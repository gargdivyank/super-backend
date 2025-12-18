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
// connect DB (only once)
connectDB();

// routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/landing-pages', landingPageRoutes);
app.use('/api/access-requests', accessRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/sub-admin', subAdminRoutes);

app.get("/api/health", (req, res) => {
  res.json({ message: "Server OK" });
});

// Create serverless handler
const handler = serverless(app);

// Export handler as default for Vercel (serverless deployment)
// Also export app as a property for local development (server.js)
module.exports = handler;
module.exports.app = app;
