'use strict';

/**
 * ensure-user.js
 * --------------
 * Create or update a user with a given role and password. Used to set up the
 * account that unlocks the "Saved Day Book" page (verified against a real
 * login, so the password is stored only as a bcrypt hash in the DB — never in
 * the code or repo).
 *
 * The password is passed as a command-line argument so it never lives in the
 * repository. Run it on the server (where node_modules and .env exist):
 *
 *   node scripts/ensure-user.js <email> '<password>' [role]
 *
 * Examples:
 *   node scripts/ensure-user.js prof.hemant.sgnr@gmail.com 'YourPassword' admin
 *   node scripts/ensure-user.js prof.hemant.sgnr@gmail.com 'YourPassword'        # role defaults to admin
 *
 * Notes:
 *  - If the user exists, its role and password are updated (password is
 *    re-hashed by the model's beforeUpdate hook).
 *  - If it does not exist, it is created (hashed by the beforeCreate hook).
 */

require('dotenv').config();
const { sequelize, User, Firm } = require('../src/models');

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'staff', 'billing'];

async function main() {
  const [email, password, roleArg] = process.argv.slice(2);
  const role = roleArg || 'admin';

  if (!email || !password) {
    console.error('Usage: node scripts/ensure-user.js <email> \'<password>\' [role]');
    process.exitCode = 1;
    return;
  }
  if (!ALLOWED_ROLES.includes(role)) {
    console.error(`❌ Invalid role '${role}'. Allowed: ${ALLOWED_ROLES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  try {
    await sequelize.authenticate();

    let user = await User.findOne({ where: { email } });

    if (user) {
      user.role_name = role;
      user.password = password; // re-hashed by beforeUpdate hook
      user.is_active = true;
      await user.save();
      console.log(`✅ Updated existing user <${email}>: role='${role}', password reset, active=true.`);
    } else {
      const firm = await Firm.findOne();
      if (!firm) {
        console.error('❌ No firm found in the database — cannot create a user without a firm.');
        process.exitCode = 1;
        return;
      }
      user = await User.create({
        firm_id: firm.id,
        name: email.split('@')[0],
        email,
        password, // hashed by beforeCreate hook
        role_name: role,
        is_active: true,
      });
      console.log(`✅ Created user <${email}> with role='${role}' under firm '${firm.name}'.`);
    }

    console.log('   This account can now unlock the Saved Day Book page.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
