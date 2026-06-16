'use strict';

const { Op } = require('sequelize');
const { Promotion } = require('../models');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(200, parseInt(q.limit) || 50);
  return { limit, offset: (page - 1) * limit, page };
};

const genPromoNumber = async (firmId) => {
  const count = await Promotion.count({ where: { firm_id: firmId } });
  return `PROMO-${String(count + 1).padStart(4, '0')}`;
};

const getAll = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search, status } = req.query;
    const where = { firm_id: req.firmId };
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { sent_to_name:  { [Op.like]: `%${search}%` } },
        { event_name:    { [Op.like]: `%${search}%` } },
        { promo_number:  { [Op.like]: `%${search}%` } },
        { contact_phone: { [Op.like]: `%${search}%` } },
      ];
    }
    const { count, rows } = await Promotion.findAndCountAll({
      where, order: [['sent_date', 'DESC'], ['createdAt', 'DESC']], limit, offset, distinct: true,
    });
    return res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const promo = await Promotion.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!promo) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: promo });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const promo_number = await genPromoNumber(req.firmId);
    const promo = await Promotion.create({ ...req.body, firm_id: req.firmId, promo_number });
    return res.status(201).json({ success: true, data: promo });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const promo = await Promotion.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!promo) return res.status(404).json({ success: false, message: 'Not found' });
    await promo.update(req.body);
    return res.json({ success: true, data: promo });
  } catch (err) { next(err); }
};

const markReturned = async (req, res, next) => {
  try {
    const promo = await Promotion.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!promo) return res.status(404).json({ success: false, message: 'Not found' });
    await promo.update({ status: 'returned', actual_return_date: new Date().toISOString().split('T')[0] });
    return res.json({ success: true, data: promo });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const promo = await Promotion.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!promo) return res.status(404).json({ success: false, message: 'Not found' });
    await promo.destroy();
    return res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, markReturned, remove };
