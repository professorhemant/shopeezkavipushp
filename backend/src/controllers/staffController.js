'use strict';

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Role, Permission } = require('../models');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

// All available permissions in the system
const ALL_PERMISSIONS = [
  'dashboard.view',
  'products.view', 'products.create', 'products.update', 'products.delete',
  'categories.view', 'categories.create', 'categories.update', 'categories.delete',
  'customers.view', 'customers.create', 'customers.update', 'customers.delete',
  'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
  'sales.view', 'sales.create', 'sales.update', 'sales.cancel', 'sales.return',
  'purchases.view', 'purchases.create', 'purchases.update', 'purchases.cancel',
  'inventory.view', 'inventory.adjust',
  'accounting.view', 'accounting.expenses', 'accounting.assets',
  'reports.view', 'gst.view', 'settings.view', 'settings.update',
  'staff.view', 'staff.create', 'staff.update', 'staff.deactivate',
  'whatsapp.view', 'whatsapp.send',
  'appointments.view', 'appointments.create', 'appointments.update',
];

/**
 * GET /staff
 */
const getAll = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search, is_active } = req.query;

    const where = { firm_id: req.firmId };
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password', 'otp', 'otp_expires'] },
      include: [{ model: Role, as: 'roleData', attributes: ['id', 'name'] }],
      order: [['name', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /staff/:id
 */
const getOne = async (req, res, next) => {
  try {
    const staff = await User.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      attributes: { exclude: ['password', 'otp', 'otp_expires'] },
      include: [{ model: Role, as: 'roleData' }],
    });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    return res.status(200).json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /staff
 */
const create = async (req, res, next) => {
  try {
    const { name, email, phone, password, role_name } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email and password are required.' });
    }

    const existing = await User.findOne({ where: { email, firm_id: req.firmId } });
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use by another staff member.' });

    const staff = await User.create({
      firm_id: req.firmId,
      name,
      email,
      phone: phone || null,
      password,
      role_name: role_name || 'staff',
      is_active: true,
    });

    const { password: _, ...staffData } = staff.toJSON();
    return res.status(201).json({ success: true, message: 'Staff member created.', data: staffData });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /staff/:id
 */
const update = async (req, res, next) => {
  try {
    const staff = await User.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });

    const { name, email, phone, role_name, is_active, password } = req.body;
    const body = {};
    if (name !== undefined) body.name = name;
    if (email !== undefined) body.email = email;
    if (phone !== undefined) body.phone = phone || null;
    if (role_name !== undefined) body.role_name = role_name;
    if (is_active !== undefined) body.is_active = is_active;
    if (password && password.trim()) body.password = password;
    await staff.update(body);

    const updated = await User.findByPk(staff.id, { attributes: { exclude: ['password', 'otp', 'otp_expires'] } });
    return res.status(200).json({ success: true, message: 'Staff member updated.', data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /staff/:id/deactivate
 */
const deactivate = async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }
    const staff = await User.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    await staff.update({ is_active: false });
    return res.status(200).json({ success: true, message: 'Staff member deactivated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /staff/:id
 */
const remove = async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }
    const staff = await User.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    await staff.destroy();
    return res.status(200).json({ success: true, message: 'Staff member deleted.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /staff/:id/reactivate
 */
const reactivate = async (req, res, next) => {
  try {
    const staff = await User.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    await staff.update({ is_active: true });
    return res.status(200).json({ success: true, message: 'Staff member reactivated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /staff/roles
 */
const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.findAll({
      where: { firm_id: req.firmId },
      order: [['name', 'ASC']],
    });
    return res.status(200).json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /staff/roles
 */
const createRole = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required.' });

    const role = await Role.create({
      firm_id: req.firmId,
      name,
      description: description || null,
      permissions: permissions || [],
    });
    return res.status(201).json({ success: true, message: 'Role created.', data: role });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /staff/roles/:id
 */
const updateRole = async (req, res, next) => {
  try {
    const role = await Role.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });

    const { name, description, permissions } = req.body;
    await role.update({
      name: name || role.name,
      description: description !== undefined ? description : role.description,
      permissions: permissions !== undefined ? permissions : role.permissions,
    });
    return res.status(200).json({ success: true, message: 'Role updated.', data: role });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /staff/roles/:id
 */
const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    await role.destroy();
    return res.status(200).json({ success: true, message: 'Role deleted.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /staff/permissions
 */
const getPermissions = async (req, res, next) => {
  try {
    // Group by module
    const grouped = {};
    ALL_PERMISSIONS.forEach((perm) => {
      const [module] = perm.split('.');
      if (!grouped[module]) grouped[module] = [];
      grouped[module].push(perm);
    });
    return res.status(200).json({ success: true, data: ALL_PERMISSIONS, grouped });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, deactivate, reactivate, remove, getRoles, createRole, updateRole, deleteRole, getPermissions };
