'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Sale, Purchase, Customer, Supplier, Expense, FixedAsset, Payment, sequelize } = require('../models');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

/**
 * GET /accounting/ledger
 * Sale uses: total, balance, invoice_date
 * Purchase uses: total, balance, bill_date
 * Expense uses: amount, expense_date
 */
const getLedger = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    const salesWhere = { firm_id: req.firmId, status: { [Op.notIn]: ['cancelled', 'draft'] } };
    const purchasesWhere = { firm_id: req.firmId, status: { [Op.notIn]: ['cancelled', 'draft'] } };
    const expenseWhere = { firm_id: req.firmId };

    if (from_date && to_date) {
      salesWhere.invoice_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
      purchasesWhere.bill_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
      expenseWhere.expense_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
    }

    const [salesEntries, purchaseEntries, expenseEntries] = await Promise.all([
      Sale.findAll({
        where: salesWhere,
        attributes: ['id', 'invoice_no', 'invoice_date', 'total', 'paid_amount', 'balance', 'customer_name'],
        order: [['invoice_date', 'ASC']],
      }),
      Purchase.findAll({
        where: purchasesWhere,
        attributes: ['id', 'bill_no', 'bill_date', 'total', 'paid_amount', 'balance', 'supplier_name'],
        order: [['bill_date', 'ASC']],
      }),
      Expense.findAll({ where: expenseWhere, order: [['expense_date', 'ASC']] }),
    ]);

    const ledger = [];

    salesEntries.forEach((s) => {
      ledger.push({
        date: s.invoice_date,
        type: 'sale',
        reference: s.invoice_no,
        party: s.customer_name || 'Walk-in',
        debit: parseFloat(s.total || 0),
        credit: 0,
        id: s.id,
      });
    });

    purchaseEntries.forEach((p) => {
      ledger.push({
        date: p.bill_date,
        type: 'purchase',
        reference: p.bill_no,
        party: p.supplier_name || 'Unknown',
        debit: 0,
        credit: parseFloat(p.total || 0),
        id: p.id,
      });
    });

    expenseEntries.forEach((e) => {
      ledger.push({
        date: e.expense_date,
        type: 'expense',
        reference: e.reference_no || `EXP-${e.id}`,
        party: e.vendor || 'Expense',
        debit: 0,
        credit: parseFloat(e.amount || 0),
        id: e.id,
      });
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    ledger.forEach((e) => {
      balance += e.debit - e.credit;
      e.balance = parseFloat(balance.toFixed(2));
    });

    return res.status(200).json({ success: true, data: ledger, closing_balance: balance });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /accounting/receivables
 */
const getReceivables = async (req, res, next) => {
  try {
    const result = await Sale.findAll({
      where: {
        firm_id: req.firmId,
        status: { [Op.notIn]: ['cancelled', 'draft'] },
        balance:  { [Op.gt]: 0 },
      },
      attributes: [
        'customer_id', 'customer_name',
        [fn('SUM', col('Sale.balance')),  'total_balance'],
        [fn('COUNT', col('Sale.id')),     'invoice_count'],
      ],
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'phone', 'email'],
        required: false,
      }],
      group: [
        literal('`Sale`.`customer_id`'),
        literal('`Sale`.`customer_name`'),
        literal('`customer`.`id`'),
        literal('`customer`.`name`'),
        literal('`customer`.`phone`'),
        literal('`customer`.`email`'),
      ],
      order: [[fn('SUM', col('Sale.balance')), 'DESC']],
      subQuery: false,
    });

    const total = result.reduce((s, r) => s + parseFloat(r.dataValues.total_balance || 0), 0);
    return res.status(200).json({ success: true, data: result, total_receivables: parseFloat(total.toFixed(2)) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /accounting/payables
 */
const getPayables = async (req, res, next) => {
  try {
    const result = await Purchase.findAll({
      where: {
        firm_id: req.firmId,
        status: { [Op.in]: ['received', 'confirmed'] },
        payment_status: { [Op.in]: ['unpaid', 'partial'] },
      },
      attributes: [
        'supplier_id', 'supplier_name',
        [fn('SUM', col('balance')), 'total_balance'],
        [fn('COUNT', col('id')), 'invoice_count'],
      ],
      include: [{
        model: Supplier,
        as: 'Supplier',
        attributes: ['id', 'name', 'phone', 'email'],
      }],
      group: ['supplier_id', 'supplier_name', 'Supplier.id', 'Supplier.name', 'Supplier.phone', 'Supplier.email'],
      having: literal('SUM(`Purchase`.`balance`) > 0'),
      order: [[fn('SUM', col('balance')), 'DESC']],
    });

    const total = result.reduce((s, r) => s + parseFloat(r.dataValues.total_balance || 0), 0);
    return res.status(200).json({ success: true, data: result, total_payables: parseFloat(total.toFixed(2)) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /accounting/profit-loss
 */
const getProfitLoss = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ success: false, message: 'from_date and to_date are required.' });

    const [salesResult, purchaseResult, expenseResult] = await Promise.all([
      Sale.findOne({
        where: {
          firm_id: req.firmId,
          status: 'confirmed',
          invoice_date: { [Op.between]: [new Date(from_date), new Date(to_date)] },
        },
        attributes: [
          [fn('SUM', col('total')), 'revenue'],
          [fn('SUM', col('cgst')), 'cgst'],
          [fn('SUM', col('sgst')), 'sgst'],
          [fn('SUM', col('igst')), 'igst'],
        ],
        raw: true,
      }),
      Purchase.findOne({
        where: {
          firm_id: req.firmId,
          status: { [Op.in]: ['received', 'confirmed'] },
          bill_date: { [Op.between]: [new Date(from_date), new Date(to_date)] },
        },
        attributes: [[fn('SUM', col('total')), 'total']],
        raw: true,
      }),
      Expense.findOne({
        where: {
          firm_id: req.firmId,
          expense_date: { [Op.between]: [new Date(from_date), new Date(to_date)] },
        },
        attributes: [[fn('SUM', col('amount')), 'total']],
        raw: true,
      }),
    ]);

    const revenue = parseFloat(salesResult?.revenue || 0);
    const salesTax = parseFloat(salesResult?.cgst || 0) + parseFloat(salesResult?.sgst || 0) + parseFloat(salesResult?.igst || 0);
    const cogs = parseFloat(purchaseResult?.total || 0);
    const expenses = parseFloat(expenseResult?.total || 0);

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    return res.status(200).json({
      success: true,
      data: {
        period: { from_date, to_date },
        revenue,
        sales_tax: salesTax,
        cogs,
        gross_profit: parseFloat(grossProfit.toFixed(2)),
        expenses,
        net_profit: parseFloat(netProfit.toFixed(2)),
        profit_margin: revenue > 0 ? parseFloat(((netProfit / revenue) * 100).toFixed(2)) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /accounting/balance-sheet
 */
const getBalanceSheet = async (req, res, next) => {
  try {
    const firmId = req.firmId;

    const [receivablesResult, payablesResult, assetsResult] = await Promise.all([
      Sale.findOne({
        where: { firm_id: firmId, payment_status: { [Op.in]: ['unpaid', 'partial'] } },
        attributes: [[fn('SUM', col('balance')), 'total']],
        raw: true,
      }),
      Purchase.findOne({
        where: { firm_id: firmId, payment_status: { [Op.in]: ['unpaid', 'partial'] } },
        attributes: [[fn('SUM', col('balance')), 'total']],
        raw: true,
      }),
      FixedAsset ? FixedAsset.findOne({
        where: { firm_id: firmId },
        attributes: [[fn('SUM', col('current_value')), 'total']],
        raw: true,
      }) : Promise.resolve({ total: 0 }),
    ]);

    const receivables = parseFloat(receivablesResult?.total || 0);
    const payables = parseFloat(payablesResult?.total || 0);
    const fixedAssets = parseFloat(assetsResult?.total || 0);

    return res.status(200).json({
      success: true,
      data: {
        assets: {
          current_assets: { receivables },
          fixed_assets: { total: fixedAssets },
          total_assets: parseFloat((receivables + fixedAssets).toFixed(2)),
        },
        liabilities: {
          current_liabilities: { payables },
          total_liabilities: parseFloat(payables.toFixed(2)),
        },
        equity: parseFloat((receivables + fixedAssets - payables).toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /accounting/expenses
 */
const getExpenses = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { from_date, to_date, category_id } = req.query;

    const where = { firm_id: req.firmId };
    if (from_date && to_date) where.expense_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
    if (category_id) where.category_id = category_id;

    const { count, rows } = await Expense.findAndCountAll({
      where,
      order: [['expense_date', 'DESC']],
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
 * POST /accounting/expenses
 */
const createExpense = async (req, res, next) => {
  try {
    const expense = await Expense.create({ ...req.body, firm_id: req.firmId, created_by: req.userId });
    return res.status(201).json({ success: true, message: 'Expense created.', data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /accounting/expenses/:id
 */
const updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    await expense.update(req.body);
    return res.status(200).json({ success: true, message: 'Expense updated.', data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /accounting/expenses/:id
 */
const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    await expense.destroy();
    return res.status(200).json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /accounting/fixed-assets
 */
const getFixedAssets = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { count, rows } = await FixedAsset.findAndCountAll({
      where: { firm_id: req.firmId },
      order: [['createdAt', 'DESC']],
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
 * POST /accounting/fixed-assets
 */
const createFixedAsset = async (req, res, next) => {
  try {
    const asset = await FixedAsset.create({ ...req.body, firm_id: req.firmId, created_by: req.userId });
    return res.status(201).json({ success: true, message: 'Fixed asset created.', data: asset });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /accounting/fixed-assets/:id
 */
const updateFixedAsset = async (req, res, next) => {
  try {
    const asset = await FixedAsset.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!asset) return res.status(404).json({ success: false, message: 'Fixed asset not found.' });
    await asset.update(req.body);
    return res.status(200).json({ success: true, message: 'Fixed asset updated.', data: asset });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLedger, getReceivables, getPayables, getProfitLoss, getBalanceSheet,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getFixedAssets, createFixedAsset, updateFixedAsset,
};
