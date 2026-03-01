const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EInvoice = sequelize.define('EInvoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  sale_id: { type: DataTypes.UUID },
  irn: { type: DataTypes.STRING(200) },
  ack_no: { type: DataTypes.STRING(100) },
  ack_date: { type: DataTypes.DATE },
  signed_invoice: { type: DataTypes.TEXT },
  qr_code: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('pending', 'generated', 'cancelled', 'failed'), defaultValue: 'pending' },
  error_msg: { type: DataTypes.TEXT },
  cancel_reason: { type: DataTypes.STRING(255) },
  cancelled_at: { type: DataTypes.DATE },
}, { tableName: 'e_invoices' });

module.exports = EInvoice;
