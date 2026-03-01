'use strict';

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/sales', reportController.getSalesReport);
router.get('/purchases', reportController.getPurchaseReport);
router.get('/inventory', reportController.getInventoryReport);
router.get('/gst', reportController.getGSTReport);
router.get('/profit-loss', reportController.getProfitLossReport);
router.get('/top-products', reportController.getTopProducts);
router.get('/top-customers', reportController.getTopCustomers);

module.exports = router;
