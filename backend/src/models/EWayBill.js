const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EWayBill = sequelize.define('EWayBill', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  sale_id: { type: DataTypes.UUID },
  ewb_no: { type: DataTypes.STRING(50) },
  ewb_date: { type: DataTypes.DATE },
  valid_upto: { type: DataTypes.DATE },
  transporter_id: { type: DataTypes.STRING(20) },
  transporter_name: { type: DataTypes.STRING(200) },
  vehicle_no: { type: DataTypes.STRING(20) },
  transport_mode: { type: DataTypes.ENUM('road', 'rail', 'air', 'ship'), defaultValue: 'road' },
  distance: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('pending', 'generated', 'cancelled', 'expired'), defaultValue: 'pending' },
  error_msg: { type: DataTypes.TEXT },
}, { tableName: 'e_way_bills' });

module.exports = EWayBill;
