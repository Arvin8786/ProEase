import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Copy, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users, 
  Sun, 
  Sunset, 
  Moon, 
  Sparkles,
  Trash2,
  Filter,
  Layers,
  ShieldCheck,
  History,
  FileCheck,
  Check,
  AlertTriangle,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Shift, UserProfile, Role, ClockLog, ClockLogAuditEntry } from '../../types';
import { hasPermission } from '../../lib/rbac';
import { toast } from 'sonner';

interface ShiftRosterManagementProps {
  profile: UserProfile | null;
}

const SHIFT_TEMPLATES = {
  morning: { label: 'Morning Shift', start: '08:00', end: '16:00', icon: Sun, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  afternoon: { label: 'Afternoon Shift', start: '14:00', end: '22:00', icon: Sunset, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  night: { label: 'Night Shift', start: '22:00', end: '06:00', icon: Moon, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  custom: { label: 'Custom Hours', start: '09:00', end: '18:00', icon: Clock, color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const ShiftRosterManagement: React.FC<ShiftRosterManagementProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'timetable' | 'attendance'>('timetable');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [clockLogs, setClockLogs] = useState<ClockLog[]>([]);
  
  // Weekly Calendar Navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Single Shift Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ date: string; employeeId?: string } | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [shiftType, setShiftType] = useState<'morning' | 'afternoon' | 'night' | 'custom'>('morning');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [location, setLocation] = useState('Main Store');
  const [notes, setNotes] = useState('');

  // Bulk Shift Creation State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkDepartment, setBulkDepartment] = useState('ALL');
  const [bulkSelectedStaff, setBulkSelectedStaff] = useState<string[]>([]);
  const [bulkStartDate, setBulkStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bulkEndDate, setBulkEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  });
  const [bulkDaysOfWeek, setBulkDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [bulkShiftType, setBulkShiftType] = useState<'morning' | 'afternoon' | 'night' | 'custom'>('morning');
  const [bulkStartTime, setBulkStartTime] = useState('08:00');
  const [bulkEndTime, setBulkEndTime] = useState('16:00');
  const [bulkLocation, setBulkLocation] = useState('Main Store');
  const [bulkNotes, setBulkNotes] = useState('Bulk Roster Batch');

  // Clock Log Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedClockLog, setSelectedClockLog] = useState<ClockLog | null>(null);
  const [adjustDateTime, setAdjustDateTime] = useState('');
  const [adjustType, setAdjustType] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [adjustJustification, setAdjustJustification] = useState('');
  const [viewAuditLog, setViewAuditLog] = useState<ClockLog | null>(null);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission(profile, 'canManageRoster') || profile?.role === 'admin' || profile?.role === 'owner';

  // Generate 7 days of the active week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return {
      dateObj: d,
      dateString: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      monthName: d.toLocaleDateString('en-US', { month: 'short' }),
    };
  });

  // Real-time Firestore Listeners
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setEmployees(snap.docs.map(d => d.data() as UserProfile));
    });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), snap => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
    });

    const unsubClock = onSnapshot(collection(db, 'clockLogs'), snap => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClockLog));
      // Sort by timestamp desc
      logs.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });
      setClockLogs(logs);
    });

    return () => {
      unsubUsers();
      unsubShifts();
      unsubClock();
    };
  }, []);

  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  // -------------------------------------------------------------
  // Single Shift Management
  // -------------------------------------------------------------
  const handleOpenAddModal = (date: string, empId?: string) => {
    if (!canManage) {
      toast.error('Access Denied: You lack permissions to manage shift rosters.');
      return;
    }
    setSelectedCell({ date, employeeId: empId });
    if (empId) setSelectedEmployeeId(empId);
    setShiftType('morning');
    setStartTime(SHIFT_TEMPLATES.morning.start);
    setEndTime(SHIFT_TEMPLATES.morning.end);
    setIsAddModalOpen(true);
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell || !selectedEmployeeId) {
      toast.error('Please choose an employee');
      return;
    }

    const emp = employees.find(e => e.uid === selectedEmployeeId);
    if (!emp) return;

    const existingShift = shifts.find(
      s => s.employeeId === selectedEmployeeId && s.date === selectedCell.date
    );
    if (existingShift) {
      toast.error(`Conflict: ${emp.displayName || emp.email} is already rostered on ${selectedCell.date}!`);
      return;
    }

    try {
      const shiftData: Omit<Shift, 'id'> = {
        employeeId: emp.uid,
        employeeName: emp.displayName || emp.email || 'Employee',
        employeeCode: emp.employeeId || 'EMP-TEMP',
        date: selectedCell.date,
        shiftType,
        startTime,
        endTime,
        location,
        isPublished: true,
        notes,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'shifts'), shiftData);
      toast.success(`Rostered ${emp.displayName || emp.email} for ${shiftType} shift on ${selectedCell.date}`);
      setIsAddModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to create shift: ' + err.message);
    }
  };

  const handleDeleteShift = async (shiftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManage) return;
    try {
      await deleteDoc(doc(db, 'shifts', shiftId));
      toast.info('Shift assignment removed');
    } catch (err: any) {
      toast.error('Failed to remove shift: ' + err.message);
    }
  };

  // -------------------------------------------------------------
  // Bulk Shift Creation Workflow
  // -------------------------------------------------------------
  const handleOpenBulkModal = () => {
    if (!canManage) {
      toast.error('Access Denied: You lack permissions to manage rosters.');
      return;
    }
    // Preselect staff based on current filter or all
    setBulkSelectedStaff(employees.map(e => e.uid));
    setIsBulkModalOpen(true);
  };

  const handleToggleStaffSelection = (uid: string) => {
    if (bulkSelectedStaff.includes(uid)) {
      setBulkSelectedStaff(bulkSelectedStaff.filter(id => id !== uid));
    } else {
      setBulkSelectedStaff([...bulkSelectedStaff, uid]);
    }
  };

  const handleSelectAllStaff = () => {
    const filtered = bulkDepartment === 'ALL' 
      ? employees 
      : employees.filter(e => e.department === bulkDepartment);
    setBulkSelectedStaff(filtered.map(e => e.uid));
  };

  const handleClearStaffSelection = () => {
    setBulkSelectedStaff([]);
  };

  const handleToggleDayOfWeek = (dayIdx: number) => {
    if (bulkDaysOfWeek.includes(dayIdx)) {
      setBulkDaysOfWeek(bulkDaysOfWeek.filter(d => d !== dayIdx));
    } else {
      setBulkDaysOfWeek([...bulkDaysOfWeek, dayIdx]);
    }
  };

  const handleExecuteBulkShiftCreation = async () => {
    if (bulkSelectedStaff.length === 0) {
      toast.error('Please select at least one staff member.');
      return;
    }

    if (!bulkStartDate || !bulkEndDate || bulkStartDate > bulkEndDate) {
      toast.error('Please enter a valid Start and End Date range.');
      return;
    }

    if (bulkDaysOfWeek.length === 0) {
      toast.error('Please select at least one day of the week.');
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      let shiftsCreated = 0;
      let skippedConflicts = 0;

      const curr = new Date(bulkStartDate + 'T00:00:00');
      const end = new Date(bulkEndDate + 'T00:00:00');

      while (curr <= end) {
        const dateString = curr.toISOString().split('T')[0];
        const dayOfWeek = curr.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

        if (bulkDaysOfWeek.includes(dayOfWeek)) {
          for (const staffId of bulkSelectedStaff) {
            const emp = employees.find(e => e.uid === staffId);
            if (!emp) continue;

            const existing = shifts.find(s => s.employeeId === staffId && s.date === dateString);
            if (existing) {
              skippedConflicts++;
              continue;
            }

            const ref = doc(collection(db, 'shifts'));
            batch.set(ref, {
              employeeId: emp.uid,
              employeeName: emp.displayName || emp.email || 'Staff',
              employeeCode: emp.employeeId || 'EMP-TEMP',
              date: dateString,
              shiftType: bulkShiftType,
              startTime: bulkStartTime,
              endTime: bulkEndTime,
              location: bulkLocation,
              isPublished: true,
              notes: bulkNotes,
              createdAt: Timestamp.now(),
            });
            shiftsCreated++;
          }
        }
        curr.setDate(curr.getDate() + 1);
      }

      await batch.commit();
      toast.success(`Bulk Roster Generated! Created ${shiftsCreated} shifts (${skippedConflicts} existing conflicts skipped).`);
      setIsBulkModalOpen(false);
    } catch (err: any) {
      toast.error('Bulk shift creation failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Audit-Protected Clock-in Adjustment Workflow
  // -------------------------------------------------------------
  const handleOpenAdjustModal = (log: ClockLog) => {
    if (!canManage) {
      toast.error('Access Denied: Only HR Managers or Supervisors can adjust attendance clock logs.');
      return;
    }
    setSelectedClockLog(log);
    
    // Format timestamp for datetime-local input
    let initialIso = new Date().toISOString().slice(0, 16);
    if (log.timestamp) {
      const dateObj = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      initialIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    setAdjustDateTime(initialIso);
    setAdjustType(log.type === 'clock_out' || log.type === 'out' ? 'clock_out' : 'clock_in');
    setAdjustJustification('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveClockAdjustment = async () => {
    if (!selectedClockLog) return;
    if (!adjustJustification.trim() || adjustJustification.trim().length < 8) {
      toast.error('Audit Compliance Error: Mandatory justification reason (min 8 characters) is required to adjust clock-in logs.');
      return;
    }

    setSaving(true);
    try {
      const newTimestamp = Timestamp.fromDate(new Date(adjustDateTime));
      const auditEntry: ClockLogAuditEntry = {
        adjustedBy: profile?.uid || 'SUPERVISOR',
        adjustedByName: profile?.displayName || profile?.email || 'Supervisor',
        previousTimestamp: selectedClockLog.timestamp,
        newTimestamp: newTimestamp,
        previousType: selectedClockLog.type,
        newType: adjustType,
        reason: adjustJustification.trim(),
        adjustedAt: Timestamp.now(),
      };

      const existingAudit = selectedClockLog.auditHistory || [];
      const updatedAuditHistory = [...existingAudit, auditEntry];

      const ref = doc(db, 'clockLogs', selectedClockLog.id);
      await updateDoc(ref, {
        timestamp: newTimestamp,
        type: adjustType,
        isAdjusted: true,
        auditHistory: updatedAuditHistory,
        lastAdjustedAt: Timestamp.now(),
        lastAdjustedBy: profile?.displayName || profile?.email || 'Supervisor',
      });

      toast.success(`Clock record for ${selectedClockLog.employeeName} adjusted with immutable audit stamp.`);
      setIsAdjustModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to adjust clock-in: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredClockLogs = clockLogs.filter(log => 
    (log.employeeName || '').toLowerCase().includes(attendanceSearch.toLowerCase()) ||
    (log.employeeCode || '').toLowerCase().includes(attendanceSearch.toLowerCase()) ||
    (log.department || '').toLowerCase().includes(attendanceSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shift Rostering & Attendance Audit</h1>
              <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold">
                Audit Trail Protected
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              Bulk shift timetable generation, live conflict resolution, and immutable audit-protected clock adjustments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeTab === 'timetable' && (
            <>
              <Button 
                onClick={handleOpenBulkModal}
                disabled={!canManage}
                className="text-xs h-9 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              >
                <Layers className="w-4 h-4" /> Bulk Shift Creation
              </Button>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <Button variant="ghost" size="sm" onClick={handlePrevWeek} className="h-7 w-7 p-0">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-semibold px-2 font-mono text-slate-700">
                  {weekDays[0].dayNumber} {weekDays[0].monthName} – {weekDays[6].dayNumber} {weekDays[6].monthName}
                </span>
                <Button variant="ghost" size="sm" onClick={handleNextWeek} className="h-7 w-7 p-0">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="timetable" className="gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-purple-600" /> Weekly Shift Grid & Timetable
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Attendance & Clock-In Audit Adjustments ({clockLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Roster Grid */}
        <TabsContent value="timetable" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3.5 text-xs font-bold text-slate-700 w-52 border-r border-slate-200">
                      Staff Member
                    </th>
                    {weekDays.map(day => {
                      const isToday = day.dateString === new Date().toISOString().split('T')[0];
                      return (
                        <th 
                          key={day.dateString} 
                          className={`p-3 text-center border-r border-slate-200 min-w-[130px] ${
                            isToday ? 'bg-purple-50/60 font-extrabold' : ''
                          }`}
                        >
                          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{day.dayName}</div>
                          <div className={`text-base font-bold ${isToday ? 'text-purple-700' : 'text-slate-800'}`}>
                            {day.dayNumber} {day.monthName}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                        No active employees available to roster.
                      </td>
                    </tr>
                  ) : (
                    employees.map(emp => (
                      <tr key={emp.uid} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-3 border-r border-slate-200 align-top">
                          <div className="font-bold text-xs text-slate-900">{emp.displayName || emp.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{emp.employeeId || 'NO-ID'} • {emp.role}</div>
                          <div className="text-[10px] text-purple-600 font-medium">{emp.department || 'Operations'}</div>
                        </td>

                        {weekDays.map(day => {
                          const dayShifts = shifts.filter(
                            s => s.employeeId === emp.uid && s.date === day.dateString
                          );

                          return (
                            <td 
                              key={day.dateString}
                              onClick={() => handleOpenAddModal(day.dateString, emp.uid)}
                              className="p-2 border-r border-slate-200 align-top h-24 hover:bg-purple-50/20 cursor-pointer transition-colors relative group"
                            >
                              {dayShifts.length === 0 ? (
                                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="text-[11px] text-purple-600 flex items-center gap-1 font-medium bg-purple-50 px-2 py-1 rounded-md">
                                    <Plus className="w-3 h-3" /> Add Shift
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {dayShifts.map(s => {
                                    const template = SHIFT_TEMPLATES[s.shiftType as keyof typeof SHIFT_TEMPLATES] || SHIFT_TEMPLATES.custom;
                                    const IconComp = template.icon;
                                    return (
                                      <div 
                                        key={s.id}
                                        className={`p-2 rounded-lg border text-xs relative group/card transition-all ${template.color}`}
                                      >
                                        <div className="flex items-center justify-between font-bold">
                                          <span className="flex items-center gap-1">
                                            <IconComp className="w-3 h-3" />
                                            {template.label}
                                          </span>
                                          {canManage && (
                                            <button 
                                              onClick={(e) => handleDeleteShift(s.id, e)}
                                              className="opacity-0 group-hover/card:opacity-100 text-rose-500 hover:text-rose-700 p-0.5"
                                              title="Delete Shift"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                        <div className="text-[10px] font-mono mt-0.5">
                                          {s.startTime} - {s.endTime}
                                        </div>
                                        {s.location && (
                                          <div className="text-[9px] text-slate-500 truncate mt-0.5">
                                            {s.location}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: Attendance & Clock-In Adjustments */}
        <TabsContent value="attendance" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Attendance Ledger & Audit Adjustments</CardTitle>
                <CardDescription className="text-xs">
                  Review employee clock-in/out timestamps. Any manager modifications enforce mandatory justification and an immutable audit trail.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input 
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  placeholder="Search staff, department..."
                  className="pl-9 h-8 text-xs bg-white"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Staff Member</TableHead>
                    <TableHead className="text-xs font-semibold">Event Type</TableHead>
                    <TableHead className="text-xs font-semibold">Timestamp</TableHead>
                    <TableHead className="text-xs font-semibold">Verification Mode</TableHead>
                    <TableHead className="text-xs font-semibold">Audit Status</TableHead>
                    <TableHead className="text-center text-xs font-semibold pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClockLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                        No clock logs found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClockLogs.map(log => {
                      const dateObj = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                      const isClockIn = log.type === 'clock_in' || log.type === 'in';
                      return (
                        <TableRow key={log.id} className="hover:bg-slate-50/70">
                          <TableCell>
                            <div className="font-semibold text-xs text-slate-900">{log.employeeName}</div>
                            <div className="text-[11px] text-slate-400">{log.department || 'Operations'}</div>
                          </TableCell>

                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={isClockIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}
                            >
                              {isClockIn ? 'Clock IN' : 'Clock OUT'}
                            </Badge>
                          </TableCell>

                          <TableCell className="font-mono text-xs text-slate-700">
                            {dateObj ? dateObj.toLocaleString() : 'N/A'}
                          </TableCell>

                          <TableCell>
                            <span className="text-[11px] text-slate-600">
                              {log.verifiedMethod || (log.isWithinGeofence ? 'Geofence Verified' : 'Standard PIN')}
                            </span>
                          </TableCell>

                          <TableCell>
                            {log.isAdjusted ? (
                              <button 
                                onClick={() => setViewAuditLog(log)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100"
                              >
                                <History className="w-3 h-3" />
                                Adjusted ({log.auditHistory?.length || 1} changes)
                              </button>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-slate-400 font-normal">
                                Original Raw
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-center pr-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAdjustModal(log)}
                                disabled={!canManage}
                                className="h-7 text-xs gap-1 hover:bg-blue-50 text-blue-700 border-blue-200"
                              >
                                <Clock className="w-3 h-3" /> Adjust Log
                              </Button>
                              {log.isAdjusted && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setViewAuditLog(log)}
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                                  title="View Full Audit History"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Single Shift Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Roster Staff Shift</DialogTitle>
            <DialogDescription className="text-xs">
              Assign a work shift for {selectedCell?.date}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateShift} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Staff Member</Label>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                required
              >
                <option value="">-- Choose Staff Member --</option>
                {employees.map(e => (
                  <option key={e.uid} value={e.uid}>
                    {e.displayName || e.email} ({e.department || 'Operations'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Shift Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SHIFT_TEMPLATES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setShiftType(key as any);
                      setStartTime(t.start);
                      setEndTime(t.end);
                    }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      shiftType === key
                        ? 'border-purple-600 bg-purple-50/50 font-bold text-purple-900'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs">{t.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{t.start} - {t.end}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Start Time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">End Time</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Location / Station</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Main Store, POS 1..." />
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">Save Shift</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Shift Generator Modal */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              Bulk Shift Schedule Generator
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign multi-day recurring schedules across multiple staff members simultaneously.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Department Filter & Staff Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-slate-800">
                  Select Staff Members ({bulkSelectedStaff.length} selected)
                </Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleSelectAllStaff} className="h-6 text-[11px] text-purple-700">
                    Select All
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleClearStaffSelection} className="h-6 text-[11px] text-slate-500">
                    Clear
                  </Button>
                </div>
              </div>

              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 grid grid-cols-2 gap-1.5 bg-slate-50/50">
                {employees.map(emp => {
                  const isChecked = bulkSelectedStaff.includes(emp.uid);
                  return (
                    <label key={emp.uid} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-white cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleStaffSelection(emp.uid)}
                        className="rounded text-purple-600"
                      />
                      <span className="truncate">{emp.displayName || emp.email}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">Start Date *</Label>
                <Input type="date" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">End Date *</Label>
                <Input type="date" value={bulkEndDate} onChange={e => setBulkEndDate(e.target.value)} />
              </div>
            </div>

            {/* Days of Week */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Applicable Days of Week</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { idx: 1, label: 'Mon' },
                  { idx: 2, label: 'Tue' },
                  { idx: 3, label: 'Wed' },
                  { idx: 4, label: 'Thu' },
                  { idx: 5, label: 'Fri' },
                  { idx: 6, label: 'Sat' },
                  { idx: 0, label: 'Sun' },
                ].map(day => {
                  const isSelected = bulkDaysOfWeek.includes(day.idx);
                  return (
                    <button
                      key={day.idx}
                      type="button"
                      onClick={() => handleToggleDayOfWeek(day.idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isSelected 
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shift Template */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="font-semibold">Shift Template</Label>
                <select
                  value={bulkShiftType}
                  onChange={e => {
                    const val = e.target.value as any;
                    setBulkShiftType(val);
                    setBulkStartTime(SHIFT_TEMPLATES[val as keyof typeof SHIFT_TEMPLATES]?.start || '08:00');
                    setBulkEndTime(SHIFT_TEMPLATES[val as keyof typeof SHIFT_TEMPLATES]?.end || '16:00');
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="morning">Morning (08:00 - 16:00)</option>
                  <option value="afternoon">Afternoon (14:00 - 22:00)</option>
                  <option value="night">Night (22:00 - 06:00)</option>
                  <option value="custom">Custom Hours</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Start Time</Label>
                <Input type="time" value={bulkStartTime} onChange={e => setBulkStartTime(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">End Time</Label>
                <Input type="time" value={bulkEndTime} onChange={e => setBulkEndTime(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={() => setIsBulkModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleExecuteBulkShiftCreation}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              {saving ? <Sparkles className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Generate Shifts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clock Adjustment Modal (Audit-Protected) */}
      <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Audit-Protected Clock Adjustment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modifying clock record for <strong>{selectedClockLog?.employeeName}</strong>. 
              Changes will be permanently recorded in the immutable audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
              <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Mandatory Regulatory Justification
              </div>
              <p className="text-[11px] text-amber-700">
                To prevent wage tampering and comply with labor regulations, any adjustments must specify a clear reason (e.g., "Employee forgot to clock out due to system outage").
              </p>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Event Type</Label>
              <select
                value={adjustType}
                onChange={(e: any) => setAdjustType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="clock_in">Clock IN</option>
                <option value="clock_out">Clock OUT</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Adjusted Date & Time *</Label>
              <Input 
                type="datetime-local"
                value={adjustDateTime}
                onChange={e => setAdjustDateTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Justification Reason * (Min 8 chars)</Label>
              <Input 
                value={adjustJustification}
                onChange={e => setAdjustJustification(e.target.value)}
                placeholder="e.g., Supervisor override for overtime handover"
                required
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={() => setIsAdjustModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveClockAdjustment}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {saving ? <Sparkles className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              Commit Audit Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Audit History Modal */}
      <Dialog open={!!viewAuditLog} onOpenChange={() => setViewAuditLog(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" />
              Immutable Audit Trail
            </DialogTitle>
            <DialogDescription className="text-xs">
              Historical ledger of adjustments for {viewAuditLog?.employeeName} ({viewAuditLog?.type?.toUpperCase()})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-72 overflow-y-auto">
            {(!viewAuditLog?.auditHistory || viewAuditLog.auditHistory.length === 0) ? (
              <p className="text-xs text-slate-400 text-center py-6">No historical adjustments on record.</p>
            ) : (
              viewAuditLog.auditHistory.map((audit, idx) => {
                const adjDate = audit.adjustedAt?.toDate ? audit.adjustedAt.toDate() : new Date(audit.adjustedAt);
                return (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>Adjusted by: {audit.adjustedByName || audit.adjustedBy}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{adjDate.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <strong>Reason:</strong> {audit.reason}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAuditLog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
