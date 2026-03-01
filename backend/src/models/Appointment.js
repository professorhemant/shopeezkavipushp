const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  customer_id: { type: DataTypes.UUID },
  customer_name: { type: DataTypes.STRING(200) },
  customer_phone: { type: DataTypes.STRING(20) },
  staff_id: { type: DataTypes.UUID },
  service: { type: DataTypes.STRING(200), allowNull: false },
  appointment_date: { type: DataTypes.DATEONLY, allowNull: false },
  appointment_time: { type: DataTypes.TIME, allowNull: false },
  duration_minutes: { type: DataTypes.INTEGER, defaultValue: 30 },
  status: { type: DataTypes.ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'), defaultValue: 'scheduled' },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
  reminder_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'appointments' });

module.exports = Appointment;
