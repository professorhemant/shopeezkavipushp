'use strict';

// Daily job: sends SMS to customers whose loyalty points expire within 14 days.
// Uses the same Fast2SMS bulkV2 route as the OTP sender.
// Fires once per day at 10:00 IST.

const axios = require('axios');
const { Customer, sequelize } = require('../models');
const { Op } = require('sequelize');

const IST_OFFSET_MIN = 330;
const istNow = () => new Date(Date.now() + IST_OFFSET_MIN * 60000);

function msUntilNextIST(hour, minute) {
  const ist = istNow();
  const target = new Date(ist);
  target.setUTCHours(hour, minute, 0, 0);
  if (target.getTime() <= ist.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return (target.getTime() - IST_OFFSET_MIN * 60000) - Date.now();
}

async function sendExpiryReminders() {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.log('[Loyalty] Fast2SMS not configured — skipping expiry SMS.');
    return;
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  try {
    const customers = await Customer.findAll({
      where: {
        loyalty_points: { [Op.gt]: 0 },
        points_expires_at: { [Op.between]: [now, cutoff] },
        phone: { [Op.not]: null },
      },
      attributes: ['id', 'name', 'phone', 'loyalty_points', 'points_expires_at'],
    });

    for (const c of customers) {
      const expStr = new Date(c.points_expires_at).toLocaleDateString('en-IN');
      const msg = `Namaste ${c.name || 'ji'}! Aapke Kavipushp Jewels ke ${c.loyalty_points} loyalty points ${expStr} ko expire ho rahe hain. Inhe apni agli kharidari par ₹${c.loyalty_points} discount ke roop mein use karein!`;
      try {
        await axios.post(
          'https://www.fast2sms.com/dev/bulkV2',
          { route: 'q', message: msg, numbers: c.phone },
          { headers: { authorization: apiKey } }
        );
        console.log(`[Loyalty] Expiry SMS sent to ${c.phone}`);
      } catch (err) {
        console.error(`[Loyalty] SMS failed for ${c.phone}:`, err?.response?.data || err.message);
      }
    }

    console.log(`[Loyalty] Expiry reminders processed: ${customers.length} customer(s)`);
  } catch (err) {
    console.error('[Loyalty] Expiry notifier error:', err.message);
  }
}

function startLoyaltyExpiryNotifier() {
  const schedule = () => {
    const delay = msUntilNextIST(10, 0); // 10:00 IST daily
    setTimeout(async () => {
      await sendExpiryReminders();
      schedule();
    }, delay).unref?.();
    const mins = Math.round(delay / 60000);
    console.log(`🎁 Loyalty expiry notifier scheduled for 10:00 IST (in ~${mins} min)`);
  };
  schedule();
}

module.exports = { startLoyaltyExpiryNotifier };
