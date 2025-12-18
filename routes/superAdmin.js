const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const LandingPage = require('../models/LandingPage');
const Lead = require('../models/Lead');
const AdminAccess = require('../models/AdminAccess');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);
router.use(authorize('super_admin'));

// @desc    Get all landing pages
// @route   GET /api/super-admin/landing-pages
// @access  Private (Super Admin only)
router.get('/landing-pages', asyncHandler(async (req, res) => {
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
router.post('/landing-pages', [
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
    $or: [{ name }, { url }]
  });

  if (existingLandingPage) {
    return res.status(400).json({
      success: false,
      message: 'Landing page with this name or URL already exists'
    });
  }

  // Create landing page
  const landingPage = await LandingPage.create({
    name,
    url,
    description,
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
router.put('/landing-pages/:id', [
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
router.delete('/landing-pages/:id', asyncHandler(async (req, res) => {
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
router.get('/sub-admins', asyncHandler(async (req, res) => {
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
router.post('/sub-admins', [
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
    approvedAt: Date.now()
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
      access,
      landingPage: access.length > 0 ? access[0].landingPage : null
    }
  });
}));

// @desc    Update sub admin
// @route   PUT /api/super-admin/sub-admins/:id
// @access  Private (Super Admin only)
router.put('/sub-admins/:id', [
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
      access,
      landingPage: access.length > 0 ? access[0].landingPage : null
    }
  });
}));

// @desc    Delete sub admin
// @route   DELETE /api/super-admin/sub-admins/:id
// @access  Private (Super Admin only)
router.delete('/sub-admins/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user || user.role !== 'sub_admin') {
    return res.status(404).json({
      success: false,
      message: 'Sub admin not found'
    });
  }

  // Check if sub admin has any leads
  const leadCount = await Lead.countDocuments({
    landingPage: { $in: await AdminAccess.distinct('landingPage', { subAdmin: req.params.id }) }
  });

  if (leadCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete sub admin. There are ${leadCount} leads associated with their landing pages.`
    });
  }

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
router.get('/leads', asyncHandler(async (req, res) => {
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
  if (landingPage) {
    query.landingPage = landingPage;
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

// @desc    Export leads
// @route   GET /api/super-admin/leads/export
// @access  Private (Super Admin only)
router.get('/leads/export', asyncHandler(async (req, res) => {
  const { 
    status, 
    landingPage, 
    search, 
    startDate, 
    endDate 
  } = req.query;

  let query = {};

  // Apply same filters as get leads
  if (status) query.status = status;
  if (landingPage) query.landingPage = landingPage;
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

module.exports = router; 