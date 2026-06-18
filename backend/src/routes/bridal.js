'use strict';

const express = require('express');
const router = express.Router();
const c = require('../controllers/bridalController');

// Bridal Inventory
router.get('/inventory', c.listInventory);
router.post('/inventory', c.createInventory);
router.post('/inventory/bulk-import', c.bulkImportInventory);
router.put('/inventory/:id', c.updateInventory);
router.delete('/inventory/:id', c.deleteInventory);

// Bridal Invoices (saved)
router.get('/invoices', c.listInvoices);
router.post('/invoices', c.createInvoice);
router.delete('/invoices/:id', c.deleteInvoice);

// Bridal Bookings
router.get('/bookings/availability', c.checkAvailability);
router.get('/bookings', c.listBookings);
router.post('/bookings', c.createBooking);
router.put('/bookings/:id', c.updateBooking);
router.delete('/bookings/:id', c.deleteBooking);

module.exports = router;
