'use strict';

// Daily 9:00 AM IST appointment reminder — sends WhatsApp to each customer
// with an appointment today + a summary to the owner.
// Same dependency-free scheduling pattern as autoSaveDayBook.js.

const { Op } = require('sequelize');
const { Appointment } = require('../models');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

const IST_OFFSET_MIN = 330; // UTC+5:30
const OWNER_PHONE    = process.env.OWNER_WHATSAPP || '7976735339';

const istNow        = () => new Date(Date.now() + IST_OFFSET_MIN * 60000);
const istDateString = () => istNow().toISOString().split('T')[0];

function msUntilNextIST(hour, minute) {
  const now = Date.now();
  const ist = istNow();
  const target = new Date(ist);
  target.setUTCHours(hour, minute, 0, 0);
  if (target.getTime() <= ist.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return (target.getTime() - IST_OFFSET_MIN * 60000) - now;
}

const fmtDate = (d) => {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

async function runAppointmentReminders() {
  const today = istDateString();
  try {
    const appointments = await Appointment.findAll({
      where: {
        appointment_date: today,
        status: { [Op.notIn]: ['cancelled', 'completed'] },
      },
      order: [['appointment_time', 'ASC']],
    });

    if (appointments.length === 0) {
      console.log(`ℹ️  Appointment reminders: no appointments today (${today})`);
      return;
    }

    // Owner summary
    const lines = appointments.map((a, i) => {
      const time = a.appointment_time ? String(a.appointment_time).slice(0, 5) : '-';
      return `${i + 1}. ${a.customer_name || 'Customer'} (${a.customer_phone || 'N/A'}) — ${a.service || 'Appointment'} at ${time}`;
    }).join('\n');

    const ownerMsg = `🌅 *Today's Appointments — ${fmtDate(today)}*\nYou have *${appointments.length}* appointment(s) today:\n\n${lines}\n\nKavipushp Jewels`;
    sendWhatsAppMessage(OWNER_PHONE, ownerMsg).catch((e) =>
      console.error('[Reminder] Owner WA failed:', e.message)
    );

    // Per-customer reminders
    for (const a of appointments) {
      if (!a.customer_phone) continue;
      const time = a.appointment_time ? String(a.appointment_time).slice(0, 5) : '-';
      const msg = `🔔 *Appointment Reminder — Kavipushp Jewels*\n\nDear ${a.customer_name || 'Customer'}, you have an appointment *today*!\n\n📅 Date: ${fmtDate(today)}\n⏰ Time: ${time}\n💄 Service: ${a.service || 'Appointment'}${a.staff_name ? `\n👩 Staff: ${a.staff_name}` : ''}\n\nWe look forward to seeing you! ✨\nKavipushp Jewels — ${OWNER_PHONE}`;
      sendWhatsAppMessage(a.customer_phone, msg).catch((e) =>
        console.error(`[Reminder] Customer WA failed for ${a.customer_phone}:`, e.message)
      );
    }

    console.log(`✅ Appointment reminders sent for ${today} (${appointments.length} appointments)`);
  } catch (err) {
    console.error(`❌ Appointment reminder job failed for ${today}:`, err.message);
  }
}

function startAppointmentReminder() {
  const hour   = 9;
  const minute = 0;

  const scheduleNext = () => {
    const delay = msUntilNextIST(hour, minute);
    setTimeout(async () => {
      await runAppointmentReminders();
      scheduleNext();
    }, delay).unref?.();
    const mins = Math.round(delay / 60000);
    console.log(`🕒 Appointment reminder scheduled for 09:00 IST (in ~${mins} min)`);
  };

  scheduleNext();
}

module.exports = { startAppointmentReminder };
