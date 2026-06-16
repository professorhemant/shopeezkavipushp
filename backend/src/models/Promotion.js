const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Promotion = sequelize.define('Promotion', {
  id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id:              { type: DataTypes.UUID, allowNull: false },
  promo_number:         { type: DataTypes.STRING(30) },
  sent_to_name:         { type: DataTypes.STRING(200), allowNull: false },
  sent_to_type:         { type: DataTypes.ENUM('celebrity','influencer','model','designer','event','other'), defaultValue: 'celebrity' },
  contact_phone:        { type: DataTypes.STRING(20) },
  contact_instagram:    { type: DataTypes.STRING(100) },
  sent_date:            { type: DataTypes.DATEONLY, allowNull: false },
  expected_return_date: { type: DataTypes.DATEONLY },
  actual_return_date:   { type: DataTypes.DATEONLY },
  event_name:           { type: DataTypes.STRING(255) },
  status:               { type: DataTypes.ENUM('sent','returned','lost'), defaultValue: 'sent' },
  notes:                { type: DataTypes.TEXT },
  items_json:           { type: DataTypes.TEXT },
}, { tableName: 'promotions' });

module.exports = Promotion;
