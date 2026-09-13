'use strict';
const axios = require('axios');
const crypto = require('crypto');
const { InstagramLead, ChatbotRule } = require('../models');

const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const IG_VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;
const IG_APP_SECRET = process.env.IG_APP_SECRET;

// In-memory diagnostic log (resets on restart, 20 entries max)
const _webhookLog = [];
exports.getWebhookLog = (req, res) => {
  res.json({ count: _webhookLog.length, events: _webhookLog });
};

// ── Webhook verification (Meta GET challenge) ─────────────────────
exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  console.log('[IG webhook] verify attempt — mode:', mode, 'token_match:', token === IG_VERIFY_TOKEN);
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
  } catch (err) {
    console.log('[IG username] fetch failed for', senderId, ':', err.response?.data || err.message);
    return null;
  }
}

// ── Main webhook event handler (Meta POST) ────────────────────────
exports.handleWebhook = async (req, res) => {
  // Log ALL incoming hits before any check (so we see failed-signature events too)
  const logEntry = { time: new Date().toISOString(), sig: req.headers['x-hub-signature-256']?.slice(0, 20) + '…', body: req.body };
  _webhookLog.unshift(logEntry);
  if (_webhookLog.length > 20) _webhookLog.pop();

  // Verify payload signature using raw body bytes
  const sig = req.headers['x-hub-signature-256'];
  if (IG_APP_SECRET && sig) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expected = 'sha256=' + crypto.createHmac('sha256', IG_APP_SECRET).update(rawBody).digest('hex');
    if (sig !== expected) {
      console.warn('[IG webhook] ❌ Signature mismatch — expected:', expected, 'got:', sig);
      return res.sendStatus(403);
    }
  }

  res.sendStatus(200); // Acknowledge immediately

  try {
    const body = req.body;
    console.log('[IG webhook] received object:', body.object, '— entries:', body.entry?.length ?? 0);

    if (body.object !== 'instagram') {
      console.log('[IG webhook] ignoring non-instagram object:', body.object);
      return;
    }

    for (const entry of body.entry || []) {
      const messagingEvents = entry.messaging || [];
      console.log('[IG webhook] entry id:', entry.id, '— messaging events:', messagingEvents.length);

      for (const event of messagingEvents) {
        const senderId = event.sender?.id;
        const recipientId = event.recipient?.id;
        const messageText = event.message?.text || '';

        console.log('[IG webhook] event — sender:', senderId, 'recipient:', recipientId, 'text:', messageText);

        // Ignore messages sent by the bot itself
        if (!senderId || senderId === IG_USER_ID) {
          console.log('[IG webhook] skipping own message');
          continue;
        }

        if (!messageText) {
          console.log('[IG webhook] skipping non-text event');
          continue;
        }

        // Upsert the lead
        let [lead, created] = await InstagramLead.findOrCreate({
          where: { sender_id: senderId },
          defaults: { sender_id: senderId, last_message: messageText, last_message_at: new Date() },
        });
        console.log('[IG webhook] lead', created ? 'created' : 'found', '— id:', lead.id);

        lead.last_message = messageText;
        lead.last_message_at = new Date();

        // Fetch username if not yet known
        if (!lead.username) {
          lead.username = await fetchUsername(senderId);
          console.log('[IG webhook] username fetched:', lead.username);
        }

        // Extract phone number if present in message
        const phoneMatch = messageText.match(/(\+?[6-9]\d{9}|\+91\d{10}|\d{10})/);
        if (phoneMatch && !lead.phone) {
          lead.phone = phoneMatch[0];
          lead.status = 'number_collected';
          console.log('[IG webhook] phone extracted:', lead.phone);
        }

        // Match chatbot rules and auto-reply (every matching message gets a reply)
        const rules = await ChatbotRule.findAll({ where: { active: true } });
        const lowerMsg = messageText.toLowerCase();
        const matched = rules.find(r => lowerMsg.includes(r.keyword.toLowerCase()));
        console.log('[IG webhook] rules loaded:', rules.length, '— matched:', matched?.keyword || 'none');

        if (matched) {
          try {
            await sendReply(senderId, matched.reply);
            lead.auto_replied = true;
          } catch (err) {
            console.error('[IG webhook] ❌ Auto-reply failed:', err.response?.data || err.message);
          }
        }

        await lead.save();
        console.log('[IG webhook] lead saved — id:', lead.id, 'status:', lead.status);
      }
    }
  } catch (err) {
    console.error('[IG webhook] ❌ Error:', err.message, err.stack);
  }
};

// ── Leads API ─────────────────────────────────────────────────────
exports.getLeads = async (req, res) => {
  try {
    const leads = await InstagramLead.findAll({
      order: [['last_message_at', 'DESC']],
    });
    res.json({ success: true, leads });
  } catch (err) {
    console.error('[IG leads] getLeads error:', err.message);
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
