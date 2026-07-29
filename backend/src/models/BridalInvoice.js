const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A saved bridal invoice (Booking / Pickup / Final). Fields are snapshotted at
// save time so the list survives later booking edits.
const BridalInvoice = sequelize.define('BridalInvoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  invoice_no: { type: DataTypes.STRING(30) },
  type: { type: DataTypes.ENUM('booking', 'pickup', 'final'), defaultValue: 'booking' },
  booking_id: { type: DataTypes.UUID, allowNull: true },

  customer_name: { type: DataTypes.STRING(100) },
  mobile_no: { type: DataTypes.STRING(20) },
  aadhaar_no: { type: DataTypes.STRING(20) },
  set_name: { type: DataTypes.STRING(255) },
  set_code: { type: DataTypes.STRING(50) },
  category: { type: DataTypes.STRING(150) },
  stylist: { type: DataTypes.STRING(100) },

  function_date: { type: DataTypes.DATEONLY },
  pickup_date: { type: DataTypes.DATEONLY },
  return_date: { type: DataTypes.DATEONLY },

  rent: { type: DataTypes.DECIMAL(12, 2) },
  booking_amount: { type: DataTypes.DECIMAL(12, 2) },
  security: { type: DataTypes.DECIMAL(12, 2) },
  damage: { type: DataTypes.DECIMAL(12, 2) },
  total: { type: DataTypes.DECIMAL(12, 2) },
  // No DB defaultValue — MySQL forbids DEFAULT on TEXT
  reasons: { type: DataTypes.TEXT },
  // Bridal set photo, stored as a data URL so reopened invoices keep the image
  set_image: { type: DataTypes.TEXT('long') },
  invoice_date: { type: DataTypes.DATEONLY },
}, { tableName: 'bridal_invoices' });

module.exports = BridalInvoice;
