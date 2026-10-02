'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SocialSetting = sequelize.define('SocialSetting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  firm_id: { type: DataTypes.INTEGER, allowNull: false },
  fb_page_id: { type: DataTypes.STRING(200), allowNull: true },
  fb_page_access_token: { type: DataTypes.TEXT, allowNull: true },
  ig_account_id: { type: DataTypes.STRING(200), allowNull: true },
}, {
  tableName: 'social_settings',
  underscored: true,
  timestamps: true,
});

module.exports = SocialSetting;
