const express = require('express');
const { body, validationResult } = require('express-validator');
const LandingPage = require('../models/LandingPage');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// @desc    Create new landing page
// @route   POST /api/landing-pages
// @access  Private (Super Admin only)
router.post('/', [
  authorize('super_admin'),
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

  res.status(201).json({
    success: true,
    message: 'Landing page created successfully',
    data: landingPage
  });
}));

// @desc    Get all landing pages
// @route   GET /api/landing-pages
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  let query = {};

  // Filter by status if provided
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Search by name if provided
  if (req.query.search) {
    query.name = { $regex: req.query.search, $options: 'i' };
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  const total = await LandingPage.countDocuments(query);
  const landingPages = await LandingPage.find(query)
    .populate('createdBy', 'name email')
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
    count: landingPages.length,
    pagination,
    total,
    data: landingPages
  });
}));

// @desc    Get single landing page
// @route   GET /api/landing-pages/:id
// @access  Private
router.get('/:id', asyncHandler(async (req, res) => {
  const landingPage = await LandingPage.findById(req.params.id)
    .populate('createdBy', 'name email');

  if (!landingPage) {
    return res.status(404).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  res.status(200).json({
    success: true,
    data: landingPage
  });
}));

// @desc    Update landing page
// @route   PUT /api/landing-pages/:id
// @access  Private (Super Admin only)
router.put('/:id', [
  authorize('super_admin'),
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
// @route   DELETE /api/landing-pages/:id
// @access  Private (Super Admin only)
router.delete('/:id', authorize('super_admin'), asyncHandler(async (req, res) => {
  const landingPage = await LandingPage.findById(req.params.id);

  if (!landingPage) {
    return res.status(404).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  // Check if there are any leads associated with this landing page
  const Lead = require('../models/Lead');
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

// @desc    Get landing page statistics
// @route   GET /api/landing-pages/:id/stats
// @access  Private
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const landingPage = await LandingPage.findById(req.params.id);
  if (!landingPage) {
    return res.status(404).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  const Lead = require('../models/Lead');
  
  // Get lead statistics for this landing page
  const stats = await Lead.aggregate([
    { $match: { landingPage: landingPage._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    landingPage: {
      id: landingPage._id,
      name: landingPage.name,
      url: landingPage.url
    },
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

  // Get leads by date (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const leadsByDate = await Lead.aggregate([
    { 
      $match: { 
        landingPage: landingPage._id,
        createdAt: { $gte: thirtyDaysAgo }
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

  result.leadsByDate = leadsByDate;

  res.status(200).json({
    success: true,
    data: result
  });
}));

// @desc    Update landing page form fields configuration
// @route   PUT /api/landing-pages/:id/form-fields
// @access  Private (Super Admin only)
router.put('/:id/form-fields', [
  authorize('super_admin'),
  body('formFields').isArray().withMessage('Form fields must be an array'),
  body('includeDefaultFields').isObject().withMessage('Include default fields must be an object')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { formFields, includeDefaultFields } = req.body;

  // Check if landing page exists
  const existingLandingPage = await LandingPage.findById(req.params.id);
  if (!existingLandingPage) {
    return res.status(404).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  // Validate form fields structure
  if (formFields) {
    for (let i = 0; i < formFields.length; i++) {
      const field = formFields[i];
      if (!field.name || !field.label || !field.type) {
        return res.status(400).json({
          success: false,
          message: `Form field at index ${i} is missing required properties (name, label, type)`
        });
      }
      
      // Set order if not provided
      if (field.order === undefined) {
        field.order = i;
      }
    }
  }

  // Validate includeDefaultFields
  if (includeDefaultFields) {
    const validDefaultFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'message'];
    for (const field of Object.keys(includeDefaultFields)) {
      if (!validDefaultFields.includes(field)) {
        return res.status(400).json({
          success: false,
          message: `Invalid default field: ${field}`
        });
      }
    }
  }

  const fieldsToUpdate = {};
  if (formFields !== undefined) fieldsToUpdate.formFields = formFields;
  if (includeDefaultFields !== undefined) fieldsToUpdate.includeDefaultFields = includeDefaultFields;

  const landingPage = await LandingPage.findByIdAndUpdate(
    req.params.id,
    fieldsToUpdate,
    { new: true, runValidators: true }
  ).populate('createdBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Landing page form fields updated successfully',
    data: landingPage
  });
}));

// @desc    Get landing page form configuration
// @route   GET /api/landing-pages/:id/form-config
// @access  Private
router.get('/:id/form-config', asyncHandler(async (req, res) => {
  const landingPage = await LandingPage.findById(req.params.id)
    .select('name formFields includeDefaultFields');

  if (!landingPage) {
    return res.status(404).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      name: landingPage.name,
      formFields: landingPage.formFields || [],
      includeDefaultFields: landingPage.includeDefaultFields || {}
    }
  });
}));

// @desc    Test landing page form submission
// @route   POST /api/landing-pages/:id/test-form
// @access  Private (Super Admin only)
router.post('/:id/test-form', [
  authorize('super_admin')
], asyncHandler(async (req, res) => {
  const landingPage = await LandingPage.findById(req.params.id);
  if (!landingPage) {
    return res.status(404).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  // Validate form data against the landing page's form configuration
  const { formData } = req.body;
  const validationErrors = [];

  // Validate default fields
  if (landingPage.includeDefaultFields.firstName && (!formData.firstName || formData.firstName.trim().length < 2)) {
    validationErrors.push('First name is required and must be at least 2 characters');
  }

  if (landingPage.includeDefaultFields.lastName && (!formData.lastName || formData.lastName.trim().length < 2)) {
    validationErrors.push('Last name is required and must be at least 2 characters');
  }

  if (landingPage.includeDefaultFields.email && (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))) {
    validationErrors.push('Valid email is required');
  }

  // Validate dynamic fields
  if (landingPage.formFields && landingPage.formFields.length > 0) {
    for (const field of landingPage.formFields) {
      const fieldValue = formData[field.name];
      
      if (field.required && (!fieldValue || fieldValue.toString().trim() === '')) {
        validationErrors.push(`${field.label} is required`);
      }
    }
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Form validation failed',
      errors: validationErrors
    });
  }

  res.status(200).json({
    success: true,
    message: 'Form validation passed',
    data: {
      formData,
      formConfig: {
        formFields: landingPage.formFields || [],
        includeDefaultFields: landingPage.includeDefaultFields || {}
      }
    }
  });
}));

module.exports = router; 