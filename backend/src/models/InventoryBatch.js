const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryBatch = sequelize.define('InventoryBatch', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  product_id: { type: DataTypes.UUID, allowNull: false },
  batch_no: { type: DataTypes.STRING(100), allowNull: false },
  manufacturing_date: { type: DataTypes.DATEONLY },
  expiry_date: { type: DataTypes.DATEONLY },
  quantity: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  purchase_price: { type: DataTypes.DECIMAL(12, 2) },
  sale_price: { type: DataTypes.DECIMAL(12, 2) },
  mrp: { type: DataTypes.DECIMAL(12, 2) },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'inventory_batches' });

module.exports = InventoryBatch;
