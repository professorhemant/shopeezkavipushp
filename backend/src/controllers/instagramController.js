'use strict';
const axios = require('axios');
const crypto = require('crypto');
const { InstagramLead, ChatbotRule } = require('../models');

const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const IG_VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;
const IG_APP_SECRET = process.env.IG_APP_SECRET;

// ── Webhook verification (Meta GET challenge) ─────────────────────
exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === IG_VERIFY_TOKEN) {
    console.log('✅ Instagram webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
};

// ── Send a reply DM via Instagram Graph API ───────────────────────
async function sendReply(recipientId, text) {
  const res = await axios.post(
    `https://graph.instagram.com/v21.0/${IG_USER_ID}/messages`,
    { recipient: { id: recipientId }, message: { text } },
    { headers: { Authorization: `Bearer ${IG_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
  );
  console.log('[IG reply] sent to', recipientId, '— response:', JSON.stringify(res.data));
}

// ── Fetch Instagram username from sender PSID ─────────────────────
async function fetchUsername(senderId) {
  try {
    const res = await axios.get(
      `https://graph.instagram.com/v21.0/${senderId}`,
      { params: { fields: 'username,name', access_token: IG_ACCESS_TOKEN } }
    );
    return res.data.username || res.data.name || null;
  } catch {
    return null;
  }
}

// ── Main webhook event handler (Meta POST) ────────────────────────
exports.handleWebhook = async (req, res) => {
  // Verify payload signature using raw body bytes (set by express.json verify callback)
  const sig = req.headers['x-hub-signature-256'];
  if (IG_APP_SECRET && sig) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expected = 'sha256=' + crypto.createHmac('sha256', IG_APP_SECRET).update(rawBody).digest('hex');
    if (sig !== expected) {
      console.warn('[IG webhook] signature mismatch');
      return res.sendStatus(403);
    }
  }

  res.sendStatus(200); // Acknowledge immediately

  try {
    const body = req.body;
    if (body.object !== 'instagram') return;

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        const messageText = event.message?.text || '';

        if (!senderId || senderId === IG_USER_ID) continue;
        if (!messageText) continue;

        // Upsert the lead
        const [lead, created] = await InstagramLead.findOrCreate({
          where: { sender_id: senderId },
          defaults: { sender_id: senderId, last_message: messageText, last_message_at: new Date() },
        });
        console.log('[IG webhook] lead', created ? 'created' : 'updated', '— sender:', senderId);

        lead.last_message = messageText;
        lead.last_message_at = new Date();

        if (!lead.username) {
          lead.username = await fetchUsername(senderId);
        }

        // Extract phone number from message
        const phoneMatch = messageText.match(/(\+?[6-9]\d{9}|\+91\d{10}|\d{10})/);
        if (phoneMatch && !lead.phone) {
          lead.phone = phoneMatch[0];
          lead.status = 'number_collected';
        }

        // Match chatbot rules and auto-reply
        const rules = await ChatbotRule.findAll({ where: { active: true } });
        const matched = rules.find(r => messageText.toLowerCase().includes(r.keyword.toLowerCase()));
        if (matched) {
          try {
            await sendReply(senderId, matched.reply);
            lead.auto_replied = true;
          } catch (err) {
            console.error('[IG webhook] auto-reply failed:', err.response?.data || err.message);
          }
        }

        await lead.save();
      }
    }
  } catch (err) {
    console.error('[IG webhook] error:', err.message);
  }
};

// ── Leads API ─────────────────────────────────────────────────────
exports.getLeads = async (req, res) => {
  try {
    const leads = await InstagramLead.findAll({ order: [['last_message_at', 'DESC']] });
    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const lead = await InstagramLead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const { status, phone, intent } = req.body;
    if (status) lead.status = status;
    if (phone) { lead.phone = phone; lead.status = 'number_collected'; }
    if (intent) lead.intent = intent;
    await lead.save();
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
