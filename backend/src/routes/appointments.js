'use strict';

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Special routes (before :id)
router.get('/today', appointmentController.getTodayAppointments);
router.get('/calendar', appointmentController.getCalendar);

// CRUD
router.get('/', appointmentController.getAll);
router.post('/', appointmentController.create);

router.get('/:id', appointmentController.getOne);
router.put('/:id', appointmentController.update);
router.put('/:id/cancel', appointmentController.cancel);
router.put('/:id/complete', appointmentController.complete);

module.exports = router;
