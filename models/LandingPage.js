const mongoose = require('mongoose');

// Schema for form field definitions
const formFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'radio', 'number', 'date', 'url'],
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    trim: true
  },
  options: [{
    value: String,
    label: String
  }],
  validation: {
    minLength: Number,
    maxLength: Number,
    pattern: String,
    min: Number,
    max: Number
  },
  order: {
    type: Number,
    default: 0
  }
});

const landingPageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide landing page name'],
    trim: true,
    unique: true
  },
  url: {
    type: String,
    required: [true, 'Please provide landing page URL'],
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // Dynamic form fields configuration
  formFields: [formFieldSchema],
  // Default fields that are always included
  includeDefaultFields: {
    firstName: { type: Boolean, default: true },
    lastName: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    phone: { type: Boolean, default: false },
    company: { type: Boolean, default: false },
    message: { type: Boolean, default: false }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
landingPageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('LandingPage', landingPageSchema); 