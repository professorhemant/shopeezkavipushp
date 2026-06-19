'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Route imports
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const productRoutes = require('./products');
const categoryRoutes = require('./categories');
const brandRoutes = require('./brands');
const unitRoutes = require('./units');
const customerRoutes = require('./customers');
const supplierRoutes = require('./suppliers');
const saleRoutes = require('./sales');
const purchaseRoutes = require('./purchases');
const inventoryRoutes = require('./inventory');
const accountingRoutes = require('./accounting');
const staffRoutes = require('./staff');
const reportRoutes = require('./reports');
const appointmentRoutes = require('./appointments');
const whatsappRoutes = require('./whatsapp');
const settingsRoutes = require('./settings');
const gstRoutes = require('./gst');
const toolsRoutes = require('./tools');
const dayBookRoutes = require('./daybook');
const promotionRoutes = require('./promotions');
const bridalRoutes = require('./bridal');
const upload = require('../middleware/upload');
const path = require('path');

// Public routes
router.use('/auth', authRoutes);

// Protected routes (require authentication)
router.use('/dashboard', authenticate, dashboardRoutes);
router.use('/products', authenticate, productRoutes);
router.use('/categories', authenticate, categoryRoutes);
router.use('/brands', authenticate, brandRoutes);
router.use('/units', authenticate, unitRoutes);
router.use('/customers', authenticate, customerRoutes);
router.use('/suppliers', authenticate, supplierRoutes);
router.use('/sales', authenticate, saleRoutes);
router.use('/purchases', authenticate, purchaseRoutes);
router.use('/inventory', authenticate, inventoryRoutes);
router.use('/accounting', authenticate, accountingRoutes);
router.use('/staff', authenticate, staffRoutes);
router.use('/reports', authenticate, reportRoutes);
router.use('/appointments', authenticate, appointmentRoutes);
router.use('/whatsapp', authenticate, whatsappRoutes);
router.use('/settings', authenticate, settingsRoutes);
router.use('/gst', authenticate, gstRoutes);
router.use('/tools', authenticate, toolsRoutes);
router.use('/daybook', authenticate, dayBookRoutes);
router.use('/promotions', authenticate, promotionRoutes);
router.use('/bridal', authenticate, bridalRoutes);

// Image upload endpoint
router.post('/upload', authenticate, (req, res, next) => {
  req.uploadFolder = 'products';
  next();
}, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/uploads/products/${req.file.filename}`;
  res.status(200).json({ success: true, url });
});

// TEMPORARY read-only diagnostic — key-gated. Remove after use.
router.get('/_diag/bridal', async (req, res) => {
  if (req.query.key !== 'kp-diag-9f3a7c') return res.status(404).json({ success: false });
  try {
    const { BridalInventory, Firm } = require('../models');
    const sequelize = require('../config/database');
    const counts = await BridalInventory.findAll({
      attributes: ['firm_id', 'item_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['firm_id', 'item_type'],
      raw: true,
    });
    const firms = await Firm.findAll({ attributes: ['id', 'name'], raw: true });
    const firmName = Object.fromEntries(firms.map((f) => [f.id, f.name]));
    const byFirm = {};
    for (const r of counts) {
      const key = firmName[r.firm_id] || r.firm_id;
      byFirm[key] = byFirm[key] || {};
      byFirm[key][r.item_type === '' || r.item_type == null ? '(blank)' : r.item_type] = Number(r.count);
    }
    // Classify every row by a keyword in its NAME, vs its stored item_type,
    // to see how many accessories are mislabeled (e.g. named "MAANG TEEKA"
    // but stored as set). Also detect duplicate codes.
    const all = await BridalInventory.findAll({ attributes: ['code', 'name', 'item_type'], raw: true });
    const KW = [
      ['maang_teeka', /MAANG\s*TEEKA/i], ['matha_patti', /MATHA\s*PATTI/i],
      ['sheesh_patti', /SHEESH\s*PATTI/i], ['hath_phool', /HATH\s*PHOOL/i],
      ['nath', /\bNATH\b/i], ['ring', /\bRING\b/i], ['pasa', /\bPASA\b/i],
      ['borla', /\bBORLA\b/i],
    ];
    const nameType = (name) => { for (const [t, re] of KW) if (re.test(name || '')) return t; return 'set/other'; };
    const mismatch = {}; // nameCategory -> { storedType: count }
    const codeSeen = {};
    let dupCodes = 0;
    for (const r of all) {
      const nt = nameType(r.name);
      mismatch[nt] = mismatch[nt] || {};
      mismatch[nt][r.item_type || '(blank)'] = (mismatch[nt][r.item_type || '(blank)'] || 0) + 1;
      if (r.code) { codeSeen[r.code] = (codeSeen[r.code] || 0) + 1; if (codeSeen[r.code] === 2) dupCodes++; }
    }
    res.json({ success: true, counts: byFirm, byNameKeyword: mismatch, totalRows: all.length, duplicateCodes: dupCodes });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// TEMPORARY one-time corrective — key-gated. Re-types accessory rows by their
// NAME and removes duplicate copies. Idempotent. Remove after use.
router.post('/_diag/fix-bridal', async (req, res) => {
  if (req.query.key !== 'kp-diag-9f3a7c') return res.status(404).json({ success: false });
  try {
    const { BridalInventory } = require('../models');
    const sequelize = require('../config/database');
    const KW = [
      ['maang_teeka', /MAANG\s*TEEKA/i], ['matha_patti', /MATHA\s*PATTI/i],
      ['sheesh_patti', /SHEESH\s*PATTI/i], ['hath_phool', /HATH\s*PHOOL/i],
      ['nath', /\bNATH\b/i], ['ring', /\bRING\b/i], ['pasa', /\bPASA\b/i],
      ['borla', /\bBORLA\b/i],
    ];
    const nameType = (name) => { for (const [t, re] of KW) if (re.test(name || '')) return t; return null; };

    const rows = await BridalInventory.findAll();
    // Group by firm + code so we can detect duplicates.
    const byKey = {};
    for (const r of rows) {
      const k = `${r.firm_id}|${(r.code || '').trim()}`;
      (byKey[k] = byKey[k] || []).push(r);
    }
    let retyped = 0, deleted = 0;
    for (const r of rows) {
      const want = nameType(r.name);
      if (!want || r.item_type === want) continue; // genuine set, or already correct
      const hasCode = r.code && r.code.trim();
      const group = hasCode ? byKey[`${r.firm_id}|${r.code.trim()}`] : [r];
      const twin = group.find((x) => x.id !== r.id && x.item_type === want);
      if (twin) { await r.destroy(); deleted++; }      // duplicate of a correct row → remove
      else { r.item_type = want; await r.save(); retyped++; } // re-type in place
    }
    const after = await BridalInventory.findAll({
      attributes: ['firm_id', 'item_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['firm_id', 'item_type'], raw: true,
    });
    res.json({ success: true, retyped, deleted, after });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running.', timestamp: new Date().toISOString() });
});

module.exports = router;
