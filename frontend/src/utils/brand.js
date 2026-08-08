// The Lehenga side of the business trades as BANNO BAZAAR. Anywhere the user is
// inside the Lehenga module — the top banner, the sidebar, and the rental/sale
// invoices — the firm name reads BANNO BAZAAR instead of the firm's own name.
// Address, phone and email are unchanged: it's the same premises.
export const LEHENGA_BRAND = 'BANNO BAZAAR'

/**
 * BANNO BAZAAR is a separately GST-registered firm sharing Kavipushp's premises,
 * so its lehenga invoices must carry its own GST identity rather than the firm's.
 *
 * PENDING: awaiting the real registration details. Every field is intentionally
 * blank — each one only prints once it is filled in, because a placeholder GSTIN
 * on a real tax invoice is worse than no GSTIN at all. Fill these in and the
 * seller GST line and Place of Supply appear on the lehenga invoices.
 */
export const LEHENGA_FIRM = {
  legal_name: '',  // registered name, if different from the trading name above
  gstin: '',       // 15-character GSTIN
  pan: '',
  state: '',       // e.g. 'Madhya Pradesh'
  state_code: '',  // e.g. '23'
}

// True while the given path is anywhere inside the Lehenga module.
export const isLehengaRoute = (pathname) => String(pathname || '').startsWith('/lehenga')

/**
 * Firm name to display for a route: the lehenga brand inside the Lehenga
 * module, otherwise the firm's own name.
 */
export const brandForRoute = (pathname, firmName) =>
  isLehengaRoute(pathname) ? LEHENGA_BRAND : (firmName || 'Kavipushp Jewels')
