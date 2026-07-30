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
const employeeRoutes = require('./employees');
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
// Bridal inventory export — uses ?token= query param (no Bearer header available for direct downloads)
const { exportInventory } = require('../controllers/bridalController');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const { User } = require('../models');
const authViaQuery = async (req, res, next) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user || !user.is_active) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user; req.userId = user.id; req.firmId = user.firm_id;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
};
router.get('/bridal/inventory/export', authViaQuery, exportInventory);
router.use('/bridal', authenticate, bridalRoutes);
router.use('/employees', authenticate, employeeRoutes);

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

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running.', timestamp: new Date().toISOString() });
});

module.exports = router;
