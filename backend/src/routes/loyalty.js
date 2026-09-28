'use strict';

const express = require('express');
const router = express.Router();
const { getCustomerPoints, getCustomerHistory, getSummary, manualAdjust } = require('../controllers/loyaltyController');

router.get('/summary',                          getSummary);
router.get('/customer/:customerId',             getCustomerPoints);
router.get('/customer/:customerId/history',     getCustomerHistory);
router.post('/adjust',                          manualAdjust);

module.exports = router;
