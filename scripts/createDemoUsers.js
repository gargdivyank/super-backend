const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config.env' });

// Import models
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected for demo user setup'))
.catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const createDemoUsers = async () => {
  try {
    // Check if demo users already exist
    const existingUsers = await User.find({
      email: { $in: ['admin@example.com', 'subadmin@example.com'] }
    });
    
    if (existingUsers.length > 0) {
      console.log('Demo users already exist');
      existingUsers.forEach(user => {
        console.log(`- ${user.email} (${user.role})`);
      });
      return;
    }

    // Create super admin demo user
    const superAdminData = {
      name: 'Super Admin',
      email: 'superadmin@example.com',
      password: 'SuperAdmin@123',
      role: 'super_admin',
      companyName: 'System Administration',
      status: 'approved',
      approvedAt: new Date()
    };

    const superAdmin = await User.create(superAdminData);
    console.log('Super admin demo user created successfully:', {
      id: superAdmin._id,
      email: superAdmin.email,
      role: superAdmin.role
    });

    // Create sub admin demo user
    const subAdminData = {
      name: 'Sub Admin',
      email: 'subadmin@example.com',
      password: 'password123',
      role: 'sub_admin',
      companyName: 'Demo Company',
      status: 'approved',
      approvedAt: new Date()
    };

    const subAdmin = await User.create(subAdminData);
    console.log('Sub admin demo user created successfully:', {
      id: subAdmin._id,
      email: subAdmin.email,
      role: subAdmin.role
    });

    console.log('\nDemo users created successfully!');
    console.log('Super Admin Demo:');
    console.log('Email: superadmin@example.com');
    console.log('Password: SuperAdmin@123');
    console.log('\nSub Admin Demo:');
    console.log('Email: subadmin@example.com');
    console.log('Password: password123');
    console.log('\nThese users are ready for testing the frontend!');

  } catch (error) {
    console.error('Error during demo user setup:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run setup
createDemoUsers(); 