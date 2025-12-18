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
.then(() => console.log('MongoDB connected for login test'))
.catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const testLogin = async () => {
  try {
    console.log('Testing login process...\n');

    // Test 1: Check if user exists
    const user = await User.findOne({ email: 'superadmin@example.com' }).select('+password');
    
    if (!user) {
      console.log('❌ User not found: superadmin@example.com');
      return;
    }

    console.log('✅ User found:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      hasPassword: !!user.password
    });

    // Test 2: Test password matching
    const testPassword = 'SuperAdmin@123';
    const isMatch = await user.matchPassword(testPassword);
    
    console.log(`\n🔐 Password test: "${testPassword}"`);
    console.log(`Password match: ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (!isMatch) {
      console.log('\n🔍 Debugging password issue...');
      
      // Check if password was hashed
      const isHashed = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
      console.log(`Password appears to be hashed: ${isHashed ? 'Yes' : 'No'}`);
      
      // Try to hash the test password and compare
      const salt = await bcrypt.genSalt(10);
      const hashedTestPassword = await bcrypt.hash(testPassword, salt);
      console.log(`Test password hash: ${hashedTestPassword.substring(0, 20)}...`);
      console.log(`Stored password hash: ${user.password.substring(0, 20)}...`);
      
      // Direct bcrypt compare
      const directMatch = await bcrypt.compare(testPassword, user.password);
      console.log(`Direct bcrypt compare: ${directMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

    // Test 3: Check if user can generate JWT
    try {
      const token = user.getSignedJwtToken();
      console.log('\n🎫 JWT generation: ✅ SUCCESS');
      console.log(`Token preview: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.log('\n🎫 JWT generation: ❌ FAILED');
      console.error('Error:', error.message);
    }

  } catch (error) {
    console.error('❌ Error during login test:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run test
testLogin(); 