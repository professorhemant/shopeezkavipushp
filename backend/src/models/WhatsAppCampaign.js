const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WhatsAppCampaign = sequelize.define('WhatsAppCampaign', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING(200), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  media_url: { type: DataTypes.STRING(500) },
  target_type: { type: DataTypes.ENUM('all_customers', 'customer_group', 'custom'), defaultValue: 'all_customers' },
  target_group: { type: DataTypes.STRING(100) },
  recipients: { type: DataTypes.JSON },
  scheduled_at: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'sent', 'failed'), defaultValue: 'draft' },
  sent_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  failed_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  created_by: { type: DataTypes.UUID },
}, { tableName: 'whatsapp_campaigns' });

module.exports = WhatsAppCampaign;
