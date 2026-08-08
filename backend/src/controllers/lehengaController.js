'use strict';

const { Op } = require('sequelize');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { LehengaInventory, LehengaRental, LehengaRentalInvoice, LehengaSale, sequelize } = require('../models');
const {
  publicBaseUrl, extractRowImages, resolveThumbnail, makeColKey, makeImagePicker,
} = require('../utils/excelImages');

const UPLOAD_FOLDER = 'lehenga';
const RENTAL_INVOICE_PREFIX = { booking: 'LBK', pickup: 'LPK', final: 'LFN' };
const SALE_INVOICE_PREFIX = 'LS';
const AVAILABLE_FOR = ['rental', 'sale', 'both'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v === '' || v == null ? 0 : (parseFloat(v) || 0));
const nullableNum = (v) => (v === '' || v == null ? null : (parseFloat(v) || 0));
const today = () => new Date().toISOString().split('T')[0];

const shiftDate = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
};

/**
 * Next sequential invoice number for a firm, derived from the highest existing
 * suffix rather than a row count — so deleting an invoice can never hand the
 * same number out twice.
 */
const nextInvoiceNo = async (Model, where, prefix) => {
  const rows = await Model.findAll({ where, attributes: ['invoice_no'] });
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)$/.exec(r.invoice_no || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(5, '0')}`;
};

// POST /lehenga/upload — single lehenga image (multipart field "image")
const uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  res.json({ success: true, url: `${publicBaseUrl(req)}/uploads/${UPLOAD_FOLDER}/${req.file.filename}` });
};

// ─── Lehenga Inventory ───────────────────────────────────────────────

// Normalizes the free-text availability column from imports; null when unknown.
const normalizeAvailableFor = (raw) => {
  const k = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (AVAILABLE_FOR.includes(k)) return k;
  if (['rent', 'rent_only', 'rental_only', 'only_rental'].includes(k)) return 'rental';
  if (['sell', 'sale_only', 'sell_only', 'only_sale'].includes(k)) return 'sale';
  if (['rental_and_sale', 'both_', 'all', 'any'].includes(k)) return 'both';
  return null;
};

const listInventory = async (req, res, next) => {
  try {
    const where = { firm_id: req.firmId, is_active: true };
    // ?available_for=rental returns pieces usable for rental (i.e. 'rental' + 'both')
    const av = normalizeAvailableFor(req.query.available_for);
    if (av === 'rental' || av === 'sale') where.available_for = { [Op.in]: [av, 'both'] };
    else if (av === 'both') where.available_for = 'both';
    const rows = await LehengaInventory.findAll({ where, order: [['code', 'ASC'], ['name', 'ASC']] });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const createInventory = async (req, res, next) => {
  try {
    const row = await LehengaInventory.create({ ...req.body, firm_id: req.firmId });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};

const updateInventory = async (req, res, next) => {
  try {
    const row = await LehengaInventory.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.update(req.body);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const deleteInventory = async (req, res, next) => {
  try {
    const row = await LehengaInventory.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// DELETE /lehenga/inventory[?category=] — wipe the firm's lehenga stock, or one category
const deleteAllInventory = async (req, res, next) => {
  try {
    const where = { firm_id: req.firmId };
    const category = String(req.query.category || '').trim();
    if (category && category !== 'all') where.category = category;
    const deleted = await LehengaInventory.destroy({ where });
    res.json({ success: true, deleted });
  } catch (err) { next(err); }
};

// Shared row shape used by both the CSV and the xlsx import paths.
const toInventoryRow = (it, firmId) => ({
  firm_id: firmId,
  code: it.code ? String(it.code).trim() : null,
  name: String(it.name).trim(),
  category: it.category ? String(it.category).trim() : null,
  size: it.size ? String(it.size).trim() : null,
  colour: it.colour ? String(it.colour).trim() : null,
  fabric: it.fabric ? String(it.fabric).trim() : null,
  work_type: it.work_type ? String(it.work_type).trim() : null,
  rental_price: num(it.rental_price),
  sale_price: num(it.sale_price),
  cost_price: num(it.cost_price),
  stock: it.stock != null && it.stock !== '' ? (parseInt(it.stock, 10) || 0) : 1,
  location: it.location ? String(it.location).trim() : null,
  description: it.description || null,
  available_for: normalizeAvailableFor(it.available_for) || 'both',
});

const bulkImportInventory = async (req, res, next) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required.' });
    }
    const toUpsert = items
      .filter((it) => it.name && String(it.name).trim())
      .map((it) => toInventoryRow(it, req.firmId));
    if (!toUpsert.length) {
      return res.status(400).json({ success: false, message: 'No valid rows. "name" is required for every row.' });
    }
    let created = 0, updated = 0;
    for (const it of toUpsert) {
      try {
        // Upsert by code so re-importing corrects existing rows instead of
        // creating duplicates. Rows without a code are always created.
        if (it.code) {
          const existing = await LehengaInventory.findOne({ where: { firm_id: req.firmId, code: it.code } });
          if (existing) { await existing.update(it); updated++; continue; }
        }
        await LehengaInventory.create(it);
        created++;
      } catch (err) { console.error('[lehenga bulkImport] upsert error:', err.message); }
    }
    const total = created + updated;
    res.status(201).json({
      success: true,
      message: `${total} lehengas imported (${created} new, ${updated} updated).`,
      data: { imported: total, created, updated, total: items.length },
    });
  } catch (err) { next(err); }
};

// PUT /lehenga/inventory/bulk-update — update shared fields across many items
const bulkUpdateInventory = async (req, res, next) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: 'ids array is required' });
    }
    const allowed = ['category', 'size', 'colour', 'fabric', 'work_type', 'rental_price', 'sale_price', 'cost_price', 'stock', 'location', 'available_for'];
    const patch = {};
    for (const k of allowed) {
      if (updates?.[k] !== undefined) patch[k] = updates[k];
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    const [count] = await LehengaInventory.update(patch, {
      where: { id: { [Op.in]: ids }, firm_id: req.firmId },
    });
    res.json({ success: true, updated: count });
  } catch (err) { next(err); }
};

const EXPORT_COLUMNS = [
  { header: 'Image',             key: 'img',    width: 14 },
  { header: 'Code',              key: 'code',   width: 12 },
  { header: 'Name',              key: 'name',   width: 30 },
  { header: 'Category',          key: 'cat',    width: 16 },
  { header: 'Size',              key: 'size',   width: 10 },
  { header: 'Colour',            key: 'colour', width: 14 },
  { header: 'Fabric',            key: 'fabric', width: 16 },
  { header: 'Work Type',         key: 'work',   width: 16 },
  { header: 'Rental Price (Rs)', key: 'rent',   width: 18 },
  { header: 'Sale Price (Rs)',   key: 'sale',   width: 18 },
  { header: 'Cost Price (Rs)',   key: 'cost',   width: 18 },
  { header: 'Stock',             key: 'stock',  width: 8 },
  { header: 'Available For',     key: 'avail',  width: 14 },
  { header: 'Location',          key: 'loc',    width: 18 },
  { header: 'Description',       key: 'desc',   width: 30 },
];

const exportInventory = async (req, res, next) => {
  try {
    const where = { firm_id: req.firmId, is_active: true };
    const category = String(req.query.category || '').trim();
    if (category && category !== 'all') where.category = category;
    const rows = await LehengaInventory.findAll({ where, order: [['code', 'ASC'], ['name', 'ASC']] });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Lehenga Inventory');
    ws.columns = EXPORT_COLUMNS;
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).height = 20;

    const ROW_H = 65; // row height in points — fits a thumbnail

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const excelRow = i + 2; // row 1 = header

      ws.addRow({
        img: '',
        code: r.code || '',
        name: r.name || '',
        cat: r.category || '',
        size: r.size || '',
        colour: r.colour || '',
        fabric: r.fabric || '',
        work: r.work_type || '',
        rent: parseFloat(r.rental_price) || 0,
        sale: parseFloat(r.sale_price) || 0,
        cost: parseFloat(r.cost_price) || 0,
        stock: r.stock ?? 0,
        avail: r.available_for || 'both',
        loc: r.location || '',
        desc: r.description || '',
      });
      ws.getRow(excelRow).height = ROW_H;

      if (r.image) {
        const img = await resolveThumbnail(r.image, 120, 80);
        if (img) {
          const imgId = wb.addImage({ buffer: img.buffer, extension: img.extension });
          ws.addImage(imgId, { tl: { col: 0, row: excelRow - 1 }, br: { col: 1, row: excelRow } });
        }
      }
    }

    const slug = category && category !== 'all' ? category.replace(/\s+/g, '-').toLowerCase() : 'all';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="lehenga-inventory-${slug}.xlsx"`);
    res.send(await wb.xlsx.writeBuffer());
  } catch (err) { next(err); }
};

// POST /lehenga/inventory/import-xlsx — parse rows + extract embedded images
const importXlsx = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No xlsx file uploaded' });
    const buf = req.file.buffer;

    // Pick the sheet matching the filename, else the first non-empty sheet
    const wb = XLSX.read(buf, { type: 'buffer' });
    const fileBase = (req.file.originalname || '').replace(/\.[^.]+$/, '').toUpperCase();
    const sheetName = wb.SheetNames.find(s => s.toUpperCase() === fileBase)
      || wb.SheetNames.find(s => XLSX.utils.sheet_to_json(wb.Sheets[s], { defval: '' }).length > 0)
      || wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    if (!rows.length) return res.status(400).json({ success: false, message: `No rows found in sheet "${sheetName}"` });

    const rowToUrl = await extractRowImages(buf, publicBaseUrl(req), UPLOAD_FOLDER);
    const pickImage = makeImagePicker(rowToUrl);

    const colKey = makeColKey(Object.keys(rows[0] || {}));
    const K = {
      name:         colKey('name', 'lehenga name', 'product name', 'item name', 'title'),
      code:         colKey('code', 'lehenga code', 'item code', 'sku', 'id'),
      category:     colKey('category', 'cat', 'type', 'group'),
      size:         colKey('size', 'sizes'),
      colour:       colKey('colour', 'color', 'shade'),
      fabric:       colKey('fabric', 'material', 'cloth'),
      work_type:    colKey('work_type', 'work', 'work type', 'embroidery'),
      rental_price: colKey('rental_price', 'rent', 'rental price', 'rental', 'rate'),
      sale_price:   colKey('sale_price', 'sale price', 'mrp', 'price', 'selling price'),
      cost_price:   colKey('cost_price', 'cost', 'cost price', 'purchase price'),
      stock:        colKey('stock', 'qty', 'quantity'),
      location:     colKey('location', 'box', 'box no', 'shelf', 'rack'),
      description:  colKey('description', 'desc', 'details', 'note', 'notes'),
      available_for: colKey('available_for', 'available for', 'availability', 'usage', 'for'),
    };
    const getVal = (r, key) => (key ? String(r[key] ?? '').trim() : '');

    let created = 0, updated = 0, failed = 0, imagesLinked = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const imageUrl = pickImage(i + 2); // row 1 = header
      const name = getVal(r, K.name);
      if (!name) { failed++; continue; }

      const item = {
        ...toInventoryRow({
          code: getVal(r, K.code),
          name,
          category: getVal(r, K.category),
          size: getVal(r, K.size),
          colour: getVal(r, K.colour),
          fabric: getVal(r, K.fabric),
          work_type: getVal(r, K.work_type),
          rental_price: getVal(r, K.rental_price),
          sale_price: getVal(r, K.sale_price),
          cost_price: getVal(r, K.cost_price),
          stock: K.stock ? r[K.stock] : '',
          location: getVal(r, K.location),
          description: getVal(r, K.description),
          available_for: getVal(r, K.available_for),
        }, req.firmId),
        ...(imageUrl ? { image: imageUrl } : {}),
      };

      try {
        if (item.code) {
          const existing = await LehengaInventory.findOne({ where: { firm_id: req.firmId, code: item.code } });
          if (existing) { await existing.update(item); updated++; if (imageUrl) imagesLinked++; continue; }
        }
        await LehengaInventory.create(item);
        created++;
        if (imageUrl) imagesLinked++;
      } catch (err) {
        console.error('[lehenga importXlsx] row error:', err.message);
        failed++;
      }
    }

    res.json({
      success: true,
      message: `Sheet "${sheetName}": ${created + updated} lehengas imported (${created} new, ${updated} updated)${imagesLinked ? `, ${imagesLinked} images attached` : ''}.`,
      data: { created, updated, failed, images: imagesLinked, total: rows.length, sheet: sheetName },
    });
  } catch (err) { next(err); }
};

// ─── Lehenga Rentals ─────────────────────────────────────────────────

const listRentals = async (req, res, next) => {
  try {
    const where = { firm_id: req.firmId };
    if (req.query.status) where.status = req.query.status;
    const rows = await LehengaRental.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// Money fields are normalized here so '' from the form never becomes 0 by accident.
const rentalPayload = (body) => ({
  ...body,
  lehenga_id: body.lehenga_id || null,
  rental_amount: nullableNum(body.rental_amount),
  booking_amount: nullableNum(body.booking_amount),
  security_amount: nullableNum(body.security_amount),
  discount: nullableNum(body.discount),
  damage_charges: nullableNum(body.damage_charges),
  function_date: body.function_date || null,
  booking_date: body.booking_date || null,
  pickup_date: body.pickup_date || null,
  return_date: body.return_date || null,
});

const createRental = async (req, res, next) => {
  try {
    const row = await LehengaRental.create({ ...rentalPayload(req.body), firm_id: req.firmId });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};

const updateRental = async (req, res, next) => {
  try {
    const row = await LehengaRental.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.update(rentalPayload(req.body));
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const deleteRental = async (req, res, next) => {
  try {
    const row = await LehengaRental.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// PUT /lehenga/rentals/:id/return — mark returned, which frees the piece up
const markRentalReturned = async (req, res, next) => {
  try {
    const row = await LehengaRental.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Rental not found' });
    await row.update({
      status: 'returned',
      returned_on: req.body?.returned_on || today(),
      ...(req.body?.damage_charges !== undefined ? { damage_charges: nullableNum(req.body.damage_charges) } : {}),
    });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

// GET /lehenga/rentals/availability?code=&function_date=[&exclude_id=]
// Returns the date ranges that clash — an empty array means the piece is free.
const checkAvailability = async (req, res, next) => {
  try {
    const { code, function_date, exclude_id } = req.query;
    if (!code) return res.json({ success: true, data: [] });

    const where = {
      firm_id: req.firmId,
      code,
      status: 'active',
      pickup_date: { [Op.ne]: null },
    };
    if (function_date) {
      const wantPickup = shiftDate(function_date, -1);
      const wantReturn = shiftDate(function_date, +1);
      // Overlap: existing.pickup <= wantReturn AND existing.return >= wantPickup
      where.pickup_date = { [Op.ne]: null, [Op.lte]: wantReturn };
      where.return_date = { [Op.gte]: wantPickup };
    }
    if (exclude_id) where.id = { [Op.ne]: exclude_id };

    const rentals = await LehengaRental.findAll({
      where,
      attributes: ['pickup_date', 'return_date', 'function_date', 'customer_name'],
      order: [['pickup_date', 'ASC']],
    });

    const seen = new Set();
    const ranges = [];
    for (const b of rentals) {
      const key = `${b.pickup_date}_${b.return_date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ranges.push({
        function_date: b.function_date,
        pickup_date: b.pickup_date,
        return_date: b.return_date,
        customer_name: b.customer_name,
      });
    }
    res.json({ success: true, data: ranges });
  } catch (err) { next(err); }
};

// ─── Lehenga Rental Invoices (saved) ─────────────────────────────────

const listRentalInvoices = async (req, res, next) => {
  try {
    const rows = await LehengaRentalInvoice.findAll({
      where: { firm_id: req.firmId },
      // Exclude the (potentially large) image so the list stays light; it's
      // fetched on demand by getRentalInvoice when reopening a single invoice.
      attributes: { exclude: ['lehenga_image'] },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getRentalInvoice = async (req, res, next) => {
  try {
    const row = await LehengaRentalInvoice.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const createRentalInvoice = async (req, res, next) => {
  try {
    const type = ['booking', 'pickup', 'final'].includes(req.body.type) ? req.body.type : 'booking';
    const rental_id = req.body.rental_id || null;
    const invoice_date = req.body.invoice_date || today();

    // One invoice per rental + type: if it already exists, update it in place
    // (keeping its number) instead of silently issuing a duplicate number.
    if (rental_id) {
      const existing = await LehengaRentalInvoice.findOne({ where: { firm_id: req.firmId, rental_id, type } });
      if (existing) {
        await existing.update({ ...req.body, type, rental_id, invoice_date });
        return res.json({ success: true, data: existing, updated: true });
      }
    }

    const invoice_no = await nextInvoiceNo(
      LehengaRentalInvoice,
      { firm_id: req.firmId, type },
      RENTAL_INVOICE_PREFIX[type],
    );
    const row = await LehengaRentalInvoice.create({
      ...req.body, type, invoice_no, firm_id: req.firmId, rental_id, invoice_date,
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};

const deleteRentalInvoice = async (req, res, next) => {
  try {
    const row = await LehengaRentalInvoice.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── Lehenga Sales (GST bill) ────────────────────────────────────────

/**
 * Authoritative GST maths. The client previews the same numbers, but whatever
 * it sends for the derived fields is discarded and recomputed here.
 */
const computeSaleTotals = (body) => {
  const quantity = Math.max(1, parseInt(body.quantity, 10) || 1);
  const unit_price = Math.max(0, num(body.unit_price));
  const discount = Math.max(0, num(body.discount));
  const gst_rate = body.gst_rate === '' || body.gst_rate == null ? 5 : Math.max(0, num(body.gst_rate));

  const taxable_value = round2(Math.max(0, unit_price * quantity - discount));
  // Intra-state sale: the rate splits evenly into CGST + SGST.
  const half = round2((taxable_value * gst_rate) / 200);
  const total = round2(taxable_value + half * 2);
  const amount_paid = Math.max(0, num(body.amount_paid));

  return {
    quantity, unit_price, discount, gst_rate, taxable_value,
    cgst: half, sgst: half, total, amount_paid,
    balance: round2(total - amount_paid),
  };
};

const listSales = async (req, res, next) => {
  try {
    const rows = await LehengaSale.findAll({
      where: { firm_id: req.firmId },
      // Keep the list light; the image comes back from getSale on reopen.
      attributes: { exclude: ['lehenga_image'] },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getSale = async (req, res, next) => {
  try {
    const row = await LehengaSale.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

/**
 * Move a stocked lehenga's quantity by `delta` (negative to sell, positive to
 * put back). Clamped at zero so a bad delta can never drive stock negative.
 */
const adjustStock = async (lehengaId, firmId, delta, transaction) => {
  if (!lehengaId || !delta) return;
  const item = await LehengaInventory.findOne({ where: { id: lehengaId, firm_id: firmId }, transaction });
  if (!item) return;
  await item.update({ stock: Math.max(0, (parseInt(item.stock, 10) || 0) + delta) }, { transaction });
};

const createSale = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const totals = computeSaleTotals(req.body);
    const invoice_no = await nextInvoiceNo(LehengaSale, { firm_id: req.firmId }, SALE_INVOICE_PREFIX);
    const row = await LehengaSale.create({
      ...req.body,
      ...totals,
      firm_id: req.firmId,
      invoice_no,
      lehenga_id: req.body.lehenga_id || null,
      sale_date: req.body.sale_date || today(),
      status: 'completed',
    }, { transaction: t });

    await adjustStock(row.lehenga_id, req.firmId, -totals.quantity, t);
    await t.commit();
    res.status(201).json({ success: true, data: row });
  } catch (err) { await t.rollback(); next(err); }
};

const updateSale = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const row = await LehengaSale.findOne({ where: { id: req.params.id, firm_id: req.firmId }, transaction: t });
    if (!row) { await t.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }

    const totals = computeSaleTotals({ ...row.toJSON(), ...req.body });
    const nextStatus = ['completed', 'cancelled'].includes(req.body.status) ? req.body.status : row.status;
    const nextLehengaId = req.body.lehenga_id !== undefined ? (req.body.lehenga_id || null) : row.lehenga_id;

    // Stock held by this sale before and after the edit — release the old hold,
    // take the new one, so quantity/item/cancellation changes all settle up.
    // Read from the row *before* updating it, or "before" reads back as "after".
    const prevLehengaId = row.lehenga_id;
    const heldBefore = row.status === 'completed' ? (parseInt(row.quantity, 10) || 0) : 0;
    const heldAfter = nextStatus === 'completed' ? totals.quantity : 0;

    await row.update({
      ...req.body, ...totals, status: nextStatus, lehenga_id: nextLehengaId,
    }, { transaction: t });

    if (String(prevLehengaId) === String(nextLehengaId)) {
      await adjustStock(nextLehengaId, req.firmId, heldBefore - heldAfter, t);
    } else {
      await adjustStock(prevLehengaId, req.firmId, heldBefore, t);
      await adjustStock(nextLehengaId, req.firmId, -heldAfter, t);
    }

    await t.commit();
    res.json({ success: true, data: row });
  } catch (err) { await t.rollback(); next(err); }
};

const deleteSale = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const row = await LehengaSale.findOne({ where: { id: req.params.id, firm_id: req.firmId }, transaction: t });
    if (!row) { await t.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }
    // Deleting a completed sale puts the pieces back on the shelf.
    if (row.status === 'completed') {
      await adjustStock(row.lehenga_id, req.firmId, parseInt(row.quantity, 10) || 0, t);
    }
    await row.destroy({ transaction: t });
    await t.commit();
    res.json({ success: true });
  } catch (err) { await t.rollback(); next(err); }
};

module.exports = {
  uploadImage,
  // Inventory
  listInventory,
  createInventory,
  updateInventory,
  deleteInventory,
  deleteAllInventory,
  bulkImportInventory,
  bulkUpdateInventory,
  exportInventory,
  importXlsx,
  // Rentals
  listRentals,
  createRental,
  updateRental,
  deleteRental,
  markRentalReturned,
  checkAvailability,
  // Rental invoices
  listRentalInvoices,
  getRentalInvoice,
  createRentalInvoice,
  deleteRentalInvoice,
  // Sales
  listSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
};
