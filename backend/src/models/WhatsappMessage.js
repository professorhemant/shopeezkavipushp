'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WhatsappMessage = sequelize.define('WhatsappMessage', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id:     { type: DataTypes.UUID },
  customer_id: { type: DataTypes.UUID },
  sale_id:     { type: DataTypes.UUID },
  phone:       { type: DataTypes.STRING(20) },
  message:     { type: DataTypes.TEXT },
  status:      { type: DataTypes.ENUM('sent', 'failed', 'pending'), defaultValue: 'sent' },
  sent_at:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'whatsapp_messages',
  indexes: [
    { fields: ['firm_id'] },
    { fields: ['customer_id'] },
    { fields: ['sale_id'] },
  ],
});

module.exports = WhatsappMessage;
