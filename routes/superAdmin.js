const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const LandingPage = require('../models/LandingPage');
const Lead = require('../models/Lead');
const AdminAccess = require('../models/AdminAccess');
const { protect, authorize, authorizePermissions } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { parseLeadCSV } = require('../utils/csvParser');
const { getLeadAnalyticsData, getEmptyAnalyticsData } = require('../utils/leadAnalytics');
const { PERMISSIONS, normalizePermissions, resolveUserPermissions } = require('../constants/permissions');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

function generateTrackingKey(){
   return "LP_" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function isValidObjectId(id) {
  return id && id !== 'undefined' && mongoose.Types.ObjectId.isValid(id);
}
// Protect all routes after this middleware
router.use(protect);
router.use(authorize('super_admin'));

// @desc    Get all landing pages
// @route   GET /api/super-admin/landing-pages
// @access  Private (Super Admin only)
router.get('/landing-pages', authorizePermissions(PERMISSIONS.LANDING_PAGES_VIEW), asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 10 } = req.query;

  let query = {};
  if (status) {
    query.status = status;
  }

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const startIndex = (pageNum - 1) * limitNum;

  const total = await LandingPage.countDocuments(query);
  const landingPages = await LandingPage.find(query)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limitNum);

  // Pagination result
  const pagination = {};
  const endIndex = startIndex + limitNum;

  if (endIndex < total) {
    pagination.next = {
      page: pageNum + 1,
      limit: limitNum
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: pageNum - 1,
      limit: limitNum
    };
  }

  res.status(200).json({
    success: true,
    count: landingPages.length,
    pagination,
    total,
    data: landingPages
  });
}));

// @desc    Create landing page
// @route   POST /api/super-admin/landing-pages
// @access  Private (Super Admin only)
router.post('/landing-pages', authorizePermissions(PERMISSIONS.LANDING_PAGES_MANAGE), [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('url').isURL().withMessage('Please provide a valid URL'),
  body('description').optional().trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, url, description } = req.body;

  // Check if landing page already exists
  const existingLandingPage = await LandingPage.findOne({
    $or: [{ name }, { originalUrl: url }]
  });

  if (existingLandingPage) {
    return res.status(400).json({
      success: false,
      message: 'Landing page with this name or URL already exists'
    });
  }
   const trackingKey = generateTrackingKey();
  //  const finalUrl= `${url}/${trackingKey}`;
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set('tk', trackingKey);
  const finalUrl = parsedUrl.toString();

   console.log("Generated Tracking Key:", trackingKey);
   console.log("Final URL with trackingKey:", finalUrl);
  // Create landing page
  const landingPage = await LandingPage.create({
    name,
    originalUrl: url,
    url: finalUrl,
    description,
    trackingKey,
    createdBy: req.user.id
  });

  await landingPage.populate('createdBy', 'name email');

  res.status(201).json({
    success: true,
    message: 'Landing page created successfully',
    data: landingPage
  });
}));

// @desc    Update landing page
// @route   PUT /api/super-admin/landing-pages/:id
// @access  Private (Super Admin only)
router.put('/landing-pages/:id', authorizePermissions(PERMISSIONS.LANDING_PAGES_MANAGE), [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('url').optional().isURL().withMessage('Please provide a valid URL'),
  body('description').optional().trim(),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid landing page ID'
    });
  }

  const { name, url, description, status } = req.body;

  // Check if landing page exists
  const existingLandingPage = await LandingPage.findById(req.params.id);
  if (!existingLandingPage) {
    return res.status(404).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  // Check for duplicate name or URL if updating
  if (name || url) {
    const duplicateQuery = { _id: { $ne: req.params.id } };
    if (name) duplicateQuery.name = name;
    if (url) duplicateQuery.url = url;

    const duplicate = await LandingPage.findOne(duplicateQuery);
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'Landing page with this name or URL already exists'
      });
    }
  }

  const fieldsToUpdate = {
    name,
    url,
    description,
    status
  };

  // Remove undefined fields
  Object.keys(fieldsToUpdate).forEach(key => 
    fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
  );

  const landingPage = await LandingPage.findByIdAndUpdate(
    req.params.id,
    fieldsToUpdate,
    { new: true, runValidators: true }
  ).populate('createdBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Landing page updated successfully',
    data: landingPage
  });
}));

// @desc    Delete landing page
// @route   DELETE /api/super-admin/landing-pages/:id
// @access  Private (Super Admin only)
router.delete('/landing-pages/:id', authorizePermissions(PERMISSIONS.LANDING_PAGES_MANAGE), asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid landing page ID'
    });
  }

  const landingPage = await LandingPage.findById(req.params.id);

  if (!landingPage) {
    return res.status(404).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  // Check if there are any leads associated with this landing page
  const leadCount = await Lead.countDocuments({ landingPage: req.params.id });

  if (leadCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete landing page. There are ${leadCount} leads associated with it.`
    });
  }

  await LandingPage.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Landing page deleted successfully'
  });
}));

// @desc    Get all sub admins
// @route   GET /api/super-admin/sub-admins
// @access  Private (Super Admin only)
router.get('/sub-admins', authorizePermissions(PERMISSIONS.SUB_ADMINS_VIEW), asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 10 } = req.query;

  let query = { role: 'sub_admin' };
  if (status) {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { companyName: { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const startIndex = (pageNum - 1) * limitNum;

  const total = await User.countDocuments(query);
  const subAdmins = await User.find(query)
    .select('-password')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limitNum);

  // Get access information for each sub admin
  const subAdminsWithAccess = await Promise.all(
    subAdmins.map(async (subAdmin) => {
      const access = await AdminAccess.find({ 
        subAdmin: subAdmin._id,
        status: 'active'
      }).populate('landingPage', 'name url');

      return {
        ...subAdmin.toObject(),
        access
      };
    })
  );

  // Pagination result
  const pagination = {};
  const endIndex = startIndex + limitNum;

  if (endIndex < total) {
    pagination.next = {
      page: pageNum + 1,
      limit: limitNum
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: pageNum - 1,
      limit: limitNum
    };
  }

  res.status(200).json({
    success: true,
    count: subAdminsWithAccess.length,
    pagination,
    total,
    data: subAdminsWithAccess
  });
}));

// @desc    Create sub admin
// @route   POST /api/super-admin/sub-admins
// @access  Private (Super Admin only)
router.post('/sub-admins', authorizePermissions(PERMISSIONS.SUB_ADMINS_MANAGE), [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('companyName').trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters'),
  body('landingPageId').optional().isMongoId().withMessage('Please provide valid landing page ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, email, password, companyName, landingPageId, phone, status } = req.body;
  const normalizedPermissions = normalizePermissions(req.body.permissions);

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Validate landing page if provided
  if (landingPageId) {
    const landingPage = await LandingPage.findById(landingPageId);
    if (!landingPage || landingPage.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Invalid landing page'
      });
    }
  }

  // Create user with approved status
  const user = await User.create({
    name,
    email,
    password,
    companyName,
    phone,
    role: 'sub_admin',
    status: status || 'approved',
    approvedBy: req.user.id,
    approvedAt: Date.now(),
    ...(normalizedPermissions.length > 0 ? { permissions: normalizedPermissions } : {})
  });

  // Create admin access record if landing page is provided
  if (landingPageId) {
    await AdminAccess.create({
      subAdmin: user._id,
      landingPage: landingPageId,
      grantedBy: req.user.id,
      status: 'active'
    });
  }

  // Get the created user with access information
  const userWithAccess = await User.findById(user._id)
    .select('-password')
    .populate('approvedBy', 'name email');

  const access = await AdminAccess.find({ 
    subAdmin: user._id,
    status: 'active'
  }).populate('landingPage', 'name url');

  res.status(201).json({
    success: true,
    message: 'Sub admin created successfully',
    data: {
      ...userWithAccess.toObject(),
      permissions: resolveUserPermissions(userWithAccess),
      access,
      landingPage: access.length > 0 ? access[0].landingPage : null
    }
  });
}));

// @desc    Update sub admin
// @route   PUT /api/super-admin/sub-admins/:id
// @access  Private (Super Admin only)
router.put('/sub-admins/:id', authorizePermissions(PERMISSIONS.SUB_ADMINS_MANAGE), [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('companyName').optional().trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters'),
  body('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
  body('landingPageId').optional().isMongoId().withMessage('Please provide valid landing page ID')
], asyncHandler(async (req, res) => {
  if (!req.params.id || req.params.id === 'undefined') {
    return res.status(400).json({
      success: false,
      message: 'Sub admin ID is required'
    });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, companyName, status, landingPageId, phone } = req.body;
  const normalizedPermissions = normalizePermissions(req.body.permissions);

  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'sub_admin') {
    return res.status(404).json({
      success: false,
      message: 'Sub admin not found'
    });
  }

  // Only set phone if it's a non-empty string
  const fieldsToUpdate = {
    name,
    companyName,
    status
  };
  if (Array.isArray(req.body.permissions)) {
    fieldsToUpdate.permissions = normalizedPermissions;
  }
  if (phone && phone.trim() !== '') {
    fieldsToUpdate.phone = phone.trim();
  }

  // Remove undefined fields
  Object.keys(fieldsToUpdate).forEach(key => 
    fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
  );

  // Update approval info if status is changing
  if (status && status !== user.status) {
    if (status === 'approved') {
      fieldsToUpdate.approvedBy = req.user.id;
      fieldsToUpdate.approvedAt = Date.now();
    } else if (status === 'rejected') {
      fieldsToUpdate.rejectedBy = req.user.id;
      fieldsToUpdate.rejectedAt = Date.now();
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    fieldsToUpdate,
    { new: true, runValidators: true }
  ).select('-password');

  // Handle landing page assignment
  if (landingPageId !== undefined) {
    // Remove existing access records (if any)
    await AdminAccess.deleteMany({ 
      subAdmin: req.params.id,
      status: 'active'
    });

    // Create new access record if landing page is provided and not empty
    if (landingPageId && landingPageId !== '') {
      // Validate landing page
      const landingPage = await LandingPage.findById(landingPageId);
      if (!landingPage || landingPage.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Invalid landing page'
        });
      }

      await AdminAccess.create({
        subAdmin: req.params.id,
        landingPage: landingPageId,
        grantedBy: req.user.id,
        status: 'active'
      });
    }
  }

  // Get updated user with access information
  const access = await AdminAccess.find({ 
    subAdmin: req.params.id,
    status: 'active'
  }).populate('landingPage', 'name url');

  res.status(200).json({
    success: true,
    message: 'Sub admin updated successfully',
    data: {
      ...updatedUser.toObject(),
      permissions: resolveUserPermissions(updatedUser),
      access,
      landingPage: access.length > 0 ? access[0].landingPage : null
    }
  });
}));

// @desc    Delete sub admin
// @route   DELETE /api/super-admin/sub-admins/:id
// @access  Private (Super Admin only)
router.delete('/sub-admins/:id', authorizePermissions(PERMISSIONS.SUB_ADMINS_MANAGE), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user || user.role !== 'sub_admin') {
    return res.status(404).json({
      success: false,
      message: 'Sub admin not found'
    });
  }

  // Check if sub admin has any leads
  // const leadCount = await Lead.countDocuments({
  //   landingPage: { $in: await AdminAccess.distinct('landingPage', { subAdmin: req.params.id }) }
  // });

  // if (leadCount > 0) {
  //   return res.status(400).json({
  //     success: false,
  //     message: `Cannot delete sub admin. There are ${leadCount} leads associated with their landing pages.`
  //   });
  // }

  // Remove admin access records
  await AdminAccess.deleteMany({ subAdmin: req.params.id });

  // Delete the user
  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Sub admin deleted successfully'
  });
}));

// @desc    Get all leads
// @route   GET /api/super-admin/leads
// @access  Private (Super Admin only)
router.get('/leads', authorizePermissions(PERMISSIONS.LEADS_VIEW), asyncHandler(async (req, res) => {
  const { 
    status, 
    landingPage, 
    search, 
    startDate, 
    endDate, 
    page = 1, 
    limit = 10 
  } = req.query;

  let query = {};

  // Filter by status if provided
  if (status) {
    query.status = status;
  }

  // Filter by landing page if provided
  // if (landingPage) {
  //   query.landingPage = landingPage;
  // }
  // Only show leads from ACTIVE landing pages
const activeLandingPageIds = await LandingPage
.find({ status: 'active' })
.distinct('_id');

if (!activeLandingPageIds.length) {
return res.status(200).json({
  success: true,
  count: 0,
  pagination: {},
  total: 0,
  data: []
});
}

if (landingPage) {
const isActive = activeLandingPageIds.some(
  (id) => id.toString() === landingPage.toString()
);

// If selected landing page is inactive => show no leads (do NOT delete)
if (!isActive) {
  return res.status(200).json({
    success: true,
    count: 0,
    pagination: {},
    total: 0,
    data: []
  });
}

// landingPage is active => filter by it
query.landingPage = landingPage;
} else {
// no landingPage filter => show leads from all active pages
query.landingPage = { $in: activeLandingPageIds };
}

  // Filter by date range if provided
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  // Search by name or email if provided
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const startIndex = (pageNum - 1) * limitNum;

  const total = await Lead.countDocuments(query);
  const leads = await Lead.find(query)
    .populate('landingPage', 'name url')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limitNum);

  // Pagination result
  const pagination = {};
  const endIndex = startIndex + limitNum;

  if (endIndex < total) {
    pagination.next = {
      page: pageNum + 1,
      limit: limitNum
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: pageNum - 1,
      limit: limitNum
    };
  }

  res.status(200).json({
    success: true,
    count: leads.length,
    pagination,
    total,
    data: leads
  });
}));

// @desc    Update lead (status, lastContacted, and details)
// @route   PUT /api/super-admin/leads/:id
// @access  Private (Super Admin only)
router.put('/leads/:id', authorizePermissions(PERMISSIONS.LEADS_EDIT), [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().trim(),
  body('company').optional().trim(),
  body('message').optional().trim(),
  body('status').optional().isIn(['new', 'contacted', 'qualified', 'converted', 'lost']).withMessage('Invalid status'),
  body('lastContacted').optional().isISO8601().toDate()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const lead = await Lead.findById(req.params.id).populate('landingPage');
  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  const fieldsToUpdate = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    phone: req.body.phone,
    company: req.body.company,
    message: req.body.message,
    status: req.body.status,
    lastContacted: req.body.lastContacted
  };

  Object.keys(fieldsToUpdate).forEach(key =>
    fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
  );

  const updatedLead = await Lead.findByIdAndUpdate(
    req.params.id,
    fieldsToUpdate,
    { new: true, runValidators: true }
  ).populate('landingPage', 'name url');

  res.status(200).json({
    success: true,
    message: 'Lead updated successfully',
    data: updatedLead
  });
}));

// @desc    Upload CSV to update leads (status, lastContacted, etc.)
// @route   POST /api/super-admin/leads/upload
// @access  Private (Super Admin only)
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'];
router.post('/leads/upload', authorizePermissions(PERMISSIONS.LEADS_EDIT), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      success: false,
      message: 'Please upload a CSV file',
      updated: 0,
      failed: 0,
      errors: []
    });
  }

  const { rows, errors: parseErrors } = parseLeadCSV(req.file.buffer);
  const errors = [...(parseErrors || [])];
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row._id && !row.email) {
      failed++;
      continue;
    }

    let lead;
    if (row._id) {
      lead = await Lead.findById(row._id);
    } else if (row.email) {
      const email = row.email.trim().toLowerCase();
      lead = await Lead.findOne({ email });
    }

    if (!lead) {
      errors.push(`No lead found for row: ${row.email || row._id}`);
      failed++;
      continue;
    }
    const updates = {};
    if (row.firstName) updates.firstName = row.firstName;
    if (row.lastName) updates.lastName = row.lastName;
    if (row.phone !== undefined) updates.phone = row.phone;
    if (row.company !== undefined) updates.company = row.company;
    if (row.message !== undefined) updates.message = row.message;
    if (row.status && VALID_STATUSES.includes(row.status.toLowerCase())) {
      updates.status = row.status.toLowerCase();
    }
    if (row.lastContacted) {
      const d = new Date(row.lastContacted);
      if (!isNaN(d.getTime())) updates.lastContacted = d;
    }
    if (Object.keys(updates).length === 0) {
      failed++;
      continue;
    }
    await Lead.findByIdAndUpdate(lead._id, updates, { runValidators: true });
    updated++;
  }

  res.status(200).json({
    success: true,
    message: `Leads update complete. Updated: ${updated}, Failed: ${failed}`,
    updated,
    failed,
    errors: errors.length ? errors : undefined
  });
}));

// @desc    Export leads
// @route   GET /api/super-admin/leads/export
// @access  Private (Super Admin only)
router.get('/leads/export', authorizePermissions(PERMISSIONS.LEADS_VIEW), asyncHandler(async (req, res) => {
  const { 
    status, 
    landingPage, 
    search, 
    startDate, 
    endDate 
  } = req.query;

  let query = {};

  // Apply same filters as get leads
  // if (status) query.status = status;
  // if (landingPage) query.landingPage = landingPage;
   // Only export leads from ACTIVE landing pages
const activeLandingPageIds = await LandingPage
.find({ status: 'active' })
.distinct('_id');

if (!activeLandingPageIds.length) {
return res.status(200).json({
  success: true,
  count: 0,
  data: []
});
}

// Apply same filters as get leads
if (status) query.status = status;

if (landingPage) {
const isActive = activeLandingPageIds.some(
  (id) => id.toString() === landingPage.toString()
);

// If selected landing page is inactive => export nothing
if (!isActive) {
  return res.status(200).json({
    success: true,
    count: 0,
    data: []
  });
}

query.landingPage = landingPage;
} else {
query.landingPage = { $in: activeLandingPageIds };
}

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const leads = await Lead.find(query)
    .populate('landingPage', 'name url')
    .sort({ createdAt: -1 });

  // Format data for export
  const exportData = leads.map(lead => ({
    'Lead ID': lead._id.toString(),
    'First Name': lead.firstName,
    'Last Name': lead.lastName,
    'Email': lead.email,
    'Phone': lead.phone || '',
    'Company': lead.company || '',
    'Message': lead.message || '',
    'Landing Page': lead.landingPage?.name || '',
    'Status': lead.status,
    'IP Address': lead.ipAddress || '',
    'Created At': lead.createdAt.toISOString()
  }));

  res.status(200).json({
    success: true,
    count: exportData.length,
    data: exportData
  });
}));

// @desc    Lead analytics for a landing page (or all active pages)
// @route   GET /api/super-admin/analytics
// @access  Private (Super Admin only)
// router.get('/analytics', asyncHandler(async (req, res) => {
//   const { landingPage: landingPageId } = req.query;

//   const emptyData = {
//     kpis: { new: 0, contacted: 0, qualified: 0, closed: 0 },
//     landingPage: null,
//     leadsOverTime: { daily: [], monthly: [], yearly: [] },
//     bySource: [],
//     byLocation: [],
//     byDevice: []
//   };

//   const activeLandingPageIds = await LandingPage.find({ status: 'active' }).distinct('_id');

//   if (!activeLandingPageIds.length) {
//     return res.status(200).json({ success: true, data: emptyData });
//   }

//   let match = { landingPage: { $in: activeLandingPageIds } };
//   let landingPageMeta = null;

//   if (landingPageId) {
//     if (!isValidObjectId(landingPageId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid landing page ID'
//       });
//     }

//     const isActive = activeLandingPageIds.some(
//       (id) => id.toString() === landingPageId.toString()
//     );

//     if (!isActive) {
//       return res.status(200).json({ success: true, data: emptyData });
//     }

//     match = { landingPage: new mongoose.Types.ObjectId(landingPageId) };
//     landingPageMeta = await LandingPage.findById(landingPageId).select('name url status');
//   }

//   const statusAgg = await Lead.aggregate([
//     { $match: match },
//     { $group: { _id: '$status', count: { $sum: 1 } } }
//   ]);

//   const counts = { new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };

//   statusAgg.forEach((row) => {
//     if (row._id && Object.prototype.hasOwnProperty.call(counts, row._id)) {
//       counts[row._id] = row.count;
//     }
//   });

//   const kpis = {
//     new: counts.new,
//     contacted: counts.contacted,
//     qualified: counts.qualified,
//     closed: counts.converted + counts.lost
//   };

//   const timeSeries = (format) =>
//     Lead.aggregate([
//       { $match: match },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format, date: '$createdAt', timezone: 'UTC' }
//           },
//           leads: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } },
//       { $project: { _id: 0, period: '$_id', leads: 1 } }
//     ]);

//   const [daily, monthly, yearly, bySourceRaw, locAgg, byDeviceRaw] = await Promise.all([
//     timeSeries('%Y-%m-%d'),
//     timeSeries('%Y-%m'),
//     timeSeries('%Y'),
//     Lead.aggregate([
//       { $match: match },
//       {
//         $addFields: {
//           src: {
//             $trim: {
//               input: { $ifNull: ['$source', ''] }
//             }
//           }
//         }
//       },
//       {
//         $addFields: {
//           src: {
//             $cond: [{ $eq: ['$src', ''] }, 'Unknown', '$src']
//           }
//         }
//       },
//       { $group: { _id: '$src', count: { $sum: 1 } } },
//       { $sort: { count: -1 } },
//       { $project: { _id: 0, source: '$_id', count: 1 } }
//     ]),
//     Lead.aggregate([
//       { $match: match },
//       {
//         $addFields: {
//           loc: {
//             $trim: {
//               input: {
//                 $ifNull: [
//                   '$dynamicFields.geoLocation',
//                   { $ifNull: ['$geoLocation', ''] }
//                 ]
//               }
//             }
//           }
//         }
//       },
//       {
//         $addFields: {
//           loc: {
//             $cond: [
//               {
//                 $or: [
//                   { $eq: ['$loc', ''] },
//                   { $eq: ['$loc', 'Unknown location'] }
//                 ]
//               },
//               'Unknown',
//               '$loc'
//             ]
//           }
//         }
//       },
//       { $group: { _id: '$loc', count: { $sum: 1 } } },
//       { $sort: { count: -1 } }
//     ]),
//     Lead.aggregate([
//       { $match: match },
//       {
//         $addFields: {
//           rawDevice: {
//             $ifNull: [
//               '$dynamicFields.deviceType',
//               { $ifNull: ['$deviceType', ''] }
//             ]
//           }
//         }
//       },
//       {
//         $addFields: {
//           bucket: {
//             $switch: {
//               branches: [
//                 {
//                   case: {
//                     $in: [
//                       { $toLower: '$rawDevice' },
//                       ['mobile', 'tablet']
//                     ]
//                   },
//                   then: 'Mobile'
//                 },
//                 {
//                   case: {
//                     $eq: [{ $toLower: '$rawDevice' }, 'desktop']
//                   },
//                   then: 'Desktop'
//                 }
//               ],
//               default: 'Unknown'
//             }
//           }
//         }
//       },
//       { $group: { _id: '$bucket', count: { $sum: 1 } } },
//       { $project: { _id: 0, device: '$_id', count: 1 } },
//       { $sort: { count: -1 } }
//     ])
//   ]);

//   const locRows = locAgg.map((x) => ({ location: x._id, count: x.count }));
//   const topLoc = locRows.slice(0, 15);
//   const otherLocSum = locRows.slice(15).reduce((acc, r) => acc + r.count, 0);

//   const byLocation =
//     otherLocSum > 0
//       ? [...topLoc, { location: 'Other', count: otherLocSum }]
//       : topLoc;

//   res.status(200).json({
//     success: true,
//     data: {
//       kpis,
//       landingPage: landingPageMeta,
//       leadsOverTime: { daily, monthly, yearly },
//       bySource: bySourceRaw,
//       byLocation,
//       byDevice: byDeviceRaw
//     }
//   });
// }));
router.get('/analytics', authorizePermissions(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(async (req, res) => {
  const { landingPage: landingPageId } = req.query;

  const emptyData = getEmptyAnalyticsData();

  const activeLandingPageIds = await LandingPage.find({ status: 'active' }).distinct('_id');

  if (!activeLandingPageIds.length) {
    return res.status(200).json({ success: true, data: emptyData });
  }

  let match = { landingPage: { $in: activeLandingPageIds } };
  let landingPageMeta = null;

  if (landingPageId) {
    if (!isValidObjectId(landingPageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid landing page ID'
      });
    }

    const isActive = activeLandingPageIds.some(
      (id) => id.toString() === landingPageId.toString()
    );

    if (!isActive) {
      return res.status(200).json({ success: true, data: emptyData });
    }

    match = { landingPage: new mongoose.Types.ObjectId(landingPageId) };
    landingPageMeta = await LandingPage.findById(landingPageId).select('name url status');
  }

  const data = await getLeadAnalyticsData(match, landingPageMeta);
  res.status(200).json({ success: true, data });
}));
module.exports = router; 