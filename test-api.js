const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'testpass123',
  companyName: 'Test Company'
};

const testLandingPage = {
  name: 'Test Landing Page',
  url: 'https://test.example.com',
  description: 'Test description'
};

let authToken = '';
let userId = '';
let landingPageId = '';

// Helper function to log results
const logResult = (testName, success, data = null, error = null) => {
  console.log(`\n${testName}: ${success ? '✅ PASS' : '❌ FAIL'}`);
  if (data) console.log('Response:', JSON.stringify(data, null, 2));
  if (error) console.log('Error:', error.message || error);
};

// Test 1: Health Check
const testHealthCheck = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logResult('Health Check', true, response.data);
  } catch (error) {
    logResult('Health Check', false, null, error);
  }
};

// Test 2: User Registration
const testUserRegistration = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);
    logResult('User Registration', true, response.data);
    authToken = response.data.token;
    userId = response.data.user.id;
  } catch (error) {
    logResult('User Registration', false, null, error);
  }
};

// Test 3: User Login
const testUserLogin = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    logResult('User Login', true, response.data);
    authToken = response.data.token;
  } catch (error) {
    logResult('User Login', false, null, error);
  }
};

// Test 4: Get User Profile
const testGetProfile = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get Profile', true, response.data);
  } catch (error) {
    logResult('Get Profile', false, null, error);
  }
};

// Test 5: Create Landing Page (should fail without super admin)
const testCreateLandingPage = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/landing-pages`, testLandingPage, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Create Landing Page (Unauthorized)', false, response.data);
  } catch (error) {
    if (error.response && error.response.status === 403) {
      logResult('Create Landing Page (Unauthorized)', true, { message: 'Correctly blocked unauthorized access' });
    } else {
      logResult('Create Landing Page (Unauthorized)', false, null, error);
    }
  }
};

// Test 6: Get Landing Pages
const testGetLandingPages = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/landing-pages`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get Landing Pages', true, response.data);
    if (response.data.data && response.data.data.length > 0) {
      landingPageId = response.data.data[0]._id;
    }
  } catch (error) {
    logResult('Get Landing Pages', false, null, error);
  }
};

// Test 7: Create Lead
const testCreateLead = async () => {
  if (!landingPageId) {
    logResult('Create Lead', false, null, { message: 'No landing page ID available' });
    return;
  }

  try {
    const leadData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      company: 'Example Corp',
      message: 'Interested in your product',
      landingPageId: landingPageId
    };

    const response = await axios.post(`${BASE_URL}/leads`, leadData);
    logResult('Create Lead', true, response.data);
  } catch (error) {
    logResult('Create Lead', false, null, error);
  }
};

// Test 8: Get Leads
const testGetLeads = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/leads`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get Leads', true, response.data);
  } catch (error) {
    logResult('Get Leads', false, null, error);
  }
};

// Test 9: Get Lead Statistics
const testGetLeadStats = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/leads/stats/overview`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get Lead Statistics', true, response.data);
  } catch (error) {
    logResult('Get Lead Statistics', false, null, error);
  }
};

// Run all tests
const runTests = async () => {
  console.log('🚀 Starting API Tests...\n');
  
  await testHealthCheck();
  await testUserRegistration();
  await testUserLogin();
  await testGetProfile();
  await testCreateLandingPage();
  await testGetLandingPages();
  await testCreateLead();
  await testGetLeads();
  await testGetLeadStats();
  
  console.log('\n✨ API Tests Completed!');
  console.log('\nNote: Some tests may fail if the server is not running or if there are no landing pages in the database.');
  console.log('Make sure to:');
  console.log('1. Start the server with: npm run dev');
  console.log('2. Run the setup script: node scripts/setup.js');
  console.log('3. Have MongoDB running');
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testHealthCheck,
  testUserRegistration,
  testUserLogin,
  testGetProfile,
  testCreateLandingPage,
  testGetLandingPages,
  testCreateLead,
  testGetLeads,
  testGetLeadStats
}; 