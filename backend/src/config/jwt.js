'use strict';

// Single source of truth for the JWT secret used to sign and verify tokens.
// In production JWT_SECRET MUST be set in the environment — we never fall back
// to a hardcoded value (a committed default would let anyone forge admin
// tokens). In non-production a fixed dev-only value is used so local dev works
// without configuring an env var; it is never reachable on the live app.
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production' ? null : 'dev_only_insecure_secret_change_me');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production.');
}

module.exports = { JWT_SECRET };
