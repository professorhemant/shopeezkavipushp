'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoyaltyTransaction = sequelize.define('LoyaltyTransaction', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id:          { type: DataTypes.UUID, allowNull: false },
  customer_id:      { type: DataTypes.UUID, allowNull: false },
  sale_id:          { type: DataTypes.UUID },
  transaction_type: { type: DataTypes.ENUM('earn', 'redeem', 'expire', 'adjust'), allowNull: false },
  points:           { type: DataTypes.INTEGER, allowNull: false },  // +earn / -redeem / -expire
  balance_after:    { type: DataTypes.INTEGER, allowNull: false },
  notes:            { type: DataTypes.STRING(255) },
}, { tableName: 'loyalty_transactions' });

module.exports = LoyaltyTransaction;
