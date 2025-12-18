const express = require('express');
const { body, validationResult } = require('express-validator');
const AccessRequest = require('../models/AccessRequest');
const User = require('../models/User');
const LandingPage = require('../models/LandingPage');
const AdminAccess = require('../models/AdminAccess');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// @desc    Create access request (Sub Admin)
// @route   POST /api/access-requests
// @access  Private (Sub Admin only)
router.post('/', [
  authorize('sub_admin'),
  body('landingPageId').isMongoId().withMessage('Please provide valid landing page ID'),
  body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be less than 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { landingPageId, message } = req.body;

  // Check if landing page exists and is active
  const landingPage = await LandingPage.findById(landingPageId);
  if (!landingPage || landingPage.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Invalid landing page'
    });
  }

  // Check if access request already exists
  const existingRequest = await AccessRequest.findOne({
    subAdmin: req.user.id,
    landingPage: landingPageId,
    status: { $in: ['pending', 'approved'] }
  });

  if (existingRequest) {
    return res.status(400).json({
      success: false,
      message: existingRequest.status === 'approved' 
        ? 'You already have access to this landing page'
        : 'You already have a pending request for this landing page'
    });
  }

  // Create access request
  const accessRequest = await AccessRequest.create({
    subAdmin: req.user.id,
    landingPage: landingPageId,
    message
  });

  await accessRequest.populate('landingPage', 'name url');

  res.status(201).json({
    success: true,
    message: 'Access request created successfully',
    data: accessRequest
  });
}));

// @desc    Get all access requests (Super Admin)
// @route   GET /api/access-requests
// @access  Private (Super Admin only)
router.get('/', [
  authorize('super_admin')
], asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  let query = {};
  if (status) {
    query.status = status;
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const startIndex = (pageNum - 1) * limitNum;

  const total = await AccessRequest.countDocuments(query);
  const accessRequests = await AccessRequest.find(query)
    .populate('subAdmin', 'name email companyName')
    .populate('landingPage', 'name url')
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email')
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
    count: accessRequests.length,
    pagination,
    total,
    data: accessRequests
  });
}));

// @desc    Get access requests for current sub admin
// @route   GET /api/access-requests/my-requests
// @access  Private (Sub Admin only)
router.get('/my-requests', [
  authorize('sub_admin')
], asyncHandler(async (req, res) => {
  const accessRequests = await AccessRequest.find({ subAdmin: req.user.id })
    .populate('landingPage', 'name url')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: accessRequests.length,
    data: accessRequests
  });
}));

// @desc    Approve access request
// @route   PUT /api/access-requests/:id/approve
// @access  Private (Super Admin only)
router.put('/:id/approve', [
  authorize('super_admin'),
  body('landingPageId').isMongoId().withMessage('Please provide valid landing page ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { landingPageId } = req.body;

  const accessRequest = await AccessRequest.findById(req.params.id);
  if (!accessRequest) {
    return res.status(404).json({
      success: false,
      message: 'Access request not found'
    });
  }

  if (accessRequest.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Access request is not pending'
    });
  }

  // Check if landing page exists
  const landingPage = await LandingPage.findById(landingPageId);
  if (!landingPage) {
    return res.status(400).json({
      success: false,
      message: 'Landing page not found'
    });
  }

  // Update access request status
  accessRequest.status = 'approved';
  accessRequest.approvedBy = req.user.id;
  accessRequest.approvedAt = Date.now();
  await accessRequest.save();

  // Grant access to the landing page
  await AdminAccess.create({
    subAdmin: accessRequest.subAdmin,
    landingPage: landingPageId,
    grantedBy: req.user.id
  });

  await accessRequest.populate('subAdmin', 'name email companyName');
  await accessRequest.populate('landingPage', 'name url');

  res.status(200).json({
    success: true,
    message: 'Access request approved successfully',
    data: accessRequest
  });
}));

// @desc    Reject access request
// @route   PUT /api/access-requests/:id/reject
// @access  Private (Super Admin only)
router.put('/:id/reject', [
  authorize('super_admin'),
  body('reason').trim().isLength({ min: 5 }).withMessage('Rejection reason must be at least 5 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { reason } = req.body;

  const accessRequest = await AccessRequest.findById(req.params.id);
  if (!accessRequest) {
    return res.status(404).json({
      success: false,
      message: 'Access request not found'
    });
  }

  if (accessRequest.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Access request is not pending'
    });
  }

  // Update access request status
  accessRequest.status = 'rejected';
  accessRequest.rejectedBy = req.user.id;
  accessRequest.rejectedAt = Date.now();
  accessRequest.rejectionReason = reason;
  await accessRequest.save();

  await accessRequest.populate('subAdmin', 'name email companyName');
  await accessRequest.populate('landingPage', 'name url');

  res.status(200).json({
    success: true,
    message: 'Access request rejected successfully',
    data: accessRequest
  });
}));

// @desc    Delete access request
// @route   DELETE /api/access-requests/:id
// @access  Private (Owner or Super Admin)
router.delete('/:id', asyncHandler(async (req, res) => {
  const accessRequest = await AccessRequest.findById(req.params.id);
  
  if (!accessRequest) {
    return res.status(404).json({
      success: false,
      message: 'Access request not found'
    });
  }

  // Only allow deletion if user is the owner or super admin
  if (req.user.role !== 'super_admin' && accessRequest.subAdmin.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this access request'
    });
  }

  await AccessRequest.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Access request deleted successfully'
  });
}));

module.exports = router; 