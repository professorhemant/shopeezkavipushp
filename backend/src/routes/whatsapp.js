'use strict';

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Single message
router.post('/send', whatsappController.sendSingleMessage);

// Invoice notification (called after order placement)
router.post('/send-invoice/:sale_id', whatsappController.sendInvoiceMessage);

// Customer message history
router.get('/customer/:id/messages', whatsappController.getCustomerMessages);

// Campaigns
router.get('/campaigns', whatsappController.getCampaigns);
router.post('/campaigns', whatsappController.createCampaign);
router.post('/campaigns/:id/send', whatsappController.sendCampaign);
router.get('/campaigns/:id/stats', whatsappController.getCampaignStats);

module.exports = router;
