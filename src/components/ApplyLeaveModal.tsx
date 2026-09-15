import React, { useState, useMemo, useEffect } from 'react';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Send,
  UserCheck,
  Palmtree,
  Stethoscope,
  Flame,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, LeaveType, LeaveRequest } from '../types';

interface ApplyLeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
  supervisors?: UserProfile[];
  onSuccess?: () => void;
}

export function ApplyLeaveModal({
  open,
  onOpenChange,
  profile,
  supervisors = [],
  onSuccess
}: ApplyLeaveModalProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.phone || '');
  const [selectedSuperiorId, setSelectedSuperiorId] = useState<string>(profile?.superiorId || '');
  const [submitting, setSubmitting] = useState(false);
  const [myPastRequests, setMyPastRequests] = useState<LeaveRequest[]>([]);

  // Listen to this user's leave requests to compute live accurate balances
  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'leaveRequests'),
      where('employeeId', '==', profile.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMyPastRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
    });
    return () => unsub();
  }, [profile?.uid]);

  // If profile superiorId changes, update selected superior
  useEffect(() => {
    if (profile?.superiorId) {
      setSelectedSuperiorId(profile.superiorId);
    }
  }, [profile?.superiorId]);

  // Compute live balances
  const balances = useMemo(() => {
    const baseQuota = {
      annual: profile?.leaveBalance?.annual ?? 14,
      sick: profile?.leaveBalance?.sick ?? 14,
      emergency: profile?.leaveBalance?.emergency ?? 5,
      unpaid: profile?.leaveBalance?.unpaid ?? 30,
      maternity_paternity: 60
    };

    const taken = {
      annual: 0,
      sick: 0,
      emergency: 0,
      unpaid: 0,
      maternity_paternity: 0
    };

    const pending = {
      annual: 0,
      sick: 0,
      emergency: 0,
      unpaid: 0,
      maternity_paternity: 0
    };

    myPastRequests.forEach(req => {
      const days = req.daysCount || 1;
      const type = req.type as keyof typeof taken;
      if (req.status === 'approved' && taken[type] !== undefined) {
        taken[type] += days;
      } else if (req.status === 'pending' && pending[type] !== undefined) {
        pending[type] += days;
      }
    });

    return {
      annual: {
        total: baseQuota.annual,
        taken: taken.annual,
        pending: pending.annual,
        available: Math.max(0, baseQuota.annual - taken.annual)
      },
      sick: {
        total: baseQuota.sick,
        taken: taken.sick,
        pending: pending.sick,
        available: Math.max(0, baseQuota.sick - taken.sick)
      },
      emergency: {
        total: baseQuota.emergency,
        taken: taken.emergency,
        pending: pending.emergency,
        available: Math.max(0, baseQuota.emergency - taken.emergency)
      },
      unpaid: {
        total: baseQuota.unpaid,
        taken: taken.unpaid,
        pending: pending.unpaid,
        available: Math.max(0, baseQuota.unpaid - taken.unpaid)
      }
    };
  }, [profile, myPastRequests]);

  // Calculate working days between startDate and endDate
  const requestedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;

    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Count weekdays only (Mon-Fri)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    // If start and end are on the weekend, at least count 1 day
    return Math.max(count, 1);
  }, [startDate, endDate]);

  const currentAvailableBalance = useMemo(() => {
    if (leaveType === 'annual') return balances.annual.available;
    if (leaveType === 'sick') return balances.sick.available;
    if (leaveType === 'emergency') return balances.emergency.available;
    if (leaveType === 'unpaid') return balances.unpaid.available;
    return 30;
  }, [leaveType, balances]);

  const isExceedingBalance = leaveType !== 'unpaid' && requestedDays > currentAvailableBalance;

  // Pre-set helper buttons
  const setQuickRange = (days: number) => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + (days - 1));
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const superiorInfo = useMemo(() => {
    if (profile?.superiorName && profile?.superiorId) {
      return { id: profile.superiorId, name: profile.superiorName };
    }
    const matched = supervisors.find(s => s.uid === selectedSuperiorId);
    if (matched) {
      return { id: matched.uid, name: matched.displayName || matched.email };
    }
    return null;
  }, [profile, supervisors, selectedSuperiorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast.error('You must be signed in to apply for leave');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date cannot be prior to start date');
      return;
    }

    if (requestedDays <= 0) {
      toast.error('Invalid leave duration');
      return;
    }

    if (isExceedingBalance) {
      toast.error(`Requested ${requestedDays} days exceeds your available balance (${currentAvailableBalance} days) for ${leaveType} leave.`);
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason or purpose for this leave request');
      return;
    }

    setSubmitting(true);
    try {
      const assignedSuperiorId = superiorInfo?.id || profile.superiorId || '';
      const assignedSuperiorName = superiorInfo?.name || profile.superiorName || 'Management / HR';

      await addDoc(collection(db, 'leaveRequests'), {
        employeeId: profile.uid,
        employeeName: profile.displayName || profile.email,
        employeeEmail: profile.email,
        department: profile.department || 'General',
        superiorId: assignedSuperiorId,
        superiorName: assignedSuperiorName,
        type: leaveType,
        startDate,
        endDate,
        daysCount: requestedDays,
        reason: reason.trim(),
        emergencyContact: emergencyPhone,
        status: 'pending',
        appliedAt: new Date().toISOString()
      });

      toast.success(
        `Leave application submitted (${requestedDays} days). Routed to ${assignedSuperiorName} for review.`
      );
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leaveRequests');
      toast.error('Failed to submit leave request. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <CalendarIcon className="w-5 h-5" />
            <DialogTitle className="text-xl font-bold">Apply for Leave</DialogTitle>
          </div>
          <DialogDescription>
            Submit your leave application for approval. Your balance will be tracked automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Live Balance Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-1">
          <div 
            onClick={() => setLeaveType('annual')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              leaveType === 'annual' 
                ? 'border-blue-500 bg-blue-50/70 shadow-xs' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Palmtree className="w-3.5 h-3.5 text-blue-600" /> Annual
              </span>
              <span>{balances.annual.total}d Total</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {balances.annual.available} <span className="text-xs font-normal text-slate-500">days left</span>
            </div>
            {balances.annual.pending > 0 && (
              <div className="text-[10px] text-amber-600 font-medium mt-1">
                {balances.annual.pending}d pending
              </div>
            )}
          </div>

          <div 
            onClick={() => setLeaveType('sick')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              leaveType === 'sick' 
                ? 'border-emerald-500 bg-emerald-50/70 shadow-xs' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> Sick
              </span>
              <span>{balances.sick.total}d Total</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {balances.sick.available} <span className="text-xs font-normal text-slate-500">days left</span>
            </div>
            {balances.sick.pending > 0 && (
              <div className="text-[10px] text-amber-600 font-medium mt-1">
                {balances.sick.pending}d pending
              </div>
            )}
          </div>

          <div 
            onClick={() => setLeaveType('emergency')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              leaveType === 'emergency' 
                ? 'border-amber-500 bg-amber-50/70 shadow-xs' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-600" /> Emergency
              </span>
              <span>{balances.emergency.total}d Total</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {balances.emergency.available} <span className="text-xs font-normal text-slate-500">days left</span>
            </div>
          </div>

          <div 
            onClick={() => setLeaveType('unpaid')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              leaveType === 'unpaid' 
                ? 'border-purple-500 bg-purple-50/70 shadow-xs' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-purple-600" /> Unpaid
              </span>
              <span>30d Max</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {balances.unpaid.available} <span className="text-xs font-normal text-slate-500">allowed</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Leave Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Leave Category</label>
            <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select leave category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual Leave (Vacation & Personal)</SelectItem>
                <SelectItem value="sick">Medical / Sick Leave (Medical cert required)</SelectItem>
                <SelectItem value="emergency">Emergency / Compassionate Leave</SelectItem>
                <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                <SelectItem value="maternity_paternity">Maternity / Paternity Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Pickers with Calendar Inputs */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-primary" /> Select Leave Period
              </span>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500 mr-1">Quick:</span>
                <button 
                  type="button" 
                  onClick={() => setQuickRange(1)}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium"
                >
                  1 Day
                </button>
                <button 
                  type="button" 
                  onClick={() => setQuickRange(3)}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium"
                >
                  3 Days
                </button>
                <button 
                  type="button" 
                  onClick={() => setQuickRange(5)}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium"
                >
                  1 Week
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Start Date</label>
                <Input 
                  type="date" 
                  value={startDate} 
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) {
                      setEndDate(e.target.value);
                    }
                  }} 
                  className="bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">End Date</label>
                <Input 
                  type="date" 
                  value={endDate} 
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="bg-white"
                  required
                />
              </div>
            </div>

            {/* Calculated Days & Validation pill */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Working Days Requested:</span>
                <span className="font-bold text-slate-900 text-sm">{requestedDays} {requestedDays === 1 ? 'day' : 'days'}</span>
              </div>

              {isExceedingBalance ? (
                <div className="flex items-center gap-1 text-red-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Exceeds balance ({currentAvailableBalance}d available)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Remaining after leave: {Math.max(0, currentAvailableBalance - requestedDays)}d</span>
                </div>
              )}
            </div>
          </div>

          {/* Reporting Superior Routing */}
          <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" /> Reporting Superior for Approval
              </label>
              {profile?.superiorName && (
                <Badge variant="outline" className="text-[10px] bg-slate-50">
                  Assigned by HR
                </Badge>
              )}
            </div>

            {profile?.superiorName ? (
              <div className="text-sm font-medium text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                <span>{profile.superiorName}</span>
                <span className="text-xs text-slate-500 font-normal">Will receive your request for approval</span>
              </div>
            ) : (
              <div>
                <Select value={selectedSuperiorId} onValueChange={setSelectedSuperiorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your manager / superior" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.length > 0 ? (
                      supervisors
                        .filter(s => s.uid !== profile?.uid)
                        .map(s => (
                          <SelectItem key={s.uid} value={s.uid}>
                            {s.displayName || s.email} {s.department ? `(${s.department} Dept)` : ''}
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value="management">Department Head / HR Manager</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 mt-1">
                  If you haven't been assigned a direct superior yet, please choose the manager in charge of your department.
                </p>
              </div>
            )}
          </div>

          {/* Reason & Emergency Contact */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Reason / Details</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Brief reason for your leave (e.g., Annual family trip, Medical appointment, Personal matters)..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">Contact Number during leave (Optional)</label>
              <Input 
                type="tel"
                placeholder="+1 555-0199"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || isExceedingBalance || requestedDays <= 0}
              className="gap-2"
            >
              {submitting ? (
                <>Submitting...</>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Application
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
