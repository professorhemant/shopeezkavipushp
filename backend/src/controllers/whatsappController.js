'use strict';

const { Op } = require('sequelize');
const { WhatsappCampaign, WhatsappMessage, Customer } = require('../models');

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || null;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || null;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || null;

// Mock/real WhatsApp send
const sendWhatsAppMessage = async (to, message, mediaUrl = null) => {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    // Mock mode
    console.log(`[WhatsApp MOCK] To: ${to} | Message: ${message}`);
    return { success: true, mock: true, message_id: `mock_${Date.now()}` };
  }

  try {
    const axios = require('axios');
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    };
    if (mediaUrl) {
      payload.type = 'image';
      payload.image = { link: mediaUrl, caption: message };
    }

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[WhatsApp API Error]', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

/**
 * GET /whatsapp/campaigns
 */
const getCampaigns = async (req, res, next) => {
  try {
    const campaigns = await WhatsappCampaign.findAll({
      where: { firm_id: req.firmId },
      order: [['created_at', 'DESC']],
    });
    return res.status(200).json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /whatsapp/campaigns
 */
const createCampaign = async (req, res, next) => {
  try {
    const { name, message, media_url, recipient_type, recipient_ids, scheduled_at } = req.body;
    if (!name || !message) return res.status(400).json({ success: false, message: 'name and message are required.' });

    let recipients = [];
    if (recipient_type === 'all') {
      const customers = await Customer.findAll({
        where: { firm_id: req.firmId, is_active: true, phone: { [Op.ne]: null } },
        attributes: ['id', 'name', 'phone'],
      });
      recipients = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
    } else if (Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      const customers = await Customer.findAll({
        where: { id: { [Op.in]: recipient_ids }, firm_id: req.firmId, phone: { [Op.ne]: null } },
        attributes: ['id', 'name', 'phone'],
      });
      recipients = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
    }

    const campaign = await WhatsappCampaign.create({
      firm_id: req.firmId,
      name,
      message,
      media_url: media_url || null,
      recipient_type: recipient_type || 'custom',
      recipient_count: recipients.length,
      recipients: JSON.stringify(recipients),
      scheduled_at: scheduled_at || null,
      status: 'draft',
    });

    return res.status(201).json({ success: true, message: 'Campaign created.', data: campaign });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /whatsapp/campaigns/:id/send
 */
const sendCampaign = async (req, res, next) => {
  try {
    const campaign = await WhatsappCampaign.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
    if (campaign.status === 'sent') return res.status(400).json({ success: false, message: 'Campaign already sent.' });

    await campaign.update({ status: 'sending', sent_at: new Date() });

    const recipients = typeof campaign.recipients === 'string' ? JSON.parse(campaign.recipients) : campaign.recipients;

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      if (!recipient.phone) { failed++; continue; }

      const personalizedMessage = campaign.message
        .replace('{name}', recipient.name || 'Customer')
        .replace('{firm}', req.firmName || 'Our Store');

      const result = await sendWhatsAppMessage(recipient.phone, personalizedMessage, campaign.media_url);

      await WhatsappMessage.create({
        firm_id: req.firmId,
        campaign_id: campaign.id,
        customer_id: recipient.id || null,
        phone: recipient.phone,
        message: personalizedMessage,
        status: result.success ? 'sent' : 'failed',
        error: result.success ? null : JSON.stringify(result.error),
        sent_at: new Date(),
      });

      if (result.success) sent++;
      else failed++;
    }

    await campaign.update({
      status: 'sent',
      sent_count: sent,
      failed_count: failed,
    });

    return res.status(200).json({
      success: true,
      message: `Campaign sent. ${sent} delivered, ${failed} failed.`,
      data: { sent, failed, total: recipients.length },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /whatsapp/campaigns/:id/stats
 */
const getCampaignStats = async (req, res, next) => {
  try {
    const campaign = await WhatsappCampaign.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    const messages = await WhatsappMessage.findAll({
      where: { campaign_id: campaign.id, firm_id: req.firmId },
    });

    const stats = {
      total: messages.length,
      sent: messages.filter((m) => m.status === 'sent').length,
      delivered: messages.filter((m) => m.status === 'delivered').length,
      read: messages.filter((m) => m.status === 'read').length,
      failed: messages.filter((m) => m.status === 'failed').length,
    };

    return res.status(200).json({ success: true, data: { campaign, stats } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /whatsapp/send
 * Send single message to a customer
 */
const sendSingleMessage = async (req, res, next) => {
  try {
    const { customer_id, phone, message, media_url } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required.' });

    let toPhone = phone;
    let customerId = customer_id || null;

    if (customer_id && !phone) {
      const customer = await Customer.findOne({ where: { id: customer_id, firm_id: req.firmId } });
      if (!customer || !customer.phone) return res.status(404).json({ success: false, message: 'Customer not found or has no phone.' });
      toPhone = customer.phone;
    }

    if (!toPhone) return res.status(400).json({ success: false, message: 'phone or customer_id with phone is required.' });

    const result = await sendWhatsAppMessage(toPhone, message, media_url || null);

    const log = await WhatsappMessage.create({
      firm_id: req.firmId,
      campaign_id: null,
      customer_id: customerId,
      phone: toPhone,
      message,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : JSON.stringify(result.error),
      sent_at: new Date(),
    });

    return res.status(200).json({
      success: result.success,
      message: result.success ? 'Message sent.' : 'Message failed.',
      data: log,
      mock: result.mock || false,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCampaigns, createCampaign, sendCampaign, getCampaignStats, sendSingleMessage };
