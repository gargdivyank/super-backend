const express = require('express');
const { body, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const LandingPage = require('../models/LandingPage');
const AdminAccess = require('../models/AdminAccess');
const { protect, authorize, checkApproval } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Protect all routes after this middleware
// router.use(protect);
// router.use(checkApproval);

// @desc    Create new lead (public endpoint for landing pages)
// @route   POST /api/leads
// @access  Public
router.post('/', asyncHandler(async (req, res) => {
  const { landingPageId, ...formData } = req.body;

  // Check if landing page exists
  const landingPage = await LandingPage.findById(landingPageId);
  if (!landingPage || landingPage.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Invalid landing page'
    });
  }

  // Prepare lead data
  const leadData = {
    landingPage: landingPageId,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    dynamicFields: new Map()
  };

  // Process default fields based on landing page configuration
  if (landingPage.includeDefaultFields.firstName) {
    if (!formData.firstName || formData.firstName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'First name is required and must be at least 2 characters'
      });
    }
    leadData.firstName = formData.firstName.trim();
  }

  if (landingPage.includeDefaultFields.lastName) {
    if (!formData.lastName || formData.lastName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Last name is required and must be at least 2 characters'
      });
    }
    leadData.lastName = formData.lastName.trim();
  }

  if (landingPage.includeDefaultFields.email) {
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }
    leadData.email = formData.email.toLowerCase().trim();
  }

  if (formData.phone) {
    leadData.phone = formData.phone.trim();
  }

  if (landingPage.includeDefaultFields.company && formData.company) {
    leadData.company = formData.company.trim();
  }

  if (landingPage.includeDefaultFields.message && formData.message) {
    leadData.message = formData.message.trim();
  }

  // Define standard field names that should not be stored in dynamicFields
  const standardFields = ['firstName', 'lastName', 'email', 'phone', 'landingPageId'];
  
  // Process dynamic form fields (both configured and unconfigured)
  for (const [fieldName, fieldValue] of Object.entries(formData)) {
    // Skip if it's a standard field or if value is empty
    if (standardFields.includes(fieldName) || !fieldValue || fieldValue.toString().trim() === '') {
      continue;
    }
    
    // Check if this field is configured in the landing page
    const configuredField = landingPage.formFields?.find(field => field.name === fieldName);
    
    // If field is configured and required, validate it
    if (configuredField && configuredField.required && (!fieldValue || fieldValue.toString().trim() === '')) {
      return res.status(400).json({
        success: false,
        message: `${configuredField.label} is required`
      });
    }
    
    // Store the field value
    leadData.dynamicFields.set(fieldName, fieldValue.toString().trim());
  }

  // Create lead
  const lead = await Lead.create(leadData);

  res.status(201).json({
    success: true,
    message: 'Lead created successfully',
    data: lead
  });
}));

router.use(protect);
router.use(checkApproval);
// @desc    Get all leads (Super Admin can see all, Sub Admin only their assigned landing pages)
// @route   GET /api/leads
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  let query = {};

  // If sub admin, only show leads from their assigned landing pages
  if (req.user.role === 'sub_admin') {
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

    query.landingPage = { $in: landingPageIds };
  }

  // Filter by landing page if provided
  if (req.query.landingPage) {
    query.landingPage = req.query.landingPage;
  }

  // Filter by status if provided
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by date range if provided
  if (req.query.startDate || req.query.endDate) {
    query.createdAt = {};
    if (req.query.startDate) {
      query.createdAt.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      query.createdAt.$lte = new Date(req.query.endDate);
    }
  }

  // Search by name or email if provided
  if (req.query.search) {
    query.$or = [
      { firstName: { $regex: req.query.search, $options: 'i' } },
      { lastName: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  const total = await Lead.countDocuments(query);
  const leads = await Lead.find(query)
    .populate('landingPage', 'name url')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit);

  // Pagination result
  const pagination = {};
  const endIndex = startIndex + limit;

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
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

// @desc    Get single lead
// @route   GET /api/leads/:id
// @access  Private
router.get('/:id', asyncHandler(async (req, res) => {
  let query = { _id: req.params.id };

  // If sub admin, check if they have access to this lead's landing page
  if (req.user.role === 'sub_admin') {
    const lead = await Lead.findById(req.params.id).populate('landingPage');
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    const hasAccess = await AdminAccess.findOne({
      subAdmin: req.user.id,
      landingPage: lead.landingPage._id,
      status: 'active'
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this lead'
      });
    }
  }

  const lead = await Lead.findById(req.params.id).populate('landingPage', 'name url');

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  res.status(200).json({
    success: true,
    data: lead
  });
}));

// @desc    Update lead status
// @route   PUT /api/leads/:id/status
// @access  Private
router.put('/:id/status', [
  body('status').isIn(['new', 'contacted', 'qualified', 'converted', 'lost']).withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  let query = { _id: req.params.id };

  // If sub admin, check if they have access to this lead's landing page
  if (req.user.role === 'sub_admin') {
    const lead = await Lead.findById(req.params.id).populate('landingPage');
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

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
  }

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true, runValidators: true }
  ).populate('landingPage', 'name url');

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Lead status updated successfully',
    data: lead
  });
}));

// @desc    Update lead details
// @route   PUT /api/leads/:id
// @access  Private
router.put('/:id', [
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

  let query = { _id: req.params.id };

  // If sub admin, check if they have access to this lead's landing page
  if (req.user.role === 'sub_admin') {
    const lead = await Lead.findById(req.params.id).populate('landingPage');
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

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

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    fieldsToUpdate,
    { new: true, runValidators: true }
  ).populate('landingPage', 'name url');

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Lead updated successfully',
    data: lead
  });
}));

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private (Super Admin only)
router.delete('/:id', authorize('super_admin'), asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Lead deleted successfully'
  });
}));

// @desc    Get lead statistics
// @route   GET /api/leads/stats/overview
// @access  Private
router.get('/stats/overview', asyncHandler(async (req, res) => {
  let matchQuery = {};

  // If sub admin, only show stats for their assigned landing pages
  if (req.user.role === 'sub_admin') {
    const accessRecords = await AdminAccess.find({
      subAdmin: req.user.id,
      status: 'active'
    });

    const landingPageIds = accessRecords.map(record => record.landingPage);
    
    if (landingPageIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalLeads: 0,
          newLeads: 0,
          contactedLeads: 0,
          qualifiedLeads: 0,
          convertedLeads: 0,
          lostLeads: 0
        }
      });
    }

    matchQuery.landingPage = { $in: landingPageIds };
  }

  // Filter by date range if provided
  if (req.query.startDate || req.query.endDate) {
    matchQuery.createdAt = {};
    if (req.query.startDate) {
      matchQuery.createdAt.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      matchQuery.createdAt.$lte = new Date(req.query.endDate);
    }
  }

  const stats = await Lead.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    totalLeads: 0,
    newLeads: 0,
    contactedLeads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    lostLeads: 0
  };

  stats.forEach(stat => {
    result.totalLeads += stat.count;
    if (stat._id) {
      result[`${stat._id}Leads`] = stat.count;
    }
  });

  res.status(200).json({
    success: true,
    data: result
  });
}));

module.exports = router; 