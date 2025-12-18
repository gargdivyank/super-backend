const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Lead = require('../models/Lead');
const AdminAccess = require('../models/AdminAccess');
const LandingPage = require('../models/LandingPage');
const { protect, authorize, checkApproval } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);
router.use(authorize('sub_admin'));
router.use(checkApproval);

// @desc    Get sub admin profile
// @route   GET /api/sub-admin/profile
// @access  Private (Sub Admin only)
router.get('/profile', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');

  res.status(200).json({
    success: true,
    data: user
  });
}));

// @desc    Update sub admin profile
// @route   PUT /api/sub-admin/profile
// @access  Private (Sub Admin only)
router.put('/profile', [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  // body('companyName').optional().trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters')
  body('phone').optional().trim().isLength({ min: 7 }).withMessage('Please provide a valid phone number'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, phone } = req.body;

  const fieldsToUpdate = {
    name,
    phone
  };

  // Remove undefined fields
  Object.keys(fieldsToUpdate).forEach(key => 
    fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
  );

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  }).select('-password');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: user
  });
}));

// @desc    Get sub admin's assigned landing page
// @route   GET /api/sub-admin/landing-page
// @access  Private (Sub Admin only)
router.get('/landing-page', asyncHandler(async (req, res) => {
  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  }).populate('landingPage', 'name url description status');

  if (accessRecords.length === 0) {
    return res.status(200).json({
      success: true,
      data: null,
      message: 'No landing pages assigned yet'
    });
  }

  res.status(200).json({
    success: true,
    data: accessRecords.map(record => record.landingPage)
  });
}));

// @desc    Get sub admin's leads
// @route   GET /api/sub-admin/leads
// @access  Private (Sub Admin only)
router.get('/leads', asyncHandler(async (req, res) => {
  const { 
    status, 
    search, 
    startDate, 
    endDate, 
    page = 1, 
    limit = 10 
  } = req.query;

  // Get sub admin's assigned landing pages
  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  });

  const landingPageIds = accessRecords.map(record => record.landingPage);
  
  if (landingPageIds.length === 0) {
    return res.status(200).json({
      success: true,
      count: 0,
      data: [],
      total: 0
    });
  }

  let query = { landingPage: { $in: landingPageIds } };

  // Filter by status if provided
  if (status) {
    query.status = status;
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

// @desc    Export sub admin's leads
// @route   GET /api/sub-admin/leads/export
// @access  Private (Sub Admin only)
router.get('/leads/export', asyncHandler(async (req, res) => {
  const { 
    status, 
    search, 
    startDate, 
    endDate 
  } = req.query;

  // Get sub admin's assigned landing pages
  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  });

  const landingPageIds = accessRecords.map(record => record.landingPage);
  
  if (landingPageIds.length === 0) {
    return res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
  }

  let query = { landingPage: { $in: landingPageIds } };

  // Apply same filters as get leads
  if (status) query.status = status;
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

// @desc    Update lead status
// @route   PUT /api/sub-admin/leads/:id/status
// @access  Private (Sub Admin only)
router.put('/leads/:id/status', [
  body('status').isIn(['new', 'contacted', 'qualified', 'converted', 'lost']).withMessage('Invalid status')
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

  // Check if sub admin has access to this lead's landing page
  const hasAccess = await AdminAccess.findOne({
    subAdmin: req.user.id,
    landingPage: lead.landingPage._id,
    status: 'active'
  });

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this lead'
    });
  }

  lead.status = req.body.status;
  await lead.save();

  await lead.populate('landingPage', 'name url');

  res.status(200).json({
    success: true,
    message: 'Lead status updated successfully',
    data: lead
  });
}));

// @desc    Update lead details
// @route   PUT /api/sub-admin/leads/:id
// @access  Private (Sub Admin only)
router.put('/leads/:id', [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().trim(),
  body('company').optional().trim(),
  body('message').optional().trim()
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

  // Check if sub admin has access to this lead's landing page
  const hasAccess = await AdminAccess.findOne({
    subAdmin: req.user.id,
    landingPage: lead.landingPage._id,
    status: 'active'
  });

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this lead'
    });
  }

  const fieldsToUpdate = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    phone: req.body.phone,
    company: req.body.company,
    message: req.body.message
  };

  // Remove undefined fields
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

// @desc    Get sub admin dashboard stats
// @route   GET /api/sub-admin/dashboard-stats
// @access  Private (Sub Admin only)
router.get('/dashboard-stats', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Get sub admin's assigned landing pages
  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  });

  const landingPageIds = accessRecords.map(record => record.landingPage);
  
  if (landingPageIds.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalLandingPages: 0,
          totalLeads: 0,
          newLeads: 0,
          contactedLeads: 0,
          qualifiedLeads: 0,
          convertedLeads: 0,
          lostLeads: 0
        },
        leadsByDate: [],
        recentLeads: []
      }
    });
  }

  let dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) {
      dateFilter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.createdAt.$lte = new Date(endDate);
    }
  }

  // Add landing page filter
  const leadFilter = { ...dateFilter, landingPage: { $in: landingPageIds } };

  // Get lead statistics
  const leadsByStatus = await Lead.aggregate([
    { $match: leadFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const totalLeads = leadsByStatus.reduce((sum, item) => sum + item.count, 0);
  
  const leadStats = {
    totalLeads,
    newLeads: 0,
    contactedLeads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    lostLeads: 0
  };

  leadsByStatus.forEach(stat => {
    if (stat._id) {
      leadStats[`${stat._id}Leads`] = stat.count;
    }
  });

  // Get leads by date (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const leadsByDate = await Lead.aggregate([
    { 
      $match: { 
        landingPage: { $in: landingPageIds },
        createdAt: { $gte: thirtyDaysAgo },
        ...dateFilter
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Get recent leads
  const recentLeads = await Lead.find(leadFilter)
    .populate('landingPage', 'name url')
    .sort({ createdAt: -1 })
    .limit(10);

  const stats = {
    overview: {
      totalLandingPages: landingPageIds.length,
      ...leadStats
    },
    leadsByDate,
    recentLeads
  };

  res.status(200).json({
    success: true,
    data: stats
  });
}));

module.exports = router; 