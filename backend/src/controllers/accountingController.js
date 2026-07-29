'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Sale, Purchase, Customer, Supplier, Expense, ExpenseCategory, FixedAsset, Payment, sequelize } = require('../models');

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
    // Fetch raw sales with balance, then group in JS to avoid MySQL GROUP BY + JOIN ambiguity
    const sales = await Sale.findAll({
      where: {
        firm_id: req.firmId,
        status: { [Op.notIn]: ['cancelled', 'draft'] },
        balance: { [Op.gt]: 0 },
      },
      attributes: ['id', 'customer_id', 'customer_name', 'balance'],
      raw: true,
    });

    // Group by customer_id (or customer_name for walk-in)
    const map = {};
    for (const s of sales) {
      const key = s.customer_id || `name:${s.customer_name}`;
      if (!map[key]) {
        map[key] = {
          customer_id: s.customer_id,
          customer_name: s.customer_name || 'Walk-in',
          total_balance: 0,
          invoice_count: 0,
        };
      }
      map[key].total_balance += parseFloat(s.balance || 0);
      map[key].invoice_count += 1;
    }

    // Fetch customer details for known customer_ids
    const customerIds = [...new Set(sales.map((s) => s.customer_id).filter(Boolean))];
    const customers = customerIds.length
      ? await Customer.findAll({ where: { id: customerIds }, attributes: ['id', 'name', 'phone', 'email'], raw: true })
      : [];
    const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));

    const result = Object.values(map)
      .map((r) => ({
        ...r,
        total_balance: parseFloat(r.total_balance.toFixed(2)),
        customer: r.customer_id ? (custMap[r.customer_id] || null) : null,
      }))
      .sort((a, b) => b.total_balance - a.total_balance);

    const total = result.reduce((s, r) => s + r.total_balance, 0);
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
    const from_date = req.query.from_date || req.query.start_date;
    const to_date = req.query.to_date || req.query.end_date;
    if (!from_date || !to_date) return res.status(400).json({ success: false, message: 'from_date and to_date are required.' });

    const periodDays = (new Date(to_date) - new Date(from_date)) / (1000 * 60 * 60 * 24) + 1;

    const [salesResult, purchaseResult, expenseResult, fixedAssets] = await Promise.all([
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
      FixedAsset.findAll({
        where: { firm_id: req.firmId, is_active: true, depreciation_rate: { [Op.gt]: 0 } },
        attributes: ['purchase_price', 'current_value', 'depreciation_rate', 'depreciation_method'],
        raw: true,
      }),
    ]);

    // Calculate period depreciation for each fixed asset
    const periodDepreciation = fixedAssets.reduce((sum, asset) => {
      const price = parseFloat(asset.purchase_price || 0);
      const rate = parseFloat(asset.depreciation_rate || 0);
      const currentVal = parseFloat(asset.current_value ?? price);
      if (price <= 0 || rate <= 0 || currentVal <= 0) return sum;
      const annualDep = price * (rate / 100);
      const periodDep = annualDep * (periodDays / 365);
      return sum + Math.min(periodDep, currentVal);
    }, 0);

    const revenue = parseFloat(salesResult?.revenue || 0);
    const salesTax = parseFloat(salesResult?.cgst || 0) + parseFloat(salesResult?.sgst || 0) + parseFloat(salesResult?.igst || 0);
    const cogs = parseFloat(purchaseResult?.total || 0);
    const expenses = parseFloat(expenseResult?.total || 0);
    const depreciation = parseFloat(periodDepreciation.toFixed(2));

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses - depreciation;

    const result = {
      period: { from_date, to_date },
      revenue,
      total_sales: revenue,
      sales_tax: salesTax,
      cogs,
      cost_of_goods: cogs,
      gross_profit: parseFloat(grossProfit.toFixed(2)),
      expenses,
      total_expenses: expenses,
      depreciation,
      net_profit: parseFloat(netProfit.toFixed(2)),
      profit_margin: revenue > 0 ? parseFloat(((netProfit / revenue) * 100).toFixed(2)) : 0,
    };
    return res.status(200).json({ success: true, ...result, data: result });
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
    const { Product } = require('../models');
    const asOf = req.query.as_of ? new Date(req.query.as_of) : new Date();
    asOf.setHours(23, 59, 59, 999);

    const [receivablesResult, payablesResult, inventoryResult, fixedAssetRows] = await Promise.all([
      Sale.findOne({
        where: { firm_id: firmId, status: { [Op.notIn]: ['cancelled', 'draft'] }, payment_status: { [Op.in]: ['unpaid', 'partial'] } },
        attributes: [[fn('SUM', col('balance')), 'total']],
        raw: true,
      }),
      Purchase.findOne({
        where: { firm_id: firmId, status: { [Op.notIn]: ['cancelled', 'draft'] }, payment_status: { [Op.in]: ['unpaid', 'partial'] } },
        attributes: [[fn('SUM', col('balance')), 'total']],
        raw: true,
      }),
      Product ? Product.findOne({
        where: { firm_id: firmId, is_active: true },
        attributes: [[fn('SUM', literal('`stock` * `purchase_price`')), 'total']],
        raw: true,
      }) : Promise.resolve({ total: 0 }),
      FixedAsset.findAll({
        where: { firm_id: firmId, is_active: true },
        attributes: ['id', 'name', 'asset_type', 'purchase_price', 'current_value', 'depreciation_rate', 'purchase_date'],
        raw: true,
      }),
    ]);

    // Calculate accumulated depreciation for each asset as of asOf date
    const fixedAssetSchedule = fixedAssetRows.map((a) => {
      const cost = parseFloat(a.purchase_price || 0);
      const rate = parseFloat(a.depreciation_rate || 0);
      let accumDep = 0;
      if (cost > 0 && rate > 0 && a.purchase_date) {
        const yearsElapsed = Math.max(0, (asOf - new Date(a.purchase_date)) / (365.25 * 24 * 60 * 60 * 1000));
        accumDep = Math.min(cost, cost * (rate / 100) * yearsElapsed);
      }
      const netValue = Math.max(0, cost - accumDep);
      return {
        name: a.name,
        category: a.asset_type || '',
        cost: parseFloat(cost.toFixed(2)),
        accumulated_depreciation: parseFloat(accumDep.toFixed(2)),
        net_value: parseFloat(netValue.toFixed(2)),
      };
    });

    const totalFixedAssetCost = fixedAssetSchedule.reduce((s, a) => s + a.cost, 0);
    const totalAccumDep = fixedAssetSchedule.reduce((s, a) => s + a.accumulated_depreciation, 0);
    const totalNetFixedAssets = fixedAssetSchedule.reduce((s, a) => s + a.net_value, 0);
    const receivables = parseFloat(receivablesResult?.total || 0);
    const payables = parseFloat(payablesResult?.total || 0);
    const inventory = parseFloat(inventoryResult?.total || 0);

    const totalCurrentAssets = receivables + inventory;
    const totalAssets = totalNetFixedAssets + totalCurrentAssets;
    const totalLiabilities = payables;
    const equity = totalAssets - totalLiabilities;

    return res.status(200).json({
      success: true,
      data: {
        as_of: req.query.as_of || new Date().toISOString().split('T')[0],
        fixed_assets: {
          schedule: fixedAssetSchedule,
          total_cost: parseFloat(totalFixedAssetCost.toFixed(2)),
          total_accumulated_depreciation: parseFloat(totalAccumDep.toFixed(2)),
          total_net_value: parseFloat(totalNetFixedAssets.toFixed(2)),
        },
        current_assets: { trade_receivables: receivables, inventory },
        total_current_assets: parseFloat(totalCurrentAssets.toFixed(2)),
        total_assets: parseFloat(totalAssets.toFixed(2)),
        current_liabilities: { trade_payables: payables },
        total_liabilities: parseFloat(totalLiabilities.toFixed(2)),
        equity: parseFloat(equity.toFixed(2)),
        total_liabilities_equity: parseFloat((totalLiabilities + equity).toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Map DB expense row to frontend-friendly shape
const formatExpense = (e, categoryName) => ({
  id: e.id,
  date: e.expense_date,
  description: e.title,
  category: categoryName || e.ExpenseCategory?.name || e.category_id || '',
  amount: e.amount,
  payment_mode: e.payment_mode,
  notes: e.notes,
  reference_no: e.reference_no,
  created_at: e.createdAt,
});

/**
 * GET /accounting/expenses
 */
const getExpenses = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { from_date, to_date, start_date, end_date, category_id, search } = req.query;

    const where = { firm_id: req.firmId };
    const fd = from_date || start_date;
    const td = to_date || end_date;
    if (fd && td) where.expense_date = { [Op.between]: [new Date(fd), new Date(td)] };
    if (category_id) where.category_id = category_id;
    if (search) where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { notes: { [Op.like]: `%${search}%` } },
    ];

    const { count, rows } = await Expense.findAndCountAll({
      where,
      include: [{ model: ExpenseCategory, as: 'ExpenseCategory', attributes: ['id', 'name'], required: false }],
      order: [['expense_date', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: rows.map((e) => formatExpense(e)),
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
      total_amount: rows.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    });
  } catch (err) {
    next(err);
  }
};

// Map frontend body → DB fields, resolving category string to category_id
const mapExpenseBody = async (body, firmId) => {
  const { date, description, category, amount, payment_mode, notes, reference_no } = body;
  let category_id = body.category_id || null;
  let categoryName = category || null;
  if (category && !category_id) {
    const [cat] = await ExpenseCategory.findOrCreate({
      where: { firm_id: firmId, name: category },
      defaults: { firm_id: firmId, name: category },
    });
    category_id = cat.id;
  }
  return {
    title: description || body.title || category || 'Expense',
    expense_date: date || body.expense_date,
    amount,
    payment_mode: payment_mode || 'cash',
    category_id,
    notes: notes || null,
    reference_no: reference_no || null,
    _categoryName: categoryName,
  };
};

/**
 * POST /accounting/expenses
 */
const createExpense = async (req, res, next) => {
  try {
    const mapped = await mapExpenseBody(req.body, req.firmId);
    const { _categoryName, ...fields } = mapped;
    const expense = await Expense.create({ ...fields, firm_id: req.firmId, created_by: req.userId });
    return res.status(201).json({ success: true, message: 'Expense created.', data: formatExpense(expense, _categoryName) });
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
    const mapped = await mapExpenseBody(req.body, req.firmId);
    const { _categoryName, ...fields } = mapped;
    await expense.update(fields);
    return res.status(200).json({ success: true, message: 'Expense updated.', data: formatExpense(expense, _categoryName) });
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

// Map DB fixed asset row → frontend-friendly shape
const formatAsset = (a) => {
  const purchaseCost = parseFloat(a.purchase_price || 0);
  const currentValue = parseFloat(a.current_value ?? purchaseCost);
  const accumulatedDepreciation = Math.max(0, purchaseCost - currentValue);
  return {
    id: a.id,
    name: a.name,
    category: a.asset_type || '',
    purchase_date: a.purchase_date,
    purchase_cost: purchaseCost,
    current_value: currentValue,
    accumulated_depreciation: accumulatedDepreciation,
    net_value: currentValue,
    depreciation_rate: a.depreciation_rate,
    depreciation_method: a.depreciation_method,
    useful_life_years: a.depreciation_rate > 0 ? Math.round(100 / parseFloat(a.depreciation_rate)) : null,
    location: a.location,
    serial_no: a.serial_no,
    notes: a.notes,
    is_active: a.is_active,
  };
};

// Map frontend body → DB fields
const mapAssetBody = (body) => {
  const purchasePrice = parseFloat(body.purchase_cost || body.purchase_price || 0);
  const accDep = body.accumulated_depreciation !== '' && body.accumulated_depreciation != null
    ? parseFloat(body.accumulated_depreciation)
    : null;
  const usefulLife = parseFloat(body.useful_life_years || 0);
  const depreciation_rate = usefulLife > 0 ? parseFloat((100 / usefulLife).toFixed(2)) : parseFloat(body.depreciation_rate || 0);
  // current_value: if accumulated_depreciation given use that, else use explicit current_value, else = purchase_price
  const current_value = accDep != null
    ? Math.max(0, purchasePrice - accDep)
    : body.current_value != null ? parseFloat(body.current_value) : purchasePrice;
  return {
    name: body.name,
    asset_type: body.category || body.asset_type || null,
    purchase_date: body.purchase_date || null,
    purchase_price: purchasePrice,
    current_value,
    depreciation_rate,
    depreciation_method: body.depreciation_method || 'straight_line',
    location: body.location || null,
    serial_no: body.serial_no || null,
    notes: body.notes || null,
  };
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
    const formatted = rows.map(formatAsset);
    return res.status(200).json({
      success: true,
      data: formatted,
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
    const asset = await FixedAsset.create({ ...mapAssetBody(req.body), firm_id: req.firmId, created_by: req.userId });
    return res.status(201).json({ success: true, message: 'Fixed asset created.', data: formatAsset(asset) });
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
    await asset.update(mapAssetBody(req.body));
    return res.status(200).json({ success: true, message: 'Fixed asset updated.', data: formatAsset(asset) });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /accounting/fixed-assets/:id
 */
const deleteFixedAsset = async (req, res, next) => {
  try {
    const asset = await FixedAsset.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!asset) return res.status(404).json({ success: false, message: 'Fixed asset not found.' });
    await asset.destroy();
    return res.status(200).json({ success: true, message: 'Fixed asset deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLedger, getReceivables, getPayables, getProfitLoss, getBalanceSheet,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getFixedAssets, createFixedAsset, updateFixedAsset, deleteFixedAsset,
};
