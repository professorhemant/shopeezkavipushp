'use strict';

const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

// Purchase Orders
router.post('/purchase-orders', purchaseController.createPO);
router.post('/purchase-orders/:id/receive', purchaseController.receivePO);

// CRUD routes
router.get('/', purchaseController.getAll);
router.post('/', purchaseController.create);

router.get('/:id', purchaseController.getOne);
router.put('/:id', purchaseController.update);

// Action routes
router.put('/:id/cancel', purchaseController.cancel);
router.delete('/:id', purchaseController.deletePurchase);
router.post('/:id/payment', purchaseController.addPayment);

module.exports = router;
