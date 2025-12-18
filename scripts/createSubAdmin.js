const mongoose = require('mongoose');
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
.then(() => console.log('MongoDB connected for sub admin creation'))
.catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const createSubAdmin = async () => {
  try {
    console.log('Creating sub admin user...\n');

    // Check if sub admin already exists
    const existingSubAdmin = await User.findOne({ email: 'subadmin@example.com' });
    
    if (existingSubAdmin) {
      console.log('✅ Sub admin already exists:', {
        id: existingSubAdmin._id,
        email: existingSubAdmin.email,
        role: existingSubAdmin.role,
        status: existingSubAdmin.status
      });
      return;
    }

    // Create sub admin user
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
    console.log('✅ Sub admin created successfully:', {
      id: subAdmin._id,
      email: subAdmin.email,
      role: subAdmin.role,
      status: subAdmin.status
    });

    console.log('\nSub Admin Demo User:');
    console.log('Email: subadmin@example.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('❌ Error during sub admin creation:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run sub admin creation
createSubAdmin(); 