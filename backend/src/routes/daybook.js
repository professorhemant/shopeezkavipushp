'use strict';

const express = require('express');
const router = express.Router();
const c = require('../controllers/dayBookController');

// Config (opening balance)
router.get('/config', c.getConfig);
router.put('/config', c.updateConfig);

// Summary
router.get('/summary', c.getSummary);

// Sales
router.get('/sales', c.getSales);
router.post('/sales', c.createSale);
router.put('/sales/:id', c.updateSale);
router.delete('/sales/:id', c.deleteSale);

// Bridal Bookings
router.get('/bridal-bookings', c.getBridalBookings);
router.post('/bridal-bookings', c.createBridalBooking);
router.put('/bridal-bookings/:id', c.updateBridalBooking);
router.delete('/bridal-bookings/:id', c.deleteBridalBooking);

// Bridal Dispatch
router.get('/bridal-dispatch', c.getBridalDispatch);
router.post('/bridal-dispatch', c.createBridalDispatch);
router.put('/bridal-dispatch/:id', c.updateBridalDispatch);
router.delete('/bridal-dispatch/:id', c.deleteBridalDispatch);

// Expenses
router.get('/expenses', c.getExpenses);
router.post('/expenses', c.createExpense);
router.put('/expenses/:id', c.updateExpense);
router.delete('/expenses/:id', c.deleteExpense);

// Security Refunds
router.get('/security-refunds', c.getSecurityRefunds);
router.post('/security-refunds', c.createSecurityRefund);
router.put('/security-refunds/:id', c.updateSecurityRefund);
router.delete('/security-refunds/:id', c.deleteSecurityRefund);

module.exports = router;
