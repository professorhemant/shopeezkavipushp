'use strict';

const express = require('express');
const router = express.Router();
const { getCustomerPoints, getCustomerHistory, getSummary, manualAdjust, backfillPoints, backfillReset } = require('../controllers/loyaltyController');

router.get('/summary',                          getSummary);
router.get('/customer/:customerId',             getCustomerPoints);
router.get('/customer/:customerId/history',     getCustomerHistory);
router.post('/adjust',                          manualAdjust);
router.post('/backfill-reset',                  backfillReset);
router.post('/backfill',                        backfillPoints);

module.exports = router;
