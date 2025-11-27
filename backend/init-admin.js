require('dotenv').config({ path: '.env.development' });
const { AuthService } = require('./dist/services/AuthService');
const AppDataSource = require('./dist/config/database').default;

async function createDefaultAdmin() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    // Check if admin already exists
    const existingAdmin = await AuthService.getAllAdmins();
    if (existingAdmin.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Create default admin
    const admin = await AuthService.createAdmin('admin@test.com', 'admin123');
    console.log('Default admin created:', admin.email);

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

createDefaultAdmin();