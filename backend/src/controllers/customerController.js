'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Customer, Sale, Payment, sequelize } = require('../models');

const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(500, parseInt(query.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

/**
 * GET /customers
 */
const getAll = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search, is_active } = req.query;

    const where = { firm_id: req.firmId };
    if (is_active !== undefined) where.is_active = is_active === 'true';
    else where.is_active = true;

    if (search) {
      // Normalize Indian phone: strip +91 or 91 prefix to match numbers stored as 0XXXXXXXXXX or 10-digit
      const phoneSearch = search.replace(/^\+91/, '').replace(/^91(?=\d{10}$)/, '');
      const phoneConditions = [{ phone: { [Op.like]: `%${search}%` } }];
      if (phoneSearch !== search) phoneConditions.push({ phone: { [Op.like]: `%${phoneSearch}%` } });
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        ...phoneConditions,
        { gstin: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Customer.findAndCountAll({
      where,
      attributes: {
        include: [
          [
            literal(`(
              COALESCE((
                SELECT SUM(s.balance)
                FROM sales s
                WHERE s.customer_id = Customer.id
                  AND s.status NOT IN ('cancelled', 'returned')
              ), 0) + COALESCE(Customer.opening_balance, 0)
            )`),
            'outstanding_balance',
          ],
        ],
      },
      order: [['name', 'ASC']],
      limit,
      offset,
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
 * GET /customers/:id
 */
const getOne = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      attributes: {
        include: [
          [
            literal(`(
              COALESCE((
                SELECT SUM(s.balance)
                FROM sales s
                WHERE s.customer_id = Customer.id
                  AND s.status NOT IN ('cancelled', 'returned')
              ), 0) + COALESCE(Customer.opening_balance, 0)
            )`),
            'outstanding_balance',
          ],
          [
            literal(`(
              SELECT COALESCE(SUM(s.total), 0)
              FROM sales s
              WHERE s.customer_id = Customer.id
                AND s.status NOT IN ('cancelled')
            )`),
            'total_sales',
          ],
          [
            literal(`(
              SELECT COALESCE(SUM(p.amount), 0)
              FROM payments p
              WHERE p.customer_id = Customer.id
            )`),
            'total_paid',
          ],
        ],
      },
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    return res.status(200).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /customers
 */
const create = async (req, res, next) => {
  try {
    const customer = await Customer.create({ ...req.body, firm_id: req.firmId });
    return res.status(201).json({ success: true, message: 'Customer created.', data: customer });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /customers/:id
 */
const update = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const body = { ...req.body };
    delete body.firm_id;
    await customer.update(body);
    return res.status(200).json({ success: true, message: 'Customer updated.', data: customer });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /customers/:id (soft delete)
 */
const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    await customer.update({ is_active: false });
    return res.status(200).json({ success: true, message: 'Customer deactivated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /customers/:id/ledger
 * Build ledger from sales + payments
 * Sale model: invoice_no, invoice_date, total, paid_amount, balance, status
 * Payment model: payment_date, amount, payment_mode, reference_no, notes
 */
const getLedger = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const { from_date, to_date } = req.query;
    const dateFilter = from_date && to_date
      ? { [Op.between]: [new Date(from_date), new Date(to_date)] }
      : undefined;

    const salesWhere = {
      firm_id: req.firmId,
      customer_id: customer.id,
      status: { [Op.notIn]: ['cancelled'] },
    };
    if (dateFilter) salesWhere.invoice_date = dateFilter;

    const sales = await Sale.findAll({
      where: salesWhere,
      attributes: ['id', 'invoice_no', 'invoice_date', 'total', 'paid_amount', 'balance', 'status'],
      order: [['invoice_date', 'ASC']],
    });

    const paymentsWhere = {
      firm_id: req.firmId,
      customer_id: customer.id,
      reference_type: 'sale',
    };
    if (dateFilter) paymentsWhere.payment_date = dateFilter;

    const payments = await Payment.findAll({
      where: paymentsWhere,
      attributes: ['id', 'payment_date', 'amount', 'payment_mode', 'reference_no', 'notes'],
      order: [['payment_date', 'ASC']],
    });

    const entries = [];

    // Opening balance entry
    const openingBal = parseFloat(customer.opening_balance || 0);
    if (openingBal !== 0) {
      entries.push({
        date: null,
        type: 'opening_balance',
        reference: 'Opening Balance',
        debit: customer.balance_type === 'debit' ? openingBal : 0,
        credit: customer.balance_type === 'credit' ? openingBal : 0,
      });
    }

    sales.forEach((s) => {
      entries.push({
        date: s.invoice_date,
        type: 'invoice',
        reference: s.invoice_no,
        debit: parseFloat(s.total || 0),
        credit: 0,
        sale_id: s.id,
      });
    });

    payments.forEach((p) => {
      entries.push({
        date: p.payment_date,
        type: 'payment',
        reference: p.reference_no || `PAY-${p.id}`,
        debit: 0,
        credit: parseFloat(p.amount || 0),
        payment_id: p.id,
      });
    });

    // Sort by date (null opening balance first)
    entries.sort((a, b) => {
      if (!a.date) return -1;
      if (!b.date) return 1;
      return new Date(a.date) - new Date(b.date);
    });

    // Running balance
    let balance = 0;
    entries.forEach((e) => {
      balance += e.debit - e.credit;
      e.balance = parseFloat(balance.toFixed(2));
    });

    return res.status(200).json({
      success: true,
      data: { customer, ledger: entries, closing_balance: balance },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /customers/outstanding
 * Customers where sum of sale balances > 0
 */
const getOutstanding = async (req, res, next) => {
  try {
    // Aggregate sale balances per customer
    const result = await Sale.findAll({
      where: {
        firm_id: req.firmId,
        status: 'confirmed',
        payment_status: { [Op.in]: ['unpaid', 'partial'] },
      },
      attributes: [
        'customer_id',
        [fn('SUM', col('balance')), 'total_balance'],
        [fn('COUNT', col('id')), 'invoice_count'],
      ],
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'phone', 'email'],
        required: true,
      }],
      group: ['customer_id', 'Customer.id', 'Customer.name', 'Customer.phone', 'Customer.email'],
      having: literal('SUM(`Sale`.`balance`) > 0'),
      order: [[fn('SUM', col('balance')), 'DESC']],
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /customers/bulk-import
 */
const bulkImport = async (req, res, next) => {
  try {
    const customers = req.body.customers;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ success: false, message: 'customers array is required.' });
    }
    const toCreate = customers.map((c) => ({ ...c, firm_id: req.firmId }));
    const created = await Customer.bulkCreate(toCreate, { ignoreDuplicates: true });
    return res.status(201).json({
      success: true,
      message: `${created.length} customers imported.`,
      data: { imported: created.length },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, delete: deleteCustomer, getLedger, getOutstanding, bulkImport };
