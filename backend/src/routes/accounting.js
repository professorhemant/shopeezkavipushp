'use strict';

const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');

// Ledger & Reports
router.get('/ledger', accountingController.getLedger);
router.get('/receivables', accountingController.getReceivables);
router.get('/payables', accountingController.getPayables);
router.get('/profit-loss', accountingController.getProfitLoss);
router.get('/balance-sheet', accountingController.getBalanceSheet);

// Expenses
router.get('/expenses', accountingController.getExpenses);
router.post('/expenses', accountingController.createExpense);
router.put('/expenses/:id', accountingController.updateExpense);
router.delete('/expenses/:id', accountingController.deleteExpense);

// Fixed Assets
router.get('/fixed-assets', accountingController.getFixedAssets);
router.post('/fixed-assets', accountingController.createFixedAsset);
router.put('/fixed-assets/:id', accountingController.updateFixedAsset);

module.exports = router;
