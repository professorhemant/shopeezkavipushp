# Shopeezkavipushp - Billing & ERP Software

A complete billing, inventory, and business management software for Indian MSMEs — built with React + Node.js + MySQL.

## Features

### Core Modules
- **Dashboard** — Real-time stats, revenue charts, top products
- **Inventory Management** — Products, categories, brands, batches, barcode generation
- **GST Billing** — Sale invoices with CGST/SGST/IGST, TCS support
- **POS System** — Point of sale with quick billing
- **Purchase Management** — Purchase orders, invoices, supplier payments
- **Customer Management** — Customer database, customer-wise pricing, ledger
- **Supplier Management** — Supplier database, payables tracking
- **Accounting** — Receivables, payables, P&L, balance sheet, expenses, fixed assets
- **Staff & Roles** — User management with granular permissions
- **Reports** — Sales, purchase, inventory, GST (GSTR-1) reports
- **Appointment Booking** — For salons, spas, clinics
- **WhatsApp Marketing** — Bulk campaigns, chatbot, digital catalogue
- **GST Compliance** — E-invoicing (IRN), E-way bills, GSTR reports
- **Tools** — Barcode generator, QR code, GST calculator, invoice generator
- **Multi-firm** — Manage multiple businesses from one account

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS, Recharts        |
| Backend    | Node.js, Express.js, Sequelize ORM            |
| Database   | MySQL 8.0+                                    |
| Auth       | JWT (JSON Web Tokens)                         |
| PDF        | PDFKit                                        |
| Barcode    | bwip-js                                       |
| QR Code    | qrcode                                        |

## Project Structure

```
shopeezkavipushp/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── controllers/  # Route controllers (auth, products, sales, etc.)
│   │   ├── models/       # Sequelize models
│   │   ├── routes/       # Express routes
│   │   ├── middleware/   # Auth, upload middleware
│   │   └── utils/        # GST calc, PDF gen, barcode utils
│   ├── database/         # Seeds
│   └── uploads/          # Uploaded files
├── frontend/             # React + Vite app
│   └── src/
│       ├── pages/        # All page components
│       ├── components/   # Reusable UI components
│       ├── api/          # API service layer
│       ├── store/        # Zustand state management
│       └── utils/        # Formatters, validators
└── database/
    └── schema.sql        # MySQL schema
```

## Setup & Installation

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### 1. Clone & Install
```bash
cd shopeezkavipushp
npm run install:all
```

### 2. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

### 3. Create Database
```bash
mysql -u root -p -e "CREATE DATABASE shopeezkavipushp;"
mysql -u root -p shopeezkavipushp < database/schema.sql
```

### 4. Seed Demo Data
```bash
npm run seed
```

### 5. Start Development
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### Demo Credentials
- Email: `admin@demo.com`
- Password: `Admin@123`

## API Endpoints

| Module      | Base URL            |
|-------------|---------------------|
| Auth        | /api/auth           |
| Dashboard   | /api/dashboard      |
| Products    | /api/products       |
| Categories  | /api/categories     |
| Brands      | /api/brands         |
| Customers   | /api/customers      |
| Suppliers   | /api/suppliers      |
| Sales       | /api/sales          |
| Purchases   | /api/purchases      |
| Inventory   | /api/inventory      |
| Accounting  | /api/accounting     |
| Staff       | /api/staff          |
| Reports     | /api/reports        |
| Appointments| /api/appointments   |
| WhatsApp    | /api/whatsapp       |
| Settings    | /api/settings       |
| GST Tools   | /api/gst            |
| Tools       | /api/tools          |

## License
MIT
