require('dotenv').config();
const app = require('./src/app');
const { sequelize, Firm } = require('./src/models');
const { seedFirmAndAdmin, seedRoles } = require('./src/database/seeds/seed');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Sync models - create tables if they don't exist (no alter to avoid duplicate index buildup)
    await sequelize.sync();
    console.log('✅ Database synced');

    // Add 'card' to payment_mode ENUM for daybook tables (safe to run multiple times)
    const alterQueries = [
      "ALTER TABLE daybook_bridal_bookings MODIFY COLUMN payment_mode ENUM('cash','online','card') NOT NULL DEFAULT 'cash'",
      "ALTER TABLE daybook_bridal_dispatch  MODIFY COLUMN payment_mode ENUM('cash','online','card') NOT NULL DEFAULT 'cash'",
      "ALTER TABLE roles ADD COLUMN permissions TEXT DEFAULT '[]'",
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
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
