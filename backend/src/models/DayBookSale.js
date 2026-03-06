const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DayBookSale = sequelize.define('DayBookSale', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  bill_no: { type: DataTypes.STRING(50) },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  payment_mode: { type: DataTypes.ENUM('cash', 'online'), defaultValue: 'cash' },
}, { tableName: 'daybook_sales' });

module.exports = DayBookSale;
