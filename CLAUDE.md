# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Shopeezkavipushp ("Kavipushp") — a billing/inventory/ERP web app for Indian MSMEs. Monorepo with two apps: a React+Vite SPA (`frontend/`) and an Express+Sequelize REST API (`backend/`) over MySQL. Deployed on Railway (project `shopeezkavipushp`, env `production`): the repo is GitHub-connected, so **a push to `master` auto-deploys** both the `frontend` and `backend` services — no manual `railway up` or server `git pull`. A push is not "deployed" until the matching commit shows `SUCCESS` (check via the Railway MCP `list_deployments`).

## Commands

Run from the repo root unless noted.

```bash
npm run install:all     # install root + backend + frontend deps
npm run dev             # run backend (nodemon :5000) + frontend (vite :5173) together
npm run seed            # seed demo firm + admin (admin@demo.com / Admin@123)

# Backend (in backend/)
npm run dev             # nodemon server.js
npm start               # node server.js

# Frontend (in frontend/)
npm run build           # vite build  -> dist/
npm run lint            # see caveat below
```

- **No test suite exists** — there is no test runner, no `test` script, and no spec files. Don't claim tests pass; verify behavior by running the app.
- **`backend` `npm run migrate` is dead** — it points at `src/config/migrate.js`, which does not exist. Schema is NOT managed by migrations (see below).
- **`frontend` lint is misconfigured** — `eslint . --ext ts,tsx` but the codebase is `.jsx`, so it lints almost nothing. Treat a clean lint as meaningless; rely on `vite build` to catch real errors.

## Verifying changes

There are no automated tests, and `vite build` / `node --check` pass on code that still breaks at runtime against real MySQL. Close-out SOP for any frontend-affecting change: build → `git push` to `master` → confirm Railway auto-deploy reaches `SUCCESS` (Railway MCP `list_deployments`) → drive the **deployed** app with the Playwright MCP browser tools and confirm actual behavior (network status codes + rendered DOM), not just that it compiles.

**Confirming a deploy without the Railway MCP** (its auth expires often):
- **Frontend** — the static server has SPA fallback, so *any* unmatched path returns `200` with `text/html`. Polling `/assets/<new-chunk>.js` is therefore a false positive. Compare the entry hash instead: `curl -s <frontend>/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'` against the same grep over `frontend/dist/index.html`.
- **Backend** — probing a route path works: `404` = not deployed yet, `502` = restarting, `401` = live and auth-protected.

## Architecture

### Schema is managed by `sequelize.sync()`, not migrations
`backend/server.js` boots by calling `sequelize.sync()` (creates missing tables from the models), then a hard-coded list of `ALTER TABLE ... ADD COLUMN` statements wrapped in try/catch (the de-facto migration mechanism for new columns), then seeds. `database/schema.sql` exists but is only used for a fresh manual install — the running source of truth is the Sequelize models. To add a column: add it to the model, and if existing DBs need it, add an `ALTER TABLE` to the list in `server.js`. A failing `sync()` calls `process.exit(1)`, taking the whole API (including login) down.

- **MySQL gotcha:** `TEXT`/`LONGTEXT`/`BLOB` columns cannot have a `DEFAULT` (`ER_BLOB_CANT_HAVE_DEFAULT`) — this crashes `sync()` on boot. For JSON-in-TEXT columns, use a getter/setter that parses/stringifies and treats null as `{}`/`[]` instead of `defaultValue` (see `models/Role.js`, `models/DayBookSnapshot.js`).
- Sequelize is configured globally `underscored: true` + `timestamps: true`: DB columns are snake_case (`created_at`), JS attributes stay camelCase (`createdAt`).

### Two parallel role systems — only one is enforced
- `User.role_name` (enum: `super_admin|admin|manager|staff|billing`) is the **only** thing that actually gates access. Backend `middleware/auth.js` `authorize(...roles)` checks it; frontend role checks read `user.role_name` from the auth store.
- The dynamic **Roles & Permissions** system (`models/Role.js` + `Permission.js`, `user_roles`/`role_permissions` join tables, the `/staff/roles` UI) is **not wired into enforcement** — editing it changes nothing about who can do what. Helper scripts to fix accounts live in `backend/scripts/` (`promote-admin.js`, `ensure-user.js`; passwords passed as runtime args, never committed).

### Request flow & API layer
- `backend/src/app.js` mounts everything under `/api` via `routes/index.js`; all routes except `/api/auth` sit behind the `authenticate` middleware (JWT → sets `req.user`/`req.userId`/`req.firmId`). Rate limiting + 50mb body limit + `/uploads` static dir are configured here.
- Frontend talks to the API through `frontend/src/api/index.js`: a single axios instance with a request interceptor (attaches JWT from `localStorage`) and a response interceptor that, on **any 401**, clears storage and hard-redirects to `/login`. Because of that interceptor, to verify credentials without nuking the current session, use the bare-axios `verifyCredentials()` helper rather than `authAPI.login`.
- API base URL: in dev, `/api` (proxied by Vite to `localhost:5000`); in prod, a hard-coded Railway backend URL in `api/index.js` (override with `VITE_API_URL`).

### Frontend state & structure
- Auth/session lives in `frontend/src/store/authStore.js` (Zustand + `persist` to `localStorage` key `auth-storage`). `checkAuth()` runs on app mount to refresh the user from `/auth/profile`.
- Routing in `App.jsx` (lazy-loaded pages under `src/pages/<module>/`); navigation/menu structure in `components/layout/Sidebar.jsx`. Adding a page = lazy import + `<Route>` in `App.jsx` + a sidebar entry.
- Multi-firm: data is scoped by `firm_id`; users belong to a firm, and seeding/auth attach the firm.

### Bridal Lehenga module (separate from Bridal jewellery)
`pages/lehenga/*` + `controllers/lehengaController.js` + `routes/lehenga.js`, on tables `lehenga_inventory`, `lehenga_rentals`, `lehenga_rental_invoices`, `lehenga_sales`. Deliberately **not** folded into `bridal_inventory`: a lehenga carries garment attributes (size/colour/fabric/work) and has both a rental and a sale price, and mixing it in would pollute the Bridal Bookings accessory dropdowns.

- `available_for` (`rental|sale|both`) gates which flow a piece appears in — `GET /lehenga/inventory?available_for=rental` returns `rental` + `both`.
- **Rental** mirrors the bridal booking flow, including the date-overlap availability check and Booking/Pickup/Final invoices (`LBK`/`LPK`/`LFN`).
- **Sale** is a GST tax invoice (`LS-…`): the row *is* the invoice. `computeSaleTotals` exists twice on purpose — once in `lehengaController` (authoritative; whatever the client sends for the derived fields is discarded) and once in `LehengaSaleInvoiceDocument.jsx` for the live preview. **Keep the two in sync.**
- Saving a sale decrements stock in a transaction; deleting restores it; editing settles the delta (quantity change, item swap, or cancel). Stock is clamped at zero.
- Invoice numbers come from the highest existing suffix, not a row count, so deleting an invoice can't reissue a number.
- `utils/excelImages.js` holds the xlsx image extraction / thumbnailing / column matching shared by the bridal and lehenga import-export paths.

### Day Book module (worth knowing)
`pages/daybook/*` + `controllers/dayBookController.js`. The "Sales" figures and the Total Received summary are computed from **live `Payment`/sale data**, not the `daybook_sales` table. `computeSummary(date)` is the shared core; "Save Day Book" freezes it into a `daybook_snapshots` row, and an in-process scheduler (`jobs/autoSaveDayBook.js`, dependency-free, IST-aware) auto-saves at 23:59 IST. The "Saved Day Book" page is unlocked by re-verifying a real admin login (no password stored in code).
