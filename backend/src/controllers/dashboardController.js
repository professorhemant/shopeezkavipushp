'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Sale, SaleItem, Customer, Product, SalePayment, sequelize } = require('../models');

const todayRange = () => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
    end:   new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  };
};

const periodRange = (period) => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start;
  switch (period) {
    case 'today':        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); break;
    case 'last_week':    start = new Date(now - 7  * 86400000); break;
    case 'last_1_month': start = new Date(now - 30 * 86400000); break;
    case 'last_3_month': start = new Date(now - 90 * 86400000); break;
    case 'last_6_month': start = new Date(now - 180 * 86400000); break;
    case 'last_1_year':  start = new Date(now - 365 * 86400000); break;
    case 'lifetime':     start = new Date('2000-01-01'); break;
    default:             start = new Date(now - 30 * 86400000);
  }
  return { start, end };
};

/**
 * GET /dashboard/stats
 */
const getStats = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const { start: startOfDay, end: endOfDay } = todayRange();

    // Today's sales by payment mode
    const todaySalesRaw = await Sale.findAll({
      where: {
        firm_id: firmId,
        status: 'confirmed',
        invoice_date: { [Op.between]: [startOfDay, endOfDay] },
      },
      attributes: [
        'payment_mode',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('total')), 'revenue'],
        [fn('SUM', col('balance')), 'due'],
        [fn('SUM', col('paid_amount')), 'paid'],
      ],
      group: ['payment_mode'],
      raw: true,
    });

    let todayOrders = 0, todaySalesAmount = 0, todayCash = 0, todayOnline = 0, todayDue = 0;
    for (const row of todaySalesRaw) {
      todayOrders += parseInt(row.count || 0);
      todaySalesAmount += parseFloat(row.revenue || 0);
      todayDue += parseFloat(row.due || 0);
      const mode = (row.payment_mode || '').toLowerCase();
      if (mode === 'cash') todayCash += parseFloat(row.paid || 0);
      else todayOnline += parseFloat(row.paid || 0);
    }

    // To collect (total unpaid/partial balance from customers)
    const toCollectRaw = await Sale.findOne({
      where: { firm_id: firmId, status: 'confirmed', balance: { [Op.gt]: 0 } },
      attributes: [[fn('SUM', col('balance')), 'total']],
      raw: true,
    });
    const toCollect = parseFloat(toCollectRaw?.total || 0);

    // To pay (from purchases - approximate using outstanding payables)
    let toPay = 0;
    try {
      const { Purchase } = require('../models');
      const toPayRaw = await Purchase.findOne({
        where: { firm_id: firmId, status: 'confirmed', balance: { [Op.gt]: 0 } },
        attributes: [[fn('SUM', col('balance')), 'total']],
        raw: true,
      });
      toPay = parseFloat(toPayRaw?.total || 0);
    } catch (_) {}

    // Total customers / products / low stock
    const [totalCustomers, totalProducts, lowStockCount, pendingPayments] = await Promise.all([
      Customer.count({ where: { firm_id: firmId, is_active: true } }),
      Product.count({ where: { firm_id: firmId, is_active: true } }),
      Product.count({
        where: {
          firm_id: firmId,
          is_active: true,
          [Op.and]: [literal('`Product`.`stock` <= `Product`.`min_stock`')],
        },
      }),
      Sale.count({
        where: { firm_id: firmId, status: 'confirmed', payment_status: { [Op.in]: ['unpaid', 'partial'] } },
      }),
    ]);

    // Payment distribution (all time / this month)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const payDistRaw = await Sale.findAll({
      where: { firm_id: firmId, status: 'confirmed', invoice_date: { [Op.gte]: startOfMonth } },
      attributes: [
        'payment_mode',
        [fn('SUM', col('paid_amount')), 'paid'],
        [fn('SUM', col('balance')), 'bal'],
      ],
      group: ['payment_mode'],
      raw: true,
    });
    let cashSales = 0, onlineSales = 0, dueAmount = 0;
    for (const row of payDistRaw) {
      const mode = (row.payment_mode || '').toLowerCase();
      if (mode === 'cash') cashSales += parseFloat(row.paid || 0);
      else                 onlineSales += parseFloat(row.paid || 0);
      dueAmount += parseFloat(row.bal || 0);
    }

    // Monthly revenue last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenueRaw = await Sale.findAll({
      where: { firm_id: firmId, status: 'confirmed', invoice_date: { [Op.gte]: twelveMonthsAgo } },
      attributes: [
        [fn('YEAR',  col('invoice_date')), 'year'],
        [fn('MONTH', col('invoice_date')), 'month'],
        [fn('SUM',   col('total')),        'revenue'],
        [fn('COUNT', col('id')),           'count'],
      ],
      group: [fn('YEAR', col('invoice_date')), fn('MONTH', col('invoice_date'))],
      order: [[fn('YEAR', col('invoice_date')), 'ASC'], [fn('MONTH', col('invoice_date')), 'ASC']],
      raw: true,
    });

    return res.json({
      success: true,
      data: {
        to_collect: toCollect,
        to_pay: toPay,
        expiring_count: 0,
        today_orders: todayOrders,
        today_sales_amount: todaySalesAmount,
        today_cash: todayCash,
        today_online: todayOnline,
        today_due: todayDue,
        cash_sales: cashSales,
        online_sales: onlineSales,
        due_amount: dueAmount,
        // legacy fields kept for compatibility
        today_sales: todayOrders,
        today_revenue: todaySalesAmount,
        total_customers: totalCustomers,
        total_products: totalProducts,
        low_stock_count: lowStockCount,
        pending_payments: pendingPayments,
        monthly_revenue: monthlyRevenueRaw.map((r) => ({
          year: r.year, month: r.month,
          revenue: parseFloat(r.revenue || 0),
          count: parseInt(r.count || 0),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/sales-chart?period=
 */
const getSalesChart = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const period = req.query.period || 'last_1_month';
    const { start, end } = periodRange(period);

    let groupBy, labelFn;
    if (period === 'today') {
      groupBy = [fn('HOUR', col('invoice_date'))];
      labelFn = (r) => `${r.label}:00`;
    } else if (period === 'last_week') {
      groupBy = [fn('DATE', col('invoice_date'))];
      labelFn = (r) => {
        const d = new Date(r.label);
        return d.toLocaleDateString('en-IN', { weekday: 'short' });
      };
    } else {
      groupBy = [fn('MONTH', col('invoice_date')), fn('YEAR', col('invoice_date'))];
      labelFn = (r) => {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[(parseInt(r.label) - 1)] || r.label;
      };
    }

    const attrKey = period === 'today' ? fn('HOUR', col('invoice_date'))
      : period === 'last_week'         ? fn('DATE', col('invoice_date'))
      :                                  fn('MONTH', col('invoice_date'));

    const raw = await Sale.findAll({
      where: { firm_id: firmId, status: 'confirmed', invoice_date: { [Op.between]: [start, end] } },
      attributes: [
        [attrKey, 'label'],
        [fn('COUNT', col('id')), 'orders'],
        [fn('SUM', col('total')), 'revenue'],
      ],
      group: groupBy,
      order: [[attrKey, 'ASC']],
      raw: true,
    });

    const data = raw.map((r) => ({
      label: labelFn(r),
      orders: parseInt(r.orders || 0),
      revenue: parseFloat(r.revenue || 0),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/latest-invoices
 */
const getLatestInvoices = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const sales = await Sale.findAll({
      where: { firm_id: firmId, status: 'confirmed' },
      attributes: ['id', 'invoice_no', 'invoice_date', 'total', 'payment_mode', 'payment_status'],
      include: [{ model: Customer, as: 'customer', attributes: ['name'], required: false }],
      order: [['invoice_date', 'DESC']],
      limit: 10,
    });

    const data = sales.map((s) => ({
      invoice_no: s.invoice_no,
      customer_name: s.customer?.name || 'Walk-in',
      date: s.invoice_date ? new Date(s.invoice_date).toLocaleDateString('en-IN') : '-',
      total: parseFloat(s.total || 0),
      payment_mode: s.payment_mode,
      status: s.payment_mode,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/top-customers
 */
const getTopCustomers = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const raw = await Sale.findAll({
      where: { firm_id: firmId, status: 'confirmed', invoice_date: { [Op.gte]: startOfMonth } },
      attributes: [
        'customer_id',
        [fn('COUNT', col('Sale.id')), 'orders'],
        [fn('SUM', col('Sale.total')), 'spent'],
        [fn('MAX', col('Sale.invoice_date')), 'last_purchase'],
      ],
      include: [{ model: Customer, as: 'customer', attributes: ['name', 'mobile'], required: true }],
      group: ['customer_id', 'customer.id', 'customer.name', 'customer.mobile'],
      order: [[fn('SUM', col('Sale.total')), 'DESC']],
      limit: 8,
    });

    const data = raw.map((r) => ({
      name: r.customer?.name || '-',
      mobile: r.customer?.mobile || '-',
      last_purchase: r.dataValues.last_purchase
        ? new Date(r.dataValues.last_purchase).toLocaleDateString('en-IN')
        : '-',
      segment: parseFloat(r.dataValues.spent || 0) > 10000 ? 'Premium & Loyal' : 'Regular',
    }));

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/best-selling
 */
const getBestSelling = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const raw = await SaleItem.findAll({
      attributes: [
        'product_id', 'product_name',
        [fn('SUM', col('SaleItem.quantity')), 'sold_qty'],
        [fn('MAX', col('SaleItem.unit_price')), 'sale_price'],
      ],
      include: [{
        model: Sale, as: 'Sale',
        where: { firm_id: firmId, status: 'confirmed', invoice_date: { [Op.gte]: startOfMonth } },
        attributes: [],
        required: true,
      }],
      group: ['product_id', 'product_name'],
      order: [[fn('SUM', col('SaleItem.quantity')), 'DESC']],
      limit: 10,
      raw: true,
    });

    const data = raw.map((r) => ({
      name: r.product_name,
      sale_price: parseFloat(r.sale_price || 0),
      sold_qty: parseFloat(r.sold_qty || 0),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/least-selling
 */
const getLeastSelling = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const raw = await SaleItem.findAll({
      attributes: [
        'product_id', 'product_name',
        [fn('SUM', col('SaleItem.quantity')), 'sold_qty'],
        [fn('MAX', col('SaleItem.unit_price')), 'sale_price'],
      ],
      include: [{
        model: Sale, as: 'Sale',
        where: { firm_id: firmId, status: 'confirmed', invoice_date: { [Op.gte]: startOfMonth } },
        attributes: [],
        required: true,
      }],
      group: ['product_id', 'product_name'],
      order: [[fn('SUM', col('SaleItem.quantity')), 'ASC']],
      limit: 10,
      raw: true,
    });

    const data = raw.map((r) => ({
      name: r.product_name,
      sale_price: parseFloat(r.sale_price || 0),
      sold_qty: parseFloat(r.sold_qty || 0),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/latest-receipts
 */
const getLatestReceipts = async (req, res, next) => {
  try {
    const firmId = req.firmId;

    // Try SalePayment model if available, fallback to Sale
    let data = [];
    try {
      const payments = await SalePayment.findAll({
        include: [{
          model: Sale, as: 'Sale',
          where: { firm_id: firmId },
          attributes: ['invoice_no'],
          include: [{ model: Customer, as: 'customer', attributes: ['name'], required: false }],
          required: true,
        }],
        order: [['payment_date', 'DESC']],
        limit: 10,
      });
      data = payments.map((p) => ({
        invoice_no: p.Sale?.invoice_no,
        customer_name: p.Sale?.customer?.name || 'Walk-in',
        payment_mode: p.payment_mode,
        date: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '-',
        amount: parseFloat(p.amount || 0),
      }));
    } catch (_) {
      // Fallback: use sales with payment info
      const sales = await Sale.findAll({
        where: { firm_id: firmId, status: 'confirmed', paid_amount: { [Op.gt]: 0 } },
        attributes: ['invoice_no', 'payment_mode', 'invoice_date', 'paid_amount'],
        include: [{ model: Customer, as: 'customer', attributes: ['name'], required: false }],
        order: [['invoice_date', 'DESC']],
        limit: 10,
      });
      data = sales.map((s) => ({
        invoice_no: s.invoice_no,
        customer_name: s.customer?.name || 'Walk-in',
        payment_mode: s.payment_mode,
        date: s.invoice_date ? new Date(s.invoice_date).toLocaleDateString('en-IN') : '-',
        amount: parseFloat(s.paid_amount || 0),
      }));
    }

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  getSalesChart,
  getLatestInvoices,
  getTopCustomers,
  getBestSelling,
  getLeastSelling,
  getLatestReceipts,
};
