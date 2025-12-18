const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config.env' });

// Import models
const User = require('../models/User');
const LandingPage = require('../models/LandingPage');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected for setup'))
.catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const createSuperAdmin = async () => {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('Super admin already exists');
      return;
    }

    // Create super admin
    const superAdminData = {
      name: 'Super Admin',
      email: 'superadmin@example.com',
      password: 'superadmin123',
      role: 'super_admin',
      companyName: 'System Administration',
      status: 'approved',
      approvedAt: new Date()
    };

    const superAdmin = await User.create(superAdminData);
    console.log('Super admin created successfully:', {
      id: superAdmin._id,
      email: superAdmin.email,
      role: superAdmin.role
    });

    // Create some sample landing pages
    const sampleLandingPages = [
      {
        name: 'Sample Landing Page 1',
        url: 'https://example1.com',
        description: 'This is a sample landing page for testing purposes',
        createdBy: superAdmin._id
      },
      {
        name: 'Sample Landing Page 2',
        url: 'https://example2.com',
        description: 'Another sample landing page for testing',
        createdBy: superAdmin._id
      }
    ];

    const landingPages = await LandingPage.insertMany(sampleLandingPages);
    console.log('Sample landing pages created:', landingPages.length);

    console.log('\nSetup completed successfully!');
    console.log('Super Admin Credentials:');
    console.log('Email: superadmin@example.com');
    console.log('Password: superadmin123');
    console.log('\nPlease change these credentials after first login!');

  } catch (error) {
    console.error('Error during setup:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run setup
createSuperAdmin(); 