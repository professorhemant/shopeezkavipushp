'use strict';

const { Op } = require('sequelize');
const {
  WhatsAppCampaign, WhatsappMessage, Customer,
  Sale, SaleItem, Firm, Settings,
} = require('../models');

const WHATSAPP_API_URL   = process.env.WHATSAPP_API_URL   || null;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || null;
const WHATSAPP_PHONE_ID  = process.env.WHATSAPP_PHONE_ID  || null;

// ── Low-level sender ─────────────────────────────────────────────
const sendWhatsAppMessage = async (to, message, mediaUrl = null) => {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    console.log(`[WhatsApp MOCK] To: ${to} | Message: ${message.slice(0, 80)}...`);
    return { success: true, mock: true, message_id: `mock_${Date.now()}` };
  }
  try {
    const axios = require('axios');
    const payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } };
    if (mediaUrl) { payload.type = 'image'; payload.image = { link: mediaUrl, caption: message }; }
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

// ── Message formatter ────────────────────────────────────────────
const formatInvoiceMessage = (sale, items, firm, settings) => {
  const date = sale.invoice_date
    ? new Date(sale.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const itemLines = (items || []).map((item) => {
    const name  = item.product_name || 'Item';
    const qty   = item.quantity || 1;
    const price = parseFloat(item.total || 0).toFixed(2);
    return `  • ${name} × ${qty} — ₹${price}`;
  }).join('\n') || '  • (no items)';

  const total   = parseFloat(sale.total || sale.grand_total || 0).toFixed(2);
  const paid    = parseFloat(sale.paid_amount || 0);
  const balance = parseFloat(sale.balance || 0);

  const upiId      = settings.payment_upi_id      || '';
  const bankAcc    = settings.payment_bank_account || '';
  const bankIfsc   = settings.payment_bank_ifsc    || '';
  const bankName   = settings.payment_bank_name    || '';
  const bankHolder = settings.payment_bank_holder  || firm.name || '';

  let paymentSection = '';
  if (upiId || bankAcc) {
    paymentSection += `\n━━━━━━━━━━━━━━━━\n💳 *Payment Options:*\n`;
    if (upiId) {
      paymentSection += `📱 *UPI ID:* ${upiId}\n   (GPay / PhonePe / Paytm)\n`;
    }
    if (bankAcc) {
      paymentSection += `🏦 *Bank Transfer:*\n   A/C: ${bankAcc}\n`;
      if (bankIfsc)   paymentSection += `   IFSC: ${bankIfsc}\n`;
      if (bankName)   paymentSection += `   Bank: ${bankName}\n`;
      if (bankHolder) paymentSection += `   Name: ${bankHolder}\n`;
    }
  }

  const firmPhone = firm.phone ? `\n📞 ${firm.phone}` : '';

  return `🧿 *${firm.name || 'Our Store'}*
━━━━━━━━━━━━━━━━
📋 *Invoice: ${sale.invoice_no || '-'}*
📅 Date: ${date}
👤 Dear ${sale.customer_name || 'Customer'},

*Items Purchased:*
${itemLines}
━━━━━━━━━━━━━━━━
💰 *Grand Total: ₹${total}*
${paid > 0 ? `✅ *Paid: ₹${paid.toFixed(2)}*\n` : ''}${balance > 0 ? `🔴 *Balance Due: ₹${balance.toFixed(2)}*` : `✅ *Fully Paid*`}${paymentSection}
Thank you for shopping with us! 🙏${firmPhone}`;
};

// ── GET /whatsapp/campaigns ──────────────────────────────────────
const getCampaigns = async (req, res, next) => {
  try {
    const campaigns = await WhatsAppCampaign.findAll({
      where: { firm_id: req.firmId },
      order: [['created_at', 'DESC']],
    });
    return res.status(200).json({ success: true, data: campaigns });
  } catch (err) { next(err); }
};

// ── POST /whatsapp/campaigns ─────────────────────────────────────
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

    const campaign = await WhatsAppCampaign.create({
      firm_id: req.firmId,
      name,
      message,
      media_url: media_url || null,
      target_type: recipient_type === 'all' ? 'all_customers' : 'custom',
      recipients,
      scheduled_at: scheduled_at || null,
      status: 'draft',
      created_by: req.userId,
    });

    return res.status(201).json({ success: true, message: 'Campaign created.', data: campaign });
  } catch (err) { next(err); }
};

// ── POST /whatsapp/campaigns/:id/send ───────────────────────────
const sendCampaign = async (req, res, next) => {
  try {
    const campaign = await WhatsAppCampaign.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
    if (campaign.status === 'sent') return res.status(400).json({ success: false, message: 'Campaign already sent.' });

    await campaign.update({ status: 'sending', sent_at: new Date() });
    const recipients = Array.isArray(campaign.recipients) ? campaign.recipients : [];

    let sent = 0, failed = 0;
    for (const recipient of recipients) {
      if (!recipient.phone) { failed++; continue; }
      const personalizedMessage = campaign.message
        .replace('{name}', recipient.name || 'Customer')
        .replace('{firm}', req.firmName || 'Our Store');
      const result = await sendWhatsAppMessage(recipient.phone, personalizedMessage, campaign.media_url);
      await WhatsappMessage.create({
        firm_id: req.firmId, customer_id: recipient.id || null,
        phone: recipient.phone, message: personalizedMessage,
        status: result.success ? 'sent' : 'failed', sent_at: new Date(),
      });
      if (result.success) sent++; else failed++;
    }

    await campaign.update({ status: 'sent', sent_count: sent, failed_count: failed });
    return res.status(200).json({ success: true, message: `Campaign sent. ${sent} delivered, ${failed} failed.`, data: { sent, failed } });
  } catch (err) { next(err); }
};

// ── GET /whatsapp/campaigns/:id/stats ───────────────────────────
const getCampaignStats = async (req, res, next) => {
  try {
    const campaign = await WhatsAppCampaign.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
    const messages = await WhatsappMessage.findAll({ where: { firm_id: req.firmId } });
    const stats = {
      total: messages.length,
      sent: messages.filter((m) => m.status === 'sent').length,
      failed: messages.filter((m) => m.status === 'failed').length,
    };
    return res.status(200).json({ success: true, data: { campaign, stats } });
  } catch (err) { next(err); }
};

// ── POST /whatsapp/send ──────────────────────────────────────────
const sendSingleMessage = async (req, res, next) => {
  try {
    const { customer_id, phone, message, media_url } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required.' });

    let toPhone = phone;
    let customerId = customer_id || null;

    if (customer_id && !phone) {
      const customer = await Customer.findOne({ where: { id: customer_id, firm_id: req.firmId } });
      if (!customer?.phone) return res.status(404).json({ success: false, message: 'Customer not found or has no phone.' });
      toPhone = customer.phone;
    }
    if (!toPhone) return res.status(400).json({ success: false, message: 'phone or customer_id required.' });

    const result = await sendWhatsAppMessage(toPhone, message, media_url || null);
    const log = await WhatsappMessage.create({
      firm_id: req.firmId, customer_id: customerId,
      phone: toPhone, message,
      status: result.success ? 'sent' : 'failed', sent_at: new Date(),
    });

    return res.status(200).json({ success: result.success, message: result.success ? 'Message sent.' : 'Message failed.', data: log, mock: result.mock || false });
  } catch (err) { next(err); }
};

// ── POST /whatsapp/send-invoice/:sale_id ─────────────────────────
const sendInvoiceMessage = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.sale_id, firm_id: req.firmId },
      include: [
        { model: SaleItem, as: 'items' },
        { model: Firm,     as: 'firm'  },
        { model: Customer, as: 'customer' },
      ],
    });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    const phone = sale.customer?.phone || sale.customer_phone || req.body.phone || null;
    if (!phone) return res.status(400).json({ success: false, message: 'Customer has no phone number.' });

    // Get firm payment settings
    const paymentKeys = ['payment_upi_id', 'payment_bank_account', 'payment_bank_ifsc', 'payment_bank_name', 'payment_bank_holder'];
    const settingRows = await Settings.findAll({
      where: { firm_id: req.firmId, key: { [Op.in]: paymentKeys } },
    });
    const settings = {};
    settingRows.forEach((s) => { settings[s.key] = s.value; });

    const firm    = sale.firm    || { name: 'Our Store', phone: '' };
    const message = formatInvoiceMessage(sale, sale.items || [], firm, settings);

    const result = await sendWhatsAppMessage(phone, message);

    await WhatsappMessage.create({
      firm_id: req.firmId,
      customer_id: sale.customer_id || null,
      sale_id: sale.id,
      phone,
      message,
      status: result.success ? 'sent' : 'failed',
      sent_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message_text: message,
      phone,
      mock: result.mock || false,
    });
  } catch (err) { next(err); }
};

// ── GET /whatsapp/customer/:id/messages ──────────────────────────
const getCustomerMessages = async (req, res, next) => {
  try {
    const messages = await WhatsappMessage.findAll({
      where: { customer_id: req.params.id, firm_id: req.firmId },
      order: [['sent_at', 'DESC']],
      limit: 30,
    });
    return res.status(200).json({ success: true, data: messages });
  } catch (err) { next(err); }
};

module.exports = {
  getCampaigns, createCampaign, sendCampaign, getCampaignStats,
  sendSingleMessage, sendInvoiceMessage, getCustomerMessages,
};
