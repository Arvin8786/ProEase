import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  User, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Layers, 
  DollarSign, 
  Lock,
  RefreshCw
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { UserProfile, Role, CustomPermissions, DEPARTMENTS, POSITIONS_BY_DEPARTMENT } from '../../types';
import { DEFAULT_ROLE_PERMISSIONS } from '../../lib/rbac';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';

interface RbacMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  allUsers: UserProfile[];
  onSaved?: () => void;
}

export const RbacMatrixModal: React.FC<RbacMatrixModalProps> = ({
  open,
  onOpenChange,
  user,
  allUsers,
  onSaved,
}) => {
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [department, setDepartment] = useState('Operations');
  const [position, setPosition] = useState('Staff');
  const [isHourlyWorker, setIsHourlyWorker] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(18);
  const [permissions, setPermissions] = useState<CustomPermissions>(DEFAULT_ROLE_PERMISSIONS.employee);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEmployeeId(user.employeeId || '');
      setRole(user.role || 'employee');
      setDepartment(user.department || 'Operations');
      setPosition(user.position || 'Staff');
      setIsHourlyWorker(!!user.isHourlyWageWorker);
      setHourlyRate(user.hourlyRate || 18);

      const base = DEFAULT_ROLE_PERMISSIONS[user.role || 'employee'];
      setPermissions({
        ...base,
        ...(user.customPermissions || {}),
      });
    }
  }, [user]);

  // When role changes, reset default permissions if user confirms or switches
  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    const defaults = DEFAULT_ROLE_PERMISSIONS[newRole];
    setPermissions(prev => ({
      ...defaults,
      // preserve any explicit overrides previously set
      ...prev,
    }));
  };

  const handleToggle = (key: keyof CustomPermissions, val: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleGenerateId = () => {
    const existingNums = allUsers
      .map(u => u.employeeId)
      .filter(Boolean)
      .map(id => {
        const match = id?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 1000;
    const nextId = `EMP-${maxNum + 1}`;
    setEmployeeId(nextId);
    toast.info(`Generated unique ID: ${nextId}`);
  };

  const handleSave = async () => {
    if (!user) return;

    // Check uniqueness of employeeId if provided
    if (employeeId.trim()) {
      const duplicate = allUsers.find(
        u => u.uid !== user.uid && u.employeeId?.trim().toLowerCase() === employeeId.trim().toLowerCase()
      );
      if (duplicate) {
        toast.error(`Employee ID "${employeeId}" is already assigned to ${duplicate.displayName || duplicate.email}!`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Partial<UserProfile> = {
        employeeId: employeeId.trim() || undefined,
        role,
        department,
        position,
        isHourlyWageWorker: isHourlyWorker,
        hourlyRate: isHourlyWorker ? hourlyRate : undefined,
        customPermissions: permissions,
      };

      await updateDoc(doc(db, 'users', user.uid), payload);
      toast.success(`RBAC permissions updated for ${user.displayName || user.email}`);
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update permissions: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Dynamic RBAC & Privilege Overrides
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Manage employee identity, base role hierarchy, and granular operational privilege overrides.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono uppercase bg-slate-50">
              {user.displayName || user.email}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-3">
          {/* Identity & Department Grid */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Unique Employee ID *</Label>
              <div className="flex gap-1.5">
                <Input 
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-1001"
                  className="h-8 text-xs font-mono font-bold"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGenerateId}
                  className="h-8 px-2 text-[11px] shrink-0"
                  title="Auto generate next sequence"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Base Role Assignment *</Label>
              <Select value={role} onValueChange={(v: Role) => handleRoleChange(v)}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner / Director</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">POS Cashier</SelectItem>
                  <SelectItem value="storekeeper">Storekeeper / Warehouse</SelectItem>
                  <SelectItem value="sales">Sales Executive</SelectItem>
                  <SelectItem value="hr_manager">HR Manager</SelectItem>
                  <SelectItem value="employee">Standard Employee</SelectItem>
                  <SelectItem value="requester">Purchasing Requester</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Corporate Position / Job Title</Label>
              <Input 
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Senior Inventory Controller"
                className="h-8 text-xs bg-white"
              />
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-[11px] font-medium text-slate-700">Hourly Wage Worker</span>
                <Switch 
                  checked={isHourlyWorker} 
                  onCheckedChange={setIsHourlyWorker} 
                />
              </div>
            </div>

            {isHourlyWorker && (
              <div className="space-y-1.5 md:col-span-3 p-3 bg-blue-50/50 rounded-lg border border-blue-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-blue-900 text-xs">Shift Hourly Pay Rate</div>
                  <div className="text-[11px] text-blue-700">Calculates automated monthly payroll based on verified geofenced clock-in hours.</div>
                </div>
                <div className="flex items-center gap-1.5 w-36">
                  <span className="text-xs font-bold text-slate-600">$</span>
                  <Input 
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs bg-white font-mono font-bold"
                  />
                  <span className="text-[11px] text-slate-500">/hr</span>
                </div>
              </div>
            )}
          </div>

          {/* Granular Permission Matrix */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Granular Manual Privilege Matrix
              </h4>
              <span className="text-[11px] text-slate-400">Enables cross-functional SME role delegation</span>
            </div>

            {/* Category 1: Procurement & Inventory */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="font-semibold text-xs text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
                <span>Procurement & Inventory Operations</span>
                <Badge variant="outline" className="text-[10px]">Supply Chain</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Create Purchase Requests</div>
                    <div className="text-[10px] text-slate-400">Can initiate departmental PRs</div>
                  </div>
                  <Switch 
                    checked={permissions.canCreatePR}
                    onCheckedChange={(val) => handleToggle('canCreatePR', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Approve Purchase Requests</div>
                    <div className="text-[10px] text-slate-400">Manager approval & PO generation</div>
                  </div>
                  <Switch 
                    checked={permissions.canApprovePR}
                    onCheckedChange={(val) => handleToggle('canApprovePR', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Key Goods Receipts (GRN)</div>
                    <div className="text-[10px] text-slate-400">Receive supplier deliveries & invoices</div>
                  </div>
                  <Switch 
                    checked={permissions.canKeyGR}
                    onCheckedChange={(val) => handleToggle('canKeyGR', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Execute Atomic Post GR</div>
                    <div className="text-[10px] text-slate-400">Post stock updates & AP ledger</div>
                  </div>
                  <Switch 
                    checked={permissions.canPostGR}
                    onCheckedChange={(val) => handleToggle('canPostGR', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Issue Internal Goods (GIN)</div>
                    <div className="text-[10px] text-slate-400">Dispatch store stock to internal depts</div>
                  </div>
                  <Switch 
                    checked={permissions.canIssueInternalGoods}
                    onCheckedChange={(val) => handleToggle('canIssueInternalGoods', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Issue External Goods</div>
                    <div className="text-[10px] text-slate-400">Authorize external project release</div>
                  </div>
                  <Switch 
                    checked={permissions.canIssueExternalGoods}
                    onCheckedChange={(val) => handleToggle('canIssueExternalGoods', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Edit Inventory Master</div>
                    <div className="text-[10px] text-slate-400">Modify SKU pricing & safety stock</div>
                  </div>
                  <Switch 
                    checked={permissions.canEditInventoryMaster}
                    onCheckedChange={(val) => handleToggle('canEditInventoryMaster', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Excel Mass Upload & Export</div>
                    <div className="text-[10px] text-slate-400">Bulk sync .xlsx master files</div>
                  </div>
                  <Switch 
                    checked={permissions.canPerformMassUpload}
                    onCheckedChange={(val) => handleToggle('canPerformMassUpload', val)}
                  />
                </div>
              </div>
            </div>

            {/* Category 2: POS Terminal Operations */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="font-semibold text-xs text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
                <span>Point of Sale (POS) Privileges</span>
                <Badge variant="outline" className="text-[10px]">Retail & Checkout</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Reprint Historic Receipts</div>
                    <div className="text-[10px] text-slate-400">Access transaction history reprints</div>
                  </div>
                  <Switch 
                    checked={permissions.canReprintReceipts}
                    onCheckedChange={(val) => handleToggle('canReprintReceipts', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Void POS Transactions</div>
                    <div className="text-[10px] text-slate-400">Cancel registered sales slips</div>
                  </div>
                  <Switch 
                    checked={permissions.canVoidPOSTransaction}
                    onCheckedChange={(val) => handleToggle('canVoidPOSTransaction', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Supervisor Price Override</div>
                    <div className="text-[10px] text-slate-400">Adjust unit price or manual discount</div>
                  </div>
                  <Switch 
                    checked={permissions.canOverridePOSPrice}
                    onCheckedChange={(val) => handleToggle('canOverridePOSPrice', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Hold / Park Customer Cart</div>
                    <div className="text-[10px] text-slate-400">Save active tabs & recall queues</div>
                  </div>
                  <Switch 
                    checked={permissions.canHoldParkCart}
                    onCheckedChange={(val) => handleToggle('canHoldParkCart', val)}
                  />
                </div>
              </div>
            </div>

            {/* Category 3: HR, Rostering & Financials */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="font-semibold text-xs text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
                <span>HR, Rostering & Financial Operations</span>
                <Badge variant="outline" className="text-[10px]">Governance</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Approve Employee Leaves</div>
                    <div className="text-[10px] text-slate-400">Review staff leave applications</div>
                  </div>
                  <Switch 
                    checked={permissions.canApproveLeaves}
                    onCheckedChange={(val) => handleToggle('canApproveLeaves', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Manage Roster & Schedules</div>
                    <div className="text-[10px] text-slate-400">Create & publish shift timetables</div>
                  </div>
                  <Switch 
                    checked={permissions.canManageRoster}
                    onCheckedChange={(val) => handleToggle('canManageRoster', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Manage Payroll & Deductions</div>
                    <div className="text-[10px] text-slate-400">Calculate CPF / EPF & disburse payslips</div>
                  </div>
                  <Switch 
                    checked={permissions.canManagePayroll}
                    onCheckedChange={(val) => handleToggle('canManagePayroll', val)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div>
                    <div className="font-medium text-xs text-slate-800">Accounting & General Ledger</div>
                    <div className="text-[10px] text-slate-400">AP/AR invoices, GL journals & E-Invoice</div>
                  </div>
                  <Switch 
                    checked={permissions.canManageAccounting}
                    onCheckedChange={(val) => handleToggle('canManageAccounting', val)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Role & Overrides
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
