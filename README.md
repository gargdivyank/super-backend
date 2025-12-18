# Admin Panel Backend

A complete backend system for managing an admin panel with super admin and sub admin functionality, built with Node.js, Express.js, and MongoDB.

## Features

### Super Admin Capabilities
- Access to all landing pages and leads
- Approve/reject sub admin registration requests
- Create sub admins directly
- Grant/revoke landing page access to sub admins
- Manage landing pages (CRUD operations)
- View comprehensive statistics and reports

### Sub Admin Capabilities
- Register and wait for super admin approval
- Access only assigned landing pages
- View and manage leads from assigned landing pages
- Update lead status and details
- View statistics for assigned landing pages

### Landing Page Management
- Create and manage multiple landing pages
- Track leads from different landing pages
- Comprehensive analytics and reporting

### Lead Management
- Capture leads from landing pages
- Track lead status (new, contacted, qualified, converted, lost)
- Advanced filtering and search capabilities
- Pagination support

## Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd admin-panel-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   - Copy `config.env` and update the values:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/admin_panel
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   JWT_EXPIRE=7d
   NODE_ENV=development
   ```

4. **Database Setup**
   - Ensure MongoDB is running
   - Run the setup script to create initial super admin:
   ```bash
   node scripts/setup.js
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new sub admin
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/updatedetails` - Update user details
- `PUT /api/auth/updatepassword` - Update password

### Admin Management (Super Admin Only)
- `GET /api/admin/pending-requests` - Get pending sub admin requests
- `PUT /api/admin/approve-user/:id` - Approve sub admin request
- `PUT /api/admin/reject-user/:id` - Reject sub admin request
- `POST /api/admin/create-sub-admin` - Create sub admin directly
- `POST /api/admin/grant-access` - Grant landing page access
- `PUT /api/admin/revoke-access/:id` - Revoke landing page access
- `GET /api/admin/sub-admins` - Get all sub admins with access
- `GET /api/admin/access-records` - Get all access records

### Landing Pages
- `POST /api/landing-pages` - Create landing page (Super Admin only)
- `GET /api/landing-pages` - Get all landing pages
- `GET /api/landing-pages/:id` - Get single landing page
- `PUT /api/landing-pages/:id` - Update landing page (Super Admin only)
- `DELETE /api/landing-pages/:id` - Delete landing page (Super Admin only)
- `GET /api/landing-pages/:id/stats` - Get landing page statistics

### Leads
- `POST /api/leads` - Create new lead (public endpoint)
- `GET /api/leads` - Get all leads (filtered by user role)
- `GET /api/leads/:id` - Get single lead
- `PUT /api/leads/:id/status` - Update lead status
- `PUT /api/leads/:id` - Update lead details
- `DELETE /api/leads/:id` - Delete lead (Super Admin only)
- `GET /api/leads/stats/overview` - Get lead statistics

## Database Models

### User
- Basic info (name, email, password, company)
- Role (super_admin, sub_admin)
- Status (pending, approved, rejected)
- Approval tracking

### LandingPage
- Basic info (name, URL, description)
- Status (active, inactive)
- Creator tracking

### Lead
- Contact information (name, email, phone, company)
- Message content
- Landing page association
- Status tracking
- Metadata (IP, user agent, timestamps)

### AdminAccess
- Sub admin to landing page mapping
- Access status (active, inactive, revoked)
- Grant/revoke tracking

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Input validation and sanitization
- Protected routes middleware

## Usage Examples

### 1. Sub Admin Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "companyName": "Example Corp"
  }'
```

### 2. Super Admin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@example.com",
    "password": "superadmin123"
  }'
```

### 3. Create Landing Page
```bash
curl -X POST http://localhost:5000/api/landing-pages \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Landing Page",
    "url": "https://product.example.com",
    "description": "Landing page for our main product"
  }'
```

### 4. Grant Access to Sub Admin
```bash
curl -X POST http://localhost:5000/api/admin/grant-access \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subAdminId": "<sub_admin_user_id>",
    "landingPageId": "<landing_page_id>"
  }'
```

## Error Handling

The API includes comprehensive error handling:
- Validation errors with detailed messages
- Authentication and authorization errors
- Database operation errors
- Custom error responses

## Pagination

Most list endpoints support pagination:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

## Search and Filtering

Leads and landing pages support:
- Text search
- Status filtering
- Date range filtering
- Landing page filtering

## Development

### Project Structure
```
admin-panel-backend/
├── models/          # Database models
├── routes/          # API route handlers
├── middleware/      # Custom middleware
├── utils/           # Utility functions
├── scripts/         # Setup and utility scripts
├── config.env       # Environment configuration
├── package.json     # Dependencies and scripts
├── server.js        # Main server file
└── README.md        # This file
```

### Running Tests
```bash
# Currently no test suite implemented
# Add your preferred testing framework
```

### Code Style
- Use ES6+ features
- Follow Express.js best practices
- Consistent error handling
- Proper input validation

## Production Deployment

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Use strong JWT secret
   - Configure production MongoDB URI

2. **Security**
   - Enable HTTPS
   - Set up proper CORS configuration
   - Implement rate limiting
   - Add request logging

3. **Performance**
   - Enable compression
   - Set up caching
   - Database indexing
   - Load balancing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions, please open an issue in the repository.

## Changelog

### Version 1.0.0
- Initial release
- Complete admin panel functionality
- Super admin and sub admin roles
- Landing page management
- Lead tracking system
- Comprehensive API endpoints 