const express = require('express');
const User = require('../models/User');
const LandingPage = require('../models/LandingPage');
const Lead = require('../models/Lead');
const AccessRequest = require('../models/AccessRequest');
const AdminAccess = require('../models/AdminAccess');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// @desc    Get super admin dashboard stats
// @route   GET /api/dashboard/super-admin
// @access  Private (Super Admin only)
router.get('/super-admin', [
  authorize('super_admin')
], asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

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

  // Get counts
  const [
    totalLandingPages,
    totalSubAdmins,
    totalLeads,
    pendingAccessRequests,
    approvedAccessRequests,
    rejectedAccessRequests
  ] = await Promise.all([
    LandingPage.countDocuments(),
    User.countDocuments({ role: 'sub_admin' }),
    Lead.countDocuments(dateFilter),
    AccessRequest.countDocuments({ status: 'pending' }),
    AccessRequest.countDocuments({ status: 'approved' }),
    AccessRequest.countDocuments({ status: 'rejected' })
  ]);

  // Get leads by status
  const leadsByStatus = await Lead.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get leads by date (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const leadsByDate = await Lead.aggregate([
    { 
      $match: { 
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

  // Get recent activity
  const recentActivity = await Promise.all([
    // Recent leads
    Lead.find(dateFilter)
      .populate('landingPage', 'name')
      .sort({ createdAt: -1 })
      .limit(5),
    
    // Recent access requests
    AccessRequest.find()
      .populate('subAdmin', 'name companyName')
      .populate('landingPage', 'name')
      .sort({ createdAt: -1 })
      .limit(5),
    
    // Recent sub admin registrations
    User.find({ role: 'sub_admin', ...dateFilter })
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  const stats = {
    overview: {
      totalLandingPages,
      totalSubAdmins,
      totalLeads,
      pendingAccessRequests,
      approvedAccessRequests,
      rejectedAccessRequests
    },
    leadsByStatus: leadsByStatus.reduce((acc, item) => {
      acc[item._id || 'new'] = item.count;
      return acc;
    }, {}),
    leadsByDate,
    recentActivity: {
      leads: recentActivity[0],
      accessRequests: recentActivity[1],
      subAdmins: recentActivity[2]
    }
  };

  res.status(200).json({
    success: true,
    data: stats
  });
}));

// @desc    Get sub admin dashboard stats
// @route   GET /api/dashboard/sub-admin
// @access  Private (Sub Admin only)
router.get('/sub-admin', [
  authorize('sub_admin')
], asyncHandler(async (req, res) => {
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