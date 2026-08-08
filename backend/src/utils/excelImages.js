'use strict';

// Shared helpers for the inventory Excel flows (bridal jewellery + lehengas):
// pulling images out of an uploaded .xlsx, and shrinking images for export.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const unzipper = require('unzipper');
const { UPLOAD_ROOT } = require('../middleware/upload');

const SUPPORTED_IMG_EXT = new Set(['jpeg', 'jpg', 'png', 'gif']);

// Absolute, publicly reachable base URL. Prefers an explicit/Railway host so the
// URL is https and works from the separate frontend origin.
const publicBaseUrl = (req) =>
  process.env.BACKEND_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `${req.protocol}://${req.get('host')}`);

/**
 * Pull the images embedded in an .xlsx and save them under uploads/<folder>/.
 * An .xlsx stores pictures as a drawing XML that anchors each image to a cell,
 * plus a rels file mapping the anchor's rId to a file in xl/media/.
 *
 * @returns {Promise<Object<number,string>>} 1-based Excel row → public image URL
 */
const extractRowImages = async (buf, baseUrl, folder) => {
  const zipFiles = {};
  const dir = await unzipper.Open.buffer(buf);
  for (const file of dir.files) {
    if (file.path.startsWith('xl/media/') || file.path.startsWith('xl/drawings/')) {
      zipFiles[file.path] = await file.buffer();
    }
  }

  const rowToUrl = {};
  const drawKey = Object.keys(zipFiles).find(k => /xl\/drawings\/drawing\d+\.xml$/.test(k) && !k.includes('_rels'));
  const relsKey = Object.keys(zipFiles).find(k => /xl\/drawings\/_rels\/drawing\d+\.xml\.rels$/.test(k));
  if (!drawKey || !relsKey) return rowToUrl;

  const drawXml = zipFiles[drawKey].toString('utf8');
  const relsXml = zipFiles[relsKey].toString('utf8');

  // rId → media filename
  const rIdToFile = {};
  const re = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
  let m;
  while ((m = re.exec(relsXml)) !== null) rIdToFile[m[1]] = path.basename(m[2]);

  const uploadDir = path.join(UPLOAD_ROOT, folder);

  // row → media filename
  const anchorRe = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
  let am;
  while ((am = anchorRe.exec(drawXml)) !== null) {
    const block = am[1];
    const rowM = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/m.exec(block);
    const ridM = /r:embed="(rId\d+)"/m.exec(block);
    if (!rowM || !ridM) continue;

    const excelRow = parseInt(rowM[1], 10) + 1; // 0-based → 1-based (row 2 = first data row)
    const mediaName = rIdToFile[ridM[1]];
    if (!mediaName) continue;
    const imgBuf = zipFiles[`xl/media/${mediaName}`];
    if (!imgBuf) continue;

    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const ext = path.extname(mediaName) || '.jpg';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), imgBuf);

    rowToUrl[excelRow] = `${baseUrl}/uploads/${folder}/${filename}`;
  }
  return rowToUrl;
};

/**
 * Fetch an image (local uploads path when possible, else HTTP) and shrink it to
 * a thumbnail so exported workbooks stay small.
 *
 * @returns {Promise<{buffer: Buffer, extension: string}|null>}
 */
const resolveThumbnail = async (url, width, height) => {
  if (!url) return null;
  try {
    let rawBuf;
    const idx = url.indexOf('/uploads/');
    if (idx !== -1) {
      const localPath = path.join(UPLOAD_ROOT, url.slice(idx + '/uploads/'.length));
      if (fs.existsSync(localPath)) {
        const ext = path.extname(localPath).replace('.', '').toLowerCase();
        if (!SUPPORTED_IMG_EXT.has(ext)) return null;
        rawBuf = fs.readFileSync(localPath);
      }
    }
    if (!rawBuf) {
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
      rawBuf = Buffer.from(resp.data);
    }
    const buffer = await sharp(rawBuf)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    return { buffer, extension: 'jpeg' };
  } catch { return null; }
};

/**
 * Build a picker that finds the sheet column matching any of the given aliases,
 * ignoring case, spaces, underscores, dashes and dots.
 */
const makeColKey = (rowKeys) => (...candidates) => {
  for (const c of candidates) {
    const norm = c.toLowerCase().replace(/[\s_\-.]+/g, '');
    const hit = rowKeys.find(k => k.toLowerCase().replace(/[\s_\-.]+/g, '') === norm);
    if (hit) return hit;
  }
  return null;
};

/**
 * Tolerance-aware image lookup for a data row: exact anchor row first, then
 * ±1/±2 rows (Excel anchors drift). Each image is handed out at most once.
 */
const makeImagePicker = (rowToUrl) => {
  const used = new Set();
  return (excelRow) => {
    for (const delta of [0, -1, 1, -2, 2]) {
      const r = excelRow + delta;
      if (rowToUrl[r] && !used.has(r)) { used.add(r); return rowToUrl[r]; }
    }
    return null;
  };
};

module.exports = { publicBaseUrl, extractRowImages, resolveThumbnail, makeColKey, makeImagePicker };
