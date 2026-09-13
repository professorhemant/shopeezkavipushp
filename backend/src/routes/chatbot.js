'use strict';
const express = require('express');
const router = express.Router();
const { getRules, saveRules } = require('../controllers/chatbotController');

router.get('/rules', getRules);
router.post('/rules', saveRules);

module.exports = router;
