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

// POST /loyalty/backfill  — award points for historical sales (one-time use)
// Body: { from_date: "2026-09-01" }   (defaults to 2026-09-01 if omitted)
const backfillPoints = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const fromDate = new Date(req.body.from_date || '2026-09-01');

    // All confirmed sales in this firm from that date with a linked customer
    // that haven't had points awarded yet (points_awarded = 0)
    const sales = await Sale.findAll({
      where: {
        firm_id: req.firmId,
        customer_id: { [Op.not]: null },
        points_awarded: 0,
        status: { [Op.notIn]: ['cancelled', 'returned'] },
        invoice_date: { [Op.gte]: fromDate },
      },
      order: [['invoice_date', 'ASC']],
      transaction: t,
    });

    const summary = { processed: 0, skipped: 0, customers_updated: 0, total_points_issued: 0 };
    const customerCache = {};  // id → customer instance

    for (const sale of sales) {
      // Spend amount = subtotal(ex-GST) + all tax - discount  ≈ grand total
      const spendAmt = parseFloat(sale.subtotal || 0)
        + parseFloat(sale.cgst || 0)
        + parseFloat(sale.sgst || 0)
        + parseFloat(sale.igst || 0)
        - parseFloat(sale.discount_amount || 0);

      const pts = calculatePoints(spendAmt);
      if (pts === 0) { summary.skipped++; continue; }

      // Load customer (cached)
      if (!customerCache[sale.customer_id]) {
        customerCache[sale.customer_id] = await Customer.findByPk(sale.customer_id, { transaction: t });
      }
      const customer = customerCache[sale.customer_id];
      if (!customer) { summary.skipped++; continue; }

      const prevBalance = isExpired(customer) ? 0 : (customer.loyalty_points || 0);
      const newBalance  = prevBalance + pts;
      const newExpiry   = expiryDate(new Date(sale.invoice_date));
      const newSpend    = parseFloat((parseFloat(customer.lifetime_spend || 0) + spendAmt).toFixed(2));

      await customer.update({
        loyalty_points: newBalance,
        points_expires_at: newExpiry,
        lifetime_spend: newSpend,
      }, { transaction: t });

      // Update cached instance for next iteration
      customer.loyalty_points = newBalance;
      customer.points_expires_at = newExpiry;
      customer.lifetime_spend = newSpend;

      await sale.update({ points_awarded: pts }, { transaction: t });

      await LoyaltyTransaction.create({
        firm_id: req.firmId,
        customer_id: sale.customer_id,
        sale_id: sale.id,
        transaction_type: 'earn',
        points: pts,
        balance_after: newBalance,
        notes: `Backfill: earned on invoice ${sale.invoice_no}`,
      }, { transaction: t });

      summary.processed++;
      summary.total_points_issued += pts;
    }

    summary.customers_updated = Object.keys(customerCache).length;
    await t.commit();

    return res.json({
      success: true,
      message: `Backfill complete. ${summary.processed} sales processed, ${summary.total_points_issued} pts issued to ${summary.customers_updated} customers. ${summary.skipped} sales skipped (below ₹500 or no customer).`,
      data: summary,
    });
  } catch (err) { await t.rollback(); next(err); }
};

module.exports = { getCustomerPoints, getCustomerHistory, getSummary, manualAdjust, backfillPoints };
