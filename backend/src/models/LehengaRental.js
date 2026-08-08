const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A saved bridal lehenga rental. The chosen piece is snapshotted as plain
// columns so the rental record survives later edits/deletes in Lehenga Inventory.
const LehengaRental = sequelize.define('LehengaRental', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },

  lehenga_id: { type: DataTypes.UUID, allowNull: true },
  code: { type: DataTypes.STRING(50) },
  name: { type: DataTypes.STRING(255) },
  category: { type: DataTypes.STRING(150) },
  size: { type: DataTypes.STRING(30) },
  colour: { type: DataTypes.STRING(80) },
  // URL of the lehenga photo (auto-filled from inventory or uploaded)
  lehenga_image: { type: DataTypes.STRING(500) },
  // Free-text piece when the customer's lehenga isn't a stocked item
  customized_lehenga: { type: DataTypes.STRING(255) },

  customer_name: { type: DataTypes.STRING(100) },
  mobile_no: { type: DataTypes.STRING(20) },
  aadhaar_no: { type: DataTypes.STRING(20) },
  address: { type: DataTypes.STRING(255) },

  function_date: { type: DataTypes.DATEONLY },
  booking_date: { type: DataTypes.DATEONLY },
  pickup_date: { type: DataTypes.DATEONLY },
  return_date: { type: DataTypes.DATEONLY },

  rental_amount: { type: DataTypes.DECIMAL(12, 2) },
  booking_amount: { type: DataTypes.DECIMAL(12, 2) },
  security_amount: { type: DataTypes.DECIMAL(12, 2) },
  discount: { type: DataTypes.DECIMAL(12, 2) },
  damage_charges: { type: DataTypes.DECIMAL(12, 2) },
  payment_mode: { type: DataTypes.ENUM('cash', 'online', 'card'), defaultValue: 'cash' },

  stylist: { type: DataTypes.STRING(150) },
  // No DB defaultValue — MySQL forbids DEFAULT on TEXT
  alteration: { type: DataTypes.TEXT },
  notes: { type: DataTypes.TEXT },

  status: { type: DataTypes.ENUM('active', 'returned', 'cancelled'), defaultValue: 'active' },
  returned_on: { type: DataTypes.DATEONLY },
}, { tableName: 'lehenga_rentals' });

module.exports = LehengaRental;
