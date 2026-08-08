const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Bridal lehenga stock. Kept separate from bridal_inventory (jewellery) because a
// lehenga carries garment attributes (size/colour/fabric) and can be both rented
// and sold, so it needs a rental price and a sale price side by side.
const LehengaInventory = sequelize.define('LehengaInventory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  code: { type: DataTypes.STRING(50) },
  name: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(150) },
  size: { type: DataTypes.STRING(30) },
  colour: { type: DataTypes.STRING(80) },
  fabric: { type: DataTypes.STRING(120) },
  work_type: { type: DataTypes.STRING(120) },
  rental_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  sale_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  cost_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  stock: { type: DataTypes.INTEGER, defaultValue: 1 },
  location: { type: DataTypes.STRING(255) },
  // No DB defaultValue — MySQL forbids DEFAULT on TEXT
  description: { type: DataTypes.TEXT },
  image: { type: DataTypes.STRING(500) },
  // Which flows this piece may be used in: Rental only, Sale only, or both.
  available_for: { type: DataTypes.ENUM('rental', 'sale', 'both'), defaultValue: 'both' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'lehenga_inventory' });

module.exports = LehengaInventory;
