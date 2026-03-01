const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Supplier = sequelize.define('Supplier', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING(200), allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(150) },
  gstin: { type: DataTypes.STRING(20) },
  pan: { type: DataTypes.STRING(15) },
  address: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING(100) },
  state: { type: DataTypes.STRING(100) },
  state_code: { type: DataTypes.STRING(5) },
  pincode: { type: DataTypes.STRING(10) },
  opening_balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  balance_type: { type: DataTypes.ENUM('debit', 'credit'), defaultValue: 'credit' },
  credit_days: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'suppliers' });

module.exports = Supplier;
