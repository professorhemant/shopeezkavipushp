const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Permission = sequelize.define('Permission', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  module: { type: DataTypes.STRING(100), allowNull: false },
  action: { type: DataTypes.STRING(100), allowNull: false },
  label: { type: DataTypes.STRING(200) },
}, { tableName: 'permissions' });

module.exports = Permission;
