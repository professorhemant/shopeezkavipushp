const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Single typed inventory of bridal items. item_type buckets each row so the
// booking form can populate the Bridal Set + accessory dropdowns from one table.
const BridalInventory = sequelize.define('BridalInventory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  code: { type: DataTypes.STRING(50) },
  name: { type: DataTypes.STRING(255), allowNull: false },
  item_type: {
    type: DataTypes.ENUM('set', 'nath', 'maang_teeka', 'ring', 'matha_patti', 'sheesh_patti', 'hath_phool', 'pasa'),
    defaultValue: 'set',
  },
  category: { type: DataTypes.STRING(150) },
  rental_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  stock: { type: DataTypes.INTEGER, defaultValue: 1 },
  // No DB defaultValue — MySQL forbids DEFAULT on TEXT
  description: { type: DataTypes.TEXT },
  image: { type: DataTypes.STRING(500) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'bridal_inventory' });

module.exports = BridalInventory;
