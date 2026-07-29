'use strict';

const express = require('express');
const router = express.Router();
const toolsController = require('../controllers/toolsController');

router.get('/barcode', toolsController.generateBarcode);
router.get('/qr', toolsController.generateQR);
router.post('/calculate-gst', toolsController.calculateGST);
router.get('/invoice-pdf/:saleId', toolsController.generateInvoicePDF);

module.exports = router;
