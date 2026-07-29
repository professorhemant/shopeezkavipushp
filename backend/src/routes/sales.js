'use strict';

const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const upload = require('../middleware/upload');
const setFolder = (req, res, next) => { req.uploadFolder = 'sales'; next(); };
const uploadImagesMiddleware = [setFolder, upload.array('images', 10)];

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
router.post('/:id/images', uploadImagesMiddleware, saleController.uploadImages);

module.exports = router;
