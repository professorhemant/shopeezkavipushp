const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DayBookBridalBooking = sequelize.define('DayBookBridalBooking', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  slip_no: { type: DataTypes.STRING(50) },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  payment_mode: { type: DataTypes.ENUM('cash', 'online', 'card'), defaultValue: 'cash' },
  function_date:  { type: DataTypes.DATEONLY },
  booking_date:   { type: DataTypes.DATEONLY },
  pickup_date:    { type: DataTypes.DATEONLY },
  return_date:    { type: DataTypes.DATEONLY },
  booking_amount: { type: DataTypes.DECIMAL(12, 2) },
  customer_name:  { type: DataTypes.STRING(100) },
  mobile_no:      { type: DataTypes.STRING(20) },
}, { tableName: 'daybook_bridal_bookings' });

module.exports = DayBookBridalBooking;
