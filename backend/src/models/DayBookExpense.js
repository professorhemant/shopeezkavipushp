const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DayBookExpense = sequelize.define('DayBookExpense', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  expense_type: { type: DataTypes.ENUM('routine', 'incentive', 'salary', 'advance_salary'), allowNull: false },
  category: { type: DataTypes.STRING(100) }, // for routine: milk, polythin, etc.
  description: { type: DataTypes.STRING(255) }, // for incentive/salary: employee name
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  payment_mode: { type: DataTypes.ENUM('cash', 'online'), defaultValue: 'cash' },
  paid_by: { type: DataTypes.STRING(100) }, // who paid (for salary/advance_salary)
}, { tableName: 'daybook_expenses' });

module.exports = DayBookExpense;
