'use strict';

const { Op } = require('sequelize');
const { Purchase, PurchaseItem, Supplier, Product, Payment, sequelize } = require('../models');
const { calculateGST } = require('../utils/gstUtils');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

/**
 * GET /purchases
 */
const getAll = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search, supplier_id, status, from_date, to_date } = req.query;

    const where = { firm_id: req.firmId };
    if (supplier_id) where.supplier_id = supplier_id;
    if (status) where.status = status;
    if (from_date && to_date) where.bill_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
    if (search) {
      where[Op.or] = [
        { bill_no: { [Op.like]: `%${search}%` } },
        { '$Supplier.name$': { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Purchase.findAndCountAll({
      where,
      include: [
        { model: Supplier, as: 'Supplier', attributes: ['id', 'name', 'phone', 'email'] },
      ],
      attributes: {
        include: [
          [sequelize.literal('(SELECT COUNT(*) FROM purchase_items WHERE purchase_items.purchase_id = `Purchase`.`id`)'), 'items_count'],
          [sequelize.literal('(SELECT GROUP_CONCAT(product_name SEPARATOR ", ") FROM purchase_items WHERE purchase_items.purchase_id = `Purchase`.`id`)'), 'product_names'],
        ],
      },
      order: [['bill_date', 'DESC'], ['createdAt', 'DESC']],
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
 * GET /purchases/:id
 */
const getOne = async (req, res, next) => {
  try {
    const purchase = await Purchase.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [
        { model: Supplier, as: 'Supplier' },
        { model: PurchaseItem, as: 'items' },
      ],
    });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });
    return res.status(200).json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /purchases
 */
const create = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const firmId = req.firmId;
    const { supplier_id, supplier_name, bill_no, bill_date, items, discount_amount, is_interstate, notes, payment } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'items are required.' });
    }

    let subtotal = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    const processedItems = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity || item.qty || 1);
      const rate = parseFloat(item.rate || item.unit_price || 0);
      const itemDiscount = parseFloat(item.discount_amount || 0);

      // Look up product only if product_id provided
      let product = null;
      let taxRate = parseFloat(item.tax_rate || 0);
      let isInclusive = false;

      if (item.product_id) {
        product = await Product.findOne({ where: { id: item.product_id, firm_id: firmId }, transaction: t });
        if (!product) throw new Error(`Product ${item.product_id} not found.`);
        taxRate = parseFloat(item.tax_rate ?? product.tax_rate ?? 0);
        isInclusive = product.tax_type === 'inclusive';
        // Update stock and purchase price
        if (product.track_inventory) {
          await product.update({ stock: parseFloat(product.stock || 0) + qty }, { transaction: t });
        }
        await product.update({ purchase_price: rate }, { transaction: t });
      }

      const baseAmount = qty * rate - itemDiscount;
      const gst = calculateGST(baseAmount, taxRate, isInclusive, is_interstate || false);

      subtotal += gst.taxableAmount;
      totalCGST += gst.cgst;
      totalSGST += gst.sgst;
      totalIGST += gst.igst;

      processedItems.push({
        product_id:       product ? product.id : null,
        product_name:     product ? product.name : (item.product_name || 'Item'),
        hsn_code:         product ? (product.hsn_code || null) : (item.hsn_code || null),
        quantity:         qty,
        unit_price:       rate,
        discount_amount:  itemDiscount,
        taxable_amount:   gst.taxableAmount,
        tax_rate:         taxRate,
        cgst_rate:        is_interstate ? 0 : taxRate / 2,
        sgst_rate:        is_interstate ? 0 : taxRate / 2,
        igst_rate:        is_interstate ? taxRate : 0,
        cgst:             gst.cgst,
        sgst:             gst.sgst,
        igst:             gst.igst,
        total:            gst.total,
        batch_no:         item.batch_no || null,
        expiry_date:      item.expiry_date || null,
      });
    }

    const discountAmt = parseFloat(discount_amount || 0);
    const taxTotal = totalCGST + totalSGST + totalIGST;
    const grandTotal = subtotal + taxTotal - discountAmt;
    const paidAmount = payment ? parseFloat(payment.amount || 0) : 0;
    const balance = grandTotal - paidAmount;

    const purchase = await Purchase.create({
      firm_id: firmId,
      supplier_id: supplier_id || null,
      supplier_name: supplier_name || null,
      bill_no: bill_no || `PUR-${Date.now()}`,
      bill_date: bill_date || new Date(),
      subtotal,
      discount_amount: discountAmt,
      taxable_amount: subtotal,
      cgst: totalCGST,
      sgst: totalSGST,
      igst: totalIGST,
      total: grandTotal,
      paid_amount: paidAmount,
      balance,
      is_interstate: is_interstate || false,
      payment_mode: payment?.mode || 'cash',
      payment_status: paidAmount >= grandTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
      status: 'received',
      notes: notes || null,
      created_by: req.userId,
    }, { transaction: t });

    for (const item of processedItems) {
      await PurchaseItem.create({ purchase_id: purchase.id, ...item }, { transaction: t });
    }

    if (paidAmount > 0) {
      await Payment.create({
        firm_id: firmId,
        reference_type: 'purchase',
        purchase_id: purchase.id,
        supplier_id: supplier_id || null,
        payment_date: bill_date || new Date(),
        amount: paidAmount,
        payment_mode: payment?.mode || 'cash',
        reference_no: payment?.reference_no || null,
        created_by: req.userId,
      }, { transaction: t });
    }

    await t.commit();

    const created = await Purchase.findByPk(purchase.id, {
      include: [{ model: Supplier, as: 'Supplier' }, { model: PurchaseItem, as: 'items' }],
    });

    return res.status(201).json({ success: true, message: 'Purchase created.', data: created });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * PUT /purchases/:id
 */
const update = async (req, res, next) => {
  try {
    const purchase = await Purchase.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });
    if (purchase.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cancelled purchases cannot be updated.' });
    }
    const body = { ...req.body };
    delete body.firm_id;
    await purchase.update(body);
    return res.status(200).json({ success: true, message: 'Purchase updated.', data: purchase });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /purchases/:id/cancel
 */
const cancel = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const purchase = await Purchase.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction: t,
    });
    if (!purchase) { await t.rollback(); return res.status(404).json({ success: false, message: 'Purchase not found.' }); }
    if (purchase.status === 'cancelled') { await t.rollback(); return res.status(400).json({ success: false, message: 'Already cancelled.' }); }

    // Reverse stock for received purchases
    if (purchase.status === 'received') {
      for (const item of (purchase.items || [])) {
        const product = await Product.findByPk(item.product_id, { transaction: t });
        if (product && product.track_inventory) {
          await product.update(
            { stock: Math.max(0, parseFloat(product.stock || 0) - parseFloat(item.quantity)) },
            { transaction: t }
          );
        }
      }
    }

    await purchase.update({ status: 'cancelled' }, { transaction: t });
    await t.commit();
    return res.status(200).json({ success: true, message: 'Purchase cancelled.' });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * POST /purchases/:id/payment
 */
const addPayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const purchase = await Purchase.findOne({ where: { id: req.params.id, firm_id: req.firmId }, transaction: t });
    if (!purchase) { await t.rollback(); return res.status(404).json({ success: false, message: 'Purchase not found.' }); }

    const { amount, payment_mode, reference_no, payment_date, notes } = req.body;
    const payAmt = parseFloat(amount);
    if (!payAmt || payAmt <= 0) { await t.rollback(); return res.status(400).json({ success: false, message: 'Valid amount required.' }); }

    const payment = await Payment.create({
      firm_id: req.firmId,
      reference_type: 'purchase',
      purchase_id: purchase.id,
      supplier_id: purchase.supplier_id,
      payment_date: payment_date || new Date(),
      amount: payAmt,
      payment_mode: payment_mode || 'cash',
      reference_no: reference_no || null,
      notes: notes || null,
      created_by: req.userId,
    }, { transaction: t });

    const newPaid = parseFloat(purchase.paid_amount || 0) + payAmt;
    const newBalance = Math.max(0, parseFloat(purchase.total) - newPaid);
    const paymentStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    await purchase.update({ paid_amount: newPaid, balance: newBalance, payment_status: paymentStatus }, { transaction: t });
    await t.commit();
    return res.status(201).json({ success: true, message: 'Payment added.', data: payment });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * POST /purchases/purchase-orders
 * Stored as a Purchase with status 'ordered'
 */
const createPO = async (req, res, next) => {
  try {
    const { supplier_id, items, expected_date, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items are required.' });
    }

    const po = await Purchase.create({
      firm_id: req.firmId,
      supplier_id: supplier_id || null,
      bill_no: `PO-${Date.now()}`,
      bill_date: new Date(),
      due_date: expected_date || null,
      subtotal: 0,
      total: 0,
      paid_amount: 0,
      balance: 0,
      status: 'ordered',
      payment_status: 'unpaid',
      notes: notes || null,
      created_by: req.userId,
    });

    // Store PO items
    for (const item of items) {
      await PurchaseItem.create({
        purchase_id: po.id,
        product_id: item.product_id,
        product_name: item.product_name || item.product_id,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.rate || 0),
        taxable_amount: 0,
        tax_rate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: parseFloat(item.quantity) * parseFloat(item.rate || 0),
      });
    }

    return res.status(201).json({ success: true, message: 'Purchase Order created.', data: po });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /purchases/purchase-orders/:id/receive
 * Convert ordered PO to received purchase
 */
const receivePO = async (req, res, next) => {
  try {
    const po = await Purchase.findOne({
      where: { id: req.params.id, firm_id: req.firmId, status: 'ordered' },
      include: [{ model: PurchaseItem, as: 'items' }],
    });
    if (!po) return res.status(404).json({ success: false, message: 'Purchase Order not found or already received.' });

    // Build the receive request using PO's item data + body overrides
    const receivedItems = req.body.items || (po.items || []).map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      rate: i.unit_price,
      tax_rate: i.tax_rate,
    }));

    req.body = {
      supplier_id: po.supplier_id,
      bill_no: req.body.bill_no || `BILL-${Date.now()}`,
      bill_date: req.body.bill_date || new Date(),
      items: receivedItems,
      discount_amount: req.body.discount_amount || 0,
      is_interstate: req.body.is_interstate || false,
      notes: req.body.notes || po.notes,
      payment: req.body.payment || null,
    };

    // Cancel the PO
    await po.update({ status: 'cancelled' });

    return create(req, res, next);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /purchases/:id
 */
const deletePurchase = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const purchase = await Purchase.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction: t,
    });
    if (!purchase) { await t.rollback(); return res.status(404).json({ success: false, message: 'Purchase not found.' }); }

    // Reverse stock if purchase was received
    if (purchase.status === 'received') {
      for (const item of (purchase.items || [])) {
        if (!item.product_id) continue;
        const product = await Product.findByPk(item.product_id, { transaction: t });
        if (product && product.track_inventory) {
          await product.update(
            { stock: Math.max(0, parseFloat(product.stock || 0) - parseFloat(item.quantity)) },
            { transaction: t }
          );
        }
      }
    }

    await Payment.destroy({ where: { purchase_id: purchase.id }, transaction: t });
    await PurchaseItem.destroy({ where: { purchase_id: purchase.id }, transaction: t });
    await purchase.destroy({ transaction: t });

    await t.commit();
    return res.status(200).json({ success: true, message: 'Purchase deleted.' });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, cancel, deletePurchase, addPayment, createPO, receivePO };
