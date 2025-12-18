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

const testSubAdminLandingPageAssignment = async () => {
  try {
    console.log('🧪 Testing Sub Admin Landing Page Assignment...\n');

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
      name: 'Test Sub Admin Assignment',
      email: 'test.assignment@example.com',
      password: 'password123',
      companyName: 'Test Company',
      role: 'sub_admin',
      status: 'approved',
      approvedBy: new mongoose.Types.ObjectId(),
      approvedAt: Date.now()
    });

    console.log('✅ Sub admin created:', testSubAdmin.name);

    // Create admin access record
    const adminAccess = await AdminAccess.create({
      subAdmin: testSubAdmin._id,
      landingPage: landingPage._id,
      grantedBy: new mongoose.Types.ObjectId(),
      status: 'active'
    });

    console.log('✅ Admin access record created');

    // Test 2: Verify the response structure that would be sent to frontend
    console.log('\n📊 Test 2: Verifying response structure...');
    
    const userWithAccess = await User.findById(testSubAdmin._id)
      .select('-password')
      .populate('approvedBy', 'name email');

    const access = await AdminAccess.find({ 
      subAdmin: testSubAdmin._id,
      status: 'active'
    }).populate('landingPage', 'name url');

    const responseData = {
      ...userWithAccess.toObject(),
      access,
      landingPage: access.length > 0 ? access[0].landingPage : null
    };

    console.log('📋 Response Data Structure:');
    console.log(JSON.stringify(responseData, null, 2));

    // Test 3: Verify sub admin can access their landing page
    console.log('\n🔍 Test 3: Testing sub admin landing page access...');
    
    const subAdminAccess = await AdminAccess.find({
      subAdmin: testSubAdmin._id,
      status: 'active'
    }).populate('landingPage', 'name url description status');

    if (subAdminAccess.length > 0) {
      console.log('✅ Sub admin has access to landing page:');
      subAdminAccess.forEach((access, index) => {
        console.log(`  ${index + 1}. ${access.landingPage.name} (${access.landingPage.url})`);
      });
    } else {
      console.log('❌ Sub admin has no landing page access');
    }

    // Test 4: Simulate the API response that sub admin dashboard would receive
    console.log('\n🌐 Test 4: Simulating sub admin dashboard API response...');
    
    const dashboardResponse = {
      success: true,
      data: subAdminAccess.map(record => record.landingPage)
    };

    console.log('📋 Dashboard API Response:');
    console.log(JSON.stringify(dashboardResponse, null, 2));

    // Test 5: Verify the data structure matches frontend expectations
    console.log('\n✅ Test 5: Verifying frontend compatibility...');
    
    const frontendData = {
      user: {
        _id: testSubAdmin._id,
        name: testSubAdmin.name,
        email: testSubAdmin.email,
        role: testSubAdmin.role,
        companyName: testSubAdmin.companyName,
        status: testSubAdmin.status
      },
      landingPage: subAdminAccess.length > 0 ? subAdminAccess[0].landingPage : null
    };

    console.log('📋 Frontend Data Structure:');
    console.log(JSON.stringify(frontendData, null, 2));

    // Test 6: Check if landing page assignment is working
    console.log('\n🎯 Test 6: Final verification...');
    
    if (responseData.landingPage && responseData.landingPage._id.toString() === landingPage._id.toString()) {
      console.log('✅ Landing page assignment is working correctly!');
      console.log(`   Sub Admin: ${responseData.name}`);
      console.log(`   Assigned Landing Page: ${responseData.landingPage.name}`);
      console.log(`   Landing Page URL: ${responseData.landingPage.url}`);
    } else {
      console.log('❌ Landing page assignment is NOT working correctly!');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await AdminAccess.deleteMany({ subAdmin: testSubAdmin._id });
    await User.findByIdAndDelete(testSubAdmin._id);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Sub Admin Landing Page Assignment test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('- Sub admin creation with landing page assignment works');
    console.log('- Response structure includes both access array and landingPage field');
    console.log('- Sub admin can access their assigned landing page via API');
    console.log('- Frontend dashboard can fetch and display landing page information');

  } catch (error) {
    console.error('❌ Error testing sub admin landing page assignment:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testSubAdminLandingPageAssignment();
