const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExpenseCategory = sequelize.define('ExpenseCategory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.STRING(255) },
}, { tableName: 'expense_categories' });

module.exports = ExpenseCategory;
