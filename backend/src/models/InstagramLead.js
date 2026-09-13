'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstagramLead = sequelize.define('InstagramLead', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID, allowNull: true },
  sender_id: { type: DataTypes.STRING(100), allowNull: false },
  username: { type: DataTypes.STRING(150), allowNull: true },
  phone: { type: DataTypes.STRING(20), allowNull: true },
  last_message: { type: DataTypes.TEXT, allowNull: true },
  intent: { type: DataTypes.STRING(100), defaultValue: 'unclear' },
  status: {
    type: DataTypes.ENUM('in_progress', 'number_collected', 'contacted', 'converted', 'not_interested'),
    defaultValue: 'in_progress',
  },
  auto_replied: { type: DataTypes.BOOLEAN, defaultValue: false },
  last_message_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'instagram_leads',
  underscored: true,
  timestamps: true,
});

module.exports = InstagramLead;
