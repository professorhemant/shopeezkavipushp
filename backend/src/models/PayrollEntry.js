const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A single money movement for an employee's payroll.
//   salary    → a salary payment (toward the month's wage)
//   advance   → advance money given, adjusted against the month's wage
//   incentive → a bonus that adds to what's payable
//   deduction → a manual deduction from what's payable (fine, damage, etc.)
const PayrollEntry = sequelize.define('PayrollEntry', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  employee_id: { type: DataTypes.UUID, allowNull: false },
  entry_type: { type: DataTypes.ENUM('salary', 'advance', 'incentive', 'deduction'), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  for_month: { type: DataTypes.DATEONLY },                  // first day of the month this pertains to
  payment_date: { type: DataTypes.DATEONLY, allowNull: false },
  payment_mode: { type: DataTypes.ENUM('cash', 'online'), defaultValue: 'cash' },
  paid_by: { type: DataTypes.STRING(100) },
  notes: { type: DataTypes.STRING(255) },
  created_by: { type: DataTypes.UUID },
}, { tableName: 'payroll_entries' });

module.exports = PayrollEntry;
