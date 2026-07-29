const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SaleItem = sequelize.define('SaleItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sale_id: { type: DataTypes.UUID, allowNull: false },
  product_id: { type: DataTypes.UUID },
  variant_id: { type: DataTypes.UUID },
  batch_id: { type: DataTypes.UUID },
  product_name: { type: DataTypes.STRING(255), allowNull: false },
  hsn_code: { type: DataTypes.STRING(20) },
  barcode: { type: DataTypes.STRING(100) },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  unit: { type: DataTypes.STRING(20) },
  unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  mrp: { type: DataTypes.DECIMAL(12, 2) },
  discount_type: { type: DataTypes.ENUM('percent', 'amount'), defaultValue: 'percent' },
  discount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  discount_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  taxable_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  tax_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  cgst_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  sgst_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  igst_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  cgst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  sgst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  igst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  serial_nos: { type: DataTypes.JSON },
}, { tableName: 'sale_items' });

module.exports = SaleItem;
