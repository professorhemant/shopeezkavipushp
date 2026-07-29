const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING(200), allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(150) },
  gstin: { type: DataTypes.STRING(20) },
  pan: { type: DataTypes.STRING(15) },
  billing_address: { type: DataTypes.TEXT },
  shipping_address: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING(100) },
  state: { type: DataTypes.STRING(100) },
  state_code: { type: DataTypes.STRING(5) },
  pincode: { type: DataTypes.STRING(10) },
  credit_limit: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  credit_days: { type: DataTypes.INTEGER, defaultValue: 0 },
  opening_balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  balance_type: { type: DataTypes.ENUM('debit', 'credit'), defaultValue: 'debit' },
  discount_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  price_list: { type: DataTypes.JSON },
  customer_group: { type: DataTypes.STRING(100) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'customers' });

module.exports = Customer;
