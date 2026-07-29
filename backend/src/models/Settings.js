const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settings = sequelize.define('Settings', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  key: { type: DataTypes.STRING(100), allowNull: false },
  value: { type: DataTypes.TEXT },
  type: { type: DataTypes.ENUM('string', 'number', 'boolean', 'json'), defaultValue: 'string' },
  group: { type: DataTypes.STRING(100), defaultValue: 'general' },
}, {
  tableName: 'settings',
  indexes: [{ fields: ['firm_id', 'key'], unique: true }],
});

module.exports = Settings;
