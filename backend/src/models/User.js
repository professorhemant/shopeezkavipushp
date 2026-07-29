const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  password: { type: DataTypes.STRING(255), allowNull: false },
  firm_id: { type: DataTypes.UUID },
  role_name: { type: DataTypes.ENUM('super_admin', 'admin', 'manager', 'staff', 'billing'), defaultValue: 'staff' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  avatar: { type: DataTypes.STRING(500) },
  last_login: { type: DataTypes.DATE },
  otp: { type: DataTypes.STRING(10) },
  otp_expires: { type: DataTypes.DATE },
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) user.password = await bcrypt.hash(user.password, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) user.password = await bcrypt.hash(user.password, 10);
    },
  },
});

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.otp;
  return values;
};

module.exports = User;
