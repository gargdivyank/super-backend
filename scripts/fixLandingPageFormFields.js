const mongoose = require('mongoose');
const LandingPage = require('../models/LandingPage');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const fixLandingPageFormFields = async () => {
  try {
    console.log('🔧 Fixing Landing Page Form Fields...\n');

    const landingPageId = '68b5f4c17bc70a85ef0e3d36'; // Your landing page ID

    // Find the landing page
    const landingPage = await LandingPage.findById(landingPageId);
    if (!landingPage) {
      console.log('❌ Landing page not found');
      return;
    }

    console.log('📋 Current Landing Page:', landingPage.name);

    // Update the landing page with form field configuration
    const updatedLandingPage = await LandingPage.findByIdAndUpdate(
      landingPageId,
      {
        includeDefaultFields: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: false,
          message: false
        },
        formFields: [
          {
            name: 'problem',
            label: 'Problem',
            type: 'text',
            required: false,
            placeholder: 'Describe your problem',
            order: 0
          },
          {
            name: 'profession',
            label: 'Profession',
            type: 'text',
            required: false,
            placeholder: 'Your profession',
            order: 1
          }
        ]
      },
      { new: true, runValidators: true }
    );

    console.log('✅ Landing page updated successfully!');
    console.log('📊 Form fields configured:', updatedLandingPage.formFields.length);
    console.log('🔧 Default fields:', Object.keys(updatedLandingPage.includeDefaultFields).filter(key => updatedLandingPage.includeDefaultFields[key]));

    console.log('\n🎉 Landing page form configuration completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Test submitting a new lead with the same data');
    console.log('2. Check that dynamic fields are now stored in the database');
    console.log('3. Verify that dynamic fields appear in the admin panel');

  } catch (error) {
    console.error('❌ Error fixing landing page form fields:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the fix
fixLandingPageFormFields();
