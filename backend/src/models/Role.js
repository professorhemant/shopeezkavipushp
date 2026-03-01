const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.STRING(255) },
  firm_id: { type: DataTypes.UUID },
  is_system: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'roles' });

module.exports = Role;
