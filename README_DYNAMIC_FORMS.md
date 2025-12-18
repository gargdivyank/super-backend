# Dynamic Form System Documentation

## Overview

The Dynamic Form System allows you to create multiple landing pages with different form structures. Each landing page can have its own set of custom form fields while maintaining standard lead information fields.

## Features

- **Flexible Form Fields**: Support for text, email, phone, textarea, select, checkbox, radio, number, date, and URL fields
- **Custom Validation**: Set required fields, min/max lengths, and patterns
- **Field Options**: Configure select and radio button options
- **Default Field Toggle**: Enable/disable standard fields per landing page
- **Dynamic Data Storage**: Store all form submissions in a flexible schema
- **API Management**: Full CRUD operations for form configurations

## Database Schema

### LandingPage Model

```javascript
{
  name: String,                    // Landing page name
  url: String,                     // Landing page URL
  description: String,             // Description
  status: String,                  // 'active' or 'inactive'
  
  // Form field configuration
  formFields: [{
    name: String,                  // Field identifier (e.g., 'project_type')
    label: String,                 // Display label (e.g., 'Project Type')
    type: String,                  // Field type (text, email, select, etc.)
    required: Boolean,             // Whether field is required
    placeholder: String,           // Placeholder text
    options: [{                    // For select/radio fields
      value: String,
      label: String
    }],
    validation: {                  // Validation rules
      minLength: Number,
      maxLength: Number,
      pattern: String,
      min: Number,
      max: Number
    },
    order: Number                  // Field display order
  }],
  
  // Default fields configuration
  includeDefaultFields: {
    firstName: Boolean,            // Always true
    lastName: Boolean,             // Always true
    email: Boolean,                // Always true
    phone: Boolean,                // Optional
    company: Boolean,              // Optional
    message: Boolean               // Optional
  }
}
```

### Lead Model

```javascript
{
  // Standard fields (configurable per landing page)
  firstName: String,               // Required if enabled
  lastName: String,                // Required if enabled
  email: String,                   // Required if enabled
  phone: String,                   // Optional if enabled
  company: String,                 // Optional if enabled
  message: String,                 // Optional if enabled
  
  // Dynamic form fields data
  dynamicFields: Map,              // Stores custom field values
  
  // Lead tracking
  landingPage: ObjectId,           // Reference to landing page
  status: String,                  // Lead status
  source: String,                  // Lead source
  ipAddress: String,               // Visitor IP
  userAgent: String,               // Visitor user agent
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Landing Page Form Configuration

#### Get Form Configuration
```
GET /api/landing-pages/:id/form-config
```
Returns the form field configuration for a specific landing page.

#### Update Form Fields
```
PUT /api/landing-pages/:id/form-fields
```
Updates the form field configuration for a landing page.

**Request Body:**
```json
{
  "formFields": [
    {
      "name": "project_type",
      "label": "Project Type",
      "type": "select",
      "required": true,
      "options": [
        {"value": "web_app", "label": "Web Application"},
        {"value": "mobile_app", "label": "Mobile Application"}
      ]
    }
  ],
  "includeDefaultFields": {
    "firstName": true,
    "lastName": true,
    "email": true,
    "phone": false,
    "company": true,
    "message": false
  }
}
```

#### Test Form Submission
```
POST /api/landing-pages/:id/test-form
```
Tests form data against the landing page's configuration without creating a lead.

### Lead Creation

#### Create Lead (Public)
```
POST /api/leads
```
Creates a new lead from form submission.

**Request Body:**
```json
{
  "landingPageId": "landing_page_id",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "project_type": "web_app",
  "budget_range": "25k_50k",
  "project_description": "Need a modern web application..."
}
```

## Usage Examples

### 1. Creating a Landing Page with Custom Form

```javascript
// Create landing page with form configuration
const landingPage = await LandingPage.create({
  name: 'Software Development Services',
  url: 'https://example.com/software-dev',
  includeDefaultFields: {
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    company: true,
    message: false
  },
  formFields: [
    {
      name: 'project_type',
      label: 'Project Type',
      type: 'select',
      required: true,
      options: [
        { value: 'web_app', label: 'Web Application' },
        { value: 'mobile_app', label: 'Mobile Application' }
      ]
    },
    {
      name: 'budget_range',
      label: 'Budget Range',
      type: 'select',
      required: true,
      options: [
        { value: 'under_10k', label: 'Under $10,000' },
        { value: '10k_25k', label: '$10,000 - $25,000' }
      ]
    }
  ]
});
```

### 2. Submitting a Lead

```javascript
// Submit lead with dynamic form data
const lead = await Lead.create({
  firstName: 'John',
  lastName: 'Smith',
  email: 'john@company.com',
  phone: '+1-555-0123',
  company: 'TechCorp Inc.',
  landingPage: landingPageId,
  dynamicFields: new Map([
    ['project_type', 'web_app'],
    ['budget_range', '25k_50k']
  ])
});
```

### 3. Retrieving Lead Data

```javascript
// Get lead with all form data
const lead = await Lead.findById(leadId).populate('landingPage');

// Access standard fields
console.log(lead.firstName, lead.email);

// Access dynamic fields
lead.dynamicFields.forEach((value, key) => {
  console.log(`${key}: ${value}`);
});

// Use virtual field for all form data
console.log(lead.allFormData);
```

## Frontend Integration

### Form Field Types

#### Text Input
```javascript
<input
  type="text"
  name="field_name"
  placeholder="Enter value"
  required={field.required}
/>
```

#### Select Dropdown
```javascript
<select name="field_name" required={field.required}>
  <option value="">Select option</option>
  {field.options.map(option => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))}
</select>
```

#### Checkbox Group
```javascript
{field.options.map(option => (
  <label key={option.value}>
    <input
      type="checkbox"
      name="field_name"
      value={option.value}
    />
    {option.label}
  </label>
))}
```

#### Radio Buttons
```javascript
{field.options.map(option => (
  <label key={option.value}>
    <input
      type="radio"
      name="field_name"
      value={option.value}
      required={field.required}
    />
    {option.label}
  </label>
))}
```

### Form Submission

```javascript
const handleSubmit = async (formData) => {
  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        landingPageId: 'your_landing_page_id',
        ...formData
      })
    });
    
    if (response.ok) {
      console.log('Lead submitted successfully');
    }
  } catch (error) {
    console.error('Error submitting lead:', error);
  }
};
```

## Testing

Run the test script to see the system in action:

```bash
cd super_Backend
node scripts/testDynamicForms.js
```

This script will:
1. Create a sample landing page with custom form fields
2. Create test leads with dynamic form data
3. Demonstrate the data structure and validation

## Best Practices

1. **Field Naming**: Use descriptive, lowercase names with underscores (e.g., `project_type`, `budget_range`)
2. **Validation**: Always validate required fields and data types
3. **Field Types**: Choose appropriate field types for the data you're collecting
4. **Options**: Provide clear, descriptive labels for select/radio options
5. **Performance**: Use indexes on frequently queried fields
6. **Security**: Validate and sanitize all form inputs

## Migration

If you have existing landing pages and leads, you can migrate them to the new system:

1. Update existing landing pages to include `formFields: []` and `includeDefaultFields`
2. Existing leads will continue to work with the new schema
3. Gradually add custom form fields to landing pages as needed

## Troubleshooting

### Common Issues

1. **Field not saving**: Check if the field name matches the `formFields` configuration
2. **Validation errors**: Ensure required fields are provided and meet validation rules
3. **Data not displaying**: Check if the `dynamicFields` Map is properly populated
4. **API errors**: Verify the landing page ID and form field structure

### Debug Tips

1. Use the test form endpoint to validate form data
2. Check the landing page's form configuration
3. Verify the lead's `dynamicFields` Map structure
4. Use the virtual `allFormData` field to see all form data

## Support

For questions or issues with the dynamic form system, check:
1. API response error messages
2. Database schema validation
3. Form field configuration
4. Lead data structure
