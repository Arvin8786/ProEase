export type Role = 'admin' | 'manager' | 'owner' | 'hr_manager' | 'storekeeper' | 'sales' | 'employee' | 'requester' | 'cashier';

export type DepartmentType = 
  | 'HR'
  | 'Sales'
  | 'Warehouse'
  | 'Retail'
  | 'Operations'
  | 'Finance'
  | 'IT'
  | 'Logistics'
  | 'Executive'
  | 'General';

export interface DepartmentInfo {
  code: string;
  name: string;
  description: string;
}

export const DEPARTMENT_CODES: DepartmentInfo[] = [
  { code: 'DEPT-LOG', name: 'Logistics & Supply Chain', description: 'Fleet, distribution, and freight' },
  { code: 'DEPT-HR', name: 'Human Resources', description: 'Personnel, recruiting, and welfare' },
  { code: 'DEPT-FIN', name: 'Finance & Accounting', description: 'Billing, treasury, and audit' },
  { code: 'DEPT-WH', name: 'Warehouse & Storage', description: 'Material handling and stores' },
  { code: 'DEPT-IT', name: 'Information Technology', description: 'Systems, network, and hardware' },
  { code: 'DEPT-OPS', name: 'Operations & Production', description: 'Assembly and plant maintenance' },
  { code: 'DEPT-SALES', name: 'Sales & Marketing', description: 'Commercial accounts and retail' },
  { code: 'DEPT-EXEC', name: 'Executive & Admin', description: 'Corporate governance and legal' },
];

export interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  category?: string;
  isInEcosystem: boolean; // registered on the digital portal
  paymentTerms?: string;
}

export interface PurchaseRequestItem {
  itemId: string;
  productCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  vendorCode: string;
  vendorName: string;
  materialQuotedPrice: number;
  totalQuotedPrice: number;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  departmentCode: string;
  departmentName?: string;
  deliveryDate: string; // YYYY-MM-DD
  status: 'pending' | 'approved' | 'rejected' | 'ordered';
  items: PurchaseRequestItem[];
  totalEstimatedCost: number;
  notes?: string;
  poNumber?: string | null;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: any;
}

export interface PurchaseOrderItem {
  itemId: string;
  productCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  receivedQty?: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  prId: string;
  prNumber: string;
  vendorCode: string;
  vendorName: string;
  vendorEmail?: string;
  isEcosystemVendor: boolean;
  deliveryDate: string;
  departmentCode: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: 'issued' | 'partially_received' | 'completed' | 'cancelled';
  approvedBy: string;
  approvedAt: string;
  routedToVendorPortal?: boolean;
  routedAt?: string;
  createdAt: any;
}

export interface VendorOrder {
  id: string;
  poNumber: string;
  vendorCode: string;
  vendorName: string;
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
  items: PurchaseOrderItem[];
  status: 'new' | 'acknowledged' | 'in_transit' | 'delivered';
  sentAt: any;
}

export interface GoodsReceiptItem {
  itemId: string;
  productCode: string;
  itemName: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  unitPrice?: number;
}

export interface GoodsReceipt {
  id: string;
  grNumber: string;
  poNumber: string;
  prId?: string;
  invoiceNumber: string; // Physical supplier invoice number
  vendorCode?: string;
  vendorName: string;
  items: GoodsReceiptItem[];
  receivedBy: string;
  receivedById?: string;
  receivedAt: any;
  isPosted: boolean;
  postedAt?: any;
  notes?: string;
}

export type IssuanceType = 'internal' | 'external';

export interface GoodsIssuanceItem {
  itemId: string;
  productCode: string;
  itemName: string;
  quantity: number;
  unit: string;
}

export interface GoodsIssuance {
  id: string;
  ginNumber: string;
  type: IssuanceType;
  departmentCode?: string;
  departmentName?: string;
  issuedTo?: string;
  reasoning?: string;
  externalRecipient?: string;
  items: GoodsIssuanceItem[];
  issuedBy: string;
  issuedById?: string;
  issuedAt: any;
  stockDeducted?: boolean;
  status: 'completed' | 'pending_approval' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: any;
  rejectionReason?: string;
  notes?: string;
}

export interface LeaveBalance {
  annual: number; // default 14
  sick: number;   // default 14
  emergency: number; // default 5
  unpaid: number; // default 30
}

export interface CustomPermissions {
  // Procurement & Inventory
  canCreatePR: boolean;
  canApprovePR: boolean;
  canKeyGR: boolean;
  canPostGR: boolean;
  canIssueInternalGoods: boolean;
  canIssueExternalGoods: boolean;
  canEditInventoryMaster: boolean;
  canPerformMassUpload: boolean;
  // POS Operations
  canReprintReceipts: boolean;
  canVoidPOSTransaction: boolean;
  canOverridePOSPrice: boolean;
  canHoldParkCart: boolean;
  // HR & Financials
  canApproveLeaves: boolean;
  canManagePayroll: boolean;
  canViewSalesReports: boolean;
  canManageAccounting: boolean;
  canManageRoster: boolean;
}

export interface BusinessSettings {
  companyName: string;
  registrationNumber: string;
  taxId: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string;
  operatingCountry: 'SG' | 'MY';
  headerTagline: string;
  footerNote: string;
  isPremiumSubscriber?: boolean;
  officeLatitude?: number;
  officeLongitude?: number;
  geofenceRadiusMeters?: number;
  authorizedWifiBssids?: string[];
  authorizedWifiSsid?: string;
  currencySymbol?: string;
  gstRate?: number; // e.g. 9 for SG
  sstRate?: number; // e.g. 8 for MY
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  employeeId?: string; // Unique employee ID assigned by Director/Owner
  role: Role;
  customPermissions?: Partial<CustomPermissions>;
  department?: string;
  position?: string;
  superiorId?: string;
  superiorName?: string;
  phone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  leaveBalance?: LeaveBalance;
  hourlyRate?: number;
  isHourlyWageWorker?: boolean;
  createdAt?: string;
}

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  department: string;
  position: string;
  superiorId?: string;
  superiorName?: string;
  joinDate: string;
  salary: number;
  status: 'active' | 'on_leave' | 'terminated';
  leaveBalance?: LeaveBalance;
}

export type LeaveType = 'annual' | 'sick' | 'emergency' | 'unpaid' | 'maternity_paternity';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  department?: string;
  superiorId?: string;
  superiorName?: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  rejectionReason?: string;
  appliedAt?: string;
  reviewedAt?: string;
}

export interface Appraisal {
  id: string;
  employeeId: string;
  employeeName?: string;
  reviewPeriod: string;
  rating: number;
  comments: string;
  reviewerId: string;
  date: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  month: string;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: 'draft' | 'paid';
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  currentStock: number;
  minStock: number;
  category: string;
  lastUpdated: any;
  unitPrice?: number;
  materialQuotedPrice?: number;
  productCode?: string;
  vendorCode?: string;
  vendorName?: string;
  barcode?: string;
  isMarkdownEligible?: boolean;
  tags?: string[];
  imageUrl?: string;
}

export interface SalesOrderItem {
  itemId: string;
  itemName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerId?: string;
  salesRepId: string;
  salesRepName: string;
  orderDate: string;
  status: 'draft' | 'quotation' | 'confirmed' | 'dispatched' | 'paid';
  items: SalesOrderItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address?: string;
  status: 'lead' | 'active' | 'inactive';
  creditLimit?: number;
  createdAt?: string;
}

export const DEPARTMENTS = [
  'HR',
  'Sales',
  'Warehouse',
  'Operations',
  'Finance',
  'IT',
  'Executive'
] as const;

export const POSITIONS_BY_DEPARTMENT: Record<string, string[]> = {
  HR: [
    'HR Director',
    'HR Manager',
    'HR Senior Executive',
    'Talent Acquisition Specialist',
    'Payroll Officer',
    'HR Generalist'
  ],
  Sales: [
    'Sales Director',
    'Sales Manager',
    'Key Account Manager',
    'Senior Sales Executive',
    'Sales Representative',
    'Business Development Associate'
  ],
  Warehouse: [
    'Warehouse Director',
    'Warehouse Supervisor',
    'Storekeeper',
    'Inventory Controller',
    'Logistics Coordinator',
    'Material Handler'
  ],
  Operations: [
    'Operations Manager',
    'Operations Lead',
    'Supply Chain Analyst',
    'Process Specialist',
    'General Operations Staff'
  ],
  Finance: [
    'Finance Manager',
    'Senior Accountant',
    'Accounts Payable Officer',
    'Accounts Receivable Specialist',
    'Financial Analyst'
  ],
  IT: [
    'IT Manager',
    'ERP Systems Administrator',
    'IT Support Specialist',
    'Database Administrator'
  ],
  Executive: [
    'Managing Director',
    'Chief Executive Officer',
    'General Manager',
    'Department Head'
  ],
  Retail: [
    'Store Manager',
    'POS Supervisor',
    'Head Cashier',
    'Cashier',
    'Customer Service Lead'
  ]
};

// --- POS Terminal Module Types ---

export interface CartItem {
  id: string; // matches item id
  sku: string;
  name: string;
  barcode?: string;
  unit: string;
  currentStock: number;
  originalPrice: number;
  unitPrice: number; // effective current selling price
  quantity: number;
  discount: number; // total discount amount on this line
  markdownApplied?: boolean;
  markdownPercent?: number;
  memberDiscountApplied?: boolean;
  priceOverridden?: boolean;
  overrideSupervisor?: string;
  overrideReason?: string;
  total: number;
}

export interface CustomerMembership {
  id: string;
  membershipId: string;
  name: string;
  phone: string;
  email?: string;
  tier: 'Silver' | 'Gold' | 'Platinum' | 'VIP';
  discountPercent: number;
  points: number;
  joinedDate: string;
}

export interface TimedMarkdownRule {
  id: string;
  name: string;
  startHour: number; // 0-23
  endHour: number;   // 0-23
  discountPercent: number; // e.g. 20 for 20%
  targetTag?: string; // 'clearance' | 'perishable' | 'all'
  targetCategories?: string[]; // e.g. ['Beverages', 'Bakery', 'All']
  isActive: boolean;
  description?: string;
}

export interface SalesTransactionItem {
  itemId: string;
  sku: string;
  name: string;
  barcode?: string;
  unit: string;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
  discount: number;
  priceOverridden?: boolean;
  overrideSupervisor?: string;
  total: number;
}

export interface SalesTransaction {
  id: string;
  transactionNumber: string;
  cashierId: string;
  cashierName: string;
  items: SalesTransactionItem[];
  subtotal: number;
  discounts: number;
  markdownDiscount: number;
  memberDiscount: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'qr_pay' | 'credit';
  amountTendered: number;
  changeDue: number;
  membershipId?: string;
  memberName?: string;
  memberTier?: string;
  pointsEarned: number;
  timestamp: string; // ISO string
  notes?: string;
}

// --- Attendance & Geofenced Clock Logs ---

export interface ClockLog {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName: string;
  userUid?: string;
  department?: string;
  type: 'clock_in' | 'clock_out' | 'in' | 'out';
  timestamp: any; // ISO string or Timestamp
  originalTimestamp?: any;
  isAdjusted?: boolean;
  auditHistory?: ClockLogAuditEntry[];
  latitude?: number;
  longitude?: number;
  distanceFromOfficeMeters?: number;
  hoursWorked?: number;
  overtimeHours?: number;
  isWithinGeofence?: boolean;
  isWifiVerified?: boolean;
  wifiBssid?: string;
  wifiSsid?: string;
  verifiedMethod?: 'geofence' | 'wifi' | 'manual_override' | string;
  isVerified?: boolean;
  notes?: string;
}

// --- Automated Shift Rostering ---

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  userUid?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  shiftType?: 'morning' | 'afternoon' | 'night' | 'split' | 'full' | string;
  department?: string;
  role?: string;
  location?: string;
  hours?: number;
  isPublished?: boolean;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  createdAt?: any;
}

// --- Claims Management with OCR ---

export interface ExpenseClaim {
  id: string;
  claimNumber?: string;
  employeeId: string;
  employeeCode?: string;
  employeeName: string;
  department?: string;
  userUid?: string;
  merchantName?: string;
  description?: string;
  claimDate?: string;
  transactionDate?: string; // YYYY-MM-DD
  category: 'travel' | 'meals' | 'supplies' | 'client_entertainment' | 'utilities' | 'other' | string;
  amount: number;
  currency?: string;
  taxAmount?: number;
  receiptImageUrl?: string;
  receiptUrl?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: any;
}

// --- Confidential Workplace Feedback ---

export interface WorkplaceFeedback {
  id: string;
  isAnonymous: boolean;
  authorName?: string;
  authorEmail?: string;
  authorUid?: string;
  subject: string;
  category: 'ethics' | 'grievance' | 'safety' | 'suggestion' | 'general';
  message: string;
  createdAt: any;
  status: 'unread' | 'investigating' | 'resolved';
  directorNotes?: string;
}

// --- General Ledger & Double-Entry Accounting ---

export interface LedgerEntry {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface LedgerJournal {
  id: string;
  voucherNumber: string;
  date: string; // YYYY-MM-DD
  description?: string;
  memo?: string;
  source?: 'pos' | 'goods_receipt' | 'ap_disbursement' | 'ar_settlement' | 'payroll' | 'manual' | string;
  sourceType?: string;
  referenceId?: string;
  entries: LedgerEntry[];
  totalAmount?: number;
  totalDebit?: number;
  totalCredit?: number;
  createdBy: string;
  createdAt: any;
}

export interface DepartmentMaster {
  id: string;
  code: string;
  name: string;
  managerName?: string;
  location?: string;
  active: boolean;
}

// --- Accounts Payable & Accounts Receivable ---

export interface APInvoice {
  id: string;
  invoiceNumber: string;
  vendorCode: string;
  vendorName: string;
  grNumber?: string;
  poNumber?: string;
  issueDate: string;
  dueDate: string;
  creditTermsDays: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  paymentReleaseDate?: string;
  paymentMethod?: string;
  createdAt: any;
}

export interface ARInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerTaxId?: string;
  customerEmail?: string;
  issueDate: string;
  dueDate: string;
  creditTermsDays: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountReceived: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue';
  eInvoiceFormat?: 'InvoiceNow_Peppol' | 'MyInvois_LHDN';
  peppolPayload?: string;
  myInvoisPayload?: string;
  createdAt: any;
}

// --- Parked POS Carts & Tabs ---

export interface ParkedCart {
  id: string;
  tabName: string;
  cashierId: string;
  cashierName: string;
  items: CartItem[];
  customerMembership?: CustomerMembership | null;
  parkedAt: string;
  total: number;
}

// --- PO Amendment Requests ---

export interface PoAmendRequest {
  id: string;
  poNumber: string;
  poId?: string;
  vendorName?: string;
  requestedBy: string;
  requestedById: string;
  justification: string;
  proposedChanges: string;
  attachmentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: any;
  reviewNotes?: string;
  createdAt: any;
}

// --- Inventory Cycle Counting ---

export interface CycleCountItem {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  systemStock: number;
  countedQty: number;
  variance: number;
  unitPrice: number;
  varianceValue: number;
  notes?: string;
}

export interface CycleCountSession {
  id: string;
  cycleNumber: string;
  scheduleType: 'weekly' | 'monthly';
  targetDate: string;
  department?: string;
  status: 'draft' | 'in_progress' | 'supervisor_verified' | 'owner_approved' | 'adjusted';
  items: CycleCountItem[];
  countedBy: string;
  countedById?: string;
  supervisorName?: string;
  supervisorVerifiedAt?: any;
  ownerApprovedBy?: string;
  ownerApprovedAt?: any;
  discrepanciesCount?: number;
  totalVarianceValue?: number;
  notes?: string;
  createdAt: any;
}

export interface ClockLogAuditEntry {
  adjustedBy: string;
  adjustedByName: string;
  previousTimestamp: any;
  newTimestamp: any;
  previousType?: string;
  newType?: string;
  reason: string;
  adjustedAt: any;
}


