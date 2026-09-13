'use strict';
const express = require('express');
const router = express.Router();
const { verifyWebhook, handleWebhook, getLeads, updateLead, getWebhookLog } = require('../controllers/instagramController');
const { authenticate } = require('../middleware/auth');

// Public webhook routes (called by Meta)
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// Diagnostic — no auth needed, resets on restart
router.get('/webhook-log', getWebhookLog);

// Protected leads API
router.get('/leads', authenticate, getLeads);
router.patch('/leads/:id', authenticate, updateLead);

module.exports = router;
