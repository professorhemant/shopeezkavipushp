const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Simple monthly leave count for an employee (one row per employee per month).
const EmployeeLeave = sequelize.define('EmployeeLeave', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  employee_id: { type: DataTypes.UUID, allowNull: false },
  month: { type: DataTypes.DATEONLY, allowNull: false },    // first day of the month
  leave_days: { type: DataTypes.DECIMAL(5, 1), defaultValue: 0 }, // allows half-days
  notes: { type: DataTypes.STRING(255) },
}, {
  tableName: 'employee_leaves',
  indexes: [{ unique: true, fields: ['employee_id', 'month'] }],
});

module.exports = EmployeeLeave;
