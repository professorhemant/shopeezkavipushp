'use strict';

/**
 * READ-ONLY audit of invoice totals.
 *
 * Finds sales whose stored total was computed with GST added on top of a price
 * that already included it (the bug fixed in e4685f4). For each one it
 * recomputes the total the GST-inclusive way and reports the difference.
 *
 * This script only issues SELECTs. It never writes, updates or deletes.
 * Nothing in the application changes as a result of running it.
 *
 * Usage (from backend/):
 *   railway run --service backend node scripts/audit-invoice-totals.js
 */

const { Sale, SaleItem, sequelize } = require('../src/models');

const money = (n) => `₹${Number(n).toFixed(2)}`;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

/**
 * Recompute a sale's total treating item prices as GST-inclusive, mirroring
 * calculateGST's inclusive branch: the price already contains the tax, so the
 * taxable base is price / (1 + rate/100).
 */
function recompute(sale) {
  let taxable = 0;
  let tax = 0;
  for (const item of sale.items || []) {
    const qty = parseFloat(item.quantity || 0);
    const unit = parseFloat(item.unit_price || 0);
    const rate = parseFloat(item.tax_rate || 0);
    const itemDisc = parseFloat(item.discount_amount || 0);
    const gross = qty * unit - itemDisc;
    const base = rate > 0 ? gross / (1 + rate / 100) : gross;
    taxable += base;
    tax += gross - base;
  }
  const discount = parseFloat(sale.discount_amount || 0);
  return Math.round((taxable + tax - discount) * 100) / 100;
}

(async () => {
  await sequelize.authenticate();

  const sales = await Sale.findAll({
    include: [{ model: SaleItem, as: 'items' }],
    order: [['invoice_date', 'ASC'], ['createdAt', 'ASC']],
  });

  const rows = [];
  let overstated = 0;
  let phantom = 0;

  for (const sale of sales) {
    if (!sale.items || sale.items.length === 0) continue;
    const stored = parseFloat(sale.total || 0);
    const correct = recompute(sale);
    const diff = Math.round((stored - correct) * 100) / 100;
    // A paisa of float drift is not a defect worth reporting.
    if (Math.abs(diff) < 0.5) continue;

    const paid = parseFloat(sale.paid_amount || 0);
    // What the customer is currently shown as owing vs what they'd owe if the
    // total were right. That gap is money being asked for in error.
    const shownBalance = parseFloat(sale.balance || 0);
    const trueBalance = Math.max(0, Math.round((correct - paid) * 100) / 100);
    const wrongly = Math.round((shownBalance - trueBalance) * 100) / 100;

    overstated += diff;
    if (wrongly > 0) phantom += wrongly;

    rows.push({
      invoice: sale.invoice_no || '(none)',
      date: sale.invoice_date ? new Date(sale.invoice_date).toISOString().slice(0, 10) : '',
      customer: (sale.customer_name || 'Walk-in').slice(0, 18),
      status: sale.payment_status || '',
      stored, correct, diff, shownBalance, trueBalance, wrongly,
    });
  }

  console.log(`\nInvoice total audit — READ ONLY, nothing was changed\n${'='.repeat(112)}`);
  console.log(`Invoices examined: ${sales.length}`);
  console.log(`Invoices with a wrong total: ${rows.length}\n`);

  if (rows.length === 0) {
    console.log('No discrepancies found.\n');
  } else {
    console.log(
      pad('INVOICE', 16) + pad('DATE', 12) + pad('CUSTOMER', 20) +
      padL('STORED', 12) + padL('SHOULD BE', 12) + padL('DIFF', 10) +
      padL('SHOWS OWING', 13) + padL('REALLY OWES', 13),
    );
    console.log('-'.repeat(112));
    for (const r of rows) {
      console.log(
        pad(r.invoice, 16) + pad(r.date, 12) + pad(r.customer, 20) +
        padL(money(r.stored), 12) + padL(money(r.correct), 12) + padL(money(r.diff), 10) +
        padL(money(r.shownBalance), 13) + padL(money(r.trueBalance), 13),
      );
    }
    console.log('-'.repeat(112));
    console.log(`\nTotals overstated by:            ${money(overstated)}`);
    console.log(`Balance wrongly shown as owing:  ${money(phantom)}   <- money customers do not owe`);
    const affected = rows.filter((r) => r.wrongly > 0);
    console.log(`Invoices wrongly showing a due:  ${affected.length}`);
    if (affected.length) {
      console.log('\nCustomers who may be chased for money they do not owe:');
      const byCustomer = {};
      for (const r of affected) byCustomer[r.customer] = (byCustomer[r.customer] || 0) + r.wrongly;
      Object.entries(byCustomer)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, amt]) => console.log(`  ${pad(name, 22)} ${money(amt)}`));
    }
  }

  console.log(`\n${'='.repeat(112)}`);
  console.log('No records were modified. This audit only read data.\n');

  await sequelize.close();
  process.exit(0);
})().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
