const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// An outright lehenga sale. The row IS the tax invoice — it carries its own
// invoice number and the full GST breakup, all snapshotted at save time so the
// bill never changes if inventory is later edited.
const LehengaSale = sequelize.define('LehengaSale', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  invoice_no: { type: DataTypes.STRING(30) },

  lehenga_id: { type: DataTypes.UUID, allowNull: true },
  code: { type: DataTypes.STRING(50) },
  name: { type: DataTypes.STRING(255) },
  category: { type: DataTypes.STRING(150) },
  size: { type: DataTypes.STRING(30) },
  colour: { type: DataTypes.STRING(80) },
  hsn_code: { type: DataTypes.STRING(20) },
  // Lehenga photo, stored as a data URL so reopened bills keep the image
  lehenga_image: { type: DataTypes.TEXT('long') },

  customer_name: { type: DataTypes.STRING(100) },
  mobile_no: { type: DataTypes.STRING(20) },
  aadhaar_no: { type: DataTypes.STRING(20) },
  address: { type: DataTypes.STRING(255) },
  gstin: { type: DataTypes.STRING(20) },

  sale_date: { type: DataTypes.DATEONLY },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  unit_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  discount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  // Derived server-side from the three fields above — never trusted from the client
  taxable_value: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  gst_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 5 },
  cgst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  sgst: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  amount_paid: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  payment_mode: { type: DataTypes.ENUM('cash', 'online', 'card'), defaultValue: 'cash' },

  salesperson: { type: DataTypes.STRING(150) },
  // No DB defaultValue — MySQL forbids DEFAULT on TEXT
  notes: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('completed', 'cancelled'), defaultValue: 'completed' },
}, { tableName: 'lehenga_sales' });

module.exports = LehengaSale;
