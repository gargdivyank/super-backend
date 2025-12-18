const mongoose = require('mongoose');
const User = require('../models/User');
const LandingPage = require('../models/LandingPage');
const AdminAccess = require('../models/AdminAccess');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testSubAdminFixes = async () => {
  try {
    console.log('🧪 Testing Sub Admin Fixes...\n');

    // Get a sample landing page
    const landingPage = await LandingPage.findOne({ status: 'active' });
    if (!landingPage) {
      console.log('❌ No active landing page found. Please create one first.');
      return;
    }

    console.log('📋 Using Landing Page:', landingPage.name, '(ID:', landingPage._id, ')');

    // Test 1: Create sub admin with landing page assignment
    console.log('\n👥 Test 1: Creating sub admin with landing page assignment...');
    
    const testSubAdmin = await User.create({
      name: 'Test Sub Admin',
      email: 'test.subadmin@example.com',
      password: 'password123',
      companyName: 'Test Company',
      phone: '1234567890',
      role: 'sub_admin',
      status: 'approved',
      approvedBy: new mongoose.Types.ObjectId(), // Mock super admin ID
      approvedAt: Date.now()
    });

    console.log('✅ Sub admin created:', testSubAdmin.name);

    // Create admin access record
    const adminAccess = await AdminAccess.create({
      subAdmin: testSubAdmin._id,
      landingPage: landingPage._id,
      grantedBy: new mongoose.Types.ObjectId(), // Mock super admin ID
      status: 'active'
    });

    console.log('✅ Admin access record created');

    // Test 2: Verify the data structure
    console.log('\n📊 Test 2: Verifying data structure...');
    
    const subAdminWithAccess = await User.findById(testSubAdmin._id)
      .select('-password')
      .populate('approvedBy', 'name email');

    const access = await AdminAccess.find({ 
      subAdmin: testSubAdmin._id,
      status: 'active'
    }).populate('landingPage', 'name url');

    const responseData = {
      ...subAdminWithAccess.toObject(),
      access,
      landingPage: access.length > 0 ? access[0].landingPage : null
    };

    console.log('📋 Response Data Structure:');
    console.log('- Name:', responseData.name);
    console.log('- Email:', responseData.email);
    console.log('- Company:', responseData.companyName);
    console.log('- Phone:', responseData.phone);
    console.log('- Status:', responseData.status);
    console.log('- Landing Page:', responseData.landingPage?.name || 'Not assigned');
    console.log('- Access Records:', responseData.access.length);

    // Test 3: Update sub admin
    console.log('\n🔄 Test 3: Updating sub admin...');
    
    const updatedSubAdmin = await User.findByIdAndUpdate(
      testSubAdmin._id,
      {
        name: 'Updated Test Sub Admin',
        phone: '9876543210'
      },
      { new: true, runValidators: true }
    ).select('-password');

    console.log('✅ Sub admin updated:', updatedSubAdmin.name);

    // Test 4: Change landing page assignment
    console.log('\n🔄 Test 4: Changing landing page assignment...');
    
    // Remove existing access
    await AdminAccess.deleteMany({ 
      subAdmin: testSubAdmin._id,
      status: 'active'
    });

    // Get another landing page for testing
    const anotherLandingPage = await LandingPage.findOne({ 
      status: 'active', 
      _id: { $ne: landingPage._id } 
    });

    if (anotherLandingPage) {
      await AdminAccess.create({
        subAdmin: testSubAdmin._id,
        landingPage: anotherLandingPage._id,
        grantedBy: new mongoose.Types.ObjectId(),
        status: 'active'
      });

      console.log('✅ Landing page assignment changed to:', anotherLandingPage.name);
    } else {
      console.log('ℹ️  Only one landing page available, skipping assignment change test');
    }

    // Test 5: Final verification
    console.log('\n📊 Test 5: Final verification...');
    
    const finalAccess = await AdminAccess.find({ 
      subAdmin: testSubAdmin._id,
      status: 'active'
    }).populate('landingPage', 'name url');

    console.log('📋 Final Data:');
    console.log('- Sub Admin:', updatedSubAdmin.name);
    console.log('- Assigned Landing Pages:', finalAccess.map(access => access.landingPage.name));

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await AdminAccess.deleteMany({ subAdmin: testSubAdmin._id });
    await User.findByIdAndDelete(testSubAdmin._id);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All Sub Admin fixes tests completed successfully!');

  } catch (error) {
    console.error('❌ Error testing sub admin fixes:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testSubAdminFixes();
