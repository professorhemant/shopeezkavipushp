'use strict';

const PDFDocument = require('pdfkit');
const path = require('path');
const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

const generateInvoiceNumber = (prefix = 'INV', counter = 1, year = null) => {
  const y = year || new Date().getFullYear();
  const paddedCounter = String(counter).padStart(4, '0');
  return `${prefix}-${y}-${paddedCounter}`;
};

const formatCurrency = (amount, symbol = '₹') => {
  const num = parseFloat(amount) || 0;
  return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num === 0) return 'Zero Rupees Only';
  if (num < 0) return 'Minus ' + numberToWords(-num);
  const integer = Math.floor(num);
  const decimal = Math.round((num - integer) * 100);
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  let words = convert(integer) + ' Rupees';
  if (decimal > 0) words += ' and ' + convert(decimal) + ' Paise';
  return words + ' Only';
};

const generatePDF = (sale, firm, items) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      const buffers = [];
      doc.on('data', (c) => buffers.push(c));
      doc.on('end',  () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const PW    = doc.page.width;   // 595.28
      const PH    = doc.page.height;  // 841.89
      const ML    = 35;
      const MR    = 35;
      const CW    = PW - ML - MR;     // ~525
      const TEAL  = '#00ACC1';

      // ── Firm details from Firm Settings (bank fields used lower down) ─
      const firmName  = firm?.name || 'Kavipushp Jewels';
      const firmAddr  = [firm?.address, firm?.city, firm?.state].filter(Boolean).join(', ');
      const firmPhone = firm?.phone || '';
      const firmEmail = firm?.email || '';
      const bankName  = firm?.bank_name  || 'ABC BANK';
      const accNo     = firm?.account_no || '1234567890';
      const ifsc      = firm?.ifsc       || 'IFSC25634125';
      const GOLD      = '#D97706';

      // ── CENTERED LETTERHEAD (matches the on-screen invoice header) ──
      doc.fillColor('#1e293b').fontSize(16).font('Helvetica-Bold')
         .text(firmName, ML, ML, { width: CW, align: 'center' });
      let hy = doc.y + 3;
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica');
      if (firmAddr) { doc.text(firmAddr, ML, hy, { width: CW, align: 'center' }); hy = doc.y + 2; }
      const contact = [firmPhone ? `Phone: ${firmPhone}` : '', firmEmail].filter(Boolean).join('    |    ');
      if (contact)  { doc.text(contact, ML, hy, { width: CW, align: 'center' }); hy = doc.y + 2; }

      // ── GOLD DIVIDER ───────────────────────────────────────────────
      const divY = hy + 3;
      doc.moveTo(ML, divY).lineTo(PW - MR, divY).lineWidth(1.2).strokeColor(GOLD).stroke();

      // ── "Sales Invoice" TITLE ──────────────────────────────────────
      const titleY = divY + 8;
      doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold')
         .text('Sales Invoice', ML, titleY, { width: CW, align: 'center' });

      // ── BILL TO / SHIP TO / INVOICE INFO ──────────────────────────
      const infoY   = titleY + 20;
      const col1W   = CW * 0.33;
      const col2W   = CW * 0.30;
      const col3W   = CW * 0.37;
      const col2X   = ML + col1W;
      const col3X   = ML + col1W + col2W;

      // Bill To
      doc.fillColor('#555').fontSize(8).font('Helvetica-Bold').text('Bill To:', ML, infoY);
      doc.fillColor('#111').fontSize(9).font('Helvetica-Bold')
         .text(sale.customer_name || sale.customer?.name || 'Walk-in', ML, infoY + 11);
      doc.fillColor('#333').fontSize(8).font('Helvetica')
         .text(`Mobile: ${sale.customer_phone || sale.customer?.mobile || sale.mobile || ''}`, ML, infoY + 23);

      // Invoice No + Date
      doc.fillColor('#333').fontSize(8).font('Helvetica-Bold')
         .text('Invoice No.: ', col3X, infoY, { continued: true, width: col3W })
         .font('Helvetica').text(sale.invoice_no || '');
      doc.font('Helvetica-Bold')
         .text('Date: ', col3X, infoY + 11, { continued: true, width: col3W })
         .font('Helvetica').text(
           new Date(sale.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
         );

      // ── ITEMS TABLE ────────────────────────────────────────────────
      const tableY = infoY + 50;

      // Column definitions (total = CW = ~525)
      const cols = [
        { key: 'no',      label: '#',           w: 18,  align: 'center' },
        { key: 'name',    label: 'Item Name',    w: 128, align: 'left'   },
        { key: 'mrp',     label: 'MRP',          w: 38,  align: 'right'  },
        { key: 'qty',     label: 'Qty',          w: 28,  align: 'center' },
        { key: 'price',   label: 'Price',        w: 46,  align: 'right'  },
        { key: 'disc',    label: 'Disc',         w: 36,  align: 'right'  },
        { key: 'taxable', label: 'Total\nAmt',   w: 46,  align: 'right'  },
        { key: 'gst',     label: 'GST\n%',       w: 28,  align: 'center' },
        { key: 'cgst',    label: 'CGST',         w: 38,  align: 'right'  },
        { key: 'sgst',    label: 'SGST',         w: 38,  align: 'right'  },
        { key: 'amount',  label: 'Amount',       w: 47,  align: 'right'  },
      ];
      // Assign x positions
      let cx = ML;
      cols.forEach((col) => { col.x = cx; cx += col.w; });

      const HEADER_H = 22;
      const ROW_H    = 16;
      const MIN_ROWS = 10;

      // Header background
      doc.rect(ML, tableY, CW, HEADER_H).fill(TEAL);
      doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold');
      cols.forEach((col) => {
        doc.text(col.label, col.x + 1, tableY + 3, { width: col.w - 2, align: col.align });
      });

      // Data rows
      const safeItems = Array.isArray(items) ? items : [];
      const displayRows = Math.max(safeItems.length, MIN_ROWS);
      let ry = tableY + HEADER_H;

      for (let idx = 0; idx < displayRows; idx++) {
        const item = safeItems[idx];
        const bg   = idx % 2 === 0 ? '#FFFFFF' : '#F7FAFA';
        doc.rect(ML, ry, CW, ROW_H).fill(bg);

        if (item) {
          doc.fillColor('#111').fontSize(7.5).font('Helvetica');
          // Total Amt = taxable_amount, the ex-tax base the row was booked on.
          // Print the GST stored against the item rather than re-deriving it —
          // the old back-calculation treated taxable_amount as still tax-inclusive
          // and so disagreed with the CGST/SGST in the summary below.
          const totalAmt  = parseFloat(item.taxable_amount || 0);
          const taxRate   = parseFloat(item.tax_rate || 0);
          const cgstRow   = parseFloat(item.cgst || 0);
          const sgstRow   = parseFloat(item.sgst || 0);
          const vals = [
            { key: 'no',      v: String(idx + 1) },
            { key: 'name',    v: item.product_name || '' },
            { key: 'mrp',     v: item.mrp ? parseFloat(item.mrp).toFixed(2) : 'N/A' },
            { key: 'qty',     v: String(parseFloat(item.quantity || 0)) },
            { key: 'price',   v: parseFloat(item.unit_price || 0).toFixed(2) },
            { key: 'disc',    v: parseFloat(item.discount_amount || 0).toFixed(2) },
            { key: 'taxable', v: totalAmt.toFixed(1) },
            { key: 'gst',     v: taxRate.toFixed(1) },
            { key: 'cgst',    v: cgstRow.toFixed(2) },
            { key: 'sgst',    v: sgstRow.toFixed(2) },
            { key: 'amount',  v: totalAmt.toFixed(2) },  // same as Total Amt
          ];
          vals.forEach((vd) => {
            const col = cols.find((c) => c.key === vd.key);
            doc.text(vd.v, col.x + 2, ry + 4, { width: col.w - 4, align: col.align, lineBreak: false });
          });
        }

        // Row separator
        doc.moveTo(ML, ry).lineTo(PW - MR, ry).lineWidth(0.2).strokeColor('#DDDDDD').stroke();
        ry += ROW_H;
      }

      // Totals row
      const totalQty     = safeItems.reduce((s, i) => s + parseFloat(i.quantity       || 0), 0);
      const totalMRP     = safeItems.reduce((s, i) => s + parseFloat(i.mrp            || 0), 0);
      const totalTaxable = safeItems.reduce((s, i) => s + parseFloat(i.taxable_amount || 0), 0);
      // Sum the GST booked against each item, so this row agrees with the item
      // rows above it and the CGST/SGST in the summary below.
      const totalCGST    = safeItems.reduce((s, i) => s + parseFloat(i.cgst || 0), 0);
      const totalSGST    = safeItems.reduce((s, i) => s + parseFloat(i.sgst || 0), 0);
      const totalAmount  = totalTaxable; // Amount = Total Amt (tax inclusive, nothing added on top)

      doc.rect(ML, ry, CW, ROW_H).fill('#E8E8E8');
      doc.fillColor('#111').fontSize(7.5).font('Helvetica-Bold');
      const tc = (key, val) => {
        const col = cols.find((c) => c.key === key);
        doc.text(val, col.x + 2, ry + 4, { width: col.w - 4, align: col.align, lineBreak: false });
      };
      tc('name',    'Total');
      tc('mrp',     totalMRP.toFixed(2));
      tc('qty',     String(totalQty));
      tc('taxable', totalTaxable.toFixed(1));
      tc('cgst',    totalCGST.toFixed(2));
      tc('sgst',    totalSGST.toFixed(2));
      tc('amount',  totalAmount.toFixed(2));
      ry += ROW_H;

      // Table outer border
      doc.rect(ML, tableY, CW, ry - tableY).lineWidth(0.5).strokeColor('#AAAAAA').stroke();
      // Vertical column dividers
      cols.forEach((col, i) => {
        if (i > 0) {
          doc.moveTo(col.x, tableY).lineTo(col.x, ry).lineWidth(0.2).strokeColor('#BBBBBB').stroke();
        }
      });

      // ── BOTTOM SECTION ─────────────────────────────────────────────
      const botY  = ry + 14;
      const leftW = CW * 0.32;
      const midW  = CW * 0.22;
      const midX  = ML + leftW + 10;
      const sumX  = ML + leftW + midW + 20;
      const sumW  = CW - leftW - midW - 20;

      // Pay To (left)
      doc.fillColor('#333').fontSize(8).font('Helvetica-Bold').text('Pay To:', ML, botY);
      doc.fillColor('#111').fontSize(8.5).font('Helvetica-Bold').text('Kavipushp Jewels', ML, botY + 12);
      doc.fillColor('#444').fontSize(7.5).font('Helvetica')
         .text(`Bank: ${bankName}`,  ML, botY + 23)
         .text(`Acc No.: ${accNo}`,  ML, botY + 33)
         .text(`IFSC: ${ifsc}`,      ML, botY + 43);

      // Payment details (mode + reference)
      const payMode = (sale.payment_mode || 'cash').toUpperCase();
      const refNo   = sale.payment_reference_no || null;
      const bankNm  = sale.payment_bank_name    || null;
      const chqDate = sale.payment_cheque_date  || null;
      const payNotes= sale.payment_notes        || null;
      let py = botY + 57;
      doc.fillColor('#333').fontSize(7.5).font('Helvetica-Bold').text('Payment:', ML, py);
      doc.fillColor('#555').font('Helvetica').text(payMode, ML + 38, py);
      py += 11;
      if (refNo)   { doc.fillColor('#555').fontSize(7.5).font('Helvetica').text(`Ref: ${refNo}`,  ML, py); py += 10; }
      if (bankNm)  { doc.fillColor('#555').fontSize(7.5).font('Helvetica').text(`Bank: ${bankNm}`, ML, py); py += 10; }
      if (chqDate) { doc.fillColor('#555').fontSize(7.5).font('Helvetica').text(`Cheque Date: ${chqDate}`, ML, py); py += 10; }
      if (payNotes){ doc.fillColor('#555').fontSize(7.5).font('Helvetica').text(payNotes, ML, py, { width: leftW }); }

      // QR placeholder (middle) - just label
      doc.fillColor('#888').fontSize(7.5).font('Helvetica-Oblique')
         .text('Scan QR for Payment', midX, botY, { width: midW, align: 'center' });
      doc.rect(midX + (midW - 50) / 2, botY + 12, 50, 50).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      doc.fillColor('#CCCCCC').fontSize(7).text('QR Code', midX + (midW - 50) / 2, botY + 32, { width: 50, align: 'center' });

      // Totals summary (right)
      // Grand Total is the amount actually payable — sale.total, which already has
      // the discount taken off. It previously read sale.subtotal, the pre-discount
      // figure, so a discounted invoice printed the undiscounted amount and then
      // showed the difference as an unpaid balance.
      const grandTot = parseFloat(sale.total || 0);
      const discountAmt = parseFloat(sale.discount_amount || 0);
      // Use the GST the sale was booked with. This used to re-derive it as
      // ta * (tr/2) / (100 + tr), but taxable_amount is already the ex-tax base,
      // so that backed the tax out a second time and under-reported CGST/SGST.
      const cgstAmt  = parseFloat(sale.cgst || 0);
      const sgstAmt  = parseFloat(sale.sgst || 0);
      const igstAmt  = parseFloat(sale.igst || 0);
      const taxAmt   = cgstAmt + sgstAmt + igstAmt;
      const roundOff = Math.round(grandTot) - grandTot;

      let sy = botY;
      const sumLW = sumW * 0.58;
      const sumVW = sumW * 0.42;

      const drawSumRow = (label, val, bold = false, large = false, color = '#333') => {
        const sz = large ? 11 : 8;
        doc.fillColor(color).fontSize(sz).font(bold ? 'Helvetica-Bold' : 'Helvetica')
           .text(label, sumX, sy, { width: sumLW, lineBreak: false });
        doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica')
           .text(String(val), sumX + sumLW, sy, { width: sumVW, align: 'right', lineBreak: false });
        // row separator
        const rowH = large ? 16 : 13;
        doc.moveTo(sumX, sy + rowH - 1).lineTo(sumX + sumW, sy + rowH - 1)
           .lineWidth(0.3).strokeColor('#DDDDDD').stroke();
        sy += rowH;
      };

      drawSumRow('Sub Total',  parseFloat(sale.subtotal || 0).toFixed(0));
      drawSumRow('Total Tax',  taxAmt.toFixed(0));
      drawSumRow('CGST',       cgstAmt.toFixed(0));
      drawSumRow('SGST',       sgstAmt.toFixed(0));
      // Shown only when there is one, so the customer can see why Grand Total is
      // lower than Sub Total + Tax.
      if (discountAmt > 0) drawSumRow('Discount', `-${discountAmt.toFixed(0)}`, false, false, '#16a34a');
      drawSumRow('Round Off',  roundOff.toFixed(1));

      // Bold line before Grand Total
      doc.moveTo(sumX, sy).lineTo(sumX + sumW, sy).lineWidth(1).strokeColor('#333333').stroke();
      sy += 4;
      drawSumRow('Grand Total', grandTot.toFixed(0), true, true);

      // Previous / outstanding balance from customer opening balance
      const prevBal = parseFloat(sale.previous_balance || 0);
      if (prevBal > 0) {
        drawSumRow('Prev. Balance', prevBal.toFixed(0), false, false, '#ea580c');
        drawSumRow('Net Payable', (grandTot + prevBal).toFixed(0), true, false, '#c2410c');
      }

      // Paid / Balance rows — recalculate against the new inclusive Grand Total
      const paidAmt      = parseFloat(sale.paid_amount || 0);
      const effectiveBal = prevBal > 0
        ? (grandTot + prevBal - paidAmt)
        : Math.max(0, grandTot - paidAmt);
      if (effectiveBal > 0 || prevBal > 0) {
        drawSumRow('Paid', paidAmt.toFixed(0), false, false, '#16a34a');
        drawSumRow('Unpaid Balance', effectiveBal.toFixed(0), true, false, '#dc2626');
      }

      // Amount in words (italic, small, teal)
      doc.fillColor(TEAL).fontSize(7.5).font('Helvetica-Oblique')
         .text(numberToWords(Math.round(grandTot)), sumX, sy + 2, { width: sumW });

      // ── SIGNATURE ──────────────────────────────────────────────────
      const sigY = sy + 35;
      doc.fillColor('#111').fontSize(9).font('Helvetica-Bold')
         .text(`For, ${firmName}`, ML, sigY, { width: CW, align: 'right' });

      // ── FOOTER ─────────────────────────────────────────────────────
      doc.fillColor('#AAAAAA').fontSize(7).font('Helvetica-Oblique')
         .text('This is a computer-generated invoice.', ML, PH - 28, { width: CW, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoiceNumber, generatePDF, formatCurrency, numberToWords };
