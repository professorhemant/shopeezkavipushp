const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FixedAsset = sequelize.define('FixedAsset', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING(200), allowNull: false },
  asset_type: { type: DataTypes.STRING(100) },
  purchase_date: { type: DataTypes.DATEONLY },
  purchase_price: { type: DataTypes.DECIMAL(12, 2) },
  current_value: { type: DataTypes.DECIMAL(12, 2) },
  depreciation_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  depreciation_method: { type: DataTypes.ENUM('straight_line', 'wdv'), defaultValue: 'straight_line' },
  location: { type: DataTypes.STRING(200) },
  serial_no: { type: DataTypes.STRING(100) },
  notes: { type: DataTypes.TEXT },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'fixed_assets' });

module.exports = FixedAsset;
