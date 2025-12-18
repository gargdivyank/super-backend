const mongoose = require('mongoose');

const AccessRequestSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    trim: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  rejectionReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
AccessRequestSchema.index({ subAdmin: 1, landingPage: 1 });
AccessRequestSchema.index({ status: 1 });

module.exports = mongoose.model('AccessRequest', AccessRequestSchema); 