const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LandingPage = require('../models/LandingPage');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testDynamicFieldsFix = async () => {
  try {
    console.log('🧪 Testing Dynamic Fields Fix...\n');

    const landingPageId = '68b5f4c17bc70a85ef0e3d36'; // Your landing page ID

    // Check landing page configuration
    const landingPage = await LandingPage.findById(landingPageId);
    if (!landingPage) {
      console.log('❌ Landing page not found');
      return;
    }

    console.log('📋 Landing Page Configuration:');
    console.log('Name:', landingPage.name);
    console.log('Form Fields:', landingPage.formFields?.length || 0);
    console.log('Default Fields:', Object.keys(landingPage.includeDefaultFields).filter(key => landingPage.includeDefaultFields[key]));

    // Create a test lead with dynamic fields
    console.log('\n👥 Creating test lead with dynamic fields...');
    
    const testLead = await Lead.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '1234567890',
      landingPage: landingPageId,
      dynamicFields: new Map([
        ['problem', 'health'],
        ['profession', 'professional']
      ])
    });

    console.log('✅ Test lead created successfully!');
    console.log('📊 Lead ID:', testLead._id);
    console.log('📊 Dynamic Fields:', Object.fromEntries(testLead.dynamicFields));
    console.log('📊 All Form Data:', testLead.allFormData);

    // Test the API endpoint simulation
    console.log('\n🌐 Testing API endpoint simulation...');
    
    const formData = {
      landingPageId: landingPageId,
      firstName: 'API',
      lastName: 'Test',
      email: 'api@test.com',
      phone: '9876543210',
      problem: 'health',
      profession: 'professional'
    };

    console.log('📤 Form data to submit:', formData);

    // Simulate the API processing logic
    const standardFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'message', 'landingPageId'];
    const dynamicFields = new Map();

    for (const [fieldName, fieldValue] of Object.entries(formData)) {
      if (standardFields.includes(fieldName) || !fieldValue || fieldValue.toString().trim() === '') {
        continue;
      }
      dynamicFields.set(fieldName, fieldValue.toString().trim());
    }

    console.log('📥 Processed dynamic fields:', Object.fromEntries(dynamicFields));

    // Check existing leads
    console.log('\n📊 Checking existing leads...');
    const existingLeads = await Lead.find({ landingPage: landingPageId }).limit(5);
    
    console.log(`Found ${existingLeads.length} leads for this landing page:`);
    existingLeads.forEach((lead, index) => {
      console.log(`\nLead ${index + 1}:`);
      console.log('  Name:', lead.firstName, lead.lastName);
      console.log('  Email:', lead.email);
      console.log('  Dynamic Fields:', Object.fromEntries(lead.dynamicFields || new Map()));
    });

    console.log('\n🎉 Dynamic fields test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing dynamic fields fix:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testDynamicFieldsFix();
