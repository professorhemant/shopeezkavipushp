'use strict';

const { DayBookSale, DayBookBridalBooking, DayBookBridalDispatch, DayBookExpense, DayBookSecurityRefund, DayBookConfig, DayBookSnapshot, Payment } = require('../models');

const today = () => new Date().toISOString().split('T')[0];

// ─── Generic CRUD helpers ─────────────────────────────────────────
function makeHandlers(Model) {
  return {
    getAll: async (req, res, next) => {
      try {
        const date = req.query.date || today();
        const rows = await Model.findAll({ where: { date }, order: [['createdAt', 'ASC']] });
        res.json({ success: true, data: rows });
      } catch (err) { next(err); }
    },
    create: async (req, res, next) => {
      try {
        const row = await Model.create(req.body);
        res.status(201).json({ success: true, data: row });
      } catch (err) { next(err); }
    },
    update: async (req, res, next) => {
      try {
        const row = await Model.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        await row.update(req.body);
        res.json({ success: true, data: row });
      } catch (err) { next(err); }
    },
    remove: async (req, res, next) => {
      try {
        const row = await Model.findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        await row.destroy();
        res.json({ success: true });
      } catch (err) { next(err); }
    },
  };
}

// ─── Sales ───────────────────────────────────────────────────────
const salesHandlers = makeHandlers(DayBookSale);

// ─── Bridal Bookings ─────────────────────────────────────────────
const bridalBookingHandlers = makeHandlers(DayBookBridalBooking);

const checkBridalAvailability = async (req, res, next) => {
  try {
    const { set_code, function_date } = req.query;
    if (!set_code) return res.json({ success: true, data: [] });
    const { Op } = require('sequelize');

    const shiftDate = (dateStr, days) => {
      const d = new Date(dateStr);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().split('T')[0];
    };

    // Build where clause — if function_date provided, only return overlapping conflicts
    let where = { slip_no: set_code, pickup_date: { [Op.ne]: null } };
    if (function_date) {
      const wantPickup = shiftDate(function_date, -1);
      const wantReturn = shiftDate(function_date, +1);
      // Overlap: existing.pickup <= wantReturn AND existing.return >= wantPickup
      where = {
        slip_no: set_code,
        pickup_date: { [Op.ne]: null, [Op.lte]: wantReturn },
        return_date: { [Op.gte]: wantPickup },
      };
    }

    const bookings = await DayBookBridalBooking.findAll({
      where,
      attributes: ['pickup_date', 'return_date', 'function_date'],
      order: [['pickup_date', 'ASC']],
    });
    // Deduplicate ranges (multiple rows per booking due to split payment)
    const seen = new Set();
    const ranges = [];
    for (const b of bookings) {
      const key = `${b.pickup_date}_${b.return_date}`;
      if (!seen.has(key)) {
        seen.add(key);
        ranges.push({ function_date: b.function_date, pickup_date: b.pickup_date, return_date: b.return_date });
      }
    }
    return res.json({ success: true, data: ranges });
  } catch (err) { next(err); }
};

// ─── Bridal Dispatch ─────────────────────────────────────────────
const bridalDispatchHandlers = makeHandlers(DayBookBridalDispatch);

// ─── Security Refunds ────────────────────────────────────────────
const securityRefundHandlers = makeHandlers(DayBookSecurityRefund);

// ─── Expenses ────────────────────────────────────────────────────
const getExpenses = async (req, res, next) => {
  try {
    const date = req.query.date || today();
    const rows = await DayBookExpense.findAll({ where: { date }, order: [['createdAt', 'ASC']] });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
const createExpense = async (req, res, next) => {
  try {
    const row = await DayBookExpense.create(req.body);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};
const updateExpense = async (req, res, next) => {
  try {
    const row = await DayBookExpense.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.update(req.body);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};
const deleteExpense = async (req, res, next) => {
  try {
    const row = await DayBookExpense.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── Config (Opening Balance) ─────────────────────────────────────
const getConfig = async (req, res, next) => {
  try {
    const date = req.query.date || today();
    const [config] = await DayBookConfig.findOrCreate({ where: { date }, defaults: { opening_balance: 0 } });
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
};
const updateConfig = async (req, res, next) => {
  try {
    const { date, opening_balance } = req.body;
    const d = date || today();
    const [config] = await DayBookConfig.findOrCreate({ where: { date: d }, defaults: { opening_balance: 0 } });
    await config.update({ opening_balance });
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
};

// ─── Summary (Total Received) ─────────────────────────────────────
// Compute the full day-book summary for a date from live data.
const computeSummary = async (date) => {
    const [salePayments, bookings, dispatches, refunds, expenses, config] = await Promise.all([
      // Use actual Payment records for sales (payment_date = date, reference_type = 'sale')
      Payment.findAll({ where: { payment_date: date, reference_type: 'sale' } }),
      DayBookBridalBooking.findAll({ where: { date } }),
      DayBookBridalDispatch.findAll({ where: { date } }),
      DayBookSecurityRefund.findAll({ where: { date } }),
      DayBookExpense.findAll({ where: { date } }),
      DayBookConfig.findOne({ where: { date } }),
    ]);

    // Sum payments: cash vs non-cash (card/upi/online all go to bank)
    const sumPayments = (rows, modeFn) => rows
      .filter(modeFn)
      .reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    const sum = (rows, mode) => rows
      .filter((r) => !mode || r.payment_mode === mode)
      .reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    const openingBalance = parseFloat(config?.opening_balance || 0);

    const salesCash   = sumPayments(salePayments, p => p.payment_mode === 'cash');
    const salesOnline = sumPayments(salePayments, p => p.payment_mode !== 'cash');
    const salesTotal  = sumPayments(salePayments, () => true);

    const received = {
      sales:    { cash: salesCash, card: sumPayments(salePayments, p => p.payment_mode === 'card'), online: sumPayments(salePayments, p => p.payment_mode !== 'cash' && p.payment_mode !== 'card'), total: salesTotal },
      bookings: { cash: sum(bookings, 'cash'), card: sum(bookings, 'card'), online: sum(bookings, 'online'), total: sum(bookings) },
      dispatch: { cash: sum(dispatches, 'cash'), card: sum(dispatches, 'card'), online: sum(dispatches, 'online'), total: sum(dispatches) },
    };

    const expenseSummary = {
      routine:   { cash: sum(expenses.filter(e => e.expense_type === 'routine'), 'cash'),   online: sum(expenses.filter(e => e.expense_type === 'routine'), 'online'),   total: sum(expenses.filter(e => e.expense_type === 'routine')) },
      incentive: { cash: sum(expenses.filter(e => e.expense_type === 'incentive'), 'cash'), online: sum(expenses.filter(e => e.expense_type === 'incentive'), 'online'), total: sum(expenses.filter(e => e.expense_type === 'incentive')) },
      salary:    { cash: sum(expenses.filter(e => e.expense_type === 'salary'), 'cash'),    online: sum(expenses.filter(e => e.expense_type === 'salary'), 'online'),    total: sum(expenses.filter(e => e.expense_type === 'salary')) },
      security_refunds: { cash: sum(refunds, 'cash'), online: sum(refunds, 'online'), total: sum(refunds) },
      total:     { cash: sum(expenses, 'cash') + sum(refunds, 'cash'), online: sum(expenses, 'online') + sum(refunds, 'online'), total: sum(expenses) + sum(refunds) },
    };

    const totalCashReceived = received.sales.cash + received.bookings.cash + received.dispatch.cash;
    const totalCardReceived = received.sales.card + received.bookings.card + received.dispatch.card;
    const totalOnlineReceived = received.sales.online + received.bookings.online + received.dispatch.online;

    return {
      date,
      opening_balance: openingBalance,
      received,
      expenses: expenseSummary,
      total_cash_received: totalCashReceived,
      total_card_received: totalCardReceived,
      total_online_received: totalOnlineReceived,
      net_cash: openingBalance + totalCashReceived - expenseSummary.total.cash,
      net_bank: totalCardReceived + totalOnlineReceived - expenseSummary.total.online,
    };
};

const getSummary = async (req, res, next) => {
  try {
    const date = req.query.date || today();
    const data = await computeSummary(date);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── Snapshots (Save Day Book) ────────────────────────────────────
// Freeze the computed summary for a date so it can be reviewed later.
const saveSnapshot = async (req, res, next) => {
  try {
    const date = req.body.date || today();
    const data = await computeSummary(date);
    const savedBy = req.user?.name || req.user?.email || null;
    const [snapshot] = await DayBookSnapshot.findOrCreate({ where: { date }, defaults: { date } });
    await snapshot.update({ data, saved_by: savedBy });
    res.status(201).json({ success: true, data: snapshot });
  } catch (err) { next(err); }
};

// One saved snapshot for a date (404 if not saved yet).
const getSnapshot = async (req, res, next) => {
  try {
    const date = req.query.date || today();
    const snapshot = await DayBookSnapshot.findOne({ where: { date } });
    if (!snapshot) return res.status(404).json({ success: false, message: 'No saved day book for this date' });
    res.json({ success: true, data: snapshot });
  } catch (err) { next(err); }
};

// List of saved days (most recent first) for the history picker.
const listSnapshots = async (req, res, next) => {
  try {
    const rows = await DayBookSnapshot.findAll({ order: [['date', 'DESC']] });
    const data = rows.map((r) => ({
      date: r.date,
      saved_by: r.saved_by,
      saved_at: r.updatedAt,
      net_cash: r.data?.net_cash ?? 0,
      net_bank: r.data?.net_bank ?? 0,
    }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

module.exports = {
  // Sales
  getSales: salesHandlers.getAll,
  createSale: salesHandlers.create,
  updateSale: salesHandlers.update,
  deleteSale: salesHandlers.remove,
  // Bridal Bookings
  getBridalBookings: bridalBookingHandlers.getAll,
  createBridalBooking: bridalBookingHandlers.create,
  updateBridalBooking: bridalBookingHandlers.update,
  deleteBridalBooking: bridalBookingHandlers.remove,
  checkBridalAvailability,
  // Bridal Dispatch
  getBridalDispatch: bridalDispatchHandlers.getAll,
  createBridalDispatch: bridalDispatchHandlers.create,
  updateBridalDispatch: bridalDispatchHandlers.update,
  deleteBridalDispatch: bridalDispatchHandlers.remove,
  // Security Refunds
  getSecurityRefunds: securityRefundHandlers.getAll,
  createSecurityRefund: securityRefundHandlers.create,
  updateSecurityRefund: securityRefundHandlers.update,
  deleteSecurityRefund: securityRefundHandlers.remove,
  // Expenses
  getExpenses, createExpense, updateExpense, deleteExpense,
  // Config
  getConfig, updateConfig,
  // Summary
  getSummary,
  // Snapshots
  saveSnapshot, getSnapshot, listSnapshots,
};
