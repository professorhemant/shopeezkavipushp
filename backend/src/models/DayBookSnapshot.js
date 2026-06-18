const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A frozen copy of a day's computed Day Book summary, saved explicitly by the
// user ("Save Day Book"). Lets a closed day be reviewed later even if the
// underlying sales/expenses change.
const DayBookSnapshot = sequelize.define('DayBookSnapshot', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  saved_by: { type: DataTypes.STRING(150) },
  data: {
    type: DataTypes.TEXT('long'),
    defaultValue: '{}',
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
