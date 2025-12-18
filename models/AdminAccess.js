const mongoose = require('mongoose');

const adminAccessSchema = new mongoose.Schema({
  subAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  landingPage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandingPage',
    required: true
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'revoked'],
    default: 'active'
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  revokedAt: {
    type: Date
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Ensure unique combination of subAdmin and landingPage
adminAccessSchema.index({ subAdmin: 1, landingPage: 1 }, { unique: true });

// Index for better query performance
adminAccessSchema.index({ subAdmin: 1, status: 1 });
adminAccessSchema.index({ landingPage: 1, status: 1 });

module.exports = mongoose.model('AdminAccess', adminAccessSchema); 