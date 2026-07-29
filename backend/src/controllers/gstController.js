'use strict';

const { Op, fn, col } = require('sequelize');
const { Sale, SaleItem, Customer } = require('../models');
const { calculateGST, getGSTRates } = require('../utils/gstUtils');

// Static HSN code list (abbreviated)
const HSN_CODES = [
  { code: '1001', description: 'Wheat and meslin', rate: 0 },
  { code: '1006', description: 'Rice', rate: 0 },
  { code: '0401', description: 'Milk and cream', rate: 0 },
  { code: '0801', description: 'Coconuts, Brazil nuts, cashew nuts', rate: 5 },
  { code: '1701', description: 'Cane or beet sugar', rate: 5 },
  { code: '2201', description: 'Waters, mineral waters', rate: 12 },
  { code: '2202', description: 'Waters with sugar, flavoured', rate: 12 },
  { code: '6101', description: 'Overcoats, car-coats, men\'s', rate: 12 },
  { code: '6201', description: 'Men\'s or boys\' overcoats', rate: 12 },
  { code: '8471', description: 'Automatic data processing machines', rate: 18 },
  { code: '8517', description: 'Telephone sets, smartphones', rate: 18 },
  { code: '8703', description: 'Motor cars and other motor vehicles', rate: 28 },
  { code: '8711', description: 'Motorcycles', rate: 28 },
  { code: '9021', description: 'Orthopaedic appliances', rate: 12 },
  { code: '3004', description: 'Medicaments', rate: 12 },
  { code: '9403', description: 'Other furniture', rate: 18 },
  { code: '8415', description: 'Air conditioning machines', rate: 28 },
];

/**
 * POST /gst/calculate
 */
const calculateGSTController = async (req, res, next) => {
  try {
    const { amount, rate, is_inclusive = false, is_interstate = false } = req.body;
    if (!amount || rate === undefined) {
      return res.status(400).json({ success: false, message: 'amount and rate are required.' });
    }
    const result = calculateGST(parseFloat(amount), parseFloat(rate), is_inclusive, is_interstate);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /gst/gstr1?from_date=&to_date=
 */
const getGSTR1 = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ success: false, message: 'from_date and to_date are required.' });

    const salesWhere = {
      firm_id: req.firmId,
      status: { [Op.in]: ['confirmed', 'completed'] },
      invoice_date: { [Op.between]: [new Date(from_date), new Date(to_date)] },
    };

    const sales = await Sale.findAll({
      where: salesWhere,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'gstin', 'state'] },
        { model: SaleItem, as: 'items', attributes: ['tax_rate', 'taxable_amount', 'cgst', 'sgst', 'igst', 'total'] },
      ],
      order: [['invoice_date', 'ASC']],
    });

    // B2B (with GSTIN customers)
    const b2b = sales.filter((s) => s.customer?.gstin).map((s) => ({
      invoice_no: s.invoice_no,
      invoice_date: s.invoice_date,
      customer_name: s.customer.name,
      gstin: s.customer.gstin,
      taxable_value: parseFloat(s.subtotal || 0),
      cgst: parseFloat(s.items.reduce((sum, i) => sum + parseFloat(i.cgst || 0), 0).toFixed(2)),
      sgst: parseFloat(s.items.reduce((sum, i) => sum + parseFloat(i.sgst || 0), 0).toFixed(2)),
      igst: parseFloat(s.items.reduce((sum, i) => sum + parseFloat(i.igst || 0), 0).toFixed(2)),
      total: parseFloat(s.grand_total || 0),
    }));

    // B2C (without GSTIN)
    const b2cSales = sales.filter((s) => !s.customer?.gstin);
    const b2cByRate = {};
    b2cSales.forEach((s) => {
      s.items.forEach((item) => {
        const rate = item.tax_rate || 0;
        if (!b2cByRate[rate]) b2cByRate[rate] = { tax_rate: rate, taxable_amount: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        b2cByRate[rate].taxable_amount += parseFloat(item.taxable_amount || 0);
        b2cByRate[rate].cgst += parseFloat(item.cgst || 0);
        b2cByRate[rate].sgst += parseFloat(item.sgst || 0);
        b2cByRate[rate].igst += parseFloat(item.igst || 0);
        b2cByRate[rate].total += parseFloat(item.total || 0);
      });
    });

    const gstr1Summary = {
      period: { from_date, to_date },
      b2b_invoices: b2b,
      b2c_summary: Object.values(b2cByRate),
      totals: {
        total_taxable: sales.reduce((s, sale) => s + parseFloat(sale.subtotal || 0), 0),
        total_cgst: b2b.reduce((s, r) => s + r.cgst, 0) + Object.values(b2cByRate).reduce((s, r) => s + r.cgst, 0),
        total_sgst: b2b.reduce((s, r) => s + r.sgst, 0) + Object.values(b2cByRate).reduce((s, r) => s + r.sgst, 0),
        total_igst: b2b.reduce((s, r) => s + r.igst, 0) + Object.values(b2cByRate).reduce((s, r) => s + r.igst, 0),
        invoice_count: sales.length,
      },
    };

    return res.status(200).json({ success: true, data: gstr1Summary });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /gst/e-invoice/generate
 * Mock IRN generation
 */
const generateEInvoice = async (req, res, next) => {
  try {
    const { sale_id } = req.body;
    if (!sale_id) return res.status(400).json({ success: false, message: 'sale_id is required.' });

    const sale = await Sale.findOne({ where: { id: sale_id, firm_id: req.firmId } });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    // Mock IRN (32 hex chars)
    const irn = require('crypto').randomBytes(16).toString('hex').toUpperCase();
    const ackNo = Date.now().toString();
    const ackDate = new Date().toISOString();

    await sale.update({ irn, ack_no: ackNo, ack_date: ackDate, e_invoice_status: 'generated' });

    return res.status(200).json({
      success: true,
      message: 'E-Invoice generated (mock).',
      data: { irn, ack_no: ackNo, ack_date: ackDate },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /gst/e-invoice/cancel
 */
const cancelEInvoice = async (req, res, next) => {
  try {
    const { sale_id, reason } = req.body;
    const sale = await Sale.findOne({ where: { id: sale_id, firm_id: req.firmId } });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    if (!sale.irn) return res.status(400).json({ success: false, message: 'No e-invoice found for this sale.' });

    await sale.update({ e_invoice_status: 'cancelled', irn_cancel_reason: reason || null });
    return res.status(200).json({ success: true, message: 'E-Invoice cancelled (mock).', data: { irn: sale.irn } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /gst/eway-bill/generate
 * Mock EWB generation
 */
const generateEWayBill = async (req, res, next) => {
  try {
    const { sale_id, transporter_id, transport_mode, vehicle_no, distance } = req.body;
    if (!sale_id) return res.status(400).json({ success: false, message: 'sale_id is required.' });

    const sale = await Sale.findOne({ where: { id: sale_id, firm_id: req.firmId } });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    const ewbNo = `EWB${Date.now()}`;
    const validUpto = new Date();
    validUpto.setDate(validUpto.getDate() + Math.ceil((parseInt(distance) || 100) / 200));

    await sale.update({
      ewb_no: ewbNo,
      ewb_date: new Date(),
      ewb_valid_upto: validUpto,
      ewb_status: 'active',
    });

    return res.status(200).json({
      success: true,
      message: 'E-Way Bill generated (mock).',
      data: { ewb_no: ewbNo, valid_upto: validUpto },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /gst/eway-bill/cancel
 */
const cancelEWayBill = async (req, res, next) => {
  try {
    const { sale_id, reason } = req.body;
    const sale = await Sale.findOne({ where: { id: sale_id, firm_id: req.firmId } });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    if (!sale.ewb_no) return res.status(400).json({ success: false, message: 'No EWB found for this sale.' });

    await sale.update({ ewb_status: 'cancelled' });
    return res.status(200).json({ success: true, message: 'E-Way Bill cancelled (mock).', data: { ewb_no: sale.ewb_no } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /gst/hsn-codes?search=
 */
const getHSNCodes = async (req, res, next) => {
  try {
    const { search, rate } = req.query;
    let codes = HSN_CODES;
    if (search) {
      const term = search.toLowerCase();
      codes = codes.filter((h) => h.code.includes(term) || h.description.toLowerCase().includes(term));
    }
    if (rate !== undefined) {
      codes = codes.filter((h) => h.rate === parseInt(rate));
    }
    return res.status(200).json({ success: true, data: codes, count: codes.length });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  calculateGST: calculateGSTController,
  getGSTR1,
  generateEInvoice,
  cancelEInvoice,
  generateEWayBill,
  cancelEWayBill,
  getHSNCodes,
};
