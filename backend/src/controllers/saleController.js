'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Sale, SaleItem, Customer, Product, Payment, Firm, sequelize } = require('../models');
const { generateInvoiceNumber, generatePDF } = require('../utils/invoiceUtils');
const { calculateGST } = require('../utils/gstUtils');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

/**
 * GET /sales
 */
const getAll = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search, customer_id, status, from_date, to_date } = req.query;

    const where = { firm_id: req.firmId };
    if (customer_id) where.customer_id = customer_id;
    if (status) where.status = status;
    if (from_date && to_date) where.invoice_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
    if (search) {
      where[Op.or] = [
        { invoice_no: { [Op.like]: `%${search}%` } },
        { customer_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Sale.findAndCountAll({
      where,
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] }],
      order: [['invoice_date', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sales/:id
 */
const getOne = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [
        { model: Customer, as: 'customer' },
        { model: SaleItem, as: 'items' },
        { model: Payment, as: 'payments' },
      ],
    });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    return res.status(200).json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sales/next-invoice-no
 */
const getNextInvoiceNo = async (req, res, next) => {
  try {
    const firm = await Firm.findByPk(req.firmId);
    const counter = (parseInt(firm.invoice_counter) || 0) + 1;
    const prefix = firm.invoice_prefix || 'INV';
    const year = new Date().getFullYear();
    const invoiceNo = generateInvoiceNumber(prefix, counter, year);
    return res.status(200).json({ success: true, data: { invoice_no: invoiceNo, counter } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /sales
 * Sale model fields: total, balance, subtotal, discount_amount, cgst, sgst, igst
 * SaleItem model fields: unit_price, total, discount_amount, taxable_amount, cgst, sgst, igst
 * Product model uses: sale_price, stock
 */
const create = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const firmId = req.firmId;
    const { customer_id, invoice_date, items, discount_amount, is_interstate, notes, payment } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'items are required.' });
    }

    // Generate invoice number atomically
    const firm = await Firm.findByPk(firmId, { transaction: t, lock: true });
    const counter = (parseInt(firm.invoice_counter) || 0) + 1;
    const prefix = firm.invoice_prefix || 'INV';
    const year = new Date().getFullYear();
    const invoiceNo = generateInvoiceNumber(prefix, counter, year);
    await firm.update({ invoice_counter: counter }, { transaction: t });

    let subtotal = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findOne({ where: { id: item.product_id, firm_id: firmId }, transaction: t });
      if (!product) throw new Error(`Product ${item.product_id} not found.`);

      const qty = parseFloat(item.quantity);
      const rate = parseFloat(item.rate || item.unit_price || product.sale_price || 0);
      const itemDiscount = parseFloat(item.discount_amount || 0);
      const taxRate = parseFloat(item.tax_rate || product.tax_rate || 0);
      const isInclusive = item.is_tax_inclusive === true; // frontend always sends exclusive prices

      const baseAmount = qty * rate - itemDiscount;
      const gst = calculateGST(baseAmount, taxRate, isInclusive, is_interstate || false);

      subtotal += gst.taxableAmount;
      totalCGST += gst.cgst;
      totalSGST += gst.sgst;
      totalIGST += gst.igst;

      processedItems.push({
        product_id: product.id,
        product_name: product.name,
        hsn_code: product.hsn_code || null,
        barcode: product.barcode || null,
        quantity: qty,
        unit_price: rate,
        discount_amount: itemDiscount,
        taxable_amount: gst.taxableAmount,
        tax_rate: taxRate,
        cgst_rate: is_interstate ? 0 : taxRate / 2,
        sgst_rate: is_interstate ? 0 : taxRate / 2,
        igst_rate: is_interstate ? taxRate : 0,
        cgst: gst.cgst,
        sgst: gst.sgst,
        igst: gst.igst,
        total: gst.total,
      });

      // Deduct stock (product uses 'stock' field)
      if (product.track_inventory) {
        const newStock = parseFloat(product.stock || 0) - qty;
        if (newStock < 0) throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
        await product.update({ stock: newStock }, { transaction: t });
      }
    }

    const discountAmt = parseFloat(discount_amount || 0);
    const taxTotal = totalCGST + totalSGST + totalIGST;
    const grandTotal = subtotal + taxTotal - discountAmt;
    const paidAmount = payment ? parseFloat(payment.amount || 0) : 0;
    // directPayment = what goes to this invoice; excessPayment = clears old dues
    const directPayment = Math.min(paidAmount, grandTotal);
    const excessPayment = Math.max(0, paidAmount - grandTotal);
    const balance = Math.max(0, grandTotal - directPayment);

    // Fetch customer snapshot
    let customerName = null;
    let customerPhone = null;
    let customerGstin = null;
    let previousBalance = 0;
    if (customer_id) {
      const customer = await Customer.findByPk(customer_id, { transaction: t });
      if (customer) {
        customerName = customer.name;
        customerPhone = customer.phone;
        customerGstin = customer.gstin;
        // Outstanding = opening balance + all previous unpaid invoice balances
        const prevSalesBalance = await Sale.sum('balance', {
          where: {
            customer_id: customer.id,
            firm_id: firmId,
            status: { [Op.notIn]: ['cancelled', 'returned'] },
          },
          transaction: t,
        }) || 0;
        previousBalance = parseFloat(customer.opening_balance || 0) + parseFloat(prevSalesBalance || 0);
      }
    }

    const sale = await Sale.create({
      firm_id: firmId,
      customer_id: customer_id || null,
      customer_name: customerName || req.body.customer_name || 'Walk-in',
      customer_phone: customerPhone || null,
      customer_gstin: customerGstin || null,
      invoice_no: invoiceNo,
      invoice_date: invoice_date || new Date(),
      subtotal,
      discount_amount: discountAmt,
      taxable_amount: subtotal,
      cgst: totalCGST,
      sgst: totalSGST,
      igst: totalIGST,
      total: grandTotal,
      paid_amount: directPayment,
      balance,
      previous_balance: previousBalance,
      is_interstate: is_interstate || false,
      payment_mode: payment?.mode || 'cash',
      payment_status: directPayment >= grandTotal ? 'paid' : directPayment > 0 ? 'partial' : 'unpaid',
      status: 'confirmed',
      notes: notes || null,
      created_by: req.userId,
    }, { transaction: t });

    // Create sale items
    for (const item of processedItems) {
      await SaleItem.create({ sale_id: sale.id, ...item }, { transaction: t });
    }

    // Create payment record
    if (paidAmount > 0) {
      await Payment.create({
        firm_id: firmId,
        reference_type: 'sale',
        sale_id: sale.id,
        customer_id: customer_id || null,
        payment_date: invoice_date || new Date(),
        amount: paidAmount,
        payment_mode: payment?.mode || 'cash',
        reference_no: payment?.reference_no || null,
        bank_name: payment?.bank_name || null,
        cheque_date: payment?.cheque_date || null,
        notes: payment?.notes || null,
        created_by: req.userId,
      }, { transaction: t });
    }

    // Apply excess payment to previous balances (opening_balance + old unpaid invoices)
    if (excessPayment > 0 && customer_id && customer) {
      let remaining = excessPayment;

      // 1. Clear oldest unpaid/partial previous invoices first
      const oldSales = await Sale.findAll({
        where: {
          customer_id,
          firm_id: firmId,
          balance: { [Op.gt]: 0 },
          status: { [Op.notIn]: ['cancelled', 'returned'] },
        },
        order: [['invoice_date', 'ASC']],
        transaction: t,
      });
      for (const oldSale of oldSales) {
        if (remaining <= 0) break;
        const oldBal = parseFloat(oldSale.balance);
        const apply = Math.min(remaining, oldBal);
        const newBal = parseFloat((oldBal - apply).toFixed(2));
        await oldSale.update({
          balance: newBal,
          paid_amount: parseFloat((parseFloat(oldSale.paid_amount) + apply).toFixed(2)),
          payment_status: newBal <= 0 ? 'paid' : 'partial',
        }, { transaction: t });
        remaining -= apply;
      }

      // 2. Reduce opening_balance with any remaining excess
      if (remaining > 0) {
        const openingBal = parseFloat(customer.opening_balance || 0);
        const newOpeningBal = Math.max(0, parseFloat((openingBal - remaining).toFixed(2)));
        await customer.update({ opening_balance: newOpeningBal }, { transaction: t });
      }
    }

    await t.commit();

    const created = await Sale.findByPk(sale.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: SaleItem, as: 'items' },
      ],
    });

    return res.status(201).json({ success: true, message: 'Sale created.', data: created });
  } catch (err) {
    console.error('Sale create ERROR:', err.message, '|', err.parent?.message, '|', err.sql?.substring(0, 200));
    await t.rollback();
    next(err);
  }
};

/**
 * PUT /sales/:id  (update draft)
 */
const update = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    if (sale.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft sales can be updated.' });
    const body = { ...req.body };
    delete body.firm_id;
    delete body.invoice_no;
    await sale.update(body);
    return res.status(200).json({ success: true, message: 'Sale updated.', data: sale });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /sales/:id/cancel
 */
const cancel = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [{ model: SaleItem, as: 'items' }],
      transaction: t,
    });
    if (!sale) { await t.rollback(); return res.status(404).json({ success: false, message: 'Sale not found.' }); }
    if (sale.status === 'cancelled') { await t.rollback(); return res.status(400).json({ success: false, message: 'Sale already cancelled.' }); }

    // Restore stock
    for (const item of (sale.items || [])) {
      const product = await Product.findByPk(item.product_id, { transaction: t });
      if (product && product.track_inventory) {
        await product.update({ stock: parseFloat(product.stock || 0) + parseFloat(item.quantity) }, { transaction: t });
      }
    }

    await sale.update({ status: 'cancelled', notes: req.body.reason ? `${sale.notes || ''}\nCancelled: ${req.body.reason}` : sale.notes }, { transaction: t });
    await t.commit();
    return res.status(200).json({ success: true, message: 'Sale cancelled.' });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * POST /sales/:id/return
 * Creates a return record by marking sale as returned and restoring stock
 */
const createReturn = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [{ model: SaleItem, as: 'items' }],
      transaction: t,
    });
    if (!sale) { await t.rollback(); return res.status(404).json({ success: false, message: 'Sale not found.' }); }
    if (['cancelled', 'returned'].includes(sale.status)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: `Cannot return a ${sale.status} sale.` });
    }

    const { items = sale.items, reason } = req.body;
    let returnTotal = 0;

    for (const ri of items) {
      const saleItem = sale.items.find((i) => i.id === ri.sale_item_id || i.product_id === ri.product_id);
      if (!saleItem) continue;
      const returnQty = parseFloat(ri.quantity || saleItem.quantity);
      const itemTotal = parseFloat(saleItem.unit_price) * returnQty;
      returnTotal += itemTotal;

      // Restore stock
      const product = await Product.findByPk(saleItem.product_id, { transaction: t });
      if (product && product.track_inventory) {
        await product.update({ stock: parseFloat(product.stock || 0) + returnQty }, { transaction: t });
      }
    }

    await sale.update({
      status: 'returned',
      notes: `${sale.notes || ''}\nReturn: ${reason || 'Customer return'}`.trim(),
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({
      success: true,
      message: 'Return processed.',
      data: { sale_id: sale.id, return_amount: returnTotal, reason: reason || null },
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * POST /sales/:id/payment
 */
const addPayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const sale = await Sale.findOne({ where: { id: req.params.id, firm_id: req.firmId }, transaction: t });
    if (!sale) { await t.rollback(); return res.status(404).json({ success: false, message: 'Sale not found.' }); }

    const { amount, payment_mode, reference_no, payment_date, notes } = req.body;
    const payAmt = parseFloat(amount);
    if (!payAmt || payAmt <= 0) { await t.rollback(); return res.status(400).json({ success: false, message: 'Valid amount is required.' }); }

    const payment = await Payment.create({
      firm_id: req.firmId,
      reference_type: 'sale',
      sale_id: sale.id,
      customer_id: sale.customer_id,
      payment_date: payment_date || new Date(),
      amount: payAmt,
      payment_mode: payment_mode || 'cash',
      reference_no: reference_no || null,
      notes: notes || null,
      created_by: req.userId,
    }, { transaction: t });

    const newPaid = parseFloat(sale.paid_amount || 0) + payAmt;
    const newBalance = Math.max(0, parseFloat(sale.total) - newPaid);
    const paymentStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    await sale.update({ paid_amount: newPaid, balance: newBalance, payment_status: paymentStatus }, { transaction: t });
    await t.commit();
    return res.status(201).json({ success: true, message: 'Payment added.', data: payment });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * GET /sales/:id/pdf
 */
const generatePDFRoute = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [
        { model: Customer, as: 'customer' },
        { model: SaleItem, as: 'items' },
        { model: Payment, as: 'payments' },
      ],
    });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    const firm = await Firm.findByPk(req.firmId);
    const payment = sale.payments?.[0] || null;

    // Map model fields to PDF generator expected shape
    const saleForPDF = {
      ...sale.toJSON(),
      grand_total: sale.total,
      balance_due: sale.balance,
      previous_balance: parseFloat(sale.previous_balance || 0),
      payment_reference_no: payment?.reference_no || null,
      payment_bank_name: payment?.bank_name || null,
      payment_cheque_date: payment?.cheque_date || null,
      payment_notes: payment?.notes || null,
    };
    const itemsForPDF = (sale.items || []).map((i) => ({
      ...i.toJSON(),
      rate: i.unit_price,
      name: i.product_name,
    }));

    const pdfBuffer = await generatePDF(saleForPDF, firm, itemsForPDF);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=invoice-${sale.invoice_no}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /sales/:id  — only allowed for cancelled invoices
 */
const deleteSale = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const sale = await Sale.findOne({ where: { id: req.params.id, firm_id: req.firmId }, transaction: t });
    if (!sale) { await t.rollback(); return res.status(404).json({ success: false, message: 'Sale not found.' }); }
    if (sale.status !== 'cancelled') { await t.rollback(); return res.status(400).json({ success: false, message: 'Only cancelled invoices can be deleted.' }); }
    await SaleItem.destroy({ where: { sale_id: sale.id }, transaction: t });
    await Payment.destroy({ where: { sale_id: sale.id }, transaction: t });
    await sale.destroy({ transaction: t });
    await t.commit();
    return res.status(200).json({ success: true, message: 'Invoice deleted.' });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = {
  getAll,
  getOne,
  create,
  update,
  cancel,
  return: createReturn,
  addPayment,
  generatePDF: generatePDFRoute,
  getNextInvoiceNo,
  delete: deleteSale,
};
