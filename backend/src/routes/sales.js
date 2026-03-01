'use strict';

const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

// Special routes (before :id)
router.get('/next-invoice-no', saleController.getNextInvoiceNo);

// CRUD routes
router.get('/', saleController.getAll);
router.post('/', saleController.create);

router.get('/:id', saleController.getOne);
router.put('/:id', saleController.update);

// Action routes
router.put('/:id/cancel', saleController.cancel);
router.delete('/:id', saleController.delete);
router.post('/:id/return', saleController.return);
router.post('/:id/payment', saleController.addPayment);
router.get('/:id/pdf', saleController.generatePDF);

module.exports = router;
