const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Firm = sequelize.define('Firm', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  legal_name: { type: DataTypes.STRING(200) },
  gstin: { type: DataTypes.STRING(20) },
  pan: { type: DataTypes.STRING(15) },
  phone: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(150) },
  address: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING(100) },
  state: { type: DataTypes.STRING(100) },
  state_code: { type: DataTypes.STRING(5) },
  pincode: { type: DataTypes.STRING(10) },
  country: { type: DataTypes.STRING(50), defaultValue: 'India' },
  logo: { type: DataTypes.STRING(500) },
  signature: { type: DataTypes.STRING(500) },
  currency: { type: DataTypes.STRING(10), defaultValue: 'INR' },
  currency_symbol: { type: DataTypes.STRING(5), defaultValue: '₹' },
  financial_year_start: { type: DataTypes.DATEONLY },
  invoice_prefix: { type: DataTypes.STRING(20), defaultValue: 'INV' },
  invoice_counter: { type: DataTypes.INTEGER, defaultValue: 1 },
  business_type: { type: DataTypes.STRING(100) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  owner_id: { type: DataTypes.UUID },
}, {
  tableName: 'firms',
});

module.exports = Firm;
