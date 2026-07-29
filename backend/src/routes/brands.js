'use strict';

const express = require('express');
const router = express.Router();
const { Brand } = require('../models');
const { Op } = require('sequelize');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 50);
  return { limit, offset: (page - 1) * limit, page };
};

// GET /brands
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search } = req.query;
    const where = { firm_id: req.firmId };
    if (search) where.name = { [Op.like]: `%${search}%` };

    const { count, rows } = await Brand.findAndCountAll({
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

// POST /brands
router.post('/', async (req, res, next) => {
  try {
    const { name, description, logo } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required.' });
    const brand = await Brand.create({ firm_id: req.firmId, name, description: description || null, logo: logo || null });
    return res.status(201).json({ success: true, message: 'Brand created.', data: brand });
  } catch (err) {
    next(err);
  }
});

// GET /brands/:id
router.get('/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found.' });
    return res.status(200).json({ success: true, data: brand });
  } catch (err) {
    next(err);
  }
});

// PUT /brands/:id
router.put('/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found.' });
    const body = { ...req.body };
    delete body.firm_id;
    await brand.update(body);
    return res.status(200).json({ success: true, message: 'Brand updated.', data: brand });
  } catch (err) {
    next(err);
  }
});

// DELETE /brands/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found.' });
    await brand.destroy();
    return res.status(200).json({ success: true, message: 'Brand deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
