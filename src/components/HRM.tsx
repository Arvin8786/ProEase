import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  UserProfile, 
  Employee, 
  LeaveRequest, 
  Appraisal, 
  Payroll, 
  Role,
  DEPARTMENTS,
  POSITIONS_BY_DEPARTMENT 
} from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Users, 
  UserCheck, 
  CalendarDays, 
  Award, 
  DollarSign, 
  ShieldAlert, 
  Shield,
  Plus, 
  Check, 
  X, 
  Edit3, 
  Trash2,
  AlertTriangle,
  Search,
  Building,
  Briefcase,
  User,
  TrendingUp,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { ApplyLeaveModal } from './ApplyLeaveModal';
import { RbacMatrixModal } from './hrm/RbacMatrixModal';

interface HRMProps {
  profile: UserProfile | null;
}

export function HRM({ profile }: HRMProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  
  // Modals state
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [selectedEmployeeToEdit, setSelectedEmployeeToEdit] = useState<Employee | null>(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    fullName: '',
    email: '',
    department: 'HR',
    position: 'HR Executive',
    superiorId: '',
    superiorName: '',
    salary: 50000,
    status: 'active' as 'active' | 'inactive' | 'on_leave',
  });
  const [deleteEmployeeConfirm, setDeleteEmployeeConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });

  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<UserProfile | null>(null);
  const [selectedUserForRbac, setSelectedUserForRbac] = useState<UserProfile | null>(null);
  const [isRbacModalOpen, setIsRbacModalOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('ALL');

  // Form states
  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    email: '',
    department: 'HR',
    position: 'HR Executive',
    superiorId: '',
    superiorName: '',
    salary: 50000,
    joinDate: new Date().toISOString().split('T')[0]
  });

  const [editUserData, setEditUserData] = useState({
    department: 'Operations',
    position: 'Operations Staff',
    superiorId: '',
    superiorName: '',
    role: 'employee' as Role,
    annualLeaveQuota: 14
  });

  // Strict RBAC Verification:
  // "only those staff assign to hr department can access hrm module and related modules"
  const isHRStaff = profile?.department === 'HR' || profile?.role === 'hr_manager';
  const isAdmin = profile?.role === 'admin' || profile?.email === 'arvin8786@gmail.com';
  const hasHRAccess = isHRStaff || isAdmin;

  useEffect(() => {
    if (!hasHRAccess) return;

    const unsubEmp = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile));
    });
    const unsubLeave = onSnapshot(collection(db, 'leaveRequests'), (snap) => {
      setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
    });
    const unsubAppraisal = onSnapshot(collection(db, 'appraisals'), (snap) => {
      setAppraisals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appraisal)));
    });
    const unsubPayroll = onSnapshot(collection(db, 'payroll'), (snap) => {
      setPayroll(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payroll)));
    });

    return () => {
      unsubEmp();
      unsubUsers();
      unsubLeave();
      unsubAppraisal();
      unsubPayroll();
    };
  }, [hasHRAccess]);

  // Open Edit User assignment modal
  const handleOpenEditUser = (user: UserProfile) => {
    setSelectedUserToEdit(user);
    setEditUserData({
      department: user.department || 'Operations',
      position: user.position || 'Staff',
      superiorId: user.superiorId || '',
      superiorName: user.superiorName || '',
      role: user.role || 'employee',
      annualLeaveQuota: user.leaveBalance?.annual ?? 14
    });
    setIsEditUserModalOpen(true);
  };

  // Save staff assignment: Department, Position, Superior, Role
  const handleSaveUserAssignment = async () => {
    if (!selectedUserToEdit) return;

    try {
      const superiorObj = users.find(u => u.uid === editUserData.superiorId);
      const superiorName = superiorObj 
        ? (superiorObj.displayName || superiorObj.email)
        : editUserData.superiorName || 'None';

      const updatePayload: Partial<UserProfile> = {
        department: editUserData.department,
        position: editUserData.position,
        superiorId: editUserData.superiorId || '',
        superiorName: superiorName,
        role: editUserData.role,
        leaveBalance: {
          annual: editUserData.annualLeaveQuota,
          sick: selectedUserToEdit.leaveBalance?.sick ?? 14,
          emergency: selectedUserToEdit.leaveBalance?.emergency ?? 5,
          unpaid: selectedUserToEdit.leaveBalance?.unpaid ?? 30
        }
      };

      await updateDoc(doc(db, 'users', selectedUserToEdit.uid), updatePayload);

      // Sync with employee record if matching employee exists
      const matchedEmployee = employees.find(e => e.email.toLowerCase() === selectedUserToEdit.email.toLowerCase());
      if (matchedEmployee) {
        await updateDoc(doc(db, 'employees', matchedEmployee.id), {
          department: editUserData.department,
          position: editUserData.position,
          superiorId: editUserData.superiorId || '',
          superiorName: superiorName
        });
      }

      toast.success(`Assigned ${selectedUserToEdit.displayName}: ${editUserData.department} • ${editUserData.position}`);
      setIsEditUserModalOpen(false);
      setSelectedUserToEdit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      toast.error('Failed to update staff assignments.');
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.fullName.trim() || !newEmployee.email.trim()) {
      toast.error('Please enter name and email');
      return;
    }

    try {
      const superiorObj = users.find(u => u.uid === newEmployee.superiorId);
      const superiorName = superiorObj ? (superiorObj.displayName || superiorObj.email) : 'None';

      await addDoc(collection(db, 'employees'), {
        ...newEmployee,
        superiorName,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      setIsAddEmployeeOpen(false);
      toast.success('Employee created successfully');
      setNewEmployee({
        fullName: '',
        email: '',
        department: 'HR',
        position: 'HR Executive',
        superiorId: '',
        superiorName: '',
        salary: 50000,
        joinDate: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'employees');
    }
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setSelectedEmployeeToEdit(emp);
    setEditEmployeeForm({
      fullName: emp.fullName || '',
      email: emp.email || '',
      department: emp.department || 'HR',
      position: emp.position || 'Staff',
      superiorId: emp.superiorId || '',
      superiorName: emp.superiorName || '',
      salary: emp.salary || 0,
      status: (emp.status as any) || 'active',
    });
    setIsEditEmployeeOpen(true);
  };

  const handleSaveEditEmployee = async () => {
    if (!selectedEmployeeToEdit) return;
    try {
      const superiorObj = users.find(u => u.uid === editEmployeeForm.superiorId);
      const superiorName = superiorObj ? (superiorObj.displayName || superiorObj.email) : editEmployeeForm.superiorName;

      await updateDoc(doc(db, 'employees', selectedEmployeeToEdit.id), {
        ...editEmployeeForm,
        superiorName,
        updatedAt: new Date().toISOString(),
      });
      setIsEditEmployeeOpen(false);
      toast.success(`Updated employee record for ${editEmployeeForm.fullName}`);
    } catch (err: any) {
      toast.error('Failed to update employee: ' + err.message);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteEmployeeConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'employees', deleteEmployeeConfirm.id));
      toast.success(`Employee ${deleteEmployeeConfirm.name} removed from directory.`);
      setDeleteEmployeeConfirm({ open: false, id: '', name: '' });
    } catch (err: any) {
      toast.error('Failed to delete employee: ' + err.message);
    }
  };

  const handleApproveLeave = async (id: string, requesterName: string) => {
    try {
      await updateDoc(doc(db, 'leaveRequests', id), { 
        status: 'approved',
        approvedBy: profile?.displayName || 'HR Administrator',
        reviewedAt: new Date().toISOString()
      });
      toast.success(`Leave approved for ${requesterName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leaveRequests');
    }
  };

  const handleRejectLeave = async (id: string, requesterName: string) => {
    try {
      await updateDoc(doc(db, 'leaveRequests', id), { 
        status: 'rejected',
        approvedBy: profile?.displayName || 'HR Administrator',
        reviewedAt: new Date().toISOString()
      });
      toast.info(`Leave rejected for ${requesterName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leaveRequests');
    }
  };

  // If user does not have HR access, show strict RBAC blocked screen
  if (!hasHRAccess) {
    return (
      <Card className="border-red-200 bg-red-50/50 max-w-2xl mx-auto my-12 shadow-sm">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl text-red-900">Access Restricted to HR Personnel</CardTitle>
          <CardDescription className="text-red-700">
            The Human Resource Management module is strictly restricted to staff assigned to the <strong>HR Department</strong> and System Administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-slate-600 space-y-3">
          <p>
            Your current assigned department: <Badge variant="outline" className="font-semibold text-slate-800">{profile?.department || 'Unassigned'}</Badge> • Role: <Badge variant="outline" className="capitalize">{profile?.role}</Badge>
          </p>
          <p className="text-xs text-slate-500">
            For personal leave applications and updating your employee profile, please use your <strong>My Workspace</strong> section.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filtered lists
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.department?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.position?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === 'ALL' || u.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = 
      e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === 'ALL' || e.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const filteredLeaves = leaveRequests.filter(l => {
    const matchesStatus = leaveStatusFilter === 'ALL' || l.status === leaveStatusFilter;
    return matchesStatus;
  });

  const pendingLeavesCount = leaveRequests.filter(l => l.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">HR Management Suite</h2>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">HR Admin</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Department assignment, organizational hierarchy, staff credentials, leave workflows, and appraisals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button 
            onClick={() => setIsApplyLeaveOpen(true)}
            variant="outline"
            className="gap-2 border-slate-300"
          >
            <CalendarDays className="w-4 h-4 text-primary" /> Apply for Leave
          </Button>

          <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus className="w-4 h-4" /> New Employee
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px]">
              <DialogHeader>
                <DialogTitle>Add New Employee Record</DialogTitle>
                <DialogDescription>
                  Register employee in the organizational master database.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Full Name</label>
                    <Input 
                      placeholder="Jane Doe"
                      value={newEmployee.fullName} 
                      onChange={e => setNewEmployee({...newEmployee, fullName: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Work Email</label>
                    <Input 
                      type="email" 
                      placeholder="jane@company.com"
                      value={newEmployee.email} 
                      onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Department</label>
                    <Select 
                      value={newEmployee.department} 
                      onValueChange={v => {
                        const defaultPos = POSITIONS_BY_DEPARTMENT[v]?.[0] || 'Staff';
                        setNewEmployee({...newEmployee, department: v, position: defaultPos});
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Position</label>
                    <Select 
                      value={newEmployee.position} 
                      onValueChange={v => setNewEmployee({...newEmployee, position: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(POSITIONS_BY_DEPARTMENT[newEmployee.department] || ['Staff']).map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Reporting Superior</label>
                    <Select 
                      value={newEmployee.superiorId} 
                      onValueChange={v => {
                        const sup = users.find(u => u.uid === v);
                        setNewEmployee({
                          ...newEmployee, 
                          superiorId: v, 
                          superiorName: sup ? (sup.displayName || sup.email) : ''
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Superior" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Top Level)</SelectItem>
                        {users.map(u => (
                          <SelectItem key={u.uid} value={u.uid}>
                            {u.displayName || u.email} ({u.department || 'Staff'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Annual Base Salary ($)</label>
                    <Input 
                      type="number" 
                      value={newEmployee.salary} 
                      onChange={e => setNewEmployee({...newEmployee, salary: parseInt(e.target.value) || 0})} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Join Date</label>
                  <Input 
                    type="date" 
                    value={newEmployee.joinDate} 
                    onChange={e => setNewEmployee({...newEmployee, joinDate: e.target.value})} 
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>Cancel</Button>
                <Button onClick={handleAddEmployee}>Save Employee Record</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* HRM Quick Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Staff & Users</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{users.length}</div>
          <div className="text-xs text-slate-500 mt-1">{employees.length} active employee files</div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Leave Approvals</span>
            <CalendarDays className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            {pendingLeavesCount}
            {pendingLeavesCount > 0 && (
              <Badge variant="destructive" className="text-[10px] animate-pulse">Action Needed</Badge>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">{leaveRequests.length} total applications</div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Departments</span>
            <Building className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{DEPARTMENTS.length}</div>
          <div className="text-xs text-slate-500 mt-1">HR, Sales, Warehouse, etc.</div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Performance Reviews</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{appraisals.length}</div>
          <div className="text-xs text-slate-500 mt-1">Logged appraisals</div>
        </Card>
      </div>

      {/* Main HRM Tabs */}
      <Tabs defaultValue="user-assignments" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[840px] bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="user-assignments" className="gap-1.5 text-xs font-medium">
            <UserCheck className="w-3.5 h-3.5" /> Staff Assignments
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-1.5 text-xs font-medium">
            <Users className="w-3.5 h-3.5" /> Employee Files
          </TabsTrigger>
          <TabsTrigger value="leave" className="gap-1.5 text-xs font-medium relative">
            <CalendarDays className="w-3.5 h-3.5" /> Leave Management
            {pendingLeavesCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-1 inline-block" />
            )}
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs font-medium">
            <Award className="w-3.5 h-3.5" /> Appraisals
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-1.5 text-xs font-medium">
            <DollarSign className="w-3.5 h-3.5" /> Payroll
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: User Department, Position & Superior Assignments */}
        <TabsContent value="user-assignments" className="space-y-4 pt-2">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Assign Staff Department, Position & Reporting Superior
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Configure organizational hierarchy and module access privileges for each user.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input 
                      placeholder="Search user, role, dept..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-xs bg-white"
                    />
                  </div>

                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="h-8 text-xs w-[130px] bg-white">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Depts</SelectItem>
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">User / Staff Member</TableHead>
                      <TableHead className="text-xs font-semibold">Department</TableHead>
                      <TableHead className="text-xs font-semibold">Position</TableHead>
                      <TableHead className="text-xs font-semibold">Reporting Superior</TableHead>
                      <TableHead className="text-xs font-semibold">ERP Access Level</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Annual Leave</TableHead>
                      <TableHead className="text-right text-xs font-semibold pr-4">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                          No users found matching your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map(u => (
                        <TableRow key={u.uid} className="hover:bg-slate-50/70">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                                {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                                  {u.displayName || 'Unnamed User'}
                                  {u.uid === profile?.uid && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1 border-blue-200 bg-blue-50 text-blue-700">You</Badge>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            {u.department ? (
                              <Badge variant="secondary" className="font-medium text-[11px] bg-slate-100 text-slate-800 border-slate-200">
                                <Building className="w-3 h-3 mr-1 text-slate-500" />
                                {u.department}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-amber-600 font-medium italic">Unassigned</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-slate-800 font-medium flex items-center gap-1">
                              <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                              {u.position || 'General Staff'}
                            </span>
                          </TableCell>

                          <TableCell>
                            {u.superiorName ? (
                              <span className="text-xs text-slate-700 flex items-center gap-1">
                                <User className="w-3 h-3 text-emerald-600 shrink-0" />
                                {u.superiorName}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">None (Top Level)</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge 
                              className={`capitalize text-[10px] font-semibold ${
                                u.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-800 border-purple-200' 
                                  : u.role === 'hr_manager'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : u.role === 'sales'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : u.role === 'storekeeper'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {u.role.replace('_', ' ')}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-center font-mono text-xs">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                              {u.leaveBalance?.annual ?? 14}d
                            </span>
                          </TableCell>

                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedUserForRbac(u);
                                  setIsRbacModalOpen(true);
                                }}
                                className="h-7 text-xs gap-1 hover:bg-purple-50 text-purple-700 border-purple-200"
                                title="Dynamic RBAC & Manual Privilege Matrix"
                              >
                                <Shield className="w-3 h-3" /> RBAC
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleOpenEditUser(u)}
                                className="h-7 text-xs gap-1.5 hover:bg-slate-100"
                              >
                                <Edit3 className="w-3 h-3 text-primary" /> Assign
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Edit User Assignment Dialog */}
          <Dialog open={isEditUserModalOpen} onOpenChange={setIsEditUserModalOpen}>
            <DialogContent className="sm:max-w-[540px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  Assign Department, Position & Superior
                </DialogTitle>
                <DialogDescription>
                  Update official assignments for <strong>{selectedUserToEdit?.displayName || selectedUserToEdit?.email}</strong>.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-3">
                {/* Department Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-500" /> Department (Required)
                  </label>
                  <Select 
                    value={editUserData.department} 
                    onValueChange={v => {
                      const availablePositions = POSITIONS_BY_DEPARTMENT[v] || ['General Staff'];
                      setEditUserData({
                        ...editUserData, 
                        department: v,
                        position: availablePositions[0] || 'Staff'
                      });
                    }}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(dept => (
                        <SelectItem key={dept} value={dept}>
                          {dept} Department
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Position Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" /> Official Position / Job Title
                  </label>
                  <Select 
                    value={editUserData.position} 
                    onValueChange={v => setEditUserData({...editUserData, position: v})}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select Position" />
                    </SelectTrigger>
                    <SelectContent>
                      {(POSITIONS_BY_DEPARTMENT[editUserData.department] || ['Staff']).map(pos => (
                        <SelectItem key={pos} value={pos}>
                          {pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reporting Superior Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" /> Reporting Superior (For Leave & Approvals)
                  </label>
                  <Select 
                    value={editUserData.superiorId || 'none'} 
                    onValueChange={v => {
                      if (v === 'none') {
                        setEditUserData({...editUserData, superiorId: '', superiorName: ''});
                      } else {
                        const sup = users.find(u => u.uid === v);
                        setEditUserData({
                          ...editUserData, 
                          superiorId: v, 
                          superiorName: sup ? (sup.displayName || sup.email) : ''
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Choose Superior" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Top Executive / Department Head)</SelectItem>
                      {users
                        .filter(u => u.uid !== selectedUserToEdit?.uid)
                        .map(u => (
                          <SelectItem key={u.uid} value={u.uid}>
                            {u.displayName || u.email} — {u.department || 'Staff'} ({u.position || u.role})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500">
                    When this user submits a leave application, it will be automatically routed to this superior for approval.
                  </p>
                </div>

                {/* ERP Access Level & Leave Quota */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">ERP Access Level</label>
                    <Select 
                      value={editUserData.role} 
                      onValueChange={(v: Role) => setEditUserData({...editUserData, role: v})}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                        <SelectItem value="hr_manager">HR Manager (HRM Suite)</SelectItem>
                        <SelectItem value="sales">Sales Representative</SelectItem>
                        <SelectItem value="storekeeper">Storekeeper (Warehouse)</SelectItem>
                        <SelectItem value="employee">Standard Employee</SelectItem>
                        <SelectItem value="requester">Purchasing Requester</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Annual Leave Quota</label>
                    <Input 
                      type="number"
                      min={0}
                      max={60}
                      value={editUserData.annualLeaveQuota}
                      onChange={e => setEditUserData({...editUserData, annualLeaveQuota: parseInt(e.target.value) || 14})}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-slate-100 pt-3">
                <Button variant="outline" onClick={() => setIsEditUserModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveUserAssignment} className="gap-1.5">
                  <Check className="w-4 h-4" /> Save Assignments
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 2: Employee Files */}
        <TabsContent value="employees" className="space-y-4 pt-2">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Employee Records Master</CardTitle>
                <CardDescription className="text-xs">
                  Active employee files, compensation, join dates, and status.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsAddEmployeeOpen(true)} className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Employee
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Name</TableHead>
                    <TableHead className="text-xs font-semibold">Email</TableHead>
                    <TableHead className="text-xs font-semibold">Department</TableHead>
                    <TableHead className="text-xs font-semibold">Position</TableHead>
                    <TableHead className="text-xs font-semibold">Reporting Superior</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Salary</TableHead>
                    <TableHead className="text-center text-xs font-semibold pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-slate-400 text-xs">
                        No employee files found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map(emp => (
                      <TableRow key={emp.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-semibold text-xs text-slate-900">{emp.fullName}</TableCell>
                        <TableCell className="text-xs text-slate-600">{emp.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] font-normal">{emp.department}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-800">{emp.position}</TableCell>
                        <TableCell className="text-xs text-slate-600">{emp.superiorName || 'None'}</TableCell>
                        <TableCell>
                          <Badge variant={emp.status === 'active' ? 'secondary' : 'outline'} className="text-[10px]">
                            {emp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-slate-900">
                          ${emp.salary.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center pr-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditEmployee(emp)}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600"
                              title="Edit Employee"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteEmployeeConfirm({
                                open: true,
                                id: emp.id,
                                name: emp.fullName,
                              })}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-rose-600"
                              title="Delete Employee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Edit Employee Modal */}
          <Dialog open={isEditEmployeeOpen} onOpenChange={setIsEditEmployeeOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">
                  Edit Employee Record
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Update employee directory information and department placement.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-2 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Full Name</label>
                  <Input 
                    value={editEmployeeForm.fullName}
                    onChange={e => setEditEmployeeForm({ ...editEmployeeForm, fullName: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Email</label>
                  <Input 
                    type="email"
                    value={editEmployeeForm.email}
                    onChange={e => setEditEmployeeForm({ ...editEmployeeForm, email: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Department</label>
                    <Select
                      value={editEmployeeForm.department}
                      onValueChange={v => {
                        const defaultPos = POSITIONS_BY_DEPARTMENT[v]?.[0] || 'Staff';
                        setEditEmployeeForm({ ...editEmployeeForm, department: v, position: defaultPos });
                      }}
                    >
                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Position</label>
                    <Select
                      value={editEmployeeForm.position}
                      onValueChange={v => setEditEmployeeForm({ ...editEmployeeForm, position: v })}
                    >
                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(POSITIONS_BY_DEPARTMENT[editEmployeeForm.department] || ['Staff']).map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Annual Salary ($)</label>
                    <Input 
                      type="number"
                      value={editEmployeeForm.salary}
                      onChange={e => setEditEmployeeForm({ ...editEmployeeForm, salary: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Status</label>
                    <Select
                      value={editEmployeeForm.status}
                      onValueChange={(v: any) => setEditEmployeeForm({ ...editEmployeeForm, status: v })}
                    >
                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditEmployeeOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveEditEmployee} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  <Check className="w-4 h-4" /> Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Employee Confirmation Modal */}
          <Dialog open={deleteEmployeeConfirm.open} onOpenChange={(open) => !open && setDeleteEmployeeConfirm({ open: false, id: '', name: '' })}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Delete Employee
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Are you sure you want to permanently remove employee record for <strong>{deleteEmployeeConfirm.name}</strong>?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteEmployeeConfirm({ open: false, id: '', name: '' })}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteEmployee} className="gap-1.5">
                  <Trash2 className="w-4 h-4" /> Delete Permanently
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 3: Leave Management */}
        <TabsContent value="leave" className="space-y-4 pt-2">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Leave Applications & Approvals</CardTitle>
                <CardDescription className="text-xs">
                  Review employee leave requests, approve or reject applications, and verify remaining balances.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Select value={leaveStatusFilter} onValueChange={setLeaveStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-[130px] bg-white">
                    <SelectValue placeholder="Status Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending Only</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  size="sm" 
                  onClick={() => setIsApplyLeaveOpen(true)} 
                  className="gap-1.5 h-8 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Apply for Leave
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {filteredLeaves.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <CalendarDays className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">No leave applications found</p>
                  <p className="text-xs text-slate-400 mt-1">Staff leave requests will appear here for review.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredLeaves.map(req => (
                    <Card key={req.id} className="border-slate-200 hover:border-slate-300 transition-all">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{req.employeeName}</span>
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                              {req.type}
                            </Badge>
                            <Badge 
                              className={`text-[10px] capitalize font-medium ${
                                req.status === 'approved' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : req.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800 animate-pulse'
                              }`}
                            >
                              {req.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <CalendarDays className="w-3.5 h-3.5 text-primary" />
                              {req.startDate} to {req.endDate} ({req.daysCount} {req.daysCount === 1 ? 'day' : 'days'})
                            </span>
                            {req.department && (
                              <span className="text-slate-500">• Dept: {req.department}</span>
                            )}
                            {req.superiorName && (
                              <span className="text-slate-500">• Superior: {req.superiorName}</span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-md border border-slate-100 italic">
                            "{req.reason}"
                          </p>

                          {req.approvedBy && (
                            <p className="text-[10px] text-slate-400">
                              Reviewed by {req.approvedBy} on {req.reviewedAt?.split('T')[0] || 'recent'}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {req.status === 'pending' && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => handleApproveLeave(req.id, req.employeeName)}
                                className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleRejectLeave(req.id, req.employeeName)}
                                className="gap-1 border-red-200 text-red-600 hover:bg-red-50 h-8 text-xs"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Appraisals */}
        <TabsContent value="performance" className="space-y-4 pt-2">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-semibold">Performance Appraisals</CardTitle>
              <CardDescription className="text-xs">
                Employee performance reviews and merit ratings.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {appraisals.length === 0 ? (
                  <p className="text-xs text-slate-400 col-span-3 text-center py-8">
                    No appraisals on file.
                  </p>
                ) : (
                  appraisals.map(app => (
                    <Card key={app.id} className="border-slate-200">
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-semibold">
                          Review for {employees.find(e => e.id === app.employeeId)?.fullName || 'Employee'}
                        </CardTitle>
                        <CardDescription className="text-[10px]">{app.reviewPeriod}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-3 pt-1">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <span className="font-bold text-base">{app.rating}/5</span>
                        </div>
                        <p className="text-xs text-slate-600 italic line-clamp-3">"{app.comments}"</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: Payroll */}
        <TabsContent value="payroll" className="space-y-4 pt-2">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-semibold">Payroll Management</CardTitle>
              <CardDescription className="text-xs">
                Monthly salary records and disbursements.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Employee</TableHead>
                    <TableHead className="text-xs font-semibold">Month</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Net Salary</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-slate-400 text-xs">
                        No payroll records recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payroll.map(pay => (
                      <TableRow key={pay.id} className="hover:bg-slate-50/70">
                        <TableCell className="text-xs font-medium">
                          {employees.find(e => e.id === pay.employeeId)?.fullName || 'Staff'}
                        </TableCell>
                        <TableCell className="text-xs">{pay.month} {pay.year}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          ${pay.netSalary.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={pay.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : ''}>
                            {pay.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Interactive Apply Leave Modal */}
      <ApplyLeaveModal 
        open={isApplyLeaveOpen}
        onOpenChange={setIsApplyLeaveOpen}
        profile={profile}
        supervisors={users}
      />

      {/* Dynamic RBAC & Manual Privilege Overrides Modal */}
      <RbacMatrixModal
        isOpen={isRbacModalOpen}
        onClose={() => {
          setIsRbacModalOpen(false);
          setSelectedUserForRbac(null);
        }}
        targetUser={selectedUserForRbac}
        currentUserProfile={profile}
      />
    </div>
  );
}
