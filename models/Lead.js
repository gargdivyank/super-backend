const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Default fields (can be toggled per landing page)
  firstName: {
    type: String,
    required: [true, 'Please provide first name'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Please provide last name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  // Dynamic form fields data (stores all custom form submissions)
  dynamicFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  // Landing page reference
  landingPage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandingPage',
    required: true
  },
  // Lead tracking
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new'
  },
  source: {
    type: String,
    default: 'landing_page'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
leadSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
leadSchema.index({ landingPage: 1, createdAt: -1 });
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });

// Virtual for getting all form data (default + dynamic)
leadSchema.virtual('allFormData').get(function() {
  const data = {
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    phone: this.phone,
    company: this.company,
    message: this.message
  };
  
  // Add dynamic fields
  if (this.dynamicFields) {
    this.dynamicFields.forEach((value, key) => {
      data[key] = value;
    });
  }
  
  return data;
});

// Ensure virtual fields are serialized
leadSchema.set('toJSON', { virtuals: true });
leadSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Lead', leadSchema); 