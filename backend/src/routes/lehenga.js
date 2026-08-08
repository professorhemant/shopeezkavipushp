'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const c = require('../controllers/lehengaController');
const upload = require('../middleware/upload');

// Memory-based multer for xlsx imports (process in-memory, don't save to disk)
const xlsxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Image upload (lehenga photo) → { url }
router.post('/upload', (req, res, next) => { req.uploadFolder = 'lehenga'; next(); }, upload.single('image'), c.uploadImage);

// Lehenga Inventory
router.get('/inventory', c.listInventory);
router.post('/inventory', c.createInventory);
router.post('/inventory/bulk-import', c.bulkImportInventory);
router.post('/inventory/import-xlsx', xlsxUpload.single('xlsx'), c.importXlsx);
router.delete('/inventory', c.deleteAllInventory);
router.put('/inventory/bulk-update', c.bulkUpdateInventory);
router.put('/inventory/:id', c.updateInventory);
router.delete('/inventory/:id', c.deleteInventory);

// Rental invoices (saved) — declared before /rentals/:id so the paths can't collide
router.get('/rental-invoices', c.listRentalInvoices);
router.get('/rental-invoices/:id', c.getRentalInvoice);
router.post('/rental-invoices', c.createRentalInvoice);
router.delete('/rental-invoices/:id', c.deleteRentalInvoice);

// Lehenga Rentals
router.get('/rentals/availability', c.checkAvailability);
router.get('/rentals', c.listRentals);
router.post('/rentals', c.createRental);
router.put('/rentals/:id/return', c.markRentalReturned);
router.put('/rentals/:id', c.updateRental);
router.delete('/rentals/:id', c.deleteRental);

// Lehenga Sales (GST bill)
router.get('/sales', c.listSales);
router.get('/sales/:id', c.getSale);
router.post('/sales', c.createSale);
router.put('/sales/:id', c.updateSale);
router.delete('/sales/:id', c.deleteSale);

module.exports = router;
