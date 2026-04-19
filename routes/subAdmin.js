const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Lead = require('../models/Lead');
const AdminAccess = require('../models/AdminAccess');
const LandingPage = require('../models/LandingPage');
const { protect, authorize, checkApproval, authorizePermissions } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { parseLeadCSV } = require('../utils/csvParser');
const { getLeadAnalyticsData, getEmptyAnalyticsData } = require('../utils/leadAnalytics');
const { PERMISSIONS, normalizePermissions, resolveUserPermissions } = require('../constants/permissions');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Protect all routes after this middleware
router.use(protect);
router.use(authorize('sub_admin'));
router.use(checkApproval);

async function getMyActiveLandingPageIds(req) {
  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  });
  return accessRecords.map((r) => r.landingPage.toString());
}

/** Target must be a sub_admin whose active landing pages are a non-empty subset of the caller's. */
async function assertManagedSubAdminOnMyLandingPages(req, targetUserId) {
  const myLpIds = await getMyActiveLandingPageIds(req);
  if (myLpIds.length === 0) return null;

  const target = await User.findById(targetUserId);
  if (!target || target.role !== 'sub_admin') return null;
  if (target._id.toString() === req.user.id.toString()) return null;

  const targetAccess = await AdminAccess.find({
    subAdmin: targetUserId,
    status: 'active'
  });
  const targetLpIds = targetAccess.map((a) => a.landingPage.toString());
  if (targetLpIds.length === 0) return null;

  const shared = targetLpIds.some((id) => myLpIds.includes(id));
  const subset = targetLpIds.every((id) => myLpIds.includes(id));
  if (!shared || !subset) return null;

  return { target, myLpIds, targetLpIds };
}

// @desc    List sub admins/users for the same assigned landing page(s)
// @route   GET /api/sub-admin/sub-admins
// @access  Private (Sub Admin only)
router.get('/sub-admins', authorizePermissions(PERMISSIONS.SUB_ADMINS_VIEW), asyncHandler(async (req, res) => {
  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  });

  const landingPageIds = accessRecords.map((r) => r.landingPage);
  if (landingPageIds.length === 0) {
    return res.status(200).json({
      success: true,
      count: 0,
      total: 0,
      pagination: {},
      data: []
    });
  }

  const records = await AdminAccess.find({
    landingPage: { $in: landingPageIds },
    status: 'active'
  }).populate('subAdmin', 'name email companyName phone status role permissions createdAt');

  const deduped = new Map();
  for (const record of records) {
    const u = record.subAdmin;
    if (!u) continue;
    const id = u._id?.toString();
    if (!id) continue;
    if (id === req.user.id.toString()) continue; // hide yourself
    if (!deduped.has(id)) deduped.set(id, u);
  }

  let users = Array.from(deduped.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const { search, page = 1, limit = 10 } = req.query;
  const searchTrim = typeof search === 'string' ? search.trim() : '';

  if (searchTrim) {
    const q = searchTrim.toLowerCase();
    users = users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const company = (u.companyName || '').toLowerCase();
      return name.includes(q) || email.includes(q) || company.includes(q);
    });
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const total = users.length;
  const startIndex = (pageNum - 1) * limitNum;
  const pagedUsers = users.slice(startIndex, startIndex + limitNum);

  const pagination = {};
  const endIndex = startIndex + limitNum;
  if (endIndex < total) {
    pagination.next = { page: pageNum + 1, limit: limitNum };
  }
  if (startIndex > 0) {
    pagination.prev = { page: pageNum - 1, limit: limitNum };
  }

  res.status(200).json({
    success: true,
    count: pagedUsers.length,
    total,
    pagination,
    data: pagedUsers
  });
}));

// @desc    Create a new sub admin for the same assigned landing page(s)
// @route   POST /api/sub-admin/sub-admins
// @access  Private (Sub Admin only)
router.post('/sub-admins', authorizePermissions(PERMISSIONS.SUB_ADMINS_MANAGE), [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('companyName').trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters'),
  body('phone').optional().trim().isLength({ min: 7 }).withMessage('Please provide a valid phone number'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array of strings')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, email, password, companyName, phone } = req.body;

  // Sub-admin can only create users for their own assigned landing page(s).
  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  });

  if (accessRecords.length === 0) {
    return res.status(403).json({
      success: false,
      message: 'No landing pages assigned. You cannot create sub admins.'
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  const creatorPermissions = new Set(resolveUserPermissions(req.user));
  const requestedPermissions = normalizePermissions(req.body.permissions);

  // If permissions aren't provided, default to core sub-admin modules (no sub-admin management).
  const defaultChildPermissions = [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.PROFILE_VIEW,
    PERMISSIONS.PROFILE_EDIT
  ];

  // Respect explicit permission list from UI (including empty). Only use defaults when field is omitted.
  const hasExplicitPermissionsArray = Array.isArray(req.body.permissions);
  const desiredPermissions = hasExplicitPermissionsArray
    ? requestedPermissions
    : defaultChildPermissions;
  const childPermissions = desiredPermissions.filter((p) => creatorPermissions.has(p));

  const user = await User.create({
    name,
    email,
    password,
    companyName,
    phone,
    role: 'sub_admin',
    status: 'approved',
    approvedBy: req.user.id,
    approvedAt: Date.now(),
    permissions: childPermissions
  });

  const landingPageIds = accessRecords.map((r) => r.landingPage);
  await AdminAccess.insertMany(
    landingPageIds.map((landingPageId) => ({
      subAdmin: user._id,
      landingPage: landingPageId,
      grantedBy: req.user.id,
      status: 'active',
      grantedAt: Date.now()
    })),
    { ordered: false }
  );

  res.status(201).json({
    success: true,
    message: 'Sub admin created successfully',
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      companyName: user.companyName,
      permissions: user.permissions,
      landingPagesAssigned: landingPageIds.length
    }
  });
}));

// @desc    Update a sub admin managed under the same landing page(s)
// @route   PUT /api/sub-admin/sub-admins/:id
// @access  Private (Sub Admin only)
router.put('/sub-admins/:id', authorizePermissions(PERMISSIONS.SUB_ADMINS_MANAGE), [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('companyName').optional().trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters'),
  body('phone').optional().trim().isLength({ min: 7 }).withMessage('Please provide a valid phone number'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array of strings')
], asyncHandler(async (req, res) => {
  if (!req.params.id || req.params.id === 'undefined') {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const ctx = await assertManagedSubAdminOnMyLandingPages(req, req.params.id);
  if (!ctx) {
    return res.status(404).json({
      success: false,
      message: 'Sub admin not found'
    });
  }

  const { name, companyName, phone, password, status, email } = req.body;
  const creatorPermissions = new Set(resolveUserPermissions(req.user));
  const normalizedPermissions = normalizePermissions(req.body.permissions);

  const fieldsToUpdate = {};
  if (name !== undefined) fieldsToUpdate.name = name;
  if (companyName !== undefined) fieldsToUpdate.companyName = companyName;
  if (phone !== undefined && phone !== '') fieldsToUpdate.phone = phone.trim();
  if (status !== undefined) fieldsToUpdate.status = status;
  if (password) fieldsToUpdate.password = password;

  if (email !== undefined && email.trim() !== '') {
    const emailTaken = await User.findOne({
      email: email.trim().toLowerCase(),
      _id: { $ne: req.params.id }
    });
    if (emailTaken) {
      return res.status(400).json({
        success: false,
        message: 'Another user already uses this email'
      });
    }
    fieldsToUpdate.email = email.trim().toLowerCase();
  }

  if (Array.isArray(req.body.permissions)) {
    fieldsToUpdate.permissions = normalizedPermissions.filter((p) => creatorPermissions.has(p));
  }

  Object.keys(fieldsToUpdate).forEach((key) => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]);

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields to update'
    });
  }

  const userToUpdate = await User.findById(req.params.id);
  if (!userToUpdate) {
    return res.status(404).json({ success: false, message: 'Sub admin not found' });
  }

  Object.assign(userToUpdate, fieldsToUpdate);
  await userToUpdate.save();

  const updatedUser = await User.findById(req.params.id).select('-password');

  res.status(200).json({
    success: true,
    message: 'Sub admin updated successfully',
    data: {
      ...updatedUser.toObject(),
      permissions: resolveUserPermissions(updatedUser)
    }
  });
}));

// @desc    Delete a sub admin managed under the same landing page(s)
// @route   DELETE /api/sub-admin/sub-admins/:id
// @access  Private (Sub Admin only)
router.delete('/sub-admins/:id', authorizePermissions(PERMISSIONS.SUB_ADMINS_MANAGE), asyncHandler(async (req, res) => {
  const ctx = await assertManagedSubAdminOnMyLandingPages(req, req.params.id);
  if (!ctx) {
    return res.status(404).json({
      success: false,
      message: 'Sub admin not found'
    });
  }

  await AdminAccess.deleteMany({ subAdmin: req.params.id });
  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Sub admin deleted successfully'
  });
}));

// @desc    Get sub admin profile
// @route   GET /api/sub-admin/profile
// @access  Private (Sub Admin only)
router.get('/profile', authorizePermissions(PERMISSIONS.PROFILE_VIEW), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');

  res.status(200).json({
    success: true,
    data: user
  });
}));

// @desc    Update sub admin profile
// @route   PUT /api/sub-admin/profile
// @access  Private (Sub Admin only)
router.put('/profile', authorizePermissions(PERMISSIONS.PROFILE_EDIT), [
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

// @desc    Lead analytics for sub-admin's assigned landing page(s) only
// @route   GET /api/sub-admin/analytics
// @access  Private (Sub Admin only)
router.get('/analytics', authorizePermissions(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(async (req, res) => {
  const emptyData = getEmptyAnalyticsData();

  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  });

  const landingPageIds = accessRecords.map((record) => record.landingPage);

  if (landingPageIds.length === 0) {
    return res.status(200).json({ success: true, data: emptyData });
  }

  const match = { landingPage: { $in: landingPageIds } };

  let landingPageMeta = null;
  if (landingPageIds.length === 1) {
    landingPageMeta = await LandingPage.findById(landingPageIds[0]).select('name url status');
  }

  const data = await getLeadAnalyticsData(match, landingPageMeta);
  res.status(200).json({ success: true, data });
}));

// @desc    Get sub admin's leads
// @route   GET /api/sub-admin/leads
// @access  Private (Sub Admin only)
router.get('/leads', authorizePermissions(PERMISSIONS.LEADS_VIEW), asyncHandler(async (req, res) => {
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
router.get('/leads/export', authorizePermissions(PERMISSIONS.LEADS_VIEW), asyncHandler(async (req, res) => {
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

// @desc    Upload CSV to update leads (status, lastContacted, etc.) for sub-admin's leads only
// @route   POST /api/sub-admin/leads/upload
// @access  Private (Sub Admin only)
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

  const accessRecords = await AdminAccess.find({
    subAdmin: req.user.id,
    status: 'active'
  });
  const landingPageIds = accessRecords.map((r) => r.landingPage);
  if (landingPageIds.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No landing pages assigned. No leads to update.',
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
      lead = await Lead.findOne({
        _id: row._id,
        landingPage: { $in: landingPageIds }
      });
    } else if (row.email) {
      const email = row.email.trim().toLowerCase();
      lead = await Lead.findOne({
        email,
        landingPage: { $in: landingPageIds }
      });
    }

    if (!lead) {
      errors.push(`No lead found for row: ${row.email || row._id} in your assigned pages`);
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

// @desc    Update lead status
// @route   PUT /api/sub-admin/leads/:id/status
// @access  Private (Sub Admin only)
router.put('/leads/:id/status', authorizePermissions(PERMISSIONS.LEADS_EDIT), [
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

// @desc    Update lead details (including status and lastContacted)
// @route   PUT /api/sub-admin/leads/:id
// @access  Private (Sub Admin only)
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
    message: req.body.message,
    status: req.body.status,
    lastContacted: req.body.lastContacted
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
router.get('/dashboard-stats', authorizePermissions(PERMISSIONS.DASHBOARD_VIEW), asyncHandler(async (req, res) => {
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