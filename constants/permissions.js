const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',
  LEADS_VIEW: 'leads.view',
  LEADS_EDIT: 'leads.edit',
  ANALYTICS_VIEW: 'analytics.view',
  LANDING_PAGES_VIEW: 'landingPages.view',
  LANDING_PAGES_MANAGE: 'landingPages.manage',
  SUB_ADMINS_VIEW: 'subAdmins.view',
  SUB_ADMINS_MANAGE: 'subAdmins.manage',
  PROFILE_VIEW: 'profile.view',
  PROFILE_EDIT: 'profile.edit'
});

const DEFAULT_PERMISSIONS_BY_ROLE = Object.freeze({
  super_admin: Object.values(PERMISSIONS),
  sub_admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.SUB_ADMINS_VIEW,
    PERMISSIONS.SUB_ADMINS_MANAGE,
    PERMISSIONS.PROFILE_VIEW,
    PERMISSIONS.PROFILE_EDIT
  ]
});

function getDefaultPermissions(role) {
  return DEFAULT_PERMISSIONS_BY_ROLE[role] || [];
}

function normalizePermissions(input) {
  if (!Array.isArray(input)) return [];
  const validPermissions = new Set(Object.values(PERMISSIONS));
  return [...new Set(input)].filter((p) => validPermissions.has(p));
}

function resolveUserPermissions(user) {
  const explicitPermissions = normalizePermissions(user?.permissions);
  // If explicit permissions were saved, use only those (no merge with role defaults).
  if (explicitPermissions.length > 0) {
    return explicitPermissions;
  }
  // Explicit empty array = no module access (sub-admins created with minimal rights).
  if (Array.isArray(user?.permissions) && user.permissions.length === 0) {
    return [];
  }
  return getDefaultPermissions(user?.role);
}

module.exports = {
  PERMISSIONS,
  getDefaultPermissions,
  normalizePermissions,
  resolveUserPermissions
};
