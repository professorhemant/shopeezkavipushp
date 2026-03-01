const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockAlert = sequelize.define('StockAlert', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  product_id: { type: DataTypes.UUID },
  alert_type: { type: DataTypes.ENUM('low_stock', 'out_of_stock', 'expiry', 'overstock'), allowNull: false },
  message: { type: DataTypes.TEXT },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  resolved_at: { type: DataTypes.DATE },
}, { tableName: 'stock_alerts' });

module.exports = StockAlert;
