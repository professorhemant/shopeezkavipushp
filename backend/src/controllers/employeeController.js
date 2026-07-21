'use strict';

const { Op } = require('sequelize');
const { Employee, PayrollEntry, EmployeeLeave } = require('../models');

// ─── Helpers ─────────────────────────────────────────────────────
const num = (v) => parseFloat(v || 0) || 0;

// First day of the month (YYYY-MM-01) for a given date string / Date.
const monthStart = (d) => {
  const dt = d ? new Date(d) : new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
};

// Compute the payroll picture for one employee for one month.
// entries = that employee's PayrollEntry rows (all months); leaveDays for the month.
const monthSummary = (employee, entries, month, leaveDays) => {
  const forMonth = entries.filter((e) => e.for_month === month);
  const sumType = (t) => forMonth.filter((e) => e.entry_type === t).reduce((s, e) => s + num(e.amount), 0);

  const base = num(employee.monthly_salary);
  const incentives = sumType('incentive');
  const manualDeductions = sumType('deduction');
  const advancePaid = sumType('advance');
  const salaryPaid = sumType('salary');

  const days = num(leaveDays);
  const leaveDeduction = employee.deduct_leaves && days > 0
    ? Math.round((base / 30) * days)
    : 0;

  const netPayable = base + incentives - manualDeductions - leaveDeduction;
  const totalPaid = advancePaid + salaryPaid;
  const balance = netPayable - totalPaid;
  const status = totalPaid <= 0 ? 'unpaid' : (balance <= 0.5 ? 'paid' : 'partial');

  return {
    month,
    base_salary: base,
    incentives,
    manual_deductions: manualDeductions,
    leave_days: days,
    leave_deduction: leaveDeduction,
    net_payable: netPayable,
    advance_paid: advancePaid,
    salary_paid: salaryPaid,
    total_paid: totalPaid,
    balance,
    status,
  };
};

// ─── Employees ───────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const month = monthStart(req.query.month);
    const where = { firm_id: req.firmId };
    if (req.query.is_active !== undefined) where.is_active = req.query.is_active === 'true';
    if (req.query.search) where.name = { [Op.like]: `%${req.query.search}%` };

    const employees = await Employee.findAll({ where, order: [['is_active', 'DESC'], ['name', 'ASC']] });
    const ids = employees.map((e) => e.id);

    const [entries, leaves] = await Promise.all([
      ids.length ? PayrollEntry.findAll({ where: { employee_id: { [Op.in]: ids }, for_month: month } }) : [],
      ids.length ? EmployeeLeave.findAll({ where: { employee_id: { [Op.in]: ids }, month } }) : [],
    ]);

    const data = employees.map((emp) => {
      const empEntries = entries.filter((e) => e.employee_id === emp.id);
      const leave = leaves.find((l) => l.employee_id === emp.id);
      return { ...emp.toJSON(), summary: monthSummary(emp, empEntries, month, leave?.leave_days) };
    });

    res.json({ success: true, data, month });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const month = monthStart(req.query.month);
    const [entries, leave] = await Promise.all([
      PayrollEntry.findAll({ where: { employee_id: employee.id }, order: [['payment_date', 'DESC'], ['createdAt', 'DESC']] }),
      EmployeeLeave.findOne({ where: { employee_id: employee.id, month } }),
    ]);

    const summary = monthSummary(employee, entries, month, leave?.leave_days);
    res.json({
      success: true,
      data: {
        employee: employee.toJSON(),
        month,
        summary,
        leave: leave ? leave.toJSON() : { month, leave_days: 0, notes: '' },
        entries: entries.map((e) => e.toJSON()),
      },
    });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const row = await Employee.create({ ...req.body, firm_id: req.firmId, created_by: req.userId });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const row = await Employee.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Employee not found' });
    const { id, firm_id, created_by, ...fields } = req.body;
    await row.update(fields);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const row = await Employee.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Employee not found' });
    await PayrollEntry.destroy({ where: { employee_id: row.id } });
    await EmployeeLeave.destroy({ where: { employee_id: row.id } });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── Payroll entries ─────────────────────────────────────────────
const addEntry = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (!req.body.amount) return res.status(400).json({ success: false, message: 'Amount is required' });

    const row = await PayrollEntry.create({
      ...req.body,
      employee_id: employee.id,
      firm_id: req.firmId,
      created_by: req.userId,
      for_month: monthStart(req.body.for_month || req.body.payment_date),
      payment_date: req.body.payment_date || new Date().toISOString().split('T')[0],
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
};

const updateEntry = async (req, res, next) => {
  try {
    const row = await PayrollEntry.findOne({ where: { id: req.params.entryId, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Entry not found' });
    const { id, firm_id, employee_id, created_by, ...fields } = req.body;
    if (fields.for_month) fields.for_month = monthStart(fields.for_month);
    await row.update(fields);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const deleteEntry = async (req, res, next) => {
  try {
    const row = await PayrollEntry.findOne({ where: { id: req.params.entryId, firm_id: req.firmId } });
    if (!row) return res.status(404).json({ success: false, message: 'Entry not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── Leave (monthly) ─────────────────────────────────────────────
const setLeave = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const month = monthStart(req.body.month);
    const [row] = await EmployeeLeave.findOrCreate({
      where: { employee_id: employee.id, month },
      defaults: { firm_id: req.firmId, leave_days: 0 },
    });
    await row.update({ leave_days: num(req.body.leave_days), notes: req.body.notes || null });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

module.exports = {
  getAll, getOne, create, update, remove,
  addEntry, updateEntry, deleteEntry,
  setLeave,
};
