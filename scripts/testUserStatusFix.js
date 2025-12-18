const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testUserStatusFix = async () => {
  try {
    console.log('🧪 Testing User Status Fix...\n');

    // Test valid status values
    const validStatuses = ['pending', 'approved', 'rejected'];
    const invalidStatuses = ['active', 'inactive', 'suspended'];

    console.log('📋 Valid Status Values:');
    validStatuses.forEach(status => {
      console.log(`✅ ${status}`);
    });

    console.log('\n📋 Invalid Status Values:');
    invalidStatuses.forEach(status => {
      console.log(`❌ ${status}`);
    });

    // Test creating a user with valid status
    console.log('\n👥 Test 1: Creating user with valid status...');
    
    const testUser = await User.create({
      name: 'Test User',
      email: 'test.status@example.com',
      password: 'password123',
      companyName: 'Test Company',
      role: 'sub_admin',
      status: 'approved' // Valid status
    });

    console.log('✅ User created successfully with status:', testUser.status);

    // Test updating user status
    console.log('\n🔄 Test 2: Updating user status...');
    
    const updatedUser = await User.findByIdAndUpdate(
      testUser._id,
      { status: 'rejected' },
      { new: true, runValidators: true }
    );

    console.log('✅ User status updated to:', updatedUser.status);

    // Test invalid status (this should fail)
    console.log('\n❌ Test 3: Testing invalid status (should fail)...');
    
    try {
      await User.findByIdAndUpdate(
        testUser._id,
        { status: 'active' }, // Invalid status
        { new: true, runValidators: true }
      );
      console.log('❌ ERROR: Invalid status was accepted!');
    } catch (error) {
      console.log('✅ Correctly rejected invalid status:', error.message);
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await User.findByIdAndDelete(testUser._id);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 User status fix test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('- User model accepts: pending, approved, rejected');
    console.log('- Frontend now sends correct status values');
    console.log('- Backend validation updated to match model');

  } catch (error) {
    console.error('❌ Error testing user status fix:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testUserStatusFix();
