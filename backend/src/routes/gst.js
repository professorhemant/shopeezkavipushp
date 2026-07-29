'use strict';

const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');

router.post('/calculate', gstController.calculateGST);
router.get('/gstr1', gstController.getGSTR1);
router.get('/hsn-codes', gstController.getHSNCodes);

// E-Invoice
router.post('/e-invoice/generate', gstController.generateEInvoice);
router.post('/e-invoice/cancel', gstController.cancelEInvoice);

// E-Way Bill
router.post('/eway-bill/generate', gstController.generateEWayBill);
router.post('/eway-bill/cancel', gstController.cancelEWayBill);

module.exports = router;
