const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A saved lehenga rental invoice (Booking / Pickup / Final). Fields are
// snapshotted at save time so the list survives later rental edits.
const LehengaRentalInvoice = sequelize.define('LehengaRentalInvoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  invoice_no: { type: DataTypes.STRING(30) },
  type: { type: DataTypes.ENUM('booking', 'pickup', 'final'), defaultValue: 'booking' },
  rental_id: { type: DataTypes.UUID, allowNull: true },

  customer_name: { type: DataTypes.STRING(100) },
  mobile_no: { type: DataTypes.STRING(20) },
  aadhaar_no: { type: DataTypes.STRING(20) },
  address: { type: DataTypes.STRING(255) },

  name: { type: DataTypes.STRING(255) },
  code: { type: DataTypes.STRING(50) },
  category: { type: DataTypes.STRING(150) },
  size: { type: DataTypes.STRING(30) },
  colour: { type: DataTypes.STRING(80) },
  stylist: { type: DataTypes.STRING(100) },

  function_date: { type: DataTypes.DATEONLY },
  pickup_date: { type: DataTypes.DATEONLY },
  return_date: { type: DataTypes.DATEONLY },

  rent: { type: DataTypes.DECIMAL(12, 2) },
  discount: { type: DataTypes.DECIMAL(12, 2) },
  booking_amount: { type: DataTypes.DECIMAL(12, 2) },
  security: { type: DataTypes.DECIMAL(12, 2) },
  damage: { type: DataTypes.DECIMAL(12, 2) },
  total: { type: DataTypes.DECIMAL(12, 2) },
  // No DB defaultValue — MySQL forbids DEFAULT on TEXT
  reasons: { type: DataTypes.TEXT },
  alteration: { type: DataTypes.TEXT },
  // Lehenga photo, stored as a data URL so reopened invoices keep the image
  lehenga_image: { type: DataTypes.TEXT('long') },
  invoice_date: { type: DataTypes.DATEONLY },
}, { tableName: 'lehenga_rental_invoices' });

module.exports = LehengaRentalInvoice;
