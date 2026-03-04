'use strict';

const { Setting, Firm, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/**
 * GET /settings
 * Returns all settings for firm as a key-value object
 */
const getSettings = async (req, res, next) => {
  try {
    const rows = await sequelize.query(
      'SELECT `key`, value FROM settings WHERE firm_id = :firmId',
      { replacements: { firmId: req.firmId }, type: QueryTypes.SELECT }
    );
    const settingsMap = rows.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});
    return res.status(200).json({ success: true, data: settingsMap });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /settings
 * Bulk upsert settings: { key: value, ... }
 */
const updateSettings = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const updates = req.body; // { key: value }

    if (typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'Body must be a key-value object.' });
    }

    const entries = Object.entries(updates);
    for (const [key, value] of entries) {
      const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const [existing] = await sequelize.query(
        'SELECT id FROM settings WHERE firm_id = :firmId AND `key` = :key LIMIT 1',
        { replacements: { firmId, key }, type: QueryTypes.SELECT }
      );
      if (existing) {
        await sequelize.query(
          'UPDATE settings SET value = :value, updatedAt = NOW() WHERE id = :id',
          { replacements: { value: strVal, id: existing.id }, type: QueryTypes.UPDATE }
        );
      } else {
        await sequelize.query(
          'INSERT INTO settings (id, firm_id, `key`, value, createdAt, updatedAt) VALUES (UUID(), :firmId, :key, :value, NOW(), NOW())',
          { replacements: { firmId, key, value: strVal }, type: QueryTypes.INSERT }
        );
      }
    }

    return res.status(200).json({ success: true, message: `${entries.length} setting(s) updated.` });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /settings/firm
 */
const getFirmSettings = async (req, res, next) => {
  try {
    const firm = await Firm.findByPk(req.firmId);
    if (!firm) return res.status(404).json({ success: false, message: 'Firm not found.' });
    return res.status(200).json({ success: true, data: firm });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /settings/firm
 */
const updateFirmSettings = async (req, res, next) => {
  try {
    const firm = await Firm.findByPk(req.firmId);
    if (!firm) return res.status(404).json({ success: false, message: 'Firm not found.' });

    const allowedFields = [
      'name', 'email', 'phone', 'address', 'city', 'state', 'country',
      'pincode', 'gstin', 'pan', 'logo', 'website', 'bank_details',
      'invoice_prefix', 'invoice_footer', 'terms_conditions',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await firm.update(updates);
    return res.status(200).json({ success: true, message: 'Firm settings updated.', data: firm });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /settings/invoice
 */
const getInvoiceSettings = async (req, res, next) => {
  try {
    const keys = [
      'invoice_prefix', 'invoice_footer', 'invoice_template', 'invoice_logo',
      'invoice_terms', 'invoice_notes', 'invoice_color', 'invoice_show_bank',
      'invoice_show_signature', 'invoice_due_days',
    ];

    const settingRows = await sequelize.query(
      'SELECT `key`, value FROM settings WHERE firm_id = :firmId AND `key` IN (:keys)',
      { replacements: { firmId: req.firmId, keys }, type: QueryTypes.SELECT }
    );

    const firm = await Firm.findByPk(req.firmId, {
      attributes: ['invoice_prefix', 'invoice_footer', 'terms_conditions', 'logo'],
    });

    const settingsMap = settingRows.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        ...settingsMap,
        invoice_prefix: firm?.invoice_prefix || settingsMap.invoice_prefix || 'INV',
        invoice_footer: firm?.invoice_footer || settingsMap.invoice_footer || '',
        terms_conditions: firm?.terms_conditions || settingsMap.invoice_terms || '',
        logo: firm?.logo || settingsMap.invoice_logo || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /settings/invoice
 */
const updateInvoiceSettings = async (req, res, next) => {
  try {
    const firmId = req.firmId;

    // Update firm table fields
    const firmUpdates = {};
    if (req.body.invoice_prefix !== undefined) firmUpdates.invoice_prefix = req.body.invoice_prefix;
    if (req.body.invoice_footer !== undefined) firmUpdates.invoice_footer = req.body.invoice_footer;
    if (req.body.terms_conditions !== undefined) firmUpdates.terms_conditions = req.body.terms_conditions;

    if (Object.keys(firmUpdates).length > 0) {
      await Firm.update(firmUpdates, { where: { id: firmId } });
    }

    // Update remaining in settings table
    const settingKeys = ['invoice_template', 'invoice_color', 'invoice_show_bank', 'invoice_show_signature', 'invoice_due_days', 'invoice_notes'];
    for (const key of settingKeys) {
      if (req.body[key] !== undefined) {
        await Setting.upsert({
          firm_id: firmId,
          key,
          value: typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : String(req.body[key]),
        });
      }
    }

    return res.status(200).json({ success: true, message: 'Invoice settings updated.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSettings, updateSettings, getFirmSettings, updateFirmSettings, getInvoiceSettings, updateInvoiceSettings };
