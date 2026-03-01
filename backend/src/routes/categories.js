'use strict';

const express = require('express');
const router = express.Router();
const { Category } = require('../models');
const { Op } = require('sequelize');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 50);
  return { limit, offset: (page - 1) * limit, page };
};

// GET /categories
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search } = req.query;
    const where = { firm_id: req.firmId };
    if (search) where.name = { [Op.like]: `%${search}%` };

    const { count, rows } = await Category.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /categories
router.post('/', async (req, res, next) => {
  try {
    const { name, description, parent_id } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required.' });
    const category = await Category.create({ firm_id: req.firmId, name, description: description || null, parent_id: parent_id || null });
    return res.status(201).json({ success: true, message: 'Category created.', data: category });
  } catch (err) {
    next(err);
  }
});

// GET /categories/:id
router.get('/:id', async (req, res, next) => {
  try {
    const category = await Category.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    return res.status(200).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

// PUT /categories/:id
router.put('/:id', async (req, res, next) => {
  try {
    const category = await Category.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    const { name, description, parent_id } = req.body;
    await category.update({ name: name || category.name, description: description !== undefined ? description : category.description, parent_id: parent_id !== undefined ? parent_id : category.parent_id });
    return res.status(200).json({ success: true, message: 'Category updated.', data: category });
  } catch (err) {
    next(err);
  }
});

// DELETE /categories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const category = await Category.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    await category.destroy();
    return res.status(200).json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
