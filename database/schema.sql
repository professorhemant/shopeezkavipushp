-- ============================================================
-- Shopeezkavipushp Database Schema
-- MySQL 8.0+
-- Run: mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS shopeezkavipushp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE shopeezkavipushp;

-- ─── Firms ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firms (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),
  gstin VARCHAR(20),
  pan VARCHAR(15),
  phone VARCHAR(20),
  email VARCHAR(150),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  state_code VARCHAR(5),
  pincode VARCHAR(10),
  country VARCHAR(50) DEFAULT 'India',
  logo VARCHAR(500),
  signature VARCHAR(500),
  currency VARCHAR(10) DEFAULT 'INR',
  currency_symbol VARCHAR(5) DEFAULT '₹',
  financial_year_start DATE,
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  invoice_counter INT DEFAULT 1,
  business_type VARCHAR(100),
  is_active TINYINT(1) DEFAULT 1,
  owner_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE,
  password VARCHAR(255) NOT NULL,
  firm_id CHAR(36),
  role_name ENUM('super_admin','admin','manager','staff','billing') DEFAULT 'staff',
  is_active TINYINT(1) DEFAULT 1,
  avatar VARCHAR(500),
  last_login TIMESTAMP NULL,
  otp VARCHAR(10),
  otp_expires TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─── Roles & Permissions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  firm_id CHAR(36),
  is_system TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  module VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  label VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  PRIMARY KEY (user_id, role_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  PRIMARY KEY (role_id, permission_id)
) ENGINE=InnoDB;

-- ─── Inventory ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(200),
  parent_id CHAR(36) NULL,
  firm_id CHAR(36),
  image VARCHAR(500),
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS brands (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(150) NOT NULL,
  firm_id CHAR(36),
  logo VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS units (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(50) NOT NULL,
  short_name VARCHAR(20) NOT NULL,
  firm_id CHAR(36),
  allow_decimal TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  hsn_code VARCHAR(20),
  description TEXT,
  firm_id CHAR(36),
  category_id CHAR(36),
  brand_id CHAR(36),
  unit_id CHAR(36),
  purchase_price DECIMAL(12,2) DEFAULT 0,
  sale_price DECIMAL(12,2) DEFAULT 0,
  mrp DECIMAL(12,2) DEFAULT 0,
  wholesale_price DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 18,
  tax_type ENUM('inclusive','exclusive') DEFAULT 'exclusive',
  stock DECIMAL(12,3) DEFAULT 0,
  min_stock DECIMAL(12,3) DEFAULT 0,
  max_stock DECIMAL(12,3),
  opening_stock DECIMAL(12,3) DEFAULT 0,
  images JSON,
  is_active TINYINT(1) DEFAULT 1,
  has_variants TINYINT(1) DEFAULT 0,
  has_batches TINYINT(1) DEFAULT 0,
  track_inventory TINYINT(1) DEFAULT 1,
  is_service TINYINT(1) DEFAULT 0,
  weight DECIMAL(10,3),
  weight_unit VARCHAR(10),
  location VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_variants (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  attributes JSON,
  purchase_price DECIMAL(12,2) DEFAULT 0,
  sale_price DECIMAL(12,2) DEFAULT 0,
  mrp DECIMAL(12,2) DEFAULT 0,
  stock DECIMAL(12,3) DEFAULT 0,
  image VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_batches (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_id CHAR(36) NOT NULL,
  batch_no VARCHAR(100) NOT NULL,
  manufacturing_date DATE,
  expiry_date DATE,
  quantity DECIMAL(12,3) DEFAULT 0,
  purchase_price DECIMAL(12,2),
  sale_price DECIMAL(12,2),
  mrp DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Customers & Suppliers ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  gstin VARCHAR(20),
  pan VARCHAR(15),
  billing_address TEXT,
  shipping_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  state_code VARCHAR(5),
  pincode VARCHAR(10),
  credit_limit DECIMAL(12,2) DEFAULT 0,
  credit_days INT DEFAULT 0,
  opening_balance DECIMAL(12,2) DEFAULT 0,
  balance_type ENUM('debit','credit') DEFAULT 'debit',
  discount_percent DECIMAL(5,2) DEFAULT 0,
  price_list JSON,
  customer_group VARCHAR(100),
  is_active TINYINT(1) DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  gstin VARCHAR(20),
  pan VARCHAR(15),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  state_code VARCHAR(5),
  pincode VARCHAR(10),
  opening_balance DECIMAL(12,2) DEFAULT 0,
  balance_type ENUM('debit','credit') DEFAULT 'credit',
  credit_days INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Sales ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  invoice_no VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  customer_id CHAR(36),
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  customer_gstin VARCHAR(20),
  billing_address TEXT,
  shipping_address TEXT,
  sale_type ENUM('retail','wholesale','online') DEFAULT 'retail',
  payment_mode VARCHAR(50) DEFAULT 'cash',
  payment_status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
  status ENUM('draft','confirmed','cancelled','returned') DEFAULT 'confirmed',
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_type ENUM('percent','amount') DEFAULT 'percent',
  discount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  taxable_amount DECIMAL(12,2) DEFAULT 0,
  cgst DECIMAL(12,2) DEFAULT 0,
  sgst DECIMAL(12,2) DEFAULT 0,
  igst DECIMAL(12,2) DEFAULT 0,
  cess DECIMAL(12,2) DEFAULT 0,
  tcs_rate DECIMAL(5,2) DEFAULT 0,
  tcs_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  previous_balance DECIMAL(12,2) DEFAULT 0,
  shipping_charges DECIMAL(12,2) DEFAULT 0,
  other_charges DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  is_interstate TINYINT(1) DEFAULT 0,
  einvoice_irn VARCHAR(200),
  eway_bill_no VARCHAR(100),
  created_by CHAR(36),
  pos_session VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_firm_invoice (firm_id, invoice_no),
  KEY idx_date (firm_id, invoice_date),
  KEY idx_customer (customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  sale_id CHAR(36) NOT NULL,
  product_id CHAR(36),
  variant_id CHAR(36),
  batch_id CHAR(36),
  product_name VARCHAR(255) NOT NULL,
  hsn_code VARCHAR(20),
  barcode VARCHAR(100),
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(20),
  unit_price DECIMAL(12,2) NOT NULL,
  mrp DECIMAL(12,2),
  discount_type ENUM('percent','amount') DEFAULT 'percent',
  discount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  taxable_amount DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  cgst_rate DECIMAL(5,2) DEFAULT 0,
  sgst_rate DECIMAL(5,2) DEFAULT 0,
  igst_rate DECIMAL(5,2) DEFAULT 0,
  cgst DECIMAL(12,2) DEFAULT 0,
  sgst DECIMAL(12,2) DEFAULT 0,
  igst DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  serial_nos JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Purchases ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  po_no VARCHAR(50),
  bill_no VARCHAR(50),
  bill_date DATE NOT NULL,
  due_date DATE,
  supplier_id CHAR(36),
  supplier_name VARCHAR(200),
  supplier_gstin VARCHAR(20),
  purchase_type ENUM('purchase_order','purchase_invoice','debit_note') DEFAULT 'purchase_invoice',
  payment_status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
  status ENUM('draft','confirmed','received','cancelled') DEFAULT 'confirmed',
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  taxable_amount DECIMAL(12,2) DEFAULT 0,
  cgst DECIMAL(12,2) DEFAULT 0,
  sgst DECIMAL(12,2) DEFAULT 0,
  igst DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  is_interstate TINYINT(1) DEFAULT 0,
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  purchase_id CHAR(36) NOT NULL,
  product_id CHAR(36),
  product_name VARCHAR(255) NOT NULL,
  hsn_code VARCHAR(20),
  batch_no VARCHAR(100),
  expiry_date DATE,
  quantity DECIMAL(12,3) NOT NULL,
  free_qty DECIMAL(12,3) DEFAULT 0,
  unit VARCHAR(20),
  unit_price DECIMAL(12,2) NOT NULL,
  mrp DECIMAL(12,2),
  discount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  taxable_amount DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  cgst DECIMAL(12,2) DEFAULT 0,
  sgst DECIMAL(12,2) DEFAULT 0,
  igst DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  update_stock TINYINT(1) DEFAULT 1,
  update_cost TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Payments ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  reference_type ENUM('sale','purchase','expense','advance') NOT NULL,
  sale_id CHAR(36),
  purchase_id CHAR(36),
  customer_id CHAR(36),
  supplier_id CHAR(36),
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode ENUM('cash','upi','card','netbanking','cheque','neft','rtgs','other') DEFAULT 'cash',
  reference_no VARCHAR(100),
  bank_name VARCHAR(100),
  cheque_date DATE,
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Expenses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  category_id CHAR(36),
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_mode VARCHAR(50) DEFAULT 'cash',
  reference_no VARCHAR(100),
  receipt VARCHAR(500),
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Fixed Assets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_assets (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  name VARCHAR(200) NOT NULL,
  asset_type VARCHAR(100),
  purchase_date DATE,
  purchase_price DECIMAL(12,2),
  current_value DECIMAL(12,2),
  depreciation_rate DECIMAL(5,2) DEFAULT 0,
  depreciation_method ENUM('straight_line','wdv') DEFAULT 'straight_line',
  location VARCHAR(200),
  serial_no VARCHAR(100),
  notes TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Appointments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  customer_id CHAR(36),
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  staff_id CHAR(36),
  service VARCHAR(200) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INT DEFAULT 30,
  status ENUM('scheduled','confirmed','in_progress','completed','cancelled','no_show') DEFAULT 'scheduled',
  amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  reminder_sent TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── WhatsApp ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  name VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  media_url VARCHAR(500),
  target_type ENUM('all_customers','customer_group','custom') DEFAULT 'all_customers',
  target_group VARCHAR(100),
  recipients JSON,
  scheduled_at TIMESTAMP NULL,
  status ENUM('draft','scheduled','sending','sent','failed') DEFAULT 'draft',
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── E-Invoice & E-Way Bills ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS e_invoices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  sale_id CHAR(36),
  irn VARCHAR(200),
  ack_no VARCHAR(100),
  ack_date TIMESTAMP NULL,
  signed_invoice TEXT,
  qr_code TEXT,
  status ENUM('pending','generated','cancelled','failed') DEFAULT 'pending',
  error_msg TEXT,
  cancel_reason VARCHAR(255),
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS e_way_bills (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  sale_id CHAR(36),
  ewb_no VARCHAR(50),
  ewb_date TIMESTAMP NULL,
  valid_upto TIMESTAMP NULL,
  transporter_id VARCHAR(20),
  transporter_name VARCHAR(200),
  vehicle_no VARCHAR(20),
  transport_mode ENUM('road','rail','air','ship') DEFAULT 'road',
  distance INT,
  status ENUM('pending','generated','cancelled','expired') DEFAULT 'pending',
  error_msg TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Stock Alerts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_alerts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  product_id CHAR(36),
  alert_type ENUM('low_stock','out_of_stock','expiry','overstock') NOT NULL,
  message TEXT,
  is_read TINYINT(1) DEFAULT 0,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Settings ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  firm_id CHAR(36),
  `key` VARCHAR(100) NOT NULL,
  value TEXT,
  type ENUM('string','number','boolean','json') DEFAULT 'string',
  `group` VARCHAR(100) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_firm_key (firm_id, `key`)
) ENGINE=InnoDB;
