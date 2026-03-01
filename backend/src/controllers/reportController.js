'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Sale, SaleItem, Purchase, PurchaseItem, Product, Customer, Supplier, sequelize } = require('../models');

const dateWhere = (from, to, field = 'invoice_date') => ({
  [field]: { [Op.between]: [new Date(from), new Date(to)] },
});

/**
 * GET /reports/sales
 */
const getSalesReport = async (req, res, next) => {
  try {
    const { from_date, to_date, group_by = 'day', customer_id } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ success: false, message: 'from_date and to_date required.' });

    const where = {
      firm_id: req.firmId,
      status: { [Op.in]: ['confirmed', 'completed'] },
      ...dateWhere(from_date, to_date),
    };
    if (customer_id) where.customer_id = customer_id;

    let groupFn, orderFn;
    switch (group_by) {
      case 'month':
        groupFn = [fn('YEAR', col('invoice_date')), fn('MONTH', col('invoice_date'))];
        orderFn = [[fn('YEAR', col('invoice_date')), 'ASC'], [fn('MONTH', col('invoice_date')), 'ASC']];
        break;
      case 'week':
        groupFn = [fn('YEARWEEK', col('invoice_date'))];
        orderFn = [[fn('YEARWEEK', col('invoice_date')), 'ASC']];
        break;
      default:
        groupFn = [fn('DATE', col('invoice_date'))];
        orderFn = [[fn('DATE', col('invoice_date')), 'ASC']];
    }

    const summary = await Sale.findAll({
      where,
      attributes: [
        ...groupFn.map((g, i) => [g, `period_${i}`]),
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('grand_total')), 'revenue'],
        [fn('SUM', col('tax_amount')), 'tax'],
        [fn('SUM', col('discount_amount')), 'discount'],
        [fn('SUM', col('balance_due')), 'outstanding'],
      ],
      group: groupFn,
      order: orderFn,
      raw: true,
    });

    const overall = await Sale.findOne({
      where,
      attributes: [
        [fn('COUNT', col('id')), 'total_bills'],
        [fn('SUM', col('grand_total')), 'total_revenue'],
        [fn('SUM', col('tax_amount')), 'total_tax'],
        [fn('SUM', col('discount_amount')), 'total_discount'],
        [fn('SUM', col('balance_due')), 'total_outstanding'],
      ],
      raw: true,
    });

    return res.status(200).json({ success: true, data: summary, overall });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /reports/purchases
 */
const getPurchaseReport = async (req, res, next) => {
  try {
    const { from_date, to_date, supplier_id } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ success: false, message: 'from_date and to_date required.' });

    const where = {
      firm_id: req.firmId,
      status: { [Op.notIn]: ['cancelled'] },
      ...dateWhere(from_date, to_date, 'bill_date'),
    };
    if (supplier_id) where.supplier_id = supplier_id;

    const summary = await Purchase.findAll({
      where,
      attributes: [
        [fn('DATE', col('bill_date')), 'date'],
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('grand_total')), 'total'],
        [fn('SUM', col('tax_amount')), 'tax'],
      ],
      group: [fn('DATE', col('bill_date'))],
      order: [[fn('DATE', col('bill_date')), 'ASC']],
      raw: true,
    });

    const overall = await Purchase.findOne({
      where,
      attributes: [
        [fn('COUNT', col('id')), 'total_bills'],
        [fn('SUM', col('grand_total')), 'total_amount'],
        [fn('SUM', col('tax_amount')), 'total_tax'],
        [fn('SUM', col('balance_due')), 'total_outstanding'],
      ],
      raw: true,
    });

    return res.status(200).json({ success: true, data: summary, overall });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /reports/inventory
 */
const getInventoryReport = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { firm_id: req.firmId, is_active: true },
      attributes: ['id', 'name', 'sku', 'current_stock', 'min_stock', 'purchase_price', 'selling_price',
        [literal('`current_stock` * `purchase_price`'), 'stock_value'],
        [literal('(`selling_price` - `purchase_price`) * `current_stock`'), 'potential_profit'],
      ],
      order: [['name', 'ASC']],
    });

    const totalValue = products.reduce((s, p) => s + (parseFloat(p.current_stock || 0) * parseFloat(p.purchase_price || 0)), 0);
    const lowStock = products.filter((p) => parseFloat(p.current_stock || 0) <= parseFloat(p.min_stock || 0)).length;

    return res.status(200).json({
      success: true,
      data: products,
      summary: {
        total_products: products.length,
        total_stock_value: parseFloat(totalValue.toFixed(2)),
        low_stock_count: lowStock,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /reports/gst
 * GSTR-1 style summary grouped by tax rate
 */
const getGSTReport = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ success: false, message: 'from_date and to_date required.' });

    const where = {
      firm_id: req.firmId,
      status: { [Op.in]: ['confirmed', 'completed'] },
    };

    const items = await SaleItem.findAll({
      where: { firm_id: req.firmId },
      attributes: [
        'tax_rate',
        [fn('SUM', col('taxable_amount')), 'taxable_amount'],
        [fn('SUM', col('cgst')), 'cgst'],
        [fn('SUM', col('sgst')), 'sgst'],
        [fn('SUM', col('igst')), 'igst'],
        [fn('SUM', col('total')), 'total'],
      ],
      include: [{
        model: Sale,
        as: 'Sale',
        where: { ...where, invoice_date: { [Op.between]: [new Date(from_date), new Date(to_date)] } },
        attributes: [],
        required: true,
      }],
      group: ['tax_rate'],
      order: [['tax_rate', 'ASC']],
      raw: true,
    });

    const totals = items.reduce((acc, r) => {
      acc.taxable_amount += parseFloat(r.taxable_amount || 0);
      acc.cgst += parseFloat(r.cgst || 0);
      acc.sgst += parseFloat(r.sgst || 0);
      acc.igst += parseFloat(r.igst || 0);
      acc.total_tax += parseFloat(r.cgst || 0) + parseFloat(r.sgst || 0) + parseFloat(r.igst || 0);
      acc.total += parseFloat(r.total || 0);
      return acc;
    }, { taxable_amount: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0, total: 0 });

    return res.status(200).json({ success: true, data: items, totals });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /reports/profit-loss
 */
const getProfitLossReport = async (req, res, next) => {
  try {
    const { from_date, to_date, group_by = 'bill' } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ success: false, message: 'from_date and to_date required.' });

    const salesWhere = {
      firm_id: req.firmId,
      status: { [Op.in]: ['confirmed', 'completed'] },
      invoice_date: { [Op.between]: [new Date(from_date), new Date(to_date)] },
    };

    const sales = await Sale.findAll({
      where: salesWhere,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name'] },
        {
          model: SaleItem, as: 'items',
          attributes: ['product_id', 'product_name', 'quantity', 'rate', 'total',
            [literal('`items`.`rate` * `items`.`quantity`'), 'revenue'],
          ],
          include: [{
            model: Product, as: 'product',
            attributes: ['id', 'purchase_price'],
          }],
        },
      ],
      order: [['invoice_date', 'DESC']],
    });

    const report = sales.map((sale) => {
      let revenue = parseFloat(sale.grand_total || 0);
      let cogs = 0;
      (sale.items || []).forEach((item) => {
        const cost = parseFloat(item.product?.purchase_price || 0) * parseFloat(item.quantity);
        cogs += cost;
      });
      return {
        invoice_no: sale.invoice_no,
        date: sale.invoice_date,
        customer: sale.customer?.name || 'Walk-in',
        revenue,
        cogs: parseFloat(cogs.toFixed(2)),
        gross_profit: parseFloat((revenue - cogs).toFixed(2)),
        margin: revenue > 0 ? parseFloat((((revenue - cogs) / revenue) * 100).toFixed(2)) : 0,
      };
    });

    const totals = report.reduce((acc, r) => {
      acc.revenue += r.revenue;
      acc.cogs += r.cogs;
      acc.gross_profit += r.gross_profit;
      return acc;
    }, { revenue: 0, cogs: 0, gross_profit: 0 });

    return res.status(200).json({ success: true, data: report, totals });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /reports/top-products
 */
const getTopProducts = async (req, res, next) => {
  try {
    const { from_date, to_date, limit = 10 } = req.query;
    const where = { firm_id: req.firmId };
    if (from_date && to_date) {
      where.invoice_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
    }

    const products = await SaleItem.findAll({
      where: { firm_id: req.firmId },
      attributes: [
        'product_id', 'product_name',
        [fn('SUM', col('quantity')), 'total_qty'],
        [fn('SUM', col('total')), 'total_revenue'],
        [fn('COUNT', col('sale_id')), 'order_count'],
      ],
      include: [{
        model: Sale, as: 'Sale',
        where: { firm_id: req.firmId, status: { [Op.in]: ['confirmed', 'completed'] }, ...(from_date && to_date ? { invoice_date: { [Op.between]: [new Date(from_date), new Date(to_date)] } } : {}) },
        attributes: [],
        required: true,
      }],
      group: ['product_id', 'product_name'],
      order: [[fn('SUM', col('quantity')), 'DESC']],
      limit: parseInt(limit),
      raw: true,
    });

    return res.status(200).json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /reports/top-customers
 */
const getTopCustomers = async (req, res, next) => {
  try {
    const { from_date, to_date, limit = 10 } = req.query;
    const where = {
      firm_id: req.firmId,
      status: { [Op.in]: ['confirmed', 'completed'] },
    };
    if (from_date && to_date) where.invoice_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };

    const customers = await Sale.findAll({
      where,
      attributes: [
        'customer_id',
        [fn('COUNT', col('id')), 'total_orders'],
        [fn('SUM', col('grand_total')), 'total_revenue'],
      ],
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] }],
      group: ['customer_id', 'customer.id', 'customer.name', 'customer.phone', 'customer.email'],
      order: [[fn('SUM', col('grand_total')), 'DESC']],
      limit: parseInt(limit),
    });

    return res.status(200).json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSalesReport, getPurchaseReport, getInventoryReport, getGSTReport, getProfitLossReport, getTopProducts, getTopCustomers };
