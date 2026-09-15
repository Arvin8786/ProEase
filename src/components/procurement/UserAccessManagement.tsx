import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  Role, 
  CustomPermissions 
} from '../../types';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DEFAULT_ROLE_PERMISSIONS } from '../../lib/rbac';
import { 
  ShieldCheck, 
  Users, 
  Check, 
  Save, 
  RefreshCw, 
  Sliders, 
  Layers, 
  Lock, 
  Unlock,
  Building,
  Briefcase,
  Search,
  Zap,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface UserAccessManagementProps {
  currentUser: UserProfile | null;
}

// Group Policy Templates
export interface PolicyTemplate {
  code: string;
  name: string;
  role: Role;
  description: string;
  permissions: CustomPermissions;
}

export const GROUP_POLICY_TEMPLATES: Record<string, PolicyTemplate> = {
  CASHIER001: {
    code: 'CASHIER001',
    name: 'Retail Cashier Operator',
    role: 'cashier',
    description: 'Dedicated POS Terminal execution, cart holding, and customer checkout.',
    permissions: {
      ...DEFAULT_ROLE_PERMISSIONS.cashier,
      canHoldParkCart: true,
      canReprintReceipts: true,
      canVoidPOSTransaction: false,
      canOverridePOSPrice: false,
    },
  },
  STORE001: {
    code: 'STORE001',
    name: 'Warehouse & Storekeeper',
    role: 'storekeeper',
    description: 'Material stock management, Goods Receipts (GRN), and Goods Issuance (GIN).',
    permissions: {
      ...DEFAULT_ROLE_PERMISSIONS.storekeeper,
      canKeyGR: true,
      canPostGR: true,
      canIssueInternalGoods: true,
      canIssueExternalGoods: true,
      canEditInventoryMaster: true,
      canPerformMassUpload: true,
    },
  },
  PROC001: {
    code: 'PROC001',
    name: 'Procurement Specialist',
    role: 'requester',
    description: 'Purchase requisitions, vendor directory oversight, and material RFQs.',
    permissions: {
      ...DEFAULT_ROLE_PERMISSIONS.requester,
      canCreatePR: true,
      canApprovePR: false,
      canEditInventoryMaster: false,
      canPerformMassUpload: false,
    },
  },
  HR001: {
    code: 'HR001',
    name: 'HR & Roster Coordinator',
    role: 'hr_manager',
    description: 'Shift scheduling, attendance adjustments, employee files, and leave reviews.',
    permissions: {
      ...DEFAULT_ROLE_PERMISSIONS.hr_manager,
      canApproveLeaves: true,
      canManagePayroll: true,
      canManageRoster: true,
    },
  },
  FIN001: {
    code: 'FIN001',
    name: 'Finance & Ledger Accountant',
    role: 'manager',
    description: 'General Ledger, AP invoices, AR settlements, and financial reporting.',
    permissions: {
      ...DEFAULT_ROLE_PERMISSIONS.manager,
      canManageAccounting: true,
      canViewSalesReports: true,
      canApprovePR: true,
    },
  },
  EXEC001: {
    code: 'EXEC001',
    name: 'Executive Director / Owner',
    role: 'owner',
    description: 'Unrestricted enterprise authority across all system modules and gates.',
    permissions: {
      ...DEFAULT_ROLE_PERMISSIONS.owner,
    },
  },
};

// Feature Category Checklist
export const PERMISSION_CATEGORIES: {
  category: string;
  items: { key: keyof CustomPermissions; label: string; description: string }[];
}[] = [
  {
    category: 'Inventory & Procurement',
    items: [
      { key: 'canCreatePR', label: 'Create PR', description: 'Raise purchase requests for items' },
      { key: 'canApprovePR', label: 'Approve PR', description: 'Authorize requisitions and issue POs' },
      { key: 'canKeyGR', label: 'Key In GRN', description: 'Create draft Goods Receipts' },
      { key: 'canPostGR', label: 'Post GRN', description: 'Lock GRN and atomically increment inventory stock' },
      { key: 'canIssueInternalGoods', label: 'Issue Internal Goods', description: 'Disburse stock to internal departments' },
      { key: 'canIssueExternalGoods', label: 'Issue External Goods', description: 'Authorize outbound stock to external entities' },
      { key: 'canEditInventoryMaster', label: 'Edit Inventory Master', description: 'Modify SKU pricing, safety stocks, details' },
      { key: 'canPerformMassUpload', label: 'Mass Import .xlsx', description: 'Batch upload and overwrite via MasterDB.xlsx' },
    ],
  },
  {
    category: 'POS Terminal & Retail Operations',
    items: [
      { key: 'canHoldParkCart', label: 'Park & Hold Carts', description: 'Save and recall active customer transactions' },
      { key: 'canReprintReceipts', label: 'Reprint Past Receipts', description: 'Access transaction history and generate copies' },
      { key: 'canOverridePOSPrice', label: 'Override Unit Prices', description: 'Authorize discretionary unit price modifications' },
      { key: 'canVoidPOSTransaction', label: 'Void / Clear Sales', description: 'Cancel active sales or clear shopping baskets' },
    ],
  },
  {
    category: 'HR, Finance & Operations',
    items: [
      { key: 'canApproveLeaves', label: 'Approve Staff Leaves', description: 'Review and grant employee leave requests' },
      { key: 'canManagePayroll', label: 'Manage Payroll', description: 'Calculate and generate monthly payroll runs' },
      { key: 'canManageRoster', label: 'Manage Shift Rosters', description: 'Create and publish weekly employee shift schedules' },
      { key: 'canViewSalesReports', label: 'View Sales Analytics', description: 'Access commercial revenue and sales KPIs' },
      { key: 'canManageAccounting', label: 'General Ledger / AP / AR', description: 'Post journal vouchers and approve invoices' },
    ],
  },
];

export const UserAccessManagement: React.FC<UserAccessManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [activePermissions, setActivePermissions] = useState<CustomPermissions>({
    ...DEFAULT_ROLE_PERMISSIONS.employee,
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isExecutive = 
    currentUser?.email === 'arvin8786@gmail.com' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'owner' ||
    currentUser?.position?.toLowerCase().includes('director');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const uList = snap.docs.map((d) => d.data() as UserProfile);
      setUsers(uList);
      if (uList.length > 0 && !selectedUser) {
        handleSelectUser(uList[0]);
      }
    });
    return () => unsub();
  }, []);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    const roleDefault = DEFAULT_ROLE_PERMISSIONS[user.role] || DEFAULT_ROLE_PERMISSIONS.employee;
    const merged: CustomPermissions = {
      ...roleDefault,
      ...(user.customPermissions || {}),
    };
    setActivePermissions(merged);
    setSelectedTemplate('');
  };

  const handleApplyTemplate = (templateKey: string) => {
    if (!templateKey || !GROUP_POLICY_TEMPLATES[templateKey]) return;
    const tpl = GROUP_POLICY_TEMPLATES[templateKey];
    setSelectedTemplate(templateKey);
    setActivePermissions({ ...tpl.permissions });
    toast.info(`Applied "${tpl.name}" (${tpl.code}) template settings.`);
  };

  const handleTogglePermission = (key: keyof CustomPermissions) => {
    setActivePermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    if (!isExecutive) {
      toast.error('Access Denied: Only Directors, Owners, or Admins can modify access policies.');
      return;
    }

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      const updates: any = {
        customPermissions: activePermissions,
        updatedAt: serverTimestamp(),
      };
      if (selectedTemplate && GROUP_POLICY_TEMPLATES[selectedTemplate]) {
        updates.role = GROUP_POLICY_TEMPLATES[selectedTemplate].role;
      }
      await updateDoc(userRef, updates);
      toast.success(`Access policy matrix saved for ${selectedUser.displayName || selectedUser.email}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update access permissions: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term) ||
      (u.department || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border-slate-200 shadow-sm bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
        <CardHeader className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold text-white">
                    User Access Management & Feature Matrix
                  </CardTitle>
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">
                    Role-Based Access Control
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-300">
                  Granular feature checkboxes, group policy templates, and dynamic navigation visibility control.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-slate-300 border-slate-700 bg-slate-800/80">
                {users.length} Registered Accounts
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: User Directory (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-3 border-b border-slate-100 bg-slate-50/70">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Staff Directory
                  </span>
                  <span className="text-[11px] text-slate-500">{filteredUsers.length} Users</span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search staff, email, dept..."
                    className="pl-8 h-8 text-xs bg-white"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-2 max-h-[560px] overflow-y-auto space-y-1.5 custom-scrollbar">
              {filteredUsers.map((u) => {
                const isSelected = selectedUser?.uid === u.uid;
                return (
                  <div
                    key={u.uid}
                    onClick={() => handleSelectUser(u)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 shadow-xs'
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {u.displayName || u.email}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0 py-0">
                        {u.role?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Building className="w-2.5 h-2.5" />
                        {u.department || 'General'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-2.5 h-2.5" />
                        {u.position || 'Staff'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Permission Matrix & Template Engine (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedUser ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Access Privileges for {selectedUser.displayName || selectedUser.email}
                      </h3>
                      <Badge className="bg-slate-900 text-white text-[10px]">
                        Current: {selectedUser.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedUser.department || 'General'} Department • {selectedUser.position || 'Staff Member'}
                    </p>
                  </div>

                  <Button
                    onClick={handleSavePermissions}
                    disabled={isSaving || !isExecutive}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-xs"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save User Matrix
                  </Button>
                </div>

                {/* Group Policy Template Quick-Select */}
                <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 shrink-0">
                    <Zap className="w-3.5 h-3.5 text-amber-500" /> Apply Group Policy Template:
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <Select value={selectedTemplate} onValueChange={handleApplyTemplate}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="-- Select Standard Template (e.g., CASHIER001) --" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(GROUP_POLICY_TEMPLATES).map((tpl) => (
                          <SelectItem key={tpl.code} value={tpl.code}>
                            {tpl.code} — {tpl.name} ({tpl.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-6">
                {PERMISSION_CATEGORIES.map((catGroup) => (
                  <div key={catGroup.category} className="space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                      <Sliders className="w-3.5 h-3.5 text-blue-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        {catGroup.category}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {catGroup.items.map((perm) => {
                        const isChecked = !!activePermissions[perm.key];
                        return (
                          <div
                            key={perm.key}
                            onClick={() => isExecutive && handleTogglePermission(perm.key)}
                            className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                              isExecutive ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                            } ${
                              isChecked
                                ? 'bg-blue-50/60 border-blue-200 text-slate-900 shadow-2xs'
                                : 'bg-slate-50/40 border-slate-200/80 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => isExecutive && handleTogglePermission(perm.key)}
                              disabled={!isExecutive}
                              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-semibold ${isChecked ? 'text-blue-900' : 'text-slate-700'}`}>
                                  {perm.label}
                                </span>
                                {isChecked && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] py-0 px-1">
                                    Granted
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                {perm.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!isExecutive && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Viewing mode: Only Directors and Administrators can modify and save policy matrices.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 p-12 text-center text-slate-400">
              Select a staff member from the left list to review or configure access policies.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
