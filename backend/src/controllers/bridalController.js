'use strict';

const { Op } = require('sequelize');
const XLSX = require('xlsx');
const unzipper = require('unzipper');
const fs = require('fs');
const path = require('path');
const { BridalInventory, BridalBooking, BridalInvoice } = require('../models');
const { UPLOAD_ROOT } = require('../middleware/upload');

const INVOICE_PREFIX = { booking: 'BK', pickup: 'PK', final: 'FN' };

// Absolute URL for an uploaded file. Prefers an explicit/Railway public host so
// the URL is https and reachable from the separate frontend origin.
const uploadUrl = (req, folder, filename) => {
  const base = process.env.BACKEND_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `${req.protocol}://${req.get('host')}`);
  return `${base}/uploads/${folder}/${filename}`;
};

// POST /bridal/upload — single bridal set image (multipart field "image")
const uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  res.json({ success: true, url: uploadUrl(req, 'bridal', req.file.filename) });
};

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

const VALID_TYPES = ['set', 'nath', 'maang_teeka', 'ring', 'matha_patti', 'sheesh_patti', 'hath_phool', 'pasa', 'borla'];

// Display-name aliases → stored value (handles CSV column values like "Bridal Set", "Maang Teeka", etc.)
const TYPE_ALIASES = {
  bridal_set: 'set',
  bridal: 'set',
  maang_teeka: 'maang_teeka',
  maang_tikka: 'maang_teeka',
  mangtika: 'maang_teeka',
  matha_patti: 'matha_patti',
  mathapatti: 'matha_patti',
  sheesh_patti: 'sheesh_patti',
  sheeshpatti: 'sheesh_patti',
  hath_phool: 'hath_phool',
  hathphool: 'hath_phool',
};

// Accepts display names ("Bridal Set", "Maang Teeka") or snake_case; returns stored key or null.
const normalizeItemType = (raw) => {
  const k = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (VALID_TYPES.includes(k)) return k;
  if (TYPE_ALIASES[k]) return TYPE_ALIASES[k];
  return null;
};

// DELETE /bridal/inventory[?type=...] — delete every inventory row for the firm,
// or just one category when ?type= is a valid item_type.
const deleteAllInventory = async (req, res, next) => {
  try {
    const where = { firm_id: req.firmId };
    const type = normalizeItemType(req.query.type);
    if (type) where.item_type = type;
    const deleted = await BridalInventory.destroy({ where });
    res.json({ success: true, deleted });
  } catch (err) { next(err); }
};

const bulkImportInventory = async (req, res, next) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required.' });
    }
    // Type applied to rows whose CSV doesn't specify a recognized item_type
    // (e.g. the category tab the user imported from).
    const defaultType = normalizeItemType(req.body.default_type) || 'set';

    const toUpsert = items
      .filter((it) => it.name && String(it.name).trim())
      .map((it) => ({
        firm_id: req.firmId,
        code: it.code ? String(it.code).trim() : null,
        name: String(it.name).trim(),
        item_type: normalizeItemType(it.item_type) || defaultType,
        category: it.category || null,
        rental_price: parseFloat(it.rental_price) || 0,
        stock: it.stock != null && it.stock !== '' ? parseInt(it.stock, 10) : 1,
        location: it.location ? String(it.location).trim() : null,
        description: it.description || null,
      }));
    if (!toUpsert.length) {
      return res.status(400).json({ success: false, message: 'No valid rows. "name" is required for every row.' });
    }
    let created = 0, updated = 0;
    for (const it of toUpsert) {
      try {
        // Upsert by code so re-importing corrects existing rows (e.g. a wrong
        // type) instead of creating duplicates. Rows without a code are created.
        if (it.code) {
          const existing = await BridalInventory.findOne({ where: { firm_id: req.firmId, code: it.code, item_type: it.item_type } });
          if (existing) { await existing.update(it); updated++; continue; }
        }
        await BridalInventory.create(it);
        created++;
      } catch (err) { console.error('[bridal bulkImport] upsert error:', err.message); }
    }
    const total = created + updated;
    res.status(201).json({
      success: true,
      message: `${total} items imported (${created} new, ${updated} updated).`,
      data: { imported: total, created, updated, total: items.length },
    });
  } catch (err) { next(err); }
};

// PUT /bridal/inventory/bulk-update — update shared fields across multiple items
const bulkUpdateInventory = async (req, res, next) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: 'ids array is required' });
    }
    const allowed = ['item_type', 'category', 'rental_price', 'stock'];
    const patch = {};
    for (const k of allowed) {
      if (updates[k] !== undefined) patch[k] = updates[k];
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    const [count] = await BridalInventory.update(patch, {
      where: { id: { [Op.in]: ids }, firm_id: req.firmId },
    });
    res.json({ success: true, updated: count });
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

    let where = { firm_id: req.firmId, set_code, pickup_date: { [Op.ne]: null }, status: 'active' };
    if (function_date) {
      const wantPickup = shiftDate(function_date, -1);
      const wantReturn = shiftDate(function_date, +1);
      // Overlap: existing.pickup <= wantReturn AND existing.return >= wantPickup
      where = {
        firm_id: req.firmId,
        set_code,
        status: 'active',
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
      // Exclude the (potentially large) image so the list stays light;
      // it's fetched on demand by getInvoice when reopening a single invoice.
      attributes: { exclude: ['set_image'] },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getInvoice = async (req, res, next) => {
  try {
    const row = await BridalInvoice.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const createInvoice = async (req, res, next) => {
  try {
    const type = ['booking', 'pickup', 'final'].includes(req.body.type) ? req.body.type : 'booking';
    const prefix = INVOICE_PREFIX[type];
    const booking_id = req.body.booking_id || null;
    const invoice_date = req.body.invoice_date || new Date().toISOString().split('T')[0];

    // One invoice per booking + type: if it already exists, update it in place
    // (keeping its number) instead of silently issuing a duplicate number.
    if (booking_id) {
      const existing = await BridalInvoice.findOne({ where: { firm_id: req.firmId, booking_id, type } });
      if (existing) {
        await existing.update({ ...req.body, type, booking_id, invoice_date });
        return res.json({ success: true, data: existing, updated: true });
      }
    }

    // Sequential per firm + type
    const count = await BridalInvoice.count({ where: { firm_id: req.firmId, type } });
    const invoice_no = `${prefix}-${String(count + 1).padStart(5, '0')}`;
    const row = await BridalInvoice.create({
      ...req.body,
      type,
      invoice_no,
      firm_id: req.firmId,
      booking_id,
      invoice_date,
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

// PUT /bridal/bookings/:id/return — mark booking as returned, frees the set
const markReturned = async (req, res, next) => {
  try {
    const row = await BridalBooking.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Booking not found' });
    await row.update({ status: 'returned' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// GET /bridal/bookings/urgent-alerts — sets due back today + overdue
const getUrgentAlerts = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const baseWhere = { firm_id: req.firmId, status: 'active', pickup_date: { [Op.ne]: null } };

    const [todayRows, overdueRows] = await Promise.all([
      BridalBooking.findAll({ where: { ...baseWhere, return_date: today }, order: [['return_date', 'ASC']] }),
      BridalBooking.findAll({ where: { ...baseWhere, return_date: { [Op.lt]: today } }, order: [['return_date', 'ASC']] }),
    ]);

    const allIds = [...todayRows, ...overdueRows].map(r => r.id);
    let secMap = {};
    if (allIds.length) {
      const invRows = await BridalInvoice.findAll({
        where: { firm_id: req.firmId, booking_id: { [Op.in]: allIds }, type: { [Op.in]: ['booking', 'pickup'] } },
        attributes: ['booking_id', 'security', 'type'],
        order: [['createdAt', 'ASC']],
      });
      for (const inv of invRows) {
        if (!secMap[inv.booking_id] || inv.type === 'pickup') {
          secMap[inv.booking_id] = parseFloat(inv.security) || 0;
        }
      }
    }

    const attach = (rows) => rows.map(r => ({ ...r.toJSON(), security: secMap[r.id] || 0 }));
    res.json({ success: true, today: attach(todayRows), overdue: attach(overdueRows) });
  } catch (err) { next(err); }
};

const TYPE_LABELS = {
  set: 'Bridal Set', nath: 'Nath', maang_teeka: 'Maang Teeka', ring: 'Ring',
  matha_patti: 'Matha Patti', sheesh_patti: 'Sheesh Patti', hath_phool: 'Hath Phool',
  pasa: 'Pasa', borla: 'Borla',
};

const exportInventory = async (req, res, next) => {
  try {
    const where = { firm_id: req.firmId, is_active: true };
    if (req.query.type && req.query.type !== 'all') where.item_type = req.query.type;
    const rows = await BridalInventory.findAll({ where, order: [['item_type', 'ASC'], ['code', 'ASC']] });

    const data = rows.map(r => ({
      Code: r.code || '',
      Name: r.name || '',
      Type: TYPE_LABELS[r.item_type] || r.item_type,
      Category: r.category || '',
      'Rental Price (Rs)': parseFloat(r.rental_price) || 0,
      Stock: r.stock ?? 0,
      Description: r.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bridal Inventory');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const typeSlug = req.query.type && req.query.type !== 'all'
      ? (TYPE_LABELS[req.query.type] || req.query.type).replace(/\s+/g, '-').toLowerCase()
      : 'all';
    const filename = `bridal-inventory-${typeSlug}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) { next(err); }
};

// POST /bridal/inventory/import-xlsx — upload xlsx file, parse rows + extract embedded images
const importXlsx = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No xlsx file uploaded' });

    const buf = req.file.buffer;

    // Parse data rows — pick the sheet matching the filename, else first non-empty sheet
    const wb = XLSX.read(buf, { type: 'buffer' });
    const fileBase = (req.file.originalname || '').replace(/\.[^.]+$/, '').toUpperCase();
    const sheetName = wb.SheetNames.find(s => s.toUpperCase() === fileBase)
      || wb.SheetNames.find(s => XLSX.utils.sheet_to_json(wb.Sheets[s], { defval: '' }).length > 0)
      || wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    if (!rows.length) return res.status(400).json({ success: false, message: `No rows found in sheet "${sheetName}"` });

    // Extract zip contents (drawings + media)
    const zipFiles = {};
    const dir = await unzipper.Open.buffer(buf);
    for (const file of dir.files) {
      if (file.path.startsWith('xl/media/') || file.path.startsWith('xl/drawings/')) {
        zipFiles[file.path] = await file.buffer();
      }
    }

    // Parse drawing XML → row (1-based) → media filename
    const rowToUrl = {};
    const drawKey = Object.keys(zipFiles).find(k => /xl\/drawings\/drawing\d+\.xml$/.test(k) && !k.includes('_rels'));
    const relsKey = Object.keys(zipFiles).find(k => /xl\/drawings\/_rels\/drawing\d+\.xml\.rels$/.test(k));

    if (drawKey && relsKey) {
      const drawXml = zipFiles[drawKey].toString('utf8');
      const relsXml = zipFiles[relsKey].toString('utf8');

      // rId → media filename
      const rIdToFile = {};
      const re = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
      let m;
      while ((m = re.exec(relsXml)) !== null) rIdToFile[m[1]] = path.basename(m[2]);

      // row → media filename
      const anchorRe = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
      let am;
      while ((am = anchorRe.exec(drawXml)) !== null) {
        const block = am[1];
        const rowM = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/m.exec(block);
        const ridM = /r:embed="(rId\d+)"/m.exec(block);
        if (rowM && ridM) {
          const excelRow = parseInt(rowM[1]) + 1; // 0-based → 1-based (row 2 = first data row)
          const mediaName = rIdToFile[ridM[1]];
          if (!mediaName) continue;
          const imgBuf = zipFiles[`xl/media/${mediaName}`];
          if (!imgBuf) continue;

          // Save image to uploads/bridal/
          const uploadDir = path.join(UPLOAD_ROOT, 'bridal');
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          const ext = path.extname(mediaName) || '.jpg';
          const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
          fs.writeFileSync(path.join(uploadDir, filename), imgBuf);

          const base = process.env.BACKEND_URL
            || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `${req.protocol}://${req.get('host')}`);
          rowToUrl[excelRow] = `${base}/uploads/bridal/${filename}`;
        }
      }
    }

    // Flexible column picker — matches any reasonable column name variant
    const colKey = (rowKeys, ...candidates) => {
      for (const c of candidates) {
        const norm = c.toLowerCase().replace(/[\s_\-\.]+/g, '');
        const hit = rowKeys.find(k => k.toLowerCase().replace(/[\s_\-\.]+/g, '') === norm);
        if (hit) return hit;
      }
      return null;
    };
    const rowKeys = Object.keys(rows[0] || {});
    const K = {
      name:         colKey(rowKeys, 'name', 'product name', 'productname', 'item name', 'itemname', 'set name', 'title'),
      code:         colKey(rowKeys, 'code', 'set code', 'item code', 'sku', 'id'),
      item_type:    colKey(rowKeys, 'item_type', 'type', 'item type', 'category type'),
      category:     colKey(rowKeys, 'category', 'cat', 'group'),
      rental_price: colKey(rowKeys, 'rental_price', 'rent', 'price', 'rental price', 'rental', 'rate'),
      stock:        colKey(rowKeys, 'stock', 'qty', 'quantity'),
      location:     colKey(rowKeys, 'location', 'box', 'box no', 'box number', 'shelf', 'rack'),
      description:  colKey(rowKeys, 'description', 'desc', 'details', 'note', 'notes'),
    };

    const getVal = (r, key) => key ? String(r[key] ?? '').trim() : '';

    // Import rows
    let created = 0, updated = 0, failed = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const excelRow = i + 2; // row 1 = header
      const imageUrl = rowToUrl[excelRow] || null;
      const name = getVal(r, K.name);
      if (!name) { failed++; continue; }

      const stockVal = K.stock ? r[K.stock] : '';
      const item = {
        firm_id: req.firmId,
        code: getVal(r, K.code) || null,
        name,
        item_type: normalizeItemType(getVal(r, K.item_type)) || 'set',
        category: getVal(r, K.category) || null,
        rental_price: parseFloat(getVal(r, K.rental_price)) || 0,
        stock: stockVal != null && stockVal !== '' ? parseInt(stockVal, 10) : 1,
        location: getVal(r, K.location) || null,
        description: getVal(r, K.description) || null,
        ...(imageUrl ? { image: imageUrl } : {}),
      };

      try {
        if (item.code) {
          const existing = await BridalInventory.findOne({ where: { firm_id: req.firmId, code: item.code } });
          if (existing) { await existing.update(item); updated++; continue; }
        }
        await BridalInventory.create(item);
        created++;
      } catch (err) {
        console.error('[importXlsx] row error:', err.message);
        failed++;
      }
    }

    const images = Object.keys(rowToUrl).length;
    res.json({
      success: true,
      message: `Sheet "${sheetName}": ${created + updated} items imported (${created} new, ${updated} updated)${images ? `, ${images} images attached` : ''}.`,
      data: { created, updated, failed, images, total: rows.length, sheet: sheetName },
    });
  } catch (err) { next(err); }
};

module.exports = {
  uploadImage,
  listInvoices,
  getInvoice,
  createInvoice,
  deleteInvoice,
  exportInventory,
  listInventory,
  createInventory,
  updateInventory,
  deleteAllInventory,
  deleteInventory,
  bulkImportInventory,
  importXlsx,
  bulkUpdateInventory,
  listBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  checkAvailability,
  markReturned,
  getUrgentAlerts,
};
