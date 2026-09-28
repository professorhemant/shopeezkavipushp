'use strict';

const { Customer, LoyaltyTransaction, Sale, sequelize } = require('../models');
const { Op } = require('sequelize');
const { calculatePoints, expiryDate, isExpired, MIN_REDEEM, POINT_VALUE } = require('../utils/loyaltyPoints');

// GET /loyalty/customer/:customerId
const getCustomerPoints = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      where: { id: req.params.customerId, firm_id: req.firmId },
      attributes: ['id', 'name', 'phone', 'loyalty_points', 'points_expires_at', 'lifetime_spend'],
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const expired = isExpired(customer);
    const balance = expired ? 0 : (customer.loyalty_points || 0);
    return res.json({
      success: true,
      data: {
        customer_id: customer.id,
        name: customer.name,
        phone: customer.phone,
        balance,
        points_expires_at: customer.points_expires_at,
        lifetime_spend: customer.lifetime_spend || 0,
        is_expired: expired,
        can_redeem: balance >= MIN_REDEEM,
        point_value: POINT_VALUE,
        min_redeem: MIN_REDEEM,
      },
    });
  } catch (err) { next(err); }
};

// GET /loyalty/customer/:customerId/history
const getCustomerHistory = async (req, res, next) => {
  try {
    const txns = await LoyaltyTransaction.findAll({
      where: { customer_id: req.params.customerId, firm_id: req.firmId },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return res.json({ success: true, data: txns });
  } catch (err) { next(err); }
};

// GET /loyalty/summary  — all customers with any loyalty activity, for the admin dashboard
const getSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const soonDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const customers = await Customer.findAll({
      where: {
        firm_id: req.firmId,
        loyalty_points: { [Op.gt]: 0 },
        points_expires_at: { [Op.not]: null },
      },
      attributes: ['id', 'name', 'phone', 'loyalty_points', 'points_expires_at', 'lifetime_spend'],
      order: [['loyalty_points', 'DESC']],
    });

    const data = customers.map(c => {
      const exp = new Date(c.points_expires_at);
      let status = 'active';
      if (exp < now) status = 'expired';
      else if (exp < soonDate) status = 'expiring_soon';
      return { ...c.toJSON(), status };
    });

    return res.json({ success: true, data });
  } catch (err) { next(err); }
};

// POST /loyalty/adjust  — manual admin adjustment
const manualAdjust = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { customer_id, points, notes } = req.body;
    if (!customer_id || !points) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'customer_id and points are required.' });
    }
    const customer = await Customer.findOne({
      where: { id: customer_id, firm_id: req.firmId }, transaction: t,
    });
    if (!customer) { await t.rollback(); return res.status(404).json({ success: false, message: 'Customer not found.' }); }

    const current = isExpired(customer) ? 0 : (customer.loyalty_points || 0);
    const newBalance = Math.max(0, current + parseInt(points));
    const exp = current === 0 && parseInt(points) > 0 ? expiryDate(new Date()) : customer.points_expires_at;

    await customer.update({ loyalty_points: newBalance, points_expires_at: exp }, { transaction: t });
    await LoyaltyTransaction.create({
      firm_id: req.firmId, customer_id, transaction_type: 'adjust',
      points: parseInt(points), balance_after: newBalance, notes: notes || 'Manual adjustment',
    }, { transaction: t });

    await t.commit();
    return res.json({ success: true, data: { balance: newBalance, points_expires_at: exp } });
  } catch (err) { await t.rollback(); next(err); }
};

module.exports = { getCustomerPoints, getCustomerHistory, getSummary, manualAdjust };
