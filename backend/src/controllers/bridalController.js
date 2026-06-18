'use strict';

const { Op } = require('sequelize');
const { BridalInventory, BridalBooking, BridalInvoice } = require('../models');

const INVOICE_PREFIX = { booking: 'BK', pickup: 'PK', final: 'FN' };

const shiftDate = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
};

// ─── Bridal Inventory ────────────────────────────────────────────────

const listInventory = async (req, res, next) => {
  try {
    const where = { firm_id: req.firmId, is_active: true };
    if (req.query.type) where.item_type = req.query.type;
    const rows = await BridalInventory.findAll({ where, order: [['item_type', 'ASC'], ['code', 'ASC']] });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const createInventory = async (req, res, next) => {
  try {
    const row = await BridalInventory.create({ ...req.body, firm_id: req.firmId });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};

const updateInventory = async (req, res, next) => {
  try {
    const row = await BridalInventory.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.update(req.body);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const deleteInventory = async (req, res, next) => {
  try {
    const row = await BridalInventory.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

const VALID_TYPES = ['set', 'nath', 'maang_teeka', 'ring', 'matha_patti', 'sheesh_patti', 'hath_phool', 'pasa'];

const bulkImportInventory = async (req, res, next) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required.' });
    }
    const toCreate = items
      .filter((it) => it.name && String(it.name).trim())
      .map((it) => ({
        firm_id: req.firmId,
        code: it.code || null,
        name: String(it.name).trim(),
        item_type: VALID_TYPES.includes((it.item_type || '').trim()) ? it.item_type.trim() : 'set',
        category: it.category || null,
        rental_price: parseFloat(it.rental_price) || 0,
        stock: it.stock != null && it.stock !== '' ? parseInt(it.stock, 10) : 1,
        description: it.description || null,
      }));
    if (!toCreate.length) {
      return res.status(400).json({ success: false, message: 'No valid rows. "name" is required for every row.' });
    }
    let created = 0;
    for (const it of toCreate) {
      try { await BridalInventory.create(it); created++; }
      catch (err) { console.error('[bridal bulkImport] create error:', err.message); }
    }
    res.status(201).json({ success: true, message: `${created} items imported.`, data: { imported: created, total: items.length } });
  } catch (err) { next(err); }
};

// ─── Bridal Bookings ─────────────────────────────────────────────────

const listBookings = async (req, res, next) => {
  try {
    const rows = await BridalBooking.findAll({
      where: { firm_id: req.firmId },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const createBooking = async (req, res, next) => {
  try {
    const row = await BridalBooking.create({ ...req.body, firm_id: req.firmId });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};

const updateBooking = async (req, res, next) => {
  try {
    const row = await BridalBooking.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.update(req.body);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const deleteBooking = async (req, res, next) => {
  try {
    const row = await BridalBooking.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// GET /bridal/bookings/availability?set_code=&function_date=
const checkAvailability = async (req, res, next) => {
  try {
    const { set_code, function_date } = req.query;
    if (!set_code) return res.json({ success: true, data: [] });

    let where = { firm_id: req.firmId, set_code, pickup_date: { [Op.ne]: null } };
    if (function_date) {
      const wantPickup = shiftDate(function_date, -1);
      const wantReturn = shiftDate(function_date, +1);
      // Overlap: existing.pickup <= wantReturn AND existing.return >= wantPickup
      where = {
        firm_id: req.firmId,
        set_code,
        pickup_date: { [Op.ne]: null, [Op.lte]: wantReturn },
        return_date: { [Op.gte]: wantPickup },
      };
    }

    const bookings = await BridalBooking.findAll({
      where,
      attributes: ['pickup_date', 'return_date', 'function_date'],
      order: [['pickup_date', 'ASC']],
    });
    const seen = new Set();
    const ranges = [];
    for (const b of bookings) {
      const key = `${b.pickup_date}_${b.return_date}`;
      if (!seen.has(key)) {
        seen.add(key);
        ranges.push({ function_date: b.function_date, pickup_date: b.pickup_date, return_date: b.return_date });
      }
    }
    res.json({ success: true, data: ranges });
  } catch (err) { next(err); }
};

// ─── Bridal Invoices (saved) ─────────────────────────────────────────

const listInvoices = async (req, res, next) => {
  try {
    const rows = await BridalInvoice.findAll({
      where: { firm_id: req.firmId },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const createInvoice = async (req, res, next) => {
  try {
    const type = ['booking', 'pickup', 'final'].includes(req.body.type) ? req.body.type : 'booking';
    const prefix = INVOICE_PREFIX[type];
    // Sequential per firm + type
    const count = await BridalInvoice.count({ where: { firm_id: req.firmId, type } });
    const invoice_no = `${prefix}-${String(count + 1).padStart(5, '0')}`;
    const row = await BridalInvoice.create({
      ...req.body,
      type,
      invoice_no,
      firm_id: req.firmId,
      booking_id: req.body.booking_id || null,
      invoice_date: req.body.invoice_date || new Date().toISOString().split('T')[0],
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};

const deleteInvoice = async (req, res, next) => {
  try {
    const row = await BridalInvoice.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = {
  listInvoices,
  createInvoice,
  deleteInvoice,
  listInventory,
  createInventory,
  updateInventory,
  deleteInventory,
  bulkImportInventory,
  listBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  checkAvailability,
};
