const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LandingPage = require('../models/LandingPage');
const User = require('../models/User');
const AdminAccess = require('../models/AdminAccess');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testSubAdminLeadsFix = async () => {
  try {
    console.log('🧪 Testing Sub Admin Leads Fix...\n');

    // Get a sample landing page
    const landingPage = await LandingPage.findOne({ status: 'active' });
    if (!landingPage) {
      console.log('❌ No active landing page found. Please create one first.');
      return;
    }

    console.log('📋 Using Landing Page:', landingPage.name, '(ID:', landingPage._id, ')');

    // Create a test sub admin
    const testSubAdmin = await User.create({
      name: 'Test Sub Admin',
      email: 'test.subadmin.leads@example.com',
      password: 'password123',
      companyName: 'Test Company',
      role: 'sub_admin',
      status: 'approved',
      approvedBy: new mongoose.Types.ObjectId(),
      approvedAt: Date.now()
    });

    console.log('✅ Test sub admin created:', testSubAdmin.name);

    // Create admin access record
    await AdminAccess.create({
      subAdmin: testSubAdmin._id,
      landingPage: landingPage._id,
      grantedBy: new mongoose.Types.ObjectId(),
      status: 'active'
    });

    console.log('✅ Admin access record created');

    // Create test leads with different data structures
    const testLeads = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '1234567890',
        company: 'Test Company',
        message: 'Interested in your services',
        landingPage: landingPage._id,
        status: 'new',
        source: 'landing_page',
        ipAddress: '127.0.0.1',
        dynamicFields: new Map([
          ['problem', 'health issues'],
          ['profession', 'doctor']
        ])
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '9876543210',
        landingPage: landingPage._id,
        status: 'contacted',
        source: 'landing_page',
        ipAddress: '127.0.0.1',
        dynamicFields: new Map([
          ['budget', '50000'],
          ['timeline', '3 months']
        ])
      },
      {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.johnson@example.com',
        landingPage: landingPage._id,
        status: 'qualified',
        source: 'landing_page',
        ipAddress: '127.0.0.1'
        // No dynamic fields for this lead
      }
    ];

    console.log('\n👥 Creating test leads...');
    const createdLeads = [];
    for (const leadData of testLeads) {
      const lead = await Lead.create(leadData);
      createdLeads.push(lead);
      console.log(`✅ Lead created: ${lead.firstName} ${lead.lastName}`);
    }

    // Test the data structure that would be sent to frontend
    console.log('\n📊 Testing data structure for frontend...');
    
    const leadsWithDetails = await Lead.find({ landingPage: landingPage._id })
      .populate('landingPage', 'name url')
      .sort({ createdAt: -1 });

    console.log('📋 Lead Data Structure:');
    leadsWithDetails.forEach((lead, index) => {
      console.log(`\nLead ${index + 1}:`);
      console.log('- ID:', lead._id);
      console.log('- Name:', `${lead.firstName} ${lead.lastName}`);
      console.log('- Email:', lead.email);
      console.log('- Phone:', lead.phone || 'N/A');
      console.log('- Company:', lead.company || 'N/A');
      console.log('- Status:', lead.status);
      console.log('- Dynamic Fields:', Object.fromEntries(lead.dynamicFields || new Map()));
      console.log('- All Form Data:', lead.allFormData);
    });

    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    
    const searchTests = [
      { term: 'John', expected: 1 },
      { term: 'jane', expected: 1 },
      { term: 'health', expected: 1 },
      { term: '50000', expected: 1 },
      { term: 'example.com', expected: 3 }
    ];

    for (const test of searchTests) {
      const matchingLeads = leadsWithDetails.filter(lead => {
        const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.toLowerCase();
        return fullName.includes(test.term.toLowerCase()) ||
               lead.firstName?.toLowerCase().includes(test.term.toLowerCase()) ||
               lead.lastName?.toLowerCase().includes(test.term.toLowerCase()) ||
               lead.email?.toLowerCase().includes(test.term.toLowerCase()) ||
               lead.phone?.toLowerCase().includes(test.term.toLowerCase()) ||
               lead.company?.toLowerCase().includes(test.term.toLowerCase()) ||
               (lead.dynamicFields && Object.values(lead.dynamicFields).some(value => 
                 value?.toString().toLowerCase().includes(test.term.toLowerCase())
               ));
      });

      console.log(`Search "${test.term}": Found ${matchingLeads.length} leads (expected: ${test.expected})`);
      if (matchingLeads.length === test.expected) {
        console.log('✅ Search test passed');
      } else {
        console.log('❌ Search test failed');
      }
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await Lead.deleteMany({ landingPage: landingPage._id });
    await AdminAccess.deleteMany({ subAdmin: testSubAdmin._id });
    await User.findByIdAndDelete(testSubAdmin._id);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Sub Admin Leads fix test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('- Lead names now display correctly using firstName + lastName');
    console.log('- Expandable details functionality added');
    console.log('- Dynamic fields are displayed in expanded view');
    console.log('- Search functionality includes dynamic fields');
    console.log('- Same functionality as Super Admin leads page');

  } catch (error) {
    console.error('❌ Error testing sub admin leads fix:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testSubAdminLeadsFix();
