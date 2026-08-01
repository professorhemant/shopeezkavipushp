require('dotenv').config();
const app = require('./src/app');
const { sequelize, Firm, Role, Product } = require('./src/models');
const { seedFirmAndAdmin, seedRoles } = require('./src/database/seeds/seed');
const { startAutoSaveDayBook } = require('./src/jobs/autoSaveDayBook');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Sync models - create tables if they don't exist (no alter to avoid duplicate index buildup)
    await sequelize.sync();
    console.log('✅ Database synced');

    // Ensure Role model columns are up to date (alter only this table, safe)
    try { await Role.sync({ alter: true }); } catch (e) { console.warn('⚠️ Role sync skipped:', e.message); }

    // Ensure Product model columns are up to date (adds discount_per and any future fields)
    try { await Product.sync({ alter: true }); } catch (e) { console.warn('⚠️ Product sync skipped:', e.message); }

    // Drop global unique constraints from users table (phone/email should be firm-scoped)
    const dropIndexQueries = [
      "ALTER TABLE users DROP INDEX email",
      "ALTER TABLE users DROP INDEX phone",
      "ALTER TABLE users DROP INDEX users_email",
      "ALTER TABLE users DROP INDEX users_phone",
    ];
    for (const q of dropIndexQueries) {
      try { await sequelize.query(q); } catch (_) { /* index may not exist */ }
    }

    // Add 'card' to payment_mode ENUM for daybook tables (safe to run multiple times)
    const alterQueries = [
      "ALTER TABLE daybook_bridal_bookings MODIFY COLUMN payment_mode ENUM('cash','online','card') NOT NULL DEFAULT 'cash'",
      "ALTER TABLE daybook_bridal_dispatch  MODIFY COLUMN payment_mode ENUM('cash','online','card') NOT NULL DEFAULT 'cash'",
      "ALTER TABLE daybook_expenses MODIFY COLUMN expense_type ENUM('routine','incentive','salary','advance_salary') NOT NULL",
      "ALTER TABLE daybook_expenses ADD COLUMN paid_by VARCHAR(100) NULL",
      "ALTER TABLE daybook_bridal_bookings ADD COLUMN function_date DATE NULL",
      "ALTER TABLE daybook_bridal_bookings ADD COLUMN booking_date DATE NULL",
      "ALTER TABLE daybook_bridal_bookings ADD COLUMN pickup_date DATE NULL",
      "ALTER TABLE daybook_bridal_bookings ADD COLUMN return_date DATE NULL",
      "ALTER TABLE daybook_bridal_bookings ADD COLUMN booking_amount DECIMAL(12,2) NULL",
      "ALTER TABLE daybook_bridal_bookings ADD COLUMN customer_name VARCHAR(100) NULL",
      "ALTER TABLE daybook_bridal_bookings ADD COLUMN mobile_no VARCHAR(20) NULL",
      "ALTER TABLE promotions ADD COLUMN image_url VARCHAR(500) NULL",
      "ALTER TABLE promotions ADD COLUMN images_json TEXT NULL",
      "ALTER TABLE sales ADD COLUMN images_json TEXT NULL",
      "ALTER TABLE bridal_bookings ADD COLUMN aadhaar_no VARCHAR(20) NULL",
      "ALTER TABLE bridal_invoices ADD COLUMN aadhaar_no VARCHAR(20) NULL",
      "ALTER TABLE bridal_invoices ADD COLUMN stylist VARCHAR(100) NULL",
      "ALTER TABLE bridal_invoices ADD COLUMN set_image LONGTEXT NULL",
      "ALTER TABLE bridal_inventory ADD COLUMN image VARCHAR(500) NULL",
      "ALTER TABLE bridal_inventory ADD COLUMN location VARCHAR(255) NULL",
      "ALTER TABLE bridal_bookings ADD COLUMN set_image VARCHAR(500) NULL",
      // Ensure the inventory type column accepts every category (a missing enum
      // value makes MySQL store '' so the rows vanish from their tab) + add Borla.
      "ALTER TABLE bridal_inventory MODIFY COLUMN item_type ENUM('set','nath','maang_teeka','ring','matha_patti','sheesh_patti','hath_phool','pasa','borla') DEFAULT 'set'",
      "ALTER TABLE bridal_bookings ADD COLUMN borla VARCHAR(255) NULL",
      "ALTER TABLE bridal_bookings ADD COLUMN status ENUM('active','returned') NOT NULL DEFAULT 'active'",
      // Widen firm phone so multiple contact numbers fit (used on invoice headers).
      "ALTER TABLE firms MODIFY COLUMN phone VARCHAR(50) NULL",
      // Customer name on security refund entries (Day Book → Expenses).
      "ALTER TABLE daybook_security_refunds ADD COLUMN customer_name VARCHAR(150) NULL",
      // Invoice counter and prefix for auto-numbering (firms table must have these columns).
      "ALTER TABLE firms ADD COLUMN invoice_counter INT NOT NULL DEFAULT 0",
      "ALTER TABLE firms ADD COLUMN invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV'",
      // Add 'purely_temporary' + 'daily_wages' to employees.employment_type ENUM (Type of appointment)
      "ALTER TABLE employees MODIFY COLUMN employment_type ENUM('permanent','contract','part_time','probation','intern','purely_temporary','daily_wages') DEFAULT 'permanent'",
      // Pay basis: monthly salary vs daily wages; days worked per month for daily-wage pay
      "ALTER TABLE employees ADD COLUMN pay_basis ENUM('monthly','daily') NOT NULL DEFAULT 'monthly'",
      "ALTER TABLE employee_leaves ADD COLUMN days_worked DECIMAL(5,1) NOT NULL DEFAULT 0",
      // Monthly Off: free offs allowed per month (extras deducted at salary/30)
      "ALTER TABLE employees ADD COLUMN monthly_off INT NOT NULL DEFAULT 4",
      // Set all existing products with tax_rate = 0 to 3% (jewellery GST default).
      "UPDATE products SET tax_rate = 3 WHERE tax_rate = 0 OR tax_rate IS NULL",
      // Strip accidental "Code " prefix from bridal inventory names (one-time cleanup).
      "UPDATE bridal_inventory SET name = SUBSTRING(name, 6) WHERE name LIKE 'Code %'",
    ];
    for (const q of alterQueries) {
      try { await sequelize.query(q); } catch (_) { /* already altered or table missing */ }
    }

    // Seed demo admin user if not present
    await seedFirmAndAdmin();
    console.log('✅ Demo seed checked');

    // Seed default roles for all firms (idempotent - uses findOrCreate)
    try {
      const firms = await Firm.findAll({ attributes: ['id'] });
      for (const firm of firms) {
        try { await seedRoles(firm.id); } catch (e) { console.warn('⚠️ Role seed skipped for firm:', firm.id, e.message); }
      }
      console.log(`✅ Default roles seeded for ${firms.length} firm(s)`);
    } catch (e) {
      console.warn('⚠️ Role seeding skipped:', e.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    });

    // End-of-day Day Book auto-save (guarded so it can never crash boot)
    try { startAutoSaveDayBook(); } catch (e) { console.warn('⚠️ Day Book auto-save not started:', e.message); }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
