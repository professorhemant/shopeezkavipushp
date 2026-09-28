'use strict';

// ₹1 = 0.04 points — proportional, no cliff-edges at slab boundaries.
// Minimum spend of ₹500 to earn anything.
const RATE = 0.04;
const MIN_SPEND = 500;

// Points valid for 12 rolling months from last purchase date.
const VALIDITY_MONTHS = 12;

// Minimum balance needed before redemption is allowed.
const MIN_REDEEM = 50;

// 1 point = ₹1 discount at redemption.
const POINT_VALUE = 1;

function calculatePoints(amount) {
  const amt = parseFloat(amount) || 0;
  if (amt < MIN_SPEND) return 0;
  return Math.round(amt * RATE);
}

function expiryDate(fromDate) {
  const d = new Date(fromDate || Date.now());
  d.setMonth(d.getMonth() + VALIDITY_MONTHS);
  return d;
}

function isExpired(customer) {
  if (!customer.points_expires_at) return true;
  return new Date(customer.points_expires_at) < new Date();
}

module.exports = { calculatePoints, expiryDate, isExpired, MIN_REDEEM, POINT_VALUE, VALIDITY_MONTHS };
