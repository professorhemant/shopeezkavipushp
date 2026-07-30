'use strict';

const express = require('express');
const router = express.Router();
const c = require('../controllers/bridalController');
const upload = require('../middleware/upload');

// Image upload (bridal set photo) → { url }
router.post('/upload', (req, res, next) => { req.uploadFolder = 'bridal'; next(); }, upload.single('image'), c.uploadImage);

// Bridal Inventory
const { authenticate } = require('../middleware/auth');
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
router.get('/inventory/export', authViaQuery, c.exportInventory);
router.get('/inventory', c.listInventory);
router.post('/inventory', c.createInventory);
router.post('/inventory/bulk-import', c.bulkImportInventory);
router.delete('/inventory', c.deleteAllInventory);
router.put('/inventory/bulk-update', c.bulkUpdateInventory);
router.put('/inventory/:id', c.updateInventory);
router.delete('/inventory/:id', c.deleteInventory);

// Bridal Invoices (saved)
router.get('/invoices', c.listInvoices);
router.get('/invoices/:id', c.getInvoice);
router.post('/invoices', c.createInvoice);
router.delete('/invoices/:id', c.deleteInvoice);

// Bridal Bookings
router.get('/bookings/urgent-alerts', c.getUrgentAlerts);
router.get('/bookings/availability', c.checkAvailability);
router.get('/bookings', c.listBookings);
router.post('/bookings', c.createBooking);
router.put('/bookings/:id/return', c.markReturned);
router.put('/bookings/:id', c.updateBooking);
router.delete('/bookings/:id', c.deleteBooking);

module.exports = router;
