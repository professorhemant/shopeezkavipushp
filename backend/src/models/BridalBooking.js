const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A saved bridal booking. Set + accessory selections are snapshotted as text so
// the booking record survives later edits/deletes in Bridal Inventory.
const BridalBooking = sequelize.define('BridalBooking', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },

  bridal_set_id: { type: DataTypes.UUID, allowNull: true },
  set_code: { type: DataTypes.STRING(50) },
  set_name: { type: DataTypes.STRING(255) },
  category: { type: DataTypes.STRING(150) },
  customized_set: { type: DataTypes.STRING(255) },
  // URL of the bridal set photo (auto-filled from inventory or uploaded)
  set_image: { type: DataTypes.STRING(500) },

  nath:         { type: DataTypes.STRING(255) },
  maang_teeka:  { type: DataTypes.STRING(255) },
  ring:         { type: DataTypes.STRING(255) },
  matha_patti:  { type: DataTypes.STRING(255) },
  sheesh_patti: { type: DataTypes.STRING(255) },
  hath_phool:   { type: DataTypes.STRING(255) },
  pasa:         { type: DataTypes.STRING(255) },
  any_other_item: { type: DataTypes.STRING(255) },

  bridal_set_rent: { type: DataTypes.DECIMAL(12, 2) },
  booking_amount:  { type: DataTypes.DECIMAL(12, 2) },
  // No DB defaultValue — MySQL forbids DEFAULT on TEXT
  customization: { type: DataTypes.TEXT },
  stylist: { type: DataTypes.STRING(150) },

  customer_name: { type: DataTypes.STRING(100) },
  mobile_no:     { type: DataTypes.STRING(20) },
  aadhaar_no:    { type: DataTypes.STRING(20) },

  function_date: { type: DataTypes.DATEONLY },
  booking_date:  { type: DataTypes.DATEONLY },
  pickup_date:   { type: DataTypes.DATEONLY },
  return_date:   { type: DataTypes.DATEONLY },
}, { tableName: 'bridal_bookings' });

module.exports = BridalBooking;
