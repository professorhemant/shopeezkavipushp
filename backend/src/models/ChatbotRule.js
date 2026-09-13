'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatbotRule = sequelize.define('ChatbotRule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  firm_id: { type: DataTypes.INTEGER, allowNull: false },
  keyword: { type: DataTypes.STRING(200), allowNull: false },
  reply: { type: DataTypes.TEXT, allowNull: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'chatbot_rules',
  underscored: true,
  timestamps: true,
});

module.exports = ChatbotRule;
