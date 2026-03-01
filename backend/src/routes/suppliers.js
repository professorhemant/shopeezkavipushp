'use strict';

const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

// Special routes first
router.get('/outstanding', supplierController.getOutstanding);
router.post('/bulk-import', supplierController.bulkImport);

// CRUD routes
router.get('/', supplierController.getAll);
router.post('/', supplierController.create);

router.get('/:id', supplierController.getOne);
router.put('/:id', supplierController.update);
router.delete('/:id', supplierController.delete);

// Sub-resource
router.get('/:id/ledger', supplierController.getLedger);

module.exports = router;
