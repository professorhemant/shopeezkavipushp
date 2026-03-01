'use strict';

const barcodeUtils = require('../utils/barcodeUtils');
const { calculateGST } = require('../utils/gstUtils');
const { generatePDF } = require('../utils/invoiceUtils');
const { Sale, SaleItem, Customer, Firm } = require('../models');

/**
 * GET /tools/barcode?text=&type=
 * Generate barcode PNG as base64
 */
const generateBarcode = async (req, res, next) => {
  try {
    const { text, type = 'code128' } = req.query;
    if (!text) return res.status(400).json({ success: false, message: 'text is required.' });

    const base64 = await barcodeUtils.generateBarcode(text, type);
    return res.status(200).json({ success: true, data: { barcode: base64, text, type } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /tools/qr?text=
 * Generate QR code
 */
const generateQR = async (req, res, next) => {
  try {
    const { text } = req.query;
    if (!text) return res.status(400).json({ success: false, message: 'text is required.' });

    const QRCode = require('qrcode');
    const base64 = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
    });

    return res.status(200).json({ success: true, data: { qr: base64, text } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /tools/calculate-gst
 * GST calculator
 */
const calculateGSTController = async (req, res, next) => {
  try {
    const { amount, rate, is_inclusive = false, is_interstate = false } = req.body;
    if (!amount || rate === undefined) {
      return res.status(400).json({ success: false, message: 'amount and rate are required.' });
    }
    const result = calculateGST(parseFloat(amount), parseFloat(rate), Boolean(is_inclusive), Boolean(is_interstate));
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /tools/invoice-pdf/:saleId
 * Standalone invoice PDF generator
 */
const generateInvoicePDF = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.saleId, firm_id: req.firmId },
      include: [
        { model: Customer, as: 'customer' },
        { model: SaleItem, as: 'items' },
        { model: Firm, as: 'firm' },
      ],
    });

    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    const pdfBuffer = await generatePDF(sale, sale.firm, sale.items);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${sale.invoice_no}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

module.exports = { generateBarcode, generateQR, calculateGST: calculateGSTController, generateInvoicePDF };
