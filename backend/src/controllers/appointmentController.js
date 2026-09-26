'use strict';

const { Op } = require('sequelize');
const { Appointment, Customer, User } = require('../models');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

const OWNER_PHONE = process.env.OWNER_WHATSAPP || '7976735339';

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

const fmtDate = (d) => {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Send booking confirmation/reminder to customer + owner (fire-and-forget)
const sendAppointmentWhatsApp = async (appt, type = 'booking') => {
  const date = fmtDate(appt.appointment_date);
  const time = appt.appointment_time ? String(appt.appointment_time).slice(0, 5) : '-';
  const service = appt.service || 'Appointment';
  const name = appt.customer_name || 'Customer';
  const phone = appt.customer_phone;

  const customerMsg = type === 'booking'
    ? `✅ *Appointment Confirmed — Kavipushp Jewels*\n\nDear ${name}, your appointment has been booked!\n\n📅 Date: ${date}\n⏰ Time: ${time}\n💄 Service: ${service}${appt.staff_name ? `\n👩 Staff: ${appt.staff_name}` : ''}\n\nPlease arrive on time. For queries call: ${OWNER_PHONE}\nThank you! 🙏`
    : `🔔 *Appointment Reminder — Kavipushp Jewels*\n\nDear ${name}, you have an appointment *today*!\n\n📅 Date: ${date}\n⏰ Time: ${time}\n💄 Service: ${service}${appt.staff_name ? `\n👩 Staff: ${appt.staff_name}` : ''}\n\nWe look forward to seeing you! ✨\nKavipushp Jewels — ${OWNER_PHONE}`;

  const ownerMsg = type === 'booking'
    ? `📌 *New Appointment Booked*\n👤 Customer: ${name}\n📱 Phone: ${phone || 'N/A'}\n💄 Service: ${service}\n📅 Date: ${date}\n⏰ Time: ${time}${appt.staff_name ? `\n👩 Staff: ${appt.staff_name}` : ''}`
    : `🌅 *Appointment Reminder*\n👤 ${name} (${phone || 'N/A'})\n💄 ${service} at ${time}`;

  const tasks = [sendWhatsAppMessage(OWNER_PHONE, ownerMsg)];
  if (phone) tasks.push(sendWhatsAppMessage(phone, customerMsg));
  await Promise.allSettled(tasks);
};

/**
 * GET /appointments
 */
const getAll = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { from_date, to_date, date, staff_id, status, customer_id, search } = req.query;

    const where = { firm_id: req.firmId };
    if (staff_id) where.staff_id = staff_id;
    if (status) where.status = status;
    if (customer_id) where.customer_id = customer_id;
    if (date) {
      where.appointment_date = date;
    } else if (from_date && to_date) {
      where.appointment_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
    }
    if (search) {
      where[Op.or] = [
        { customer_name: { [Op.like]: `%${search}%` } },
        { customer_phone: { [Op.like]: `%${search}%` } },
        { service: { [Op.like]: `%${search}%` } },
        { staff_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const today = new Date().toISOString().split('T')[0];
    const todayCount = await Appointment.count({
      where: { firm_id: req.firmId, appointment_date: today },
    });

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
      today_count: todayCount,
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
    const {
      customer_id, customer_name, customer_phone,
      staff_id, staff_name,
      appointment_date, date,
      appointment_time, time,
      service, duration_minutes, duration, notes,
    } = req.body;

    const apptDate = appointment_date || date;
    if (!apptDate) return res.status(400).json({ success: false, message: 'appointment_date is required.' });

    const appointment = await Appointment.create({
      firm_id: req.firmId,
      customer_id: customer_id || null,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      staff_id: staff_id || null,
      staff_name: staff_name || null,
      appointment_date: apptDate,
      appointment_time: appointment_time || time || null,
      service: service || '',
      duration_minutes: duration_minutes || duration || 30,
      notes: notes || null,
      status: 'scheduled',
    });

    // Fire-and-forget: booking confirmation to customer + owner
    sendAppointmentWhatsApp(appointment, 'booking').catch((e) =>
      console.error('[Appointment WA] booking notification failed:', e.message)
    );

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
    if (body.date && !body.appointment_date) { body.appointment_date = body.date; }
    if (body.time && !body.appointment_time) { body.appointment_time = body.time; }
    if (body.service === undefined || body.service === null) body.service = '';
    if (body.duration && !body.duration_minutes) { body.duration_minutes = body.duration; }
    delete body.date; delete body.time; delete body.duration;
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
 * DELETE /appointments/:id  — only for cancelled appointments
 */
const deleteOne = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (appointment.status !== 'cancelled') {
      return res.status(400).json({ success: false, message: 'Only cancelled appointments can be deleted.' });
    }
    await appointment.destroy();
    return res.status(200).json({ success: true, message: 'Appointment deleted.' });
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
    const { month } = req.query;
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

module.exports = {
  getAll, getOne, create, update, cancel, complete, deleteOne,
  getTodayAppointments, getCalendar, sendAppointmentWhatsApp,
};
