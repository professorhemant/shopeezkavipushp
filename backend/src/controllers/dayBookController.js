'use strict';

const { DayBookSale, DayBookBridalBooking, DayBookBridalDispatch, DayBookExpense, DayBookSecurityRefund, DayBookConfig, Payment } = require('../models');

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
const getSummary = async (req, res, next) => {
  try {
    const date = req.query.date || today();

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

    // For bridal bookings/dispatch/refunds: cash + card treated as cash-in-hand; online as bank
    const bookingCash   = sum(bookings, 'cash') + sum(bookings, 'card');
    const bookingOnline = sum(bookings, 'online');
    const dispatchCash   = sum(dispatches, 'cash') + sum(dispatches, 'card');
    const dispatchOnline = sum(dispatches, 'online');
    const refundCash   = sum(refunds, 'cash') + sum(refunds, 'card');
    const refundOnline = sum(refunds, 'online');

    const received = {
      sales:    { cash: salesCash,   online: salesOnline,   total: salesTotal },
      bookings: { cash: bookingCash, online: bookingOnline, total: bookingCash + bookingOnline },
      dispatch: { cash: dispatchCash, online: dispatchOnline, total: dispatchCash + dispatchOnline },
      refunds:  { cash: refundCash,  online: refundOnline,  total: refundCash + refundOnline },
    };

    const expenseSummary = {
      routine:   { cash: sum(expenses.filter(e => e.expense_type === 'routine'), 'cash'),   online: sum(expenses.filter(e => e.expense_type === 'routine'), 'online'),   total: sum(expenses.filter(e => e.expense_type === 'routine')) },
      incentive: { cash: sum(expenses.filter(e => e.expense_type === 'incentive'), 'cash'), online: sum(expenses.filter(e => e.expense_type === 'incentive'), 'online'), total: sum(expenses.filter(e => e.expense_type === 'incentive')) },
      salary:    { cash: sum(expenses.filter(e => e.expense_type === 'salary'), 'cash'),    online: sum(expenses.filter(e => e.expense_type === 'salary'), 'online'),    total: sum(expenses.filter(e => e.expense_type === 'salary')) },
      total:     { cash: sum(expenses, 'cash'), online: sum(expenses, 'online'), total: sum(expenses) },
    };

    const totalCashReceived = received.sales.cash + received.bookings.cash + received.dispatch.cash + received.refunds.cash;
    const totalOnlineReceived = received.sales.online + received.bookings.online + received.dispatch.online + received.refunds.online;

    res.json({
      success: true,
      data: {
        date,
        opening_balance: openingBalance,
        received,
        expenses: expenseSummary,
        total_cash_received: totalCashReceived,
        total_online_received: totalOnlineReceived,
        net_cash: openingBalance + totalCashReceived - expenseSummary.total.cash,
        net_bank: totalOnlineReceived - expenseSummary.total.online,
      },
    });
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
};
