const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductVariant = sequelize.define('ProductVariant', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  product_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  sku: { type: DataTypes.STRING(100) },
  barcode: { type: DataTypes.STRING(100) },
  attributes: { type: DataTypes.JSON },
  purchase_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  sale_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  mrp: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  stock: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  image: { type: DataTypes.STRING(500) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'product_variants' });

module.exports = ProductVariant;
