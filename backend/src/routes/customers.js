'use strict';

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// Special routes first
router.get('/outstanding', customerController.getOutstanding);
router.post('/bulk-import', customerController.bulkImport);

// CRUD routes
router.get('/', customerController.getAll);
router.post('/', customerController.create);

router.get('/:id', customerController.getOne);
router.put('/:id', customerController.update);
router.delete('/:id', customerController.delete);

// Sub-resource
router.get('/:id/ledger', customerController.getLedger);

module.exports = router;
