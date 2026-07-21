const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A payroll employee — a person the firm pays a salary to.
// Distinct from `User` (an app-login account); an employee may not have a login.
const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firm_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING(150), allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  designation: { type: DataTypes.STRING(100) },            // job title, e.g. Beautician, Helper
  employment_type: {                                        // "Type of appointment"
    type: DataTypes.ENUM('permanent', 'contract', 'part_time', 'probation', 'intern', 'purely_temporary', 'daily_wages'),
    defaultValue: 'permanent',
  },
  pay_basis: {                                              // how monthly_salary is interpreted for pay
    type: DataTypes.ENUM('monthly', 'daily'),               // 'monthly' = fixed monthly salary; 'daily' = rate/day × days worked
    defaultValue: 'monthly',
  },
  work_timings: { type: DataTypes.STRING(100) },            // e.g. "10:00 AM – 7:00 PM"
  monthly_off: { type: DataTypes.INTEGER, defaultValue: 4 }, // free offs allowed per month; extras deducted at salary/30
  monthly_salary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, // monthly salary, OR daily rate when pay_basis='daily'
  date_of_joining: { type: DataTypes.DATEONLY },
  address: { type: DataTypes.STRING(255) },
  emergency_contact: { type: DataTypes.STRING(50) },
  deduct_leaves: { type: DataTypes.BOOLEAN, defaultValue: false }, // auto-deduct salary for leave days
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.UUID },
}, { tableName: 'employees' });

module.exports = Employee;
