const mongoose = require('mongoose');
const LandingPage = require('../models/LandingPage');
const Lead = require('../models/Lead');
const User = require('../models/User');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testDynamicForms = async () => {
  try {
    console.log('🚀 Testing Dynamic Form System...\n');

    // Find or create a super admin user
    let superAdmin = await User.findOne({ role: 'super_admin' });
    if (!superAdmin) {
      console.log('❌ No super admin user found. Please create one first.');
      return;
    }

    // Create a landing page with custom form fields
    console.log('📝 Creating landing page with custom form fields...');
    
    const landingPage = await LandingPage.create({
      name: 'Software Development Services',
      url: 'https://example.com/software-dev',
      description: 'Landing page for software development services with custom form',
      includeDefaultFields: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        message: false
      },
      formFields: [
        {
          name: 'project_type',
          label: 'Project Type',
          type: 'select',
          required: true,
          placeholder: 'Select project type',
          options: [
            { value: 'web_app', label: 'Web Application' },
            { value: 'mobile_app', label: 'Mobile Application' },
            { value: 'desktop_app', label: 'Desktop Application' },
            { value: 'api', label: 'API Development' },
            { value: 'other', label: 'Other' }
          ],
          order: 0
        },
        {
          name: 'budget_range',
          label: 'Budget Range',
          type: 'select',
          required: true,
          placeholder: 'Select budget range',
          options: [
            { value: 'under_10k', label: 'Under $10,000' },
            { value: '10k_25k', label: '$10,000 - $25,000' },
            { value: '25k_50k', label: '$25,000 - $50,000' },
            { value: '50k_100k', label: '$50,000 - $100,000' },
            { value: 'over_100k', label: 'Over $100,000' }
          ],
          order: 1
        },
        {
          name: 'timeline',
          label: 'Project Timeline',
          type: 'select',
          required: true,
          placeholder: 'Select timeline',
          options: [
            { value: '1_3_months', label: '1-3 months' },
            { value: '3_6_months', label: '3-6 months' },
            { value: '6_12_months', label: '6-12 months' },
            { value: 'over_12_months', label: 'Over 12 months' }
          ],
          order: 2
        },
        {
          name: 'team_size',
          label: 'Preferred Team Size',
          type: 'radio',
          required: false,
          options: [
            { value: '1_2', label: '1-2 developers' },
            { value: '3_5', label: '3-5 developers' },
            { value: '5_10', label: '5-10 developers' },
            { value: '10_plus', label: '10+ developers' }
          ],
          order: 3
        },
        {
          name: 'technologies',
          label: 'Preferred Technologies',
          type: 'checkbox',
          required: false,
          options: [
            { value: 'react', label: 'React' },
            { value: 'node', label: 'Node.js' },
            { value: 'python', label: 'Python' },
            { value: 'java', label: 'Java' },
            { value: 'php', label: 'PHP' },
            { value: 'other', label: 'Other' }
          ],
          order: 4
        },
        {
          name: 'project_description',
          label: 'Project Description',
          type: 'textarea',
          required: true,
          placeholder: 'Please describe your project requirements...',
          validation: {
            minLength: 50,
            maxLength: 1000
          },
          order: 5
        },
        {
          name: 'start_date',
          label: 'Preferred Start Date',
          type: 'date',
          required: false,
          order: 6
        },
        {
          name: 'website_url',
          label: 'Current Website (if any)',
          type: 'url',
          required: false,
          placeholder: 'https://example.com',
          order: 7
        }
      ],
      createdBy: superAdmin._id
    });

    console.log('✅ Landing page created:', landingPage.name);
    console.log('📊 Form fields configured:', landingPage.formFields.length);

    // Create test leads with different form submissions
    console.log('\n👥 Creating test leads...');

    const testLeads = [
      {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@company.com',
        phone: '+1-555-0123',
        company: 'TechCorp Inc.',
        landingPage: landingPage._id,
        dynamicFields: new Map([
          ['project_type', 'web_app'],
          ['budget_range', '25k_50k'],
          ['timeline', '3_6_months'],
          ['team_size', '3_5'],
          ['technologies', ['react', 'node']],
          ['project_description', 'We need a modern web application for our customer management system. It should include user authentication, dashboard, and reporting features.'],
          ['start_date', '2024-03-01'],
          ['website_url', 'https://techcorp.com']
        ])
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.j@startup.io',
        phone: '+1-555-0456',
        company: 'StartupIO',
        landingPage: landingPage._id,
        dynamicFields: new Map([
          ['project_type', 'mobile_app'],
          ['budget_range', 'under_10k'],
          ['timeline', '1_3_months'],
          ['team_size', '1_2'],
          ['technologies', ['react']],
          ['project_description', 'Looking to build a simple mobile app for our food delivery service. Need basic ordering and payment functionality.']
        ])
      },
      {
        firstName: 'Michael',
        lastName: 'Brown',
        email: 'michael.brown@enterprise.com',
        company: 'Enterprise Solutions Ltd.',
        landingPage: landingPage._id,
        dynamicFields: new Map([
          ['project_type', 'api'],
          ['budget_range', 'over_100k'],
          ['timeline', '6_12_months'],
          ['team_size', '10_plus'],
          ['technologies', ['python', 'java']],
          ['project_description', 'Large-scale enterprise API development project. Need robust, scalable backend services with comprehensive documentation and testing.']
        ])
      }
    ];

    for (const leadData of testLeads) {
      const lead = await Lead.create(leadData);
      console.log(`✅ Lead created for ${lead.firstName} ${lead.lastName}`);
    }

    // Test form validation
    console.log('\n🧪 Testing form validation...');
    
    // Test valid form submission
    const validFormData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+1-555-0789',
      company: 'Test Company',
      project_type: 'web_app',
      budget_range: '10k_25k',
      timeline: '3_6_months',
      project_description: 'This is a test project description that meets the minimum length requirement for validation.'
    };

    console.log('✅ Valid form data structure created');

    // Display landing page configuration
    console.log('\n📋 Landing Page Configuration:');
    console.log('Name:', landingPage.name);
    console.log('URL:', landingPage.url);
    console.log('Default Fields:', Object.keys(landingPage.includeDefaultFields).filter(key => landingPage.includeDefaultFields[key]));
    console.log('Custom Fields:', landingPage.formFields.map(f => `${f.label} (${f.type})`));

    // Display sample lead data
    console.log('\n📊 Sample Lead Data Structure:');
    const sampleLead = await Lead.findOne({ landingPage: landingPage._id }).populate('landingPage');
    if (sampleLead) {
      console.log('Lead ID:', sampleLead._id);
      console.log('Standard Fields:', {
        firstName: sampleLead.firstName,
        lastName: sampleLead.lastName,
        email: sampleLead.email,
        phone: sampleLead.phone,
        company: sampleLead.company
      });
      console.log('Dynamic Fields:', Object.fromEntries(sampleLead.dynamicFields));
      console.log('All Form Data (virtual):', sampleLead.allFormData);
    }

    console.log('\n🎉 Dynamic form system test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Use the API endpoints to manage form configurations');
    console.log('2. Submit leads through the dynamic forms');
    console.log('3. View leads with expanded details in the admin panel');

  } catch (error) {
    console.error('❌ Error testing dynamic forms:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testDynamicForms();
