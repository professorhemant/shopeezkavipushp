'use strict';

const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// General settings
router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);

// Firm settings
router.get('/firm', settingsController.getFirmSettings);
router.put('/firm', settingsController.updateFirmSettings);

// Invoice settings
router.get('/invoice', settingsController.getInvoiceSettings);
router.put('/invoice', settingsController.updateInvoiceSettings);

module.exports = router;
