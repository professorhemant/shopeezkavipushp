// The Lehenga side of the business trades as BANNO BAZAAR. Anywhere the user is
// inside the Lehenga module — the top banner, the sidebar, and the rental/sale
// invoices — the firm name reads BANNO BAZAAR instead of the firm's own name.
// Address, phone and email are unchanged: it's the same premises.
export const LEHENGA_BRAND = 'BANNO BAZAAR'

// True while the given path is anywhere inside the Lehenga module.
export const isLehengaRoute = (pathname) => String(pathname || '').startsWith('/lehenga')

/**
 * Firm name to display for a route: the lehenga brand inside the Lehenga
 * module, otherwise the firm's own name.
 */
export const brandForRoute = (pathname, firmName) =>
  isLehengaRoute(pathname) ? LEHENGA_BRAND : (firmName || 'Kavipushp Jewels')
