'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Supplier, Purchase, Payment, sequelize } = require('../models');

const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(500, parseInt(query.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

/**
 * GET /suppliers
 */
const getAll = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search, is_active } = req.query;

    const where = { firm_id: req.firmId };
    if (is_active !== undefined) where.is_active = is_active === 'true';
    else where.is_active = true;

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { gstin: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Supplier.findAndCountAll({
      where,
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
 * GET /suppliers/:id
 */
const getOne = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    return res.status(200).json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /suppliers
 */
const create = async (req, res, next) => {
  try {
    const supplier = await Supplier.create({ ...req.body, firm_id: req.firmId });
    return res.status(201).json({ success: true, message: 'Supplier created.', data: supplier });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /suppliers/:id
 */
const update = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    const body = { ...req.body };
    delete body.firm_id;
    await supplier.update(body);
    return res.status(200).json({ success: true, message: 'Supplier updated.', data: supplier });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /suppliers/:id (soft delete)
 */
const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    await supplier.update({ is_active: false });
    return res.status(200).json({ success: true, message: 'Supplier deactivated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /suppliers/:id/ledger
 * Purchase model: bill_no, bill_date, total, paid_amount, balance
 */
const getLedger = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    const { from_date, to_date } = req.query;
    const dateFilter = from_date && to_date
      ? { [Op.between]: [new Date(from_date), new Date(to_date)] }
      : undefined;

    const purchasesWhere = {
      firm_id: req.firmId,
      supplier_id: supplier.id,
      status: { [Op.notIn]: ['cancelled'] },
    };
    if (dateFilter) purchasesWhere.bill_date = dateFilter;

    const purchases = await Purchase.findAll({
      where: purchasesWhere,
      attributes: ['id', 'bill_no', 'bill_date', 'total', 'paid_amount', 'balance', 'status'],
      order: [['bill_date', 'ASC']],
    });

    const paymentsWhere = {
      firm_id: req.firmId,
      supplier_id: supplier.id,
      reference_type: 'purchase',
    };
    if (dateFilter) paymentsWhere.payment_date = dateFilter;

    const payments = await Payment.findAll({
      where: paymentsWhere,
      attributes: ['id', 'payment_date', 'amount', 'payment_mode', 'reference_no', 'notes'],
      order: [['payment_date', 'ASC']],
    });

    const entries = [];

    // Opening balance entry
    const openingBal = parseFloat(supplier.opening_balance || 0);
    if (openingBal !== 0) {
      entries.push({
        date: null,
        type: 'opening_balance',
        reference: 'Opening Balance',
        debit: supplier.balance_type === 'debit' ? openingBal : 0,
        credit: supplier.balance_type === 'credit' ? openingBal : 0,
      });
    }

    purchases.forEach((p) => {
      entries.push({
        date: p.bill_date,
        type: 'bill',
        reference: p.bill_no,
        debit: 0,
        credit: parseFloat(p.total || 0),
        purchase_id: p.id,
      });
    });

    payments.forEach((p) => {
      entries.push({
        date: p.payment_date,
        type: 'payment',
        reference: p.reference_no || `PAY-${p.id}`,
        debit: parseFloat(p.amount || 0),
        credit: 0,
        payment_id: p.id,
      });
    });

    entries.sort((a, b) => {
      if (!a.date) return -1;
      if (!b.date) return 1;
      return new Date(a.date) - new Date(b.date);
    });

    // For supplier: credit = what we owe them, debit = what we paid
    let balance = 0;
    entries.forEach((e) => {
      balance += e.credit - e.debit;
      e.balance = parseFloat(balance.toFixed(2));
    });

    return res.status(200).json({
      success: true,
      data: { supplier, ledger: entries, closing_balance: balance },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /suppliers/outstanding
 */
const getOutstanding = async (req, res, next) => {
  try {
    const result = await Purchase.findAll({
      where: {
        firm_id: req.firmId,
        status: { [Op.in]: ['received', 'confirmed'] },
        payment_status: { [Op.in]: ['unpaid', 'partial'] },
      },
      attributes: [
        'supplier_id',
        [fn('SUM', col('balance')), 'total_balance'],
        [fn('COUNT', col('id')), 'invoice_count'],
      ],
      include: [{
        model: Supplier,
        as: 'Supplier',
        attributes: ['id', 'name', 'phone', 'email'],
        required: true,
      }],
      group: ['supplier_id', 'Supplier.id', 'Supplier.name', 'Supplier.phone', 'Supplier.email'],
      having: literal('SUM(`Purchase`.`balance`) > 0'),
      order: [[fn('SUM', col('balance')), 'DESC']],
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /suppliers/bulk-import
 */
const bulkImport = async (req, res, next) => {
  try {
    const suppliers = req.body.suppliers;
    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({ success: false, message: 'suppliers array is required.' });
    }
    const toCreate = suppliers.map((s) => ({ ...s, firm_id: req.firmId }));
    const created = await Supplier.bulkCreate(toCreate, { ignoreDuplicates: true });
    return res.status(201).json({
      success: true,
      message: `${created.length} suppliers imported.`,
      data: { imported: created.length },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, delete: deleteSupplier, getLedger, getOutstanding, bulkImport };
