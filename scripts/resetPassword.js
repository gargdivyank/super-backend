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
.then(() => console.log('MongoDB connected for password reset'))
.catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const resetPassword = async () => {
  try {
    console.log('Resetting super admin password...\n');

    // Find the super admin user
    const user = await User.findOne({ email: 'superadmin@example.com' });
    
    if (!user) {
      console.log('❌ User not found: superadmin@example.com');
      return;
    }

    console.log('✅ User found:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    // Set new password (it will be automatically hashed by the pre-save middleware)
    user.password = 'SuperAdmin@123';
    
    // Save the user (this will trigger password hashing)
    await user.save();
    
    console.log('✅ Password reset successfully!');
    console.log('New password: SuperAdmin@123');
    console.log('Password has been properly hashed and stored.');

  } catch (error) {
    console.error('❌ Error during password reset:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run password reset
resetPassword(); 