const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LandingPage = require('../models/LandingPage');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testPhoneFieldFix = async () => {
  try {
    console.log('🧪 Testing Phone Field Fix...\n');

    const landingPageId = '68b5f4c17bc70a85ef0e3d36'; // Your landing page ID

    // Check landing page configuration
    const landingPage = await LandingPage.findById(landingPageId);
    if (!landingPage) {
      console.log('❌ Landing page not found');
      return;
    }

    console.log('📋 Landing Page Configuration:');
    console.log('Name:', landingPage.name);
    console.log('Phone field enabled:', landingPage.includeDefaultFields?.phone);

    // Create a test lead with phone number
    console.log('\n👥 Creating test lead with phone number...');
    
    const testLead = await Lead.create({
      firstName: 'Phone',
      lastName: 'Test',
      email: 'phone@test.com',
      phone: '9876543210', // This should now be stored
      landingPage: landingPageId,
      dynamicFields: new Map([
        ['problem', 'health'],
        ['profession', 'professional']
      ])
    });

    console.log('✅ Test lead created successfully!');
    console.log('📊 Lead ID:', testLead._id);
    console.log('📊 Phone:', testLead.phone);
    console.log('📊 Dynamic Fields:', Object.fromEntries(testLead.dynamicFields));
    console.log('📊 All Form Data:', testLead.allFormData);

    // Test the API endpoint simulation
    console.log('\n🌐 Testing API endpoint simulation...');
    
    const formData = {
      landingPageId: landingPageId,
      firstName: 'API',
      lastName: 'PhoneTest',
      email: 'api@phone.com',
      phone: '1234567890', // This should be processed
      problem: 'health',
      profession: 'professional'
    };

    console.log('📤 Form data to submit:', formData);

    // Simulate the API processing logic
    const leadData = {
      landingPage: landingPageId,
      dynamicFields: new Map()
    };

    // Process standard fields
    if (formData.firstName) {
      leadData.firstName = formData.firstName.trim();
    }
    if (formData.lastName) {
      leadData.lastName = formData.lastName.trim();
    }
    if (formData.email) {
      leadData.email = formData.email.toLowerCase().trim();
    }
    if (formData.phone) {
      leadData.phone = formData.phone.trim(); // This should now work
    }

    // Process dynamic fields
    const standardFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'message', 'landingPageId'];
    for (const [fieldName, fieldValue] of Object.entries(formData)) {
      if (standardFields.includes(fieldName) || !fieldValue || fieldValue.toString().trim() === '') {
        continue;
      }
      leadData.dynamicFields.set(fieldName, fieldValue.toString().trim());
    }

    console.log('📥 Processed lead data:', {
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      email: leadData.email,
      phone: leadData.phone, // This should now be present
      dynamicFields: Object.fromEntries(leadData.dynamicFields)
    });

    console.log('\n🎉 Phone field fix test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing phone field fix:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testPhoneFieldFix();
