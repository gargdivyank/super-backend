const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const LandingPage = require('../models/LandingPage');
const AdminAccess = require('../models/AdminAccess');
const { protect, authorize, checkApproval } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);
router.use(authorize('super_admin'));

// @desc    Get all pending sub admin requests
// @route   GET /api/admin/pending-requests
// @access  Private (Super Admin only)
router.get('/pending-requests', asyncHandler(async (req, res) => {
  const pendingUsers = await User.find({ 
    role: 'sub_admin', 
    status: 'pending' 
  }).select('-password');

  res.status(200).json({
    success: true,
    count: pendingUsers.length,
    data: pendingUsers
  });
}));

// @desc    Approve sub admin request
// @route   PUT /api/admin/approve-user/:id
// @access  Private (Super Admin only)
router.put('/approve-user/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (user.role !== 'sub_admin') {
    return res.status(400).json({
      success: false,
      message: 'Can only approve sub admin users'
    });
  }

  if (user.status === 'approved') {
    return res.status(400).json({
      success: false,
      message: 'User is already approved'
    });
  }

  user.status = 'approved';
  user.approvedBy = req.user.id;
  user.approvedAt = Date.now();
  await user.save();

  res.status(200).json({
    success: true,
    message: 'User approved successfully',
    data: user
  });
}));

// @desc    Reject sub admin request
// @route   PUT /api/admin/reject-user/:id
// @access  Private (Super Admin only)
router.put('/reject-user/:id', [
  body('reason').optional().trim().isLength({ min: 5 }).withMessage('Reason must be at least 5 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (user.role !== 'sub_admin') {
    return res.status(400).json({
      success: false,
      message: 'Can only reject sub admin users'
    });
  }

  if (user.status === 'rejected') {
    return res.status(400).json({
      success: false,
      message: 'User is already rejected'
    });
  }

  user.status = 'rejected';
  user.approvedBy = req.user.id;
  user.approvedAt = Date.now();
  await user.save();

  res.status(200).json({
    success: true,
    message: 'User rejected successfully',
    data: user
  });
}));

// @desc    Create sub admin directly (by super admin)
// @route   POST /api/admin/create-sub-admin
// @access  Private (Super Admin only)
router.post('/create-sub-admin', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('companyName').trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, email, password, companyName } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Create user with approved status
  const user = await User.create({
    name,
    email,
    password,
    companyName,
    role: 'sub_admin',
    status: 'approved',
    approvedBy: req.user.id,
    approvedAt: Date.now()
  });

  res.status(201).json({
    success: true,
    message: 'Sub admin created successfully',
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      companyName: user.companyName
    }
  });
}));

// @desc    Grant landing page access to sub admin
// @route   POST /api/admin/grant-access
// @access  Private (Super Admin only)
router.post('/grant-access', [
  body('subAdminId').isMongoId().withMessage('Please provide valid sub admin ID'),
  body('landingPageId').isMongoId().withMessage('Please provide valid landing page ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { subAdminId, landingPageId } = req.body;

  // Check if sub admin exists and is approved
  const subAdmin = await User.findById(subAdminId);
  if (!subAdmin || subAdmin.role !== 'sub_admin' || subAdmin.status !== 'approved') {
    return res.status(400).json({
      success: false,
      message: 'Invalid sub admin or not approved'
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

  // Check if access already exists
  const existingAccess = await AdminAccess.findOne({
    subAdmin: subAdminId,
    landingPage: landingPageId
  });

  if (existingAccess) {
    if (existingAccess.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Access already granted'
      });
    } else {
      // Reactivate access
      existingAccess.status = 'active';
      existingAccess.revokedAt = undefined;
      existingAccess.revokedBy = undefined;
      await existingAccess.save();

      return res.status(200).json({
        success: true,
        message: 'Access reactivated successfully',
        data: existingAccess
      });
    }
  }

  // Grant new access
  const adminAccess = await AdminAccess.create({
    subAdmin: subAdminId,
    landingPage: landingPageId,
    grantedBy: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'Access granted successfully',
    data: adminAccess
  });
}));

// @desc    Revoke landing page access from sub admin
// @route   PUT /api/admin/revoke-access/:id
// @access  Private (Super Admin only)
router.put('/revoke-access/:id', asyncHandler(async (req, res) => {
  const adminAccess = await AdminAccess.findById(req.params.id);

  if (!adminAccess) {
    return res.status(404).json({
      success: false,
      message: 'Access record not found'
    });
  }

  if (adminAccess.status === 'revoked') {
    return res.status(400).json({
      success: false,
      message: 'Access is already revoked'
    });
  }

  adminAccess.status = 'revoked';
  adminAccess.revokedAt = Date.now();
  adminAccess.revokedBy = req.user.id;
  await adminAccess.save();

  res.status(200).json({
    success: true,
    message: 'Access revoked successfully',
    data: adminAccess
  });
}));

// @desc    Get all sub admins with their access
// @route   GET /api/admin/sub-admins
// @access  Private (Super Admin only)
router.get('/sub-admins', asyncHandler(async (req, res) => {
  const subAdmins = await User.find({ role: 'sub_admin' })
    .select('-password')
    .populate('approvedBy', 'name email');

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

  res.status(200).json({
    success: true,
    count: subAdminsWithAccess.length,
    data: subAdminsWithAccess
  });
}));

// @desc    Get all admin access records
// @route   GET /api/admin/access-records
// @access  Private (Super Admin only)
router.get('/access-records', asyncHandler(async (req, res) => {
  const accessRecords = await AdminAccess.find()
    .populate('subAdmin', 'name email companyName')
    .populate('landingPage', 'name url')
    .populate('grantedBy', 'name email')
    .populate('revokedBy', 'name email');

  res.status(200).json({
    success: true,
    count: accessRecords.length,
    data: accessRecords
  });
}));

module.exports = router; 