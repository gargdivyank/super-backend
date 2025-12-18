const express = require("express");
const serverless = require("serverless-http");
const path = require("path");

// Load environment variables - works for both local (.env) and Vercel (env vars)
try {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
} catch (e) {
  // .env file not found (normal on Vercel), use environment variables instead
  // Vercel automatically provides environment variables from dashboard
}

const cors = require('cors');
const connectDB = require("../config/database");
const mongoose = require("mongoose");

// import routes
const authRoutes = require("../routes/auth");
const adminRoutes = require("../routes/admin");
const leadRoutes = require("../routes/leads");
const landingPageRoutes = require("../routes/landingPages");
const accessRequestRoutes = require("../routes/accessRequests");
const dashboardRoutes = require("../routes/dashboard");
const superAdminRoutes = require("../routes/superAdmin");
const subAdminRoutes = require("../routes/subAdmin");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect DB - handle it gracefully for serverless
let dbConnected = false;
const ensureDBConnection = async () => {
  if (!dbConnected && mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      dbConnected = mongoose.connection.readyState === 1;
    } catch (error) {
      console.error("Database connection error:", error);
    }
  }
};

// Middleware to ensure DB connection before handling requests
app.use(async (req, res, next) => {
  await ensureDBConnection();
  next();
});

// Root route
app.get("/", (req, res) => {
  res.json({ 
    message: "API Server is running",
    status: "OK",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      admin: "/api/admin",
      leads: "/api/leads",
      landingPages: "/api/landing-pages"
    }
  });
});

// Health check route
app.get("/api/health", async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbConnected = dbStatus === 1;
  
  res.json({ 
    message: "Server OK",
    database: dbConnected ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString()
  });
});

// routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/landing-pages', landingPageRoutes);
app.use('/api/access-requests', accessRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/sub-admin', subAdminRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    message: "Route not found",
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Create serverless handler
const handler = serverless(app);

// Export handler as default for Vercel (serverless deployment)
// Also export app as a property for local development (server.js)
module.exports = handler;
module.exports.app = app;
