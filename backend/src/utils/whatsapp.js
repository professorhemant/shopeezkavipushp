'use strict';

const WHATSAPP_API_URL   = process.env.WHATSAPP_API_URL   || null;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || null;
const WHATSAPP_PHONE_ID  = process.env.WHATSAPP_PHONE_ID  || null;

// Normalize to full international number (add 91 for 10-digit Indian numbers)
const normalizePhone = (num) => {
  const digits = String(num).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
};

const sendWhatsAppMessage = async (to, message, mediaUrl = null) => {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    console.log(`[WhatsApp MOCK] To: ${to} | ${message.slice(0, 100)}`);
    return { success: true, mock: true, message_id: `mock_${Date.now()}` };
  }
  try {
    const axios = require('axios');
    const isWati = WHATSAPP_API_URL.includes('wati.io');
    let response;

    if (isWati) {
      const phone = String(to).replace(/\D/g, '');
      response = await axios.post(
        `${WHATSAPP_API_URL}/api/v1/sendSessionMessage/${phone}`,
        { messageText: message },
        { headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}`, 'Content-Type': 'application/json' } }
      );
    } else {
      const phone = normalizePhone(to);
      const payload = { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } };
      if (mediaUrl) { payload.type = 'image'; payload.image = { link: mediaUrl, caption: message }; }
      response = await axios.post(
        `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}`, 'Content-Type': 'application/json' } }
      );
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error('[WhatsApp API Error]', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

module.exports = { sendWhatsAppMessage };
