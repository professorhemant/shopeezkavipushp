'use strict';

const { Op, fn, col } = require('sequelize');
const { Appointment, Customer, User } = require('../models');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

/**
 * GET /appointments
 */
const getAll = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { from_date, to_date, staff_id, status, customer_id } = req.query;

    const where = { firm_id: req.firmId };
    if (staff_id) where.staff_id = staff_id;
    if (status) where.status = status;
    if (customer_id) where.customer_id = customer_id;
    if (from_date && to_date) {
      where.appointment_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
    }

    const { count, rows } = await Appointment.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] },
        { model: User, as: 'staff', attributes: ['id', 'name', 'phone'] },
      ],
      order: [['appointment_date', 'ASC'], ['appointment_time', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /appointments/:id
 */
const getOne = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'staff', attributes: ['id', 'name', 'phone'] },
      ],
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    return res.status(200).json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /appointments
 */
const create = async (req, res, next) => {
  try {
    const { customer_id, staff_id, appointment_date, appointment_time, service, duration, notes } = req.body;
    if (!appointment_date) return res.status(400).json({ success: false, message: 'appointment_date is required.' });

    const appointment = await Appointment.create({
      firm_id: req.firmId,
      customer_id: customer_id || null,
      staff_id: staff_id || null,
      appointment_date,
      appointment_time: appointment_time || null,
      service: service || null,
      duration: duration || 60,
      notes: notes || null,
      status: 'scheduled',
    });

    return res.status(201).json({ success: true, message: 'Appointment created.', data: appointment });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /appointments/:id
 */
const update = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (['cancelled', 'completed'].includes(appointment.status)) {
      return res.status(400).json({ success: false, message: `Cannot update a ${appointment.status} appointment.` });
    }
    const body = { ...req.body };
    delete body.firm_id;
    await appointment.update(body);
    return res.status(200).json({ success: true, message: 'Appointment updated.', data: appointment });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /appointments/:id/cancel
 */
const cancel = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (appointment.status === 'cancelled') return res.status(400).json({ success: false, message: 'Already cancelled.' });
    await appointment.update({ status: 'cancelled', cancel_reason: req.body.reason || null });
    return res.status(200).json({ success: true, message: 'Appointment cancelled.' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /appointments/:id/complete
 */
const complete = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    await appointment.update({ status: 'completed', completed_at: new Date(), notes: req.body.notes || appointment.notes });
    return res.status(200).json({ success: true, message: 'Appointment completed.', data: appointment });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /appointments/today
 */
const getTodayAppointments = async (req, res, next) => {
  try {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const appointments = await Appointment.findAll({
      where: {
        firm_id: req.firmId,
        appointment_date: { [Op.between]: [start, end] },
        status: { [Op.notIn]: ['cancelled'] },
      },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'staff', attributes: ['id', 'name'] },
      ],
      order: [['appointment_time', 'ASC']],
    });

    return res.status(200).json({ success: true, data: appointments, count: appointments.length });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /appointments/calendar?month=2024-01
 */
const getCalendar = async (req, res, next) => {
  try {
    const { month } = req.query; // format: YYYY-MM
    let startDate, endDate;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0, 23, 59, 59);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const appointments = await Appointment.findAll({
      where: {
        firm_id: req.firmId,
        appointment_date: { [Op.between]: [startDate, endDate] },
      },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'staff', attributes: ['id', 'name'] },
      ],
      order: [['appointment_date', 'ASC'], ['appointment_time', 'ASC']],
    });

    // Group by date
    const calendar = {};
    appointments.forEach((appt) => {
      const dateKey = appt.appointment_date.toISOString().split('T')[0];
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push(appt);
    });

    return res.status(200).json({ success: true, data: calendar, total: appointments.length });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, cancel, complete, getTodayAppointments, getCalendar };
