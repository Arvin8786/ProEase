import { Role, UserProfile, CustomPermissions } from '../types';
import { 
  LayoutDashboard, 
  Store, 
  ShoppingBag, 
  UserCheck, 
  Users, 
  Package, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShoppingCart,
  Building2,
  Receipt,
  CalendarCheck,
  Sparkles,
  Database,
  LucideIcon
} from 'lucide-react';

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, CustomPermissions> = {
  owner: {
    canCreatePR: true,
    canApprovePR: true,
    canKeyGR: true,
    canPostGR: true,
    canIssueInternalGoods: true,
    canIssueExternalGoods: true,
    canEditInventoryMaster: true,
    canPerformMassUpload: true,
    canReprintReceipts: true,
    canVoidPOSTransaction: true,
    canOverridePOSPrice: true,
    canHoldParkCart: true,
    canApproveLeaves: true,
    canManagePayroll: true,
    canViewSalesReports: true,
    canManageAccounting: true,
    canManageRoster: true,
  },
  admin: {
    canCreatePR: true,
    canApprovePR: true,
    canKeyGR: true,
    canPostGR: true,
    canIssueInternalGoods: true,
    canIssueExternalGoods: true,
    canEditInventoryMaster: true,
    canPerformMassUpload: true,
    canReprintReceipts: true,
    canVoidPOSTransaction: true,
    canOverridePOSPrice: true,
    canHoldParkCart: true,
    canApproveLeaves: true,
    canManagePayroll: true,
    canViewSalesReports: true,
    canManageAccounting: true,
    canManageRoster: true,
  },
  manager: {
    canCreatePR: true,
    canApprovePR: true,
    canKeyGR: true,
    canPostGR: true,
    canIssueInternalGoods: true,
    canIssueExternalGoods: true,
    canEditInventoryMaster: true,
    canPerformMassUpload: true,
    canReprintReceipts: true,
    canVoidPOSTransaction: true,
    canOverridePOSPrice: true,
    canHoldParkCart: true,
    canApproveLeaves: true,
    canManagePayroll: true,
    canViewSalesReports: true,
    canManageAccounting: true,
    canManageRoster: true,
  },
  storekeeper: {
    canCreatePR: true,
    canApprovePR: false,
    canKeyGR: true,
    canPostGR: true,
    canIssueInternalGoods: true,
    canIssueExternalGoods: true,
    canEditInventoryMaster: true,
    canPerformMassUpload: true,
    canReprintReceipts: false,
    canVoidPOSTransaction: false,
    canOverridePOSPrice: false,
    canHoldParkCart: false,
    canApproveLeaves: false,
    canManagePayroll: false,
    canViewSalesReports: false,
    canManageAccounting: false,
    canManageRoster: false,
  },
  cashier: {
    canCreatePR: false,
    canApprovePR: false,
    canKeyGR: false,
    canPostGR: false,
    canIssueInternalGoods: false,
    canIssueExternalGoods: false,
    canEditInventoryMaster: false,
    canPerformMassUpload: false,
    canReprintReceipts: true,
    canVoidPOSTransaction: false,
    canOverridePOSPrice: false,
    canHoldParkCart: true,
    canApproveLeaves: false,
    canManagePayroll: false,
    canViewSalesReports: false,
    canManageAccounting: false,
    canManageRoster: false,
  },
  sales: {
    canCreatePR: true,
    canApprovePR: false,
    canKeyGR: false,
    canPostGR: false,
    canIssueInternalGoods: false,
    canIssueExternalGoods: false,
    canEditInventoryMaster: false,
    canPerformMassUpload: false,
    canReprintReceipts: true,
    canVoidPOSTransaction: false,
    canOverridePOSPrice: false,
    canHoldParkCart: true,
    canApproveLeaves: false,
    canManagePayroll: false,
    canViewSalesReports: true,
    canManageAccounting: false,
    canManageRoster: false,
  },
  hr_manager: {
    canCreatePR: true,
    canApprovePR: false,
    canKeyGR: false,
    canPostGR: false,
    canIssueInternalGoods: true,
    canIssueExternalGoods: false,
    canEditInventoryMaster: false,
    canPerformMassUpload: false,
    canReprintReceipts: false,
    canVoidPOSTransaction: false,
    canOverridePOSPrice: false,
    canHoldParkCart: false,
    canApproveLeaves: true,
    canManagePayroll: true,
    canViewSalesReports: false,
    canManageAccounting: false,
    canManageRoster: true,
  },
  employee: {
    canCreatePR: true,
    canApprovePR: false,
    canKeyGR: false,
    canPostGR: false,
    canIssueInternalGoods: false,
    canIssueExternalGoods: false,
    canEditInventoryMaster: false,
    canPerformMassUpload: false,
    canReprintReceipts: false,
    canVoidPOSTransaction: false,
    canOverridePOSPrice: false,
    canHoldParkCart: false,
    canApproveLeaves: false,
    canManagePayroll: false,
    canViewSalesReports: false,
    canManageAccounting: false,
    canManageRoster: false,
  },
  requester: {
    canCreatePR: true,
    canApprovePR: false,
    canKeyGR: false,
    canPostGR: false,
    canIssueInternalGoods: false,
    canIssueExternalGoods: false,
    canEditInventoryMaster: false,
    canPerformMassUpload: false,
    canReprintReceipts: false,
    canVoidPOSTransaction: false,
    canOverridePOSPrice: false,
    canHoldParkCart: false,
    canApproveLeaves: false,
    canManagePayroll: false,
    canViewSalesReports: false,
    canManageAccounting: false,
    canManageRoster: false,
  },
};

/**
 * Unified helper: hasPermission(user, permissionKey)
 * Checks whether user has permission by manual override or base role defaults.
 */
export function hasPermission(
  user: UserProfile | null | undefined, 
  permissionKey: keyof CustomPermissions
): boolean {
  if (!user) return false;

  // Executive bypass for Owner, Admin, or initial admin account
  if (
    user.email === 'arvin8786@gmail.com' || 
    user.role === 'admin' || 
    user.role === 'owner' ||
    user.position?.toLowerCase().includes('director')
  ) {
    return true;
  }

  // 1. Check explicit manual override in customPermissions
  if (user.customPermissions && typeof user.customPermissions[permissionKey] === 'boolean') {
    return user.customPermissions[permissionKey] as boolean;
  }

  // 2. Fall back to role-based permission
  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[user.role];
  return roleDefaults ? !!roleDefaults[permissionKey] : false;
}

export interface ModuleDefinition {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  allowedRoles?: Role[];
  allowedDepartments?: string[];
  requiredPermission?: keyof CustomPermissions;
  badge?: string;
  directorOnly?: boolean;
}

export const ERP_MODULES: ModuleDefinition[] = [
  {
    id: 'dashboard',
    label: 'Executive Dashboard',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
    description: 'System-wide KPI analytics, stock warnings, and operations overview',
    allowedRoles: ['admin', 'owner', 'manager', 'sales', 'storekeeper', 'hr_manager', 'employee', 'requester', 'cashier'],
  },
  {
    id: 'pos',
    label: 'POS Register Terminal',
    shortLabel: 'POS Terminal',
    icon: Store,
    description: 'Retail checkout, barcode scanning, loyalty memberships, and receipts',
    allowedRoles: ['admin', 'owner', 'manager', 'cashier', 'sales', 'storekeeper'],
    requiredPermission: 'canHoldParkCart',
    badge: 'Retail',
  },
  {
    id: 'sales',
    label: 'Sales & Customers',
    shortLabel: 'Sales Orders',
    icon: ShoppingBag,
    description: 'Quotations, B2B wholesale orders, invoices, and client accounts',
    allowedRoles: ['admin', 'owner', 'manager', 'sales'],
    allowedDepartments: ['Sales', 'Commercial'],
    requiredPermission: 'canViewSalesReports',
  },
  {
    id: 'accounting',
    label: 'Finance & General Ledger',
    shortLabel: 'Accounting',
    icon: Receipt,
    description: 'Double-entry GL, AP/AR, Tax summaries, and E-Invoicing compliance',
    allowedRoles: ['admin', 'owner', 'manager'],
    allowedDepartments: ['Finance', 'Executive'],
    requiredPermission: 'canManageAccounting',
    badge: 'Finance',
  },
  {
    id: 'self-service',
    label: 'My Workspace (ESS)',
    shortLabel: 'My Workspace',
    icon: UserCheck,
    description: 'Geofenced clock-in, personal profile, claims OCR, payslips, and feedback',
    allowedRoles: ['admin', 'owner', 'manager', 'cashier', 'storekeeper', 'sales', 'hr_manager', 'employee', 'requester'],
  },
  {
    id: 'roster',
    label: 'Shift Roster & Attendance',
    shortLabel: 'Shift Roster',
    icon: CalendarCheck,
    description: 'Interactive shift schedule builder with rule conflict validation',
    allowedRoles: ['admin', 'owner', 'manager', 'hr_manager'],
    allowedDepartments: ['HR', 'Operations'],
    requiredPermission: 'canManageRoster',
  },
  {
    id: 'hrm',
    label: 'HR Management Suite',
    shortLabel: 'HR & Payroll',
    icon: Users,
    description: 'Employee directory, manual permission matrix, leaves, and automated payroll',
    allowedRoles: ['admin', 'owner', 'manager', 'hr_manager'],
    allowedDepartments: ['HR'],
    requiredPermission: 'canManagePayroll',
  },
  {
    id: 'inventory',
    label: 'Inventory Master',
    shortLabel: 'Inventory',
    icon: Package,
    description: 'Product catalog, pricing, SKU tracking, Excel mass upload/download',
    allowedRoles: ['admin', 'owner', 'manager', 'storekeeper'],
    allowedDepartments: ['Warehouse', 'Logistics'],
    requiredPermission: 'canEditInventoryMaster',
  },
  {
    id: 'goods-receipt',
    label: 'Goods Receipt (GRN)',
    shortLabel: 'Goods Receipt',
    icon: ArrowDownLeft,
    description: 'Warehouse inbound shipments, vendor invoice verification, atomic post',
    allowedRoles: ['admin', 'owner', 'manager', 'storekeeper'],
    allowedDepartments: ['Warehouse', 'Logistics'],
    requiredPermission: 'canKeyGR',
  },
  {
    id: 'goods-issuance',
    label: 'Goods Issuance (GIN)',
    shortLabel: 'Goods Issuance',
    icon: ArrowUpRight,
    description: 'Internal departmental requisitions & external approval issuance',
    allowedRoles: ['admin', 'owner', 'manager', 'storekeeper'],
    allowedDepartments: ['Warehouse', 'Logistics'],
    requiredPermission: 'canIssueInternalGoods',
  },
  {
    id: 'purchase-requests',
    label: 'Purchase Requests',
    shortLabel: 'Purchase Req.',
    icon: ShoppingCart,
    description: 'Departmental purchasing requisitions, self-approval, and PO routing',
    allowedRoles: ['admin', 'owner', 'manager', 'storekeeper', 'sales', 'hr_manager', 'employee', 'requester'],
    allowedDepartments: ['Warehouse', 'Logistics', 'Operations', 'Finance'],
    requiredPermission: 'canCreatePR',
  },
  {
    id: 'business-settings',
    label: 'Business Setup & Branding',
    shortLabel: 'Company Setup',
    icon: Building2,
    description: 'Master organization details, tax IDs, and document branding engine',
    allowedRoles: ['admin', 'owner'],
    directorOnly: true,
    badge: 'Admin',
  },
  {
    id: 'executive-ai',
    label: 'Executive AI Analytics',
    shortLabel: 'AI Analytics',
    icon: Sparkles,
    description: 'AI-driven SME margin diagnostics, dead stock forecasting, and anomaly detection',
    allowedRoles: ['admin', 'owner', 'manager'],
    allowedDepartments: ['Executive', 'Finance', 'Operations'],
    badge: 'Gemini AI',
  },
  {
    id: 'master-data',
    label: 'Master Data & XLSX Hub',
    shortLabel: 'Master Data',
    icon: Database,
    description: 'Departments, Vendors, and Inventory Master with Excel mass import/export',
    allowedRoles: ['admin', 'owner', 'manager', 'storekeeper'],
    allowedDepartments: ['Warehouse', 'Logistics', 'Finance'],
    badge: 'Data',
  },
];

export function canAccessModule(
  moduleId: string, 
  profile: UserProfile | null | undefined
): boolean {
  if (!profile) return false;

  const isDirectorOrOwner = 
    profile.email === 'arvin8786@gmail.com' || 
    profile.role === 'admin' || 
    profile.role === 'owner' ||
    profile.position?.toLowerCase().includes('director');

  // Super Admin / Owner / Director executive bypass
  if (isDirectorOrOwner) {
    return true;
  }

  const mod = ERP_MODULES.find(m => m.id === moduleId);
  if (!mod) return false;

  // Director/Owner only restriction
  if (mod.directorOnly) {
    return false;
  }

  // Permission override check: if module defines a requiredPermission, check hasPermission
  if (mod.requiredPermission) {
    if (hasPermission(profile, mod.requiredPermission)) {
      return true;
    }
  }

  // Check role
  if (mod.allowedRoles && mod.allowedRoles.includes(profile.role)) {
    return true;
  }

  // Check department if specified
  if (mod.allowedDepartments && profile.department && mod.allowedDepartments.includes(profile.department)) {
    return true;
  }

  return false;
}

export function getDefaultTabForRole(profile: UserProfile | null | undefined): string {
  if (!profile) return 'self-service';
  if (profile.role === 'cashier') return 'pos';
  if (profile.role === 'storekeeper') return 'inventory';
  if (profile.role === 'hr_manager') return 'hrm';
  if (profile.role === 'sales') return 'sales';
  return 'dashboard';
}

export function getVisibleModules(profile: UserProfile | null | undefined): ModuleDefinition[] {
  return ERP_MODULES.filter(mod => canAccessModule(mod.id, profile));
}
