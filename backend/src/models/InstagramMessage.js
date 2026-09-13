'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstagramMessage = sequelize.define('InstagramMessage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  lead_id: { type: DataTypes.UUID, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  direction: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false,
    defaultValue: 'inbound',
  },
  sent_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'instagram_messages',
  underscored: true,
  timestamps: false,
});

module.exports = InstagramMessage;
