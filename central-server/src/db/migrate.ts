import { DB } from './index.js';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

async function migrate() {
  console.log('Running database migrations...');

  const db = await DB.create('./data/hive.db');

  // Create default admin user if none exists
  const adminEmail = 'admin@example.com';
  const existingAdmin = db.getUserByEmail(adminEmail);

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    db.createUser({
      id: `user_${nanoid(12)}`,
      email: adminEmail,
      passwordHash,
      roles: ['admin'],
      isActive: true,
    });
    console.log('✅ Created default admin user');
    console.log('   Email: admin@example.com');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change this password immediately!');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  db.close();
  console.log('✅ Migrations complete');
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
