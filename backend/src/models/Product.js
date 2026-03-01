const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  sku: { type: DataTypes.STRING(100) },
  barcode: { type: DataTypes.STRING(100) },
  hsn_code: { type: DataTypes.STRING(20) },
  description: { type: DataTypes.TEXT },
  firm_id: { type: DataTypes.UUID },
  category_id: { type: DataTypes.UUID },
  brand_id: { type: DataTypes.UUID },
  unit_id: { type: DataTypes.UUID },
  purchase_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  sale_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  mrp: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  wholesale_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  tax_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 18 },
  tax_type: { type: DataTypes.ENUM('inclusive', 'exclusive'), defaultValue: 'exclusive' },
  stock: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  min_stock: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  max_stock: { type: DataTypes.DECIMAL(12, 3) },
  opening_stock: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  images: { type: DataTypes.JSON },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  has_variants: { type: DataTypes.BOOLEAN, defaultValue: false },
  has_batches: { type: DataTypes.BOOLEAN, defaultValue: false },
  track_inventory: { type: DataTypes.BOOLEAN, defaultValue: true },
  is_service: { type: DataTypes.BOOLEAN, defaultValue: false },
  weight: { type: DataTypes.DECIMAL(10, 3) },
  weight_unit: { type: DataTypes.STRING(10) },
  location: { type: DataTypes.STRING(100) },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'products' });

module.exports = Product;
