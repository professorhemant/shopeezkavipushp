'use strict';

/**
 * GST Rates available in India
 */
const GST_RATES = [0, 5, 12, 18, 28];

/**
 * Calculate GST breakdown for a given amount and rate
 *
 * @param {number} amount       - Base amount (before or after tax, depending on is_inclusive)
 * @param {number} rate         - GST rate (e.g. 18 for 18%)
 * @param {boolean} isInclusive - Whether amount already includes GST
 * @param {boolean} isInterstate - IGST (interstate) vs CGST+SGST (intrastate)
 * @returns {{ taxableAmount, cgst, sgst, igst, totalTax, total }}
 */
const calculateGST = (amount, rate, isInclusive = false, isInterstate = false) => {
  amount = parseFloat(amount) || 0;
  rate = parseFloat(rate) || 0;

  let taxableAmount;

  if (isInclusive) {
    // Back-calculate taxable amount from tax-inclusive amount
    taxableAmount = amount / (1 + rate / 100);
  } else {
    taxableAmount = amount;
  }

  const totalTaxAmount = taxableAmount * (rate / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterstate) {
    igst = totalTaxAmount;
  } else {
    cgst = totalTaxAmount / 2;
    sgst = totalTaxAmount / 2;
  }

  const total = taxableAmount + totalTaxAmount;

  return {
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    igst: parseFloat(igst.toFixed(2)),
    totalTax: parseFloat(totalTaxAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    rate,
    isInterstate,
    isInclusive,
  };
};

/**
 * Get all valid GST rates
 * @returns {number[]}
 */
const getGSTRates = () => GST_RATES;

/**
 * Calculate TCS (Tax Collected at Source)
 * @param {number} amount
 * @param {number} rate - TCS rate %
 * @returns {number}
 */
const calculateTCS = (amount, rate) => {
  amount = parseFloat(amount) || 0;
  rate = parseFloat(rate) || 0;
  return parseFloat((amount * (rate / 100)).toFixed(2));
};

/**
 * Calculate TDS (Tax Deducted at Source)
 * @param {number} amount
 * @param {number} rate - TDS rate %
 * @returns {number}
 */
const calculateTDS = (amount, rate) => {
  amount = parseFloat(amount) || 0;
  rate = parseFloat(rate) || 0;
  return parseFloat((amount * (rate / 100)).toFixed(2));
};

/**
 * Calculate GST for multiple line items
 * @param {Array} items - Array of { amount, rate, is_inclusive, is_interstate }
 * @returns {{ items, subtotal, total_cgst, total_sgst, total_igst, total_tax, grand_total }}
 */
const calculateGSTForItems = (items = []) => {
  const processedItems = items.map((item) =>
    calculateGST(item.amount, item.rate, item.is_inclusive, item.is_interstate)
  );

  const totals = processedItems.reduce(
    (acc, item) => {
      acc.subtotal += item.taxableAmount;
      acc.total_cgst += item.cgst;
      acc.total_sgst += item.sgst;
      acc.total_igst += item.igst;
      acc.total_tax += item.totalTax;
      acc.grand_total += item.total;
      return acc;
    },
    { subtotal: 0, total_cgst: 0, total_sgst: 0, total_igst: 0, total_tax: 0, grand_total: 0 }
  );

  return {
    items: processedItems,
    subtotal: parseFloat(totals.subtotal.toFixed(2)),
    total_cgst: parseFloat(totals.total_cgst.toFixed(2)),
    total_sgst: parseFloat(totals.total_sgst.toFixed(2)),
    total_igst: parseFloat(totals.total_igst.toFixed(2)),
    total_tax: parseFloat(totals.total_tax.toFixed(2)),
    grand_total: parseFloat(totals.grand_total.toFixed(2)),
  };
};

module.exports = { calculateGST, getGSTRates, calculateTCS, calculateTDS, calculateGSTForItems };
