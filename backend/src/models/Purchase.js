const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Purchase = sequelize.define('Purchase', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  po_no: { type: DataTypes.STRING(50) },
  bill_no: { type: DataTypes.STRING(50) },
  bill_date: { type: DataTypes.DATEONLY, allowNull: false },
  due_date: { type: DataTypes.DATEONLY },
  supplier_id: { type: DataTypes.UUID },
  supplier_name: { type: DataTypes.STRING(200) },
  supplier_gstin: { type: DataTypes.STRING(20) },
  purchase_type: { type: DataTypes.ENUM('purchase_order', 'purchase_invoice', 'debit_note'), defaultValue: 'purchase_invoice' },
  payment_status: { type: DataTypes.ENUM('unpaid', 'partial', 'paid'), defaultValue: 'unpaid' },
  status: { type: DataTypes.ENUM('draft', 'confirmed', 'received', 'cancelled'), defaultValue: 'confirmed' },
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  discount_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  taxable_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  cgst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  sgst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  igst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  paid_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  is_interstate: { type: DataTypes.BOOLEAN, defaultValue: false },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.UUID },
}, { tableName: 'purchases' });

module.exports = Purchase;
