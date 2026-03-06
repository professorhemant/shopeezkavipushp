const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DayBookConfig = sequelize.define('DayBookConfig', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  opening_balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
}, { tableName: 'daybook_config' });

module.exports = DayBookConfig;
