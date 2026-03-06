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

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running.', timestamp: new Date().toISOString() });
});

module.exports = router;
