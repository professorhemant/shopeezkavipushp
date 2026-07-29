'use strict';

const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.get('/stock-summary', inventoryController.getStockSummary);
router.get('/low-stock-alerts', inventoryController.getLowStockAlerts);
router.get('/expiry-alerts', inventoryController.getExpiryAlerts);
router.post('/adjust-stock', inventoryController.adjustStock);

router.get('/stock-ledger/:productId', inventoryController.getStockLedger);
router.get('/batches/:productId', inventoryController.getBatches);
router.delete('/reset-all', inventoryController.resetAllInventory);

module.exports = router;
