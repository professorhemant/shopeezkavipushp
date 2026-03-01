'use strict';

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Special / aggregate routes first (before :id)
router.get('/low-stock', productController.getLowStock);

// CRUD routes
router.get('/', productController.getAll);
router.post('/', productController.create);
router.post('/bulk-import', productController.bulkImport);

router.get('/:id', productController.getOne);
router.put('/:id', productController.update);
router.delete('/:id', productController.delete);

// Sub-resource routes
router.post('/:id/adjust-stock', productController.updateStock);
router.get('/:id/barcode', productController.generateBarcode);

module.exports = router;
