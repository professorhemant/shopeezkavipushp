'use strict';

const express = require('express');
const router = express.Router();
const c = require('../controllers/dashboardController');

router.get('/stats',            c.getStats);
router.get('/sales-chart',      c.getSalesChart);
router.get('/latest-invoices',  c.getLatestInvoices);
router.get('/top-customers',    c.getTopCustomers);
router.get('/best-selling',     c.getBestSelling);
router.get('/least-selling',    c.getLeastSelling);
router.get('/latest-receipts',  c.getLatestReceipts);

module.exports = router;
