const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  reference_type: { type: DataTypes.ENUM('sale', 'purchase', 'expense', 'advance'), allowNull: false },
  sale_id: { type: DataTypes.UUID },
  purchase_id: { type: DataTypes.UUID },
  customer_id: { type: DataTypes.UUID },
  supplier_id: { type: DataTypes.UUID },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  payment_date: { type: DataTypes.DATEONLY, allowNull: false },
  payment_mode: { type: DataTypes.ENUM('cash', 'upi', 'card', 'netbanking', 'cheque', 'neft', 'rtgs', 'other'), defaultValue: 'cash' },
  reference_no: { type: DataTypes.STRING(100) },
  bank_name: { type: DataTypes.STRING(100) },
  cheque_date: { type: DataTypes.DATEONLY },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.UUID },
}, { tableName: 'payments' });

module.exports = Payment;
