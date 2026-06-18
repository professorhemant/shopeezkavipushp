'use strict';

/**
 * promote-admin.js
 * ----------------
 * One-off helper to set a user's role_name to 'admin' so they regain full
 * access (including the Day Book "view previous days" date picker, which is
 * gated on role_name being 'admin' or 'super_admin').
 *
 * NOTE: This edits the fixed `role_name` field on the users table — NOT the
 * dynamic "Roles & Permissions" screen, which does not control access.
 *
 * Usage (run from the backend/ directory so .env is picked up):
 *   node scripts/promote-admin.js                      # lists all users + roles
 *   node scripts/promote-admin.js user@example.com     # promotes that user
 *   node scripts/promote-admin.js user@example.com super_admin   # optional role
 */

require('dotenv').config();
const { sequelize, User } = require('../src/models');

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'staff', 'billing'];

async function listUsers() {
  const users = await User.findAll({
    attributes: ['name', 'email', 'role_name', 'is_active'],
    order: [['createdAt', 'ASC']],
  });
  if (!users.length) {
    console.log('No users found.');
    return;
  }
  console.log('\nCurrent users:\n');
  console.table(users.map((u) => ({
    name: u.name,
    email: u.email,
    role_name: u.role_name,
    active: u.is_active,
  })));
  console.log('\nTo promote one, run:\n  node scripts/promote-admin.js <email>\n');
}

async function promote(email, role) {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`❌ No user found with email: ${email}`);
    console.error('   Run with no arguments to list all users and their emails.');
    process.exitCode = 1;
    return;
  }

  if (user.role_name === role) {
    console.log(`ℹ️  ${user.name} <${email}> already has role_name = '${role}'. Nothing to do.`);
    console.log('   If the date picker is still locked, log out and log back in to refresh the session.');
    return;
  }

  const previous = user.role_name;
  user.role_name = role;
  await user.save();

  console.log(`✅ Updated ${user.name} <${email}>`);
  console.log(`   role_name: '${previous}'  ->  '${role}'`);
  console.log('   Now log out and log back in — the Day Book date picker will be unlocked.');
}

async function main() {
  const [email, roleArg] = process.argv.slice(2);
  const role = roleArg || 'admin';

  if (roleArg && !ALLOWED_ROLES.includes(roleArg)) {
    console.error(`❌ Invalid role '${roleArg}'. Allowed: ${ALLOWED_ROLES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  try {
    await sequelize.authenticate();
    if (!email) {
      await listUsers();
    } else {
      await promote(email, role);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
