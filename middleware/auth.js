const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { resolveUserPermissions } = require('../constants/permissions');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Grant access to users that own one (or more) required permissions.
exports.authorizePermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    // Keep super admins backward-compatible even if legacy rows have no permissions.
    if (req.user.role === 'super_admin') {
      return next();
    }

    const userPermissions = resolveUserPermissions(req.user);
    const hasRequiredPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
};

// Check if user is approved
exports.checkApproval = async (req, res, next) => {
  if (req.user.role === 'sub_admin' && req.user.status !== 'approved') {
    return res.status(403).json({
      success: false,
      message: 'Your account is pending approval or has been rejected'
    });
  }
  next();
}; 