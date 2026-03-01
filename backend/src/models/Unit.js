const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Unit = sequelize.define('Unit', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(50), allowNull: false },
  short_name: { type: DataTypes.STRING(20), allowNull: false },
  firm_id: { type: DataTypes.UUID },
  allow_decimal: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'units' });

module.exports = Unit;
