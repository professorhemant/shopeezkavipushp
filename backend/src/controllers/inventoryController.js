'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Product, InventoryBatch, Category, Unit, sequelize } = require('../models');

const paginate = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(500, parseInt(q.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

/**
 * GET /inventory/stock-summary
 * Product model uses 'stock' and 'min_stock', 'purchase_price', 'sale_price'
 */
const getStockSummary = async (req, res, next) => {
  try {
    const { limit, offset, page } = paginate(req.query);
    const { search, category_id } = req.query;

    const where = { firm_id: req.firmId, is_active: true };
    if (category_id) where.category_id = category_id;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      attributes: [
        'id', 'name', 'sku', 'barcode',
        'stock', 'min_stock', 'max_stock',
        'purchase_price', 'sale_price', 'mrp', 'tax_rate',
        [literal('`Product`.`stock` * `Product`.`purchase_price`'), 'stock_value'],
      ],
      include: [
        { model: Category, as: 'Category', attributes: ['id', 'name'] },
        { model: Unit, as: 'Unit', attributes: ['id', 'name', 'short_name'] },
      ],
      order: [['name', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    const totalValue = rows.reduce(
      (sum, p) => sum + parseFloat(p.stock || 0) * parseFloat(p.purchase_price || 0),
      0
    );

    return res.status(200).json({
      success: true,
      data: rows,
      summary: { total_value: parseFloat(totalValue.toFixed(2)) },
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /inventory/low-stock-alerts
 */
const getLowStockAlerts = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: {
        firm_id: req.firmId,
        is_active: true,
        [Op.and]: [literal('`Product`.`stock` <= `Product`.`min_stock`')],
      },
      include: [
        { model: Category, as: 'Category', attributes: ['id', 'name'] },
        { model: Unit, as: 'Unit', attributes: ['id', 'name', 'short_name'] },
      ],
      order: [['stock', 'ASC']],
    });
    return res.status(200).json({ success: true, data: products, count: products.length });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /inventory/expiry-alerts?days=30
 * Uses InventoryBatch model (has product_id, batch_no, expiry_date, quantity)
 */
const getExpiryAlerts = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const batches = await InventoryBatch.findAll({
      where: {
        expiry_date: { [Op.between]: [today, futureDate] },
        quantity: { [Op.gt]: 0 },
      },
      include: [
        {
          model: Product,
          as: 'Product',
          where: { firm_id: req.firmId, is_active: true },
          attributes: ['id', 'name', 'sku', 'firm_id'],
          required: true,
        },
      ],
      order: [['expiry_date', 'ASC']],
    });

    return res.status(200).json({ success: true, data: batches, count: batches.length, days_ahead: days });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /inventory/stock-ledger/:productId
 * We don't have a StockLedger model, so we derive movements from SaleItems and PurchaseItems
 */
const getStockLedger = async (req, res, next) => {
  try {
    const { SaleItem, PurchaseItem, Sale, Purchase } = require('../models');
    const { limit, offset, page } = paginate(req.query);
    const { from_date, to_date } = req.query;

    const product = await Product.findOne({ where: { id: req.params.productId, firm_id: req.firmId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const dateFilter = from_date && to_date
      ? { [Op.between]: [new Date(from_date), new Date(to_date)] }
      : undefined;

    // Sales outflows
    const saleItemsWhere = { product_id: product.id };
    const saleItems = await SaleItem.findAll({
      where: saleItemsWhere,
      include: [{
        model: Sale,
        as: 'Sale',
        where: {
          firm_id: req.firmId,
          status: { [Op.notIn]: ['cancelled'] },
          ...(dateFilter ? { invoice_date: dateFilter } : {}),
        },
        attributes: ['id', 'invoice_no', 'invoice_date', 'status'],
        required: true,
      }],
      order: [[{ model: Sale, as: 'Sale' }, 'invoice_date', 'ASC']],
    });

    // Purchase inflows
    const purchaseItems = await PurchaseItem.findAll({
      where: { product_id: product.id },
      include: [{
        model: Purchase,
        as: 'Purchase',
        where: {
          firm_id: req.firmId,
          status: { [Op.notIn]: ['cancelled'] },
          ...(dateFilter ? { bill_date: dateFilter } : {}),
        },
        attributes: ['id', 'bill_no', 'bill_date', 'status'],
        required: true,
      }],
      order: [[{ model: Purchase, as: 'Purchase' }, 'bill_date', 'ASC']],
    });

    // Build unified ledger
    const ledger = [];
    saleItems.forEach((si) => {
      ledger.push({
        date: si.Sale.invoice_date,
        type: 'sale',
        reference: si.Sale.invoice_no,
        qty_out: parseFloat(si.quantity),
        qty_in: 0,
        rate: parseFloat(si.unit_price || 0),
      });
    });
    purchaseItems.forEach((pi) => {
      ledger.push({
        date: pi.Purchase.bill_date,
        type: 'purchase',
        reference: pi.Purchase.bill_no,
        qty_out: 0,
        qty_in: parseFloat(pi.quantity),
        rate: parseFloat(pi.unit_price || 0),
      });
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Running balance starting from opening_stock
    let balance = parseFloat(product.opening_stock || 0);
    ledger.forEach((e) => {
      balance = balance + e.qty_in - e.qty_out;
      e.balance = parseFloat(balance.toFixed(3));
    });

    const paginated = ledger.slice(offset, offset + limit);

    return res.status(200).json({
      success: true,
      product: { id: product.id, name: product.name, current_stock: product.stock },
      data: paginated,
      pagination: { page, limit, total: ledger.length, pages: Math.ceil(ledger.length / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /inventory/adjust-stock
 */
const adjustStock = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { product_id, adjustment_type, quantity, reason } = req.body;
    if (!product_id || !quantity || !adjustment_type) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'product_id, adjustment_type, quantity are required.' });
    }

    const product = await Product.findOne({ where: { id: product_id, firm_id: req.firmId }, transaction: t });
    if (!product) { await t.rollback(); return res.status(404).json({ success: false, message: 'Product not found.' }); }

    const qty = parseFloat(quantity);
    const current = parseFloat(product.stock || 0);
    let newStock;

    switch (adjustment_type) {
      case 'add':
        newStock = current + qty;
        break;
      case 'subtract':
        newStock = current - qty;
        break;
      case 'set':
        newStock = qty;
        break;
      default:
        await t.rollback();
        return res.status(400).json({ success: false, message: 'adjustment_type must be add|subtract|set.' });
    }

    if (newStock < 0) { await t.rollback(); return res.status(400).json({ success: false, message: 'Insufficient stock.' }); }

    await product.update({ stock: newStock }, { transaction: t });
    await t.commit();

    return res.status(200).json({
      success: true,
      message: 'Stock adjusted.',
      data: {
        product_id: product.id,
        name: product.name,
        previous_stock: current,
        adjustment: qty,
        current_stock: newStock,
        reason: reason || 'Manual adjustment',
      },
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * GET /inventory/batches/:productId
 */
const getBatches = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.productId, firm_id: req.firmId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const batches = await InventoryBatch.findAll({
      where: { product_id: product.id },
      order: [['expiry_date', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      product: { id: product.id, name: product.name, stock: product.stock },
      data: batches,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /inventory/reset-all
 * Resets stock and opening_stock to 0 for all products, deletes all inventory batches
 */
const resetAllInventory = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    // Delete all inventory batches for this firm's products
    const productIds = await Product.findAll({
      where: { firm_id: req.firmId },
      attributes: ['id'],
      transaction: t,
    }).then(products => products.map(p => p.id));

    let batchesDeleted = 0;
    if (productIds.length > 0) {
      batchesDeleted = await InventoryBatch.destroy({
        where: { product_id: productIds },
        transaction: t,
      });
    }

    // Reset stock and opening_stock to 0 for all products
    const [productsUpdated] = await Product.update(
      { stock: 0, opening_stock: 0 },
      { where: { firm_id: req.firmId }, transaction: t }
    );

    await t.commit();

    return res.status(200).json({
      success: true,
      message: 'All inventory reset successfully.',
      data: { products_updated: productsUpdated, batches_deleted: batchesDeleted },
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = { getStockSummary, getLowStockAlerts, getExpiryAlerts, getStockLedger, adjustStock, getBatches, resetAllInventory };
