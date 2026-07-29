const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  category_id: { type: DataTypes.UUID },
  title: { type: DataTypes.STRING(255), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  expense_date: { type: DataTypes.DATEONLY, allowNull: false },
  payment_mode: { type: DataTypes.STRING(50), defaultValue: 'cash' },
  reference_no: { type: DataTypes.STRING(100) },
  receipt: { type: DataTypes.STRING(500) },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.UUID },
}, { tableName: 'expenses' });

module.exports = Expense;
