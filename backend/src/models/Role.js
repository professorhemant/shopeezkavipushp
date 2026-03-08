const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.STRING(255) },
  firm_id: { type: DataTypes.UUID },
  is_system: { type: DataTypes.BOOLEAN, defaultValue: false },
  permissions: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      const raw = this.getDataValue('permissions');
      try { return raw ? JSON.parse(raw) : []; } catch { return []; }
    },
    set(val) {
      this.setDataValue('permissions', JSON.stringify(val || []));
    },
  },
}, { tableName: 'roles' });

module.exports = Role;
