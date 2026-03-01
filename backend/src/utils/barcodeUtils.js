'use strict';

const bwipjs = require('bwip-js');

/**
 * Generate a barcode image as base64 PNG string.
 *
 * @param {string} text        - The value to encode
 * @param {string} type        - Barcode type: 'code128' | 'ean13' | 'qr' | 'code39' | 'upca' | 'datamatrix'
 * @param {object} options     - Optional bwip-js overrides
 * @returns {Promise<string>}  - Base64 encoded PNG (data URI)
 */
const generateBarcode = (text, type = 'code128', options = {}) => {
  return new Promise((resolve, reject) => {
    // Map friendly type names to bwip-js bcid values
    const bcidMap = {
      code128: 'code128',
      code39: 'code39',
      ean13: 'ean13',
      ean8: 'ean8',
      upca: 'upca',
      upce: 'upce',
      qr: 'qrcode',
      qrcode: 'qrcode',
      datamatrix: 'datamatrix',
      pdf417: 'pdf417',
      aztec: 'azteccode',
      itf: 'interleaved2of5',
    };

    const bcid = bcidMap[type.toLowerCase()] || 'code128';

    const bwipOptions = {
      bcid,
      text: String(text),
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
      textsize: 10,
      paddingwidth: 4,
      paddingheight: 4,
      backgroundcolor: 'FFFFFF',
      ...options,
    };

    // QR codes don't use height or includetext the same way
    if (bcid === 'qrcode') {
      delete bwipOptions.height;
      bwipOptions.scale = 4;
      delete bwipOptions.includetext;
    }

    bwipjs.toBuffer(bwipOptions, (err, png) => {
      if (err) {
        reject(new Error(`Barcode generation failed: ${err.message || err}`));
        return;
      }
      const base64 = `data:image/png;base64,${png.toString('base64')}`;
      resolve(base64);
    });
  });
};

/**
 * Generate multiple barcodes for a list of texts
 * @param {string[]} texts
 * @param {string}   type
 * @returns {Promise<Array<{ text, barcode }>>}
 */
const generateBarcodes = async (texts, type = 'code128') => {
  const results = await Promise.allSettled(
    texts.map(async (text) => {
      const barcode = await generateBarcode(text, type);
      return { text, barcode };
    })
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { text: texts[i], barcode: null, error: r.reason?.message };
  });
};

/**
 * Validate EAN-13 check digit
 * @param {string} code - 12 or 13 digit string
 * @returns {string} valid 13-digit EAN-13
 */
const validateEAN13 = (code) => {
  const digits = String(code).replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + checkDigit;
};

module.exports = { generateBarcode, generateBarcodes, validateEAN13 };
