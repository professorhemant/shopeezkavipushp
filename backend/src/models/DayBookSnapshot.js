const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A frozen copy of a day's computed Day Book summary, saved explicitly by the
// user ("Save Day Book"). Lets a closed day be reviewed later even if the
// underlying sales/expenses change.
const DayBookSnapshot = sequelize.define('DayBookSnapshot', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  saved_by: { type: DataTypes.STRING(150) },
  // No DB defaultValue — MySQL forbids DEFAULT on TEXT/LONGTEXT columns
  // (ER_BLOB_CANT_HAVE_DEFAULT). The getter/setter handle JSON, and a null
  // raw value reads back as {}.
  data: {
    type: DataTypes.TEXT('long'),
    get() {
      const raw = this.getDataValue('data');
      try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
    },
    set(val) {
      this.setDataValue('data', JSON.stringify(val || {}));
    },
  },
}, { tableName: 'daybook_snapshots' });

module.exports = DayBookSnapshot;
