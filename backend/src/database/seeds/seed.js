'use strict';

/**
 * Database Seed Script
 * Run with: node src/database/seeds/seed.js
 *
 * Creates:
 *  - Demo firm
 *  - Admin user (admin@demo.com / Admin@123)
 *  - Sample categories
 *  - Sample units (UOM)
 *  - Sample expense categories
 *  - System roles with permissions
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');

// Adjust path if your models index is elsewhere
const db = require('../../models');
const { Firm, User, Category, Unit, Role, Settings, sequelize } = db;

// ──────────────────────────────────────────────────────────────────────────────
// DATA DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Electronics', description: 'Electronic gadgets and accessories' },
  { name: 'Clothing', description: 'Apparel and fashion items' },
  { name: 'Food & Beverages', description: 'Edible products and drinks' },
  { name: 'Furniture', description: 'Home and office furniture' },
  { name: 'Books & Stationery', description: 'Books, notebooks, pens and office supplies' },
  { name: 'Health & Beauty', description: 'Cosmetics, health and personal care' },
  { name: 'Sports & Outdoors', description: 'Sporting goods and outdoor equipment' },
  { name: 'Toys & Games', description: 'Toys, games and entertainment' },
  { name: 'Automotive', description: 'Vehicle parts and accessories' },
  { name: 'Home Appliances', description: 'Kitchen and household appliances' },
  { name: 'Medicines', description: 'Pharmaceutical products' },
  { name: 'Grocery', description: 'Daily grocery items' },
];

const UNITS = [
  { name: 'Piece', short_name: 'Pcs' },
  { name: 'Kilogram', short_name: 'Kg' },
  { name: 'Gram', short_name: 'Gm' },
  { name: 'Liter', short_name: 'Ltr' },
  { name: 'Milliliter', short_name: 'Ml' },
  { name: 'Meter', short_name: 'Mtr' },
  { name: 'Centimeter', short_name: 'Cm' },
  { name: 'Box', short_name: 'Box' },
  { name: 'Dozen', short_name: 'Doz' },
  { name: 'Pair', short_name: 'Pr' },
  { name: 'Packet', short_name: 'Pkt' },
  { name: 'Bundle', short_name: 'Bndl' },
  { name: 'Bag', short_name: 'Bag' },
  { name: 'Roll', short_name: 'Rol' },
  { name: 'Set', short_name: 'Set' },
];

const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Internet & Phone',
  'Salaries & Wages',
  'Raw Materials',
  'Packaging',
  'Transport & Logistics',
  'Marketing & Advertising',
  'Office Supplies',
  'Repairs & Maintenance',
  'Professional Fees',
  'Insurance',
  'Bank Charges',
  'Miscellaneous',
];

const ALL_PERMISSIONS = [
  'dashboard.view',
  'products.view', 'products.create', 'products.update', 'products.delete',
  'categories.view', 'categories.create', 'categories.update', 'categories.delete',
  'customers.view', 'customers.create', 'customers.update', 'customers.delete',
  'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
  'sales.view', 'sales.create', 'sales.update', 'sales.cancel', 'sales.return',
  'purchases.view', 'purchases.create', 'purchases.update', 'purchases.cancel',
  'inventory.view', 'inventory.adjust',
  'accounting.view', 'accounting.expenses', 'accounting.assets',
  'reports.view', 'gst.view', 'settings.view', 'settings.update',
  'staff.view', 'staff.create', 'staff.update', 'staff.deactivate',
  'whatsapp.view', 'whatsapp.send',
  'appointments.view', 'appointments.create', 'appointments.update',
];

const ROLES = [
  {
    name: 'Administrator',
    description: 'Full access to all modules',
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Manager',
    description: 'Access to most modules except settings and staff management',
    permissions: ALL_PERMISSIONS.filter((p) => !p.startsWith('settings') && !p.startsWith('staff')),
  },
  {
    name: 'Sales Staff',
    description: 'Can manage sales, customers and view inventory',
    permissions: [
      'dashboard.view',
      'products.view',
      'customers.view', 'customers.create', 'customers.update',
      'sales.view', 'sales.create', 'sales.update',
      'inventory.view',
      'reports.view',
      'appointments.view', 'appointments.create', 'appointments.update',
    ],
  },
  {
    name: 'Purchase Staff',
    description: 'Can manage purchases and suppliers',
    permissions: [
      'dashboard.view',
      'products.view',
      'suppliers.view', 'suppliers.create', 'suppliers.update',
      'purchases.view', 'purchases.create', 'purchases.update',
      'inventory.view', 'inventory.adjust',
    ],
  },
  {
    name: 'Accountant',
    description: 'Access to accounting and reports',
    permissions: [
      'dashboard.view',
      'sales.view',
      'purchases.view',
      'customers.view',
      'suppliers.view',
      'accounting.view', 'accounting.expenses', 'accounting.assets',
      'reports.view',
      'gst.view',
    ],
  },
  {
    name: 'Inventory Manager',
    description: 'Manages product stock and inventory',
    permissions: [
      'dashboard.view',
      'products.view', 'products.create', 'products.update',
      'categories.view', 'categories.create', 'categories.update',
      'inventory.view', 'inventory.adjust',
      'purchases.view', 'purchases.create',
      'reports.view',
    ],
  },
];

const DEFAULT_SETTINGS = [
  { key: 'currency', value: 'INR' },
  { key: 'currency_symbol', value: '₹' },
  { key: 'date_format', value: 'DD/MM/YYYY' },
  { key: 'financial_year_start', value: '04' }, // April
  { key: 'invoice_due_days', value: '30' },
  { key: 'low_stock_alert', value: 'true' },
  { key: 'expiry_alert_days', value: '30' },
  { key: 'enable_gst', value: 'true' },
  { key: 'enable_whatsapp', value: 'false' },
  { key: 'enable_appointments', value: 'true' },
  { key: 'invoice_template', value: 'default' },
  { key: 'invoice_color', value: '#2563EB' },
  { key: 'invoice_show_bank', value: 'true' },
  { key: 'invoice_show_signature', value: 'true' },
  { key: 'tax_type', value: 'gst' },
];

// ──────────────────────────────────────────────────────────────────────────────
// SEED FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

async function seedFirmAndAdmin() {
  console.log('  Creating demo firm...');

  let firm = await Firm.findOne({ where: { email: 'admin@demo.com' } });
  if (!firm) {
    firm = await Firm.create({
      name: 'Demo Business Pvt. Ltd.',
      email: 'admin@demo.com',
      phone: '9876543210',
      address: '123, Demo Street, Market Area',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      pincode: '400001',
      gstin: '27AADCS0472N1Z1',
      pan: 'AADCS0472N',
      invoice_prefix: 'INV',
      invoice_counter: 0,
      is_active: true,
    });
    console.log(`    Firm created: ${firm.name} (ID: ${firm.id})`);
  } else {
    console.log(`    Firm already exists: ${firm.name}`);
  }

  console.log('  Creating admin user...');
  let adminUser = await User.findOne({ where: { email: 'admin@demo.com' } });
  if (!adminUser) {
    const passwordHash = await bcrypt.hash('Admin@123', 12);
    adminUser = await User.create({
      firm_id: firm.id,
      name: 'Demo Admin',
      email: 'admin@demo.com',
      phone: '9876543210',
      password: passwordHash,
      role_name: 'admin',
      is_active: true,
    });
    console.log(`    Admin user created: ${adminUser.email}`);
  } else {
    console.log(`    Admin user already exists: ${adminUser.email}`);
  }

  return firm;
}

async function seedCategories(firmId) {
  console.log('  Seeding categories...');
  let created = 0;
  for (const cat of CATEGORIES) {
    const [, wasCreated] = await Category.findOrCreate({
      where: { firm_id: firmId, name: cat.name },
      defaults: { ...cat, firm_id: firmId },
    });
    if (wasCreated) created++;
  }
  console.log(`    ${created} new categories created (${CATEGORIES.length - created} already existed)`);
}

async function seedUnits(firmId) {
  console.log('  Seeding units of measurement...');
  let created = 0;
  for (const unit of UNITS) {
    const [, wasCreated] = await Unit.findOrCreate({
      where: { firm_id: firmId, short_name: unit.short_name },
      defaults: { ...unit, firm_id: firmId },
    });
    if (wasCreated) created++;
  }
  console.log(`    ${created} new units created (${UNITS.length - created} already existed)`);
}

async function seedExpenseCategories(firmId) {
  console.log('  Seeding expense categories (as settings)...');
  await Settings.upsert({
    firm_id: firmId,
    key: 'expense_categories',
    value: JSON.stringify(EXPENSE_CATEGORIES),
  });
  console.log(`    ${EXPENSE_CATEGORIES.length} expense categories saved.`);
}

async function seedRoles(firmId) {
  console.log('  Seeding system roles...');
  let created = 0;
  for (const roleData of ROLES) {
    const [, wasCreated] = await Role.findOrCreate({
      where: { firm_id: firmId, name: roleData.name },
      defaults: {
        firm_id: firmId,
        name: roleData.name,
        description: roleData.description,
        permissions: JSON.stringify(roleData.permissions),
      },
    });
    if (wasCreated) created++;
  }
  console.log(`    ${created} new roles created (${ROLES.length - created} already existed)`);
}

async function seedSettings(firmId) {
  console.log('  Seeding default settings...');
  let upserted = 0;
  for (const setting of DEFAULT_SETTINGS) {
    await Settings.upsert({ firm_id: firmId, key: setting.key, value: setting.value });
    upserted++;
  }
  console.log(`    ${upserted} settings upserted.`);
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n====================================');
  console.log('  Shopeez Kavi - Database Seed');
  console.log('====================================\n');

  try {
    // Test connection
    await sequelize.authenticate();
    console.log('  Database connection established.\n');

    // Sync models (alter: true to add new columns without dropping tables)
    await sequelize.sync({ alter: false });

    console.log('Starting seed process...\n');

    const firm = await seedFirmAndAdmin();
    await seedCategories(firm.id);
    await seedUnits(firm.id);
    await seedExpenseCategories(firm.id);
    await seedRoles(firm.id);
    await seedSettings(firm.id);

    console.log('\n====================================');
    console.log('  Seed completed successfully!');
    console.log('====================================');
    console.log('\n  Login credentials:');
    console.log('    Email:    admin@demo.com');
    console.log('    Password: Admin@123');
    console.log('\n  Firm: Demo Business Pvt. Ltd.\n');
  } catch (err) {
    console.error('\n  Seed failed:', err.message || err);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
