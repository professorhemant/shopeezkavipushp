const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PurchaseItem = sequelize.define('PurchaseItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  purchase_id: { type: DataTypes.UUID, allowNull: false },
  product_id: { type: DataTypes.UUID },
  product_name: { type: DataTypes.STRING(255), allowNull: false },
  hsn_code: { type: DataTypes.STRING(20) },
  batch_no: { type: DataTypes.STRING(100) },
  expiry_date: { type: DataTypes.DATEONLY },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  free_qty: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  unit: { type: DataTypes.STRING(20) },
  unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  mrp: { type: DataTypes.DECIMAL(12, 2) },
  discount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  discount_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  taxable_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  tax_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  cgst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  sgst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  igst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  update_stock: { type: DataTypes.BOOLEAN, defaultValue: true },
  update_cost: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'purchase_items' });

module.exports = PurchaseItem;
