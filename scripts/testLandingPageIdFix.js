const mongoose = require('mongoose');
const LandingPage = require('../models/LandingPage');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testLandingPageIdFix = async () => {
  try {
    console.log('🧪 Testing Landing Page ID Fix...\n');

    // Get all active landing pages
    const landingPages = await LandingPage.find({ status: 'active' });
    
    if (landingPages.length === 0) {
      console.log('❌ No active landing pages found.');
      return;
    }

    console.log('📋 Active Landing Pages:');
    landingPages.forEach((page, index) => {
      console.log(`${index + 1}. Name: ${page.name}`);
      console.log(`   URL: ${page.url}`);
      console.log(`   MongoDB _id: ${page._id}`);
      console.log(`   Virtual id: ${page.id}`);
      console.log('');
    });

    // Test the data structure that would be sent to frontend
    const frontendData = landingPages.map(page => ({
      _id: page._id,
      id: page.id,
      name: page.name,
      url: page.url,
      status: page.status
    }));

    console.log('📤 Frontend Data Structure:');
    console.log(JSON.stringify(frontendData, null, 2));

    // Test validation
    console.log('\n🔍 Testing MongoDB ObjectId Validation:');
    const testId = landingPages[0]._id.toString();
    console.log(`Test ID: ${testId}`);
    console.log(`Is valid ObjectId: ${mongoose.Types.ObjectId.isValid(testId)}`);

    // Test with invalid ID (like the one that was failing)
    const invalidId = 'brahmavastu.g1';
    console.log(`Invalid ID: ${invalidId}`);
    console.log(`Is valid ObjectId: ${mongoose.Types.ObjectId.isValid(invalidId)}`);

    console.log('\n✅ Landing Page ID fix test completed!');
    console.log('\n📝 Summary:');
    console.log('- Frontend should use page._id (MongoDB ObjectId) as the value');
    console.log('- Backend validation expects valid MongoDB ObjectId');
    console.log('- The error was caused by sending page name/URL instead of _id');

  } catch (error) {
    console.error('❌ Error testing landing page ID fix:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testLandingPageIdFix();
