'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Product, Category, Brand, Unit, ProductVariant, InventoryBatch } = require('../models');
const barcodeUtils = require('../utils/barcodeUtils');

const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(500, parseInt(query.limit) || 20);
  return { limit, offset: (page - 1) * limit, page };
};

/**
 * GET /products
 */
const getAll = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const { limit, offset, page } = paginate(req.query);
    const { search, category_id, brand_id, is_active } = req.query;

    const where = { firm_id: firmId };
    if (is_active !== undefined) where.is_active = is_active === 'true';
    else where.is_active = true;
    if (category_id) where.category_id = category_id;
    if (brand_id) where.brand_id = brand_id;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { barcode: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'Category', attributes: ['id', 'name'] },
        { model: Brand, as: 'Brand', attributes: ['id', 'name'] },
        { model: Unit, as: 'Unit', attributes: ['id', 'name', 'short_name'] },
      ],
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
 * GET /products/:id
 */
const getOne = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, firm_id: req.firmId },
      include: [
        { model: Category, as: 'Category' },
        { model: Brand, as: 'Brand' },
        { model: Unit, as: 'Unit' },
        { model: ProductVariant, as: 'variants' },
        { model: InventoryBatch, as: 'batches' },
      ],
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    return res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /products
 */
const create = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const body = req.body;
    if (body.images && typeof body.images === 'string') {
      try { body.images = JSON.parse(body.images); } catch (_) {}
    }
    const product = await Product.create({ ...body, firm_id: firmId });
    return res.status(201).json({ success: true, message: 'Product created.', data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /products/:id
 */
const update = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    const body = { ...req.body };
    delete body.firm_id;
    await product.update(body);
    return res.status(200).json({ success: true, message: 'Product updated.', data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /products/:id  (soft delete)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    await product.update({ is_active: false });
    return res.status(200).json({ success: true, message: 'Product deactivated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /products/bulk-import
 */
const bulkImport = async (req, res, next) => {
  try {
    const firmId = req.firmId;
    const products = req.body.products;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'products array is required.' });
    }

    // Resolve category names → category_id
    const categoryNames = [...new Set(
      products.map((p) => (p.category_name || '').trim()).filter(Boolean)
    )];
    console.log('[bulkImport] categoryNames:', categoryNames);
    const categoryMap = {};
    if (categoryNames.length > 0) {
      // Fetch already-existing categories for this firm
      const existing = await Category.findAll({
        where: { firm_id: firmId, name: { [Op.in]: categoryNames } },
        attributes: ['id', 'name'],
      });
      console.log('[bulkImport] existing categories found:', existing.map(c => ({ id: c.id, name: c.name })));
      existing.forEach((c) => { categoryMap[c.name] = c.id; });

      // Create any that don't exist yet
      for (const name of categoryNames) {
        if (categoryMap[name]) continue;
        try {
          const cat = await Category.create({ name, firm_id: firmId });
          categoryMap[name] = cat.id;
          console.log('[bulkImport] created category:', name, cat.id);
        } catch (err) {
          console.error('[bulkImport] category create error:', name, err.message);
          const cat = await Category.findOne({ where: { name, firm_id: firmId } });
          if (cat) categoryMap[name] = cat.id;
        }
      }
    }
    console.log('[bulkImport] categoryMap:', categoryMap);
    console.log('[bulkImport] sample category_id:', categoryMap[(products[0]?.category_name || '').trim()]);

    const toCreate = products
      .filter((p) => p.name && String(p.name).trim())
      .map(({ category_name, ...p }) => ({
        ...p,
        firm_id: firmId,
        category_id: categoryMap[(category_name || '').trim()] || null,
      }));

    if (!toCreate.length) {
      return res.status(400).json({ success: false, message: 'No valid products to import. "name" is required for every row.' });
    }
    const created = await Product.bulkCreate(toCreate, { ignoreDuplicates: true, validate: false });
    return res.status(201).json({
      success: true,
      message: `${created.length} products imported.`,
      data: { imported: created.length, total: products.length },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /products/:id/adjust-stock
 * Product model uses 'stock' field
 */
const updateStock = async (req, res, next) => {
  try {
    const { adjustment, reason, type } = req.body;
    if (!adjustment) return res.status(400).json({ success: false, message: 'adjustment is required.' });

    const product = await Product.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const qty = parseFloat(adjustment);
    const delta = type === 'subtract' ? -Math.abs(qty) : Math.abs(qty);
    const newStock = parseFloat(product.stock || 0) + delta;

    if (newStock < 0) return res.status(400).json({ success: false, message: 'Insufficient stock.' });

    await product.update({ stock: newStock });

    return res.status(200).json({
      success: true,
      message: 'Stock adjusted.',
      data: { stock: newStock, previous_stock: parseFloat(product.stock || 0), adjustment: qty },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /products/low-stock
 * Product uses 'stock' and 'min_stock'
 */
const getLowStock = async (req, res, next) => {
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
    return res.status(200).json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /products/:id/barcode
 */
const generateBarcode = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const text = product.barcode || product.sku || String(product.id);
    const type = req.query.type || 'code128';
    const base64 = await barcodeUtils.generateBarcode(text, type);

    return res.status(200).json({ success: true, data: { barcode: base64, text, type } });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /products/all
 * Hard-deletes all products for this firm.
 */
const deleteAllProducts = async (req, res, next) => {
  try {
    const [deleted] = await Product.update(
      { is_active: false },
      { where: { firm_id: req.firmId, is_active: true } }
    );
    return res.status(200).json({ success: true, message: 'All products deleted.', data: { deleted } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getOne,
  create,
  update,
  delete: deleteProduct,
  deleteAll: deleteAllProducts,
  bulkImport,
  updateStock,
  getLowStock,
  generateBarcode,
};
