'use strict';

const express = require('express');
const router = express.Router();
const { Unit } = require('../models');
const { Op } = require('sequelize');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 50);
  return { limit, offset: (page - 1) * limit, page };
};

// GET /units
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search } = req.query;
    const where = { firm_id: req.firmId };
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { short_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Unit.findAndCountAll({
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

// POST /units
router.post('/', async (req, res, next) => {
  try {
    const { name, short_name, description } = req.body;
    if (!name || !short_name) return res.status(400).json({ success: false, message: 'name and short_name are required.' });
    const unit = await Unit.create({ firm_id: req.firmId, name, short_name, description: description || null });
    return res.status(201).json({ success: true, message: 'Unit created.', data: unit });
  } catch (err) {
    next(err);
  }
});

// GET /units/:id
router.get('/:id', async (req, res, next) => {
  try {
    const unit = await Unit.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found.' });
    return res.status(200).json({ success: true, data: unit });
  } catch (err) {
    next(err);
  }
});

// PUT /units/:id
router.put('/:id', async (req, res, next) => {
  try {
    const unit = await Unit.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found.' });
    const body = { ...req.body };
    delete body.firm_id;
    await unit.update(body);
    return res.status(200).json({ success: true, message: 'Unit updated.', data: unit });
  } catch (err) {
    next(err);
  }
});

// DELETE /units/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const unit = await Unit.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found.' });
    await unit.destroy();
    return res.status(200).json({ success: true, message: 'Unit deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
