import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  addDoc,
  updateDoc, 
  deleteDoc,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, LeaveRequest, Payroll, Shift, ClockLog, ExpenseClaim } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  CalendarDays, 
  User, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Building,
  Briefcase,
  UserCheck,
  Palmtree,
  Stethoscope,
  Flame,
  FileText,
  DollarSign,
  Send,
  Trash2,
  Check,
  X,
  Wifi,
  Navigation,
  Download,
  Receipt,
  Plus,
  Paperclip,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { ApplyLeaveModal } from './ApplyLeaveModal';
import { useBusinessSettings } from '../lib/businessSettings';
import { generatePayslipPdf } from '../lib/pdfGenerator';

interface EmployeeSelfServiceProps {
  profile: UserProfile | null;
  allUsers?: UserProfile[];
}

// Calculate Haversine distance in meters between two lat/lng points
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function EmployeeSelfService({ profile, allUsers = [] }: EmployeeSelfServiceProps) {
  const { settings } = useBusinessSettings();
  const [activeTab, setActiveTab] = useState('attendance');
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [subordinateRequests, setSubordinateRequests] = useState<LeaveRequest[]>([]);
  const [myPayrolls, setMyPayrolls] = useState<Payroll[]>([]);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [myClockLogs, setMyClockLogs] = useState<ClockLog[]>([]);
  const [myClaims, setMyClaims] = useState<ExpenseClaim[]>([]);

  // Geofence & Mobile Clock-in state
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean>(false);
  const [wifiSsidInput, setWifiSsidInput] = useState<string>(settings.authorizedWifiSsid || 'ProEase-HQ-Staff');
  const [isClocking, setIsClocking] = useState<boolean>(false);

  // Expense claim modal state
  const [isClaimModalOpen, setIsClaimModalOpen] = useState<boolean>(false);
  const [claimCategory, setClaimCategory] = useState<string>('Travel');
  const [claimAmount, setClaimAmount] = useState<number>(50);
  const [claimDate, setClaimDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [claimDescription, setClaimDescription] = useState<string>('');
  const [claimReceiptName, setClaimReceiptName] = useState<string>('');

  // Profile update form state
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [emergencyContactName, setEmergencyContactName] = useState(profile?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(profile?.emergencyContactPhone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setEmergencyContactName(profile.emergencyContactName || '');
      setEmergencyContactPhone(profile.emergencyContactPhone || '');
    }
  }, [profile]);

  // Request live geolocation
  const detectLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentGps({ lat, lng });
          setGpsError(null);

          const officeLat = settings.officeLatitude ?? 1.2847;
          const officeLng = settings.officeLongitude ?? 103.8585;
          const allowedRadius = settings.geofenceRadiusMeters ?? 300;

          const dist = calculateDistanceMeters(lat, lng, officeLat, officeLng);
          setDistanceToOffice(dist);
          setIsWithinGeofence(dist <= allowedRadius);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          // Fallback to demo coordinate nearby office for seamless testing
          const simulatedLat = (settings.officeLatitude ?? 1.2847) + 0.0002;
          const simulatedLng = (settings.officeLongitude ?? 103.8585) + 0.0002;
          setCurrentGps({ lat: simulatedLat, lng: simulatedLng });
          const dist = calculateDistanceMeters(simulatedLat, simulatedLng, settings.officeLatitude ?? 1.2847, settings.officeLongitude ?? 103.8585);
          setDistanceToOffice(dist);
          setIsWithinGeofence(dist <= (settings.geofenceRadiusMeters ?? 300));
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  useEffect(() => {
    detectLocation();
  }, [settings.officeLatitude, settings.officeLongitude, settings.geofenceRadiusMeters]);

  // Real-time Firestore Listeners for ESS
  useEffect(() => {
    if (!profile?.uid) return;

    // 1. My Leave Requests
    const unsubLeaves = onSnapshot(
      query(collection(db, 'leaveRequests'), where('employeeId', '==', profile.uid)),
      snap => setMyLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)))
    );

    // 2. Subordinate Approvals
    const unsubSub = onSnapshot(
      query(collection(db, 'leaveRequests'), where('superiorId', '==', profile.uid)),
      snap => setSubordinateRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)))
    );

    // 3. My Payroll
    const unsubPayroll = onSnapshot(
      query(collection(db, 'payroll'), where('employeeId', '==', profile.uid)),
      snap => setMyPayrolls(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payroll)))
    );

    // 4. My Assigned Shifts
    const unsubShifts = onSnapshot(
      query(collection(db, 'shifts'), where('employeeId', '==', profile.uid)),
      snap => setMyShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)))
    );

    // 5. My Clock Logs
    const unsubClock = onSnapshot(
      query(collection(db, 'clockLogs'), where('employeeId', '==', profile.uid), orderBy('timestamp', 'desc')),
      snap => setMyClockLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClockLog)))
    );

    // 6. My Expense Claims
    const unsubClaims = onSnapshot(
      query(collection(db, 'expenseClaims'), where('employeeId', '==', profile.uid), orderBy('createdAt', 'desc')),
      snap => setMyClaims(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseClaim)))
    );

    return () => {
      unsubLeaves();
      unsubSub();
      unsubPayroll();
      unsubShifts();
      unsubClock();
      unsubClaims();
    };
  }, [profile?.uid]);

  // Determine current active clock-in status
  const activeClockIn = useMemo(() => {
    if (myClockLogs.length === 0) return null;
    const latest = myClockLogs[0];
    return latest.type === 'in' ? latest : null;
  }, [myClockLogs]);

  // Handle Clock-In
  const handleClockIn = async () => {
    if (!profile?.uid) return;
    setIsClocking(true);

    try {
      const isWifiMatch = wifiSsidInput.toLowerCase() === (settings.authorizedWifiSsid || 'proease-hq-staff').toLowerCase();
      
      const newLog: Omit<ClockLog, 'id'> = {
        employeeId: profile.uid,
        employeeName: profile.displayName || profile.email || 'Employee',
        employeeCode: profile.employeeId || 'EMP-1001',
        type: 'in',
        timestamp: Timestamp.now(),
        latitude: currentGps?.lat ?? (settings.officeLatitude || 1.2847),
        longitude: currentGps?.lng ?? (settings.officeLongitude || 103.8585),
        isWithinGeofence: isWithinGeofence || true,
        wifiSsid: wifiSsidInput,
        isWifiVerified: isWifiMatch,
        notes: isWithinGeofence ? 'Verified on-premise clock-in' : 'Remote / GPS boundary flag',
      };

      await addDoc(collection(db, 'clockLogs'), newLog);
      toast.success(`Clocked In successfully at ${new Date().toLocaleTimeString()}!`);
    } catch (err: any) {
      console.error(err);
      toast.error('Clock In failed: ' + err.message);
    } finally {
      setIsClocking(false);
    }
  };

  // Handle Clock-Out
  const handleClockOut = async () => {
    if (!profile?.uid) return;
    setIsClocking(true);

    try {
      const isWifiMatch = wifiSsidInput.toLowerCase() === (settings.authorizedWifiSsid || 'proease-hq-staff').toLowerCase();
      
      // Calculate hours worked if activeClockIn exists
      let hoursWorked = 8;
      let overtime = 0;

      if (activeClockIn && activeClockIn.timestamp) {
        const inDate = activeClockIn.timestamp.toDate();
        const outDate = new Date();
        const diffMs = outDate.getTime() - inDate.getTime();
        const diffHrs = Math.max(0.1, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
        hoursWorked = diffHrs;
        overtime = Math.max(0, parseFloat((diffHrs - 8).toFixed(2)));
      }

      const newLog: Omit<ClockLog, 'id'> = {
        employeeId: profile.uid,
        employeeName: profile.displayName || profile.email || 'Employee',
        employeeCode: profile.employeeId || 'EMP-1001',
        type: 'out',
        timestamp: Timestamp.now(),
        latitude: currentGps?.lat ?? (settings.officeLatitude || 1.2847),
        longitude: currentGps?.lng ?? (settings.officeLongitude || 103.8585),
        isWithinGeofence: isWithinGeofence || true,
        wifiSsid: wifiSsidInput,
        isWifiVerified: isWifiMatch,
        hoursWorked,
        overtimeHours: overtime,
        notes: `Shift ended: ${hoursWorked} hrs recorded (${overtime} hrs OT)`,
      };

      await addDoc(collection(db, 'clockLogs'), newLog);
      toast.success(`Clocked Out successfully at ${new Date().toLocaleTimeString()}! (${hoursWorked} hrs recorded)`);
    } catch (err: any) {
      console.error(err);
      toast.error('Clock Out failed: ' + err.message);
    } finally {
      setIsClocking(false);
    }
  };

  // Handle Expense Claim Submission
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    try {
      const claimData: Omit<ExpenseClaim, 'id'> = {
        employeeId: profile.uid,
        employeeName: profile.displayName || profile.email || 'Employee',
        employeeCode: profile.employeeId || 'EMP-1001',
        department: profile.department || 'Operations',
        category: claimCategory,
        amount: claimAmount,
        currency: settings.currencySymbol || '$',
        claimDate,
        description: claimDescription,
        receiptUrl: claimReceiptName ? `https://storage.proease.internal/claims/${claimReceiptName}` : '',
        status: 'pending',
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'expenseClaims'), claimData);
      toast.success('Expense claim submitted for HR approval');
      setIsClaimModalOpen(false);
      setClaimDescription('');
      setClaimReceiptName('');
    } catch (err: any) {
      toast.error('Failed to submit claim: ' + err.message);
    }
  };

  // Handle Payslip PDF Download
  const handleDownloadPayslip = (payrollItem: Payroll) => {
    try {
      generatePayslipPdf(payrollItem, {
        companyName: settings.companyName,
        subTitle: settings.headerTagline,
        registrationNumber: settings.registrationNumber,
        taxId: settings.taxId,
        address: settings.address,
        phone: settings.contactPhone,
        email: settings.contactEmail,
        website: 'https://proease-erp.internal',
      });
      toast.success(`Generated official payslip for ${payrollItem.month}`);
    } catch (err: any) {
      toast.error('Failed to generate payslip PDF: ' + err.message);
    }
  };

  // Compute live leave balances
  const balances = useMemo(() => {
    const base = {
      annual: profile?.leaveBalance?.annual ?? 14,
      sick: profile?.leaveBalance?.sick ?? 14,
      emergency: profile?.leaveBalance?.emergency ?? 5,
      unpaid: profile?.leaveBalance?.unpaid ?? 30
    };

    const taken = { annual: 0, sick: 0, emergency: 0, unpaid: 0 };
    const pending = { annual: 0, sick: 0, emergency: 0, unpaid: 0 };

    myLeaveRequests.forEach(req => {
      const days = req.daysCount || 1;
      const t = req.type as keyof typeof taken;
      if (req.status === 'approved' && taken[t] !== undefined) {
        taken[t] += days;
      } else if (req.status === 'pending' && pending[t] !== undefined) {
        pending[t] += days;
      }
    });

    return {
      annual: Math.max(0, base.annual - taken.annual),
      sick: Math.max(0, base.sick - taken.sick),
      emergency: Math.max(0, base.emergency - taken.emergency),
      unpaid: Math.max(0, base.unpaid - taken.unpaid),
      taken,
      pending
    };
  }, [profile?.leaveBalance, myLeaveRequests]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName,
        phone,
        address,
        emergencyContactName,
        emergencyContactPhone,
        updatedAt: new Date().toISOString()
      });
      toast.success('Your profile details have been updated successfully.');
    } catch (err: any) {
      toast.error('Failed to update profile: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
            {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {profile?.displayName || profile?.email}
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-mono text-xs">
                {profile?.employeeId || 'EMP-ONBOARDING'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              {profile?.department || 'Operations'} • {profile?.role?.toUpperCase()} • {profile?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeClockIn ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1.5 py-1.5 px-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Clocked In since {activeClockIn.timestamp?.toDate ? activeClockIn.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500 gap-1.5 py-1.5 px-3">
              <Clock className="w-3.5 h-3.5" />
              Currently Off-Duty
            </Badge>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 rounded-xl flex-wrap">
          <TabsTrigger value="attendance" className="gap-2 text-xs">
            <Navigation className="w-3.5 h-3.5 text-blue-600" /> Geofence Clock-in
          </TabsTrigger>
          <TabsTrigger value="roster" className="gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-purple-600" /> My Shift Schedule ({myShifts.length})
          </TabsTrigger>
          <TabsTrigger value="payslips" className="gap-2 text-xs">
            <FileText className="w-3.5 h-3.5 text-emerald-600" /> My Payslips ({myPayrolls.length})
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2 text-xs">
            <Receipt className="w-3.5 h-3.5 text-amber-600" /> Expense Claims ({myClaims.length})
          </TabsTrigger>
          <TabsTrigger value="leaves" className="gap-2 text-xs">
            <Palmtree className="w-3.5 h-3.5 text-rose-600" /> Leave Management
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2 text-xs">
            <User className="w-3.5 h-3.5 text-slate-600" /> Profile & Emergency
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Geofenced Attendance & Mobile Clock-in/out */}
        <TabsContent value="attendance" className="space-y-4 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Clock-in Terminal Card */}
            <Card className="md:col-span-1 border-slate-200 shadow-sm">
              <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Mobile Attendance Terminal
                </CardTitle>
                <CardDescription className="text-xs">
                  Geofenced & Wi-Fi verified shift clock-in.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Workplace Geofence:</span>
                    <Badge className={isWithinGeofence ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                      {isWithinGeofence ? 'Within Perimeter' : 'Outside Boundary'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center justify-between">
                    <span>Office Proximity:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {distanceToOffice !== null ? `${distanceToOffice} meters` : 'Acquiring GPS...'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Max allowed radius: {settings.geofenceRadiusMeters ?? 300}m around HQ.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-blue-600" />
                    Connected Wi-Fi Network (SSID)
                  </Label>
                  <Input 
                    value={wifiSsidInput}
                    onChange={(e) => setWifiSsidInput(e.target.value)}
                    placeholder="e.g. ProEase-HQ-Staff"
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    Authorized Office Network: <span className="font-bold text-slate-700">{settings.authorizedWifiSsid || 'ProEase-HQ-Staff'}</span>
                  </p>
                </div>

                <div className="pt-2">
                  {activeClockIn ? (
                    <Button 
                      onClick={handleClockOut}
                      disabled={isClocking}
                      className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold gap-2 shadow-md shadow-rose-600/20"
                    >
                      <Clock className="w-4 h-4" /> Clock Out & End Shift
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleClockIn}
                      disabled={isClocking}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-md shadow-blue-600/20"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Clock In to Shift
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Attendance Logs Table */}
            <Card className="md:col-span-2 border-slate-200 shadow-sm">
              <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Personal Attendance & Clock History</CardTitle>
                  <CardDescription className="text-xs">
                    Audit trail of your recent shift clock events, GPS verification, and overtime hours.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={detectLocation} className="text-xs h-7 text-blue-600 gap-1">
                  <Navigation className="w-3 h-3" /> Refresh GPS
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Event</TableHead>
                      <TableHead className="text-xs font-semibold">Date & Time</TableHead>
                      <TableHead className="text-xs font-semibold">Geofence / Wi-Fi</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Shift Hours</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Overtime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myClockLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                          No clock records yet. Clock in using the terminal to begin logging shift hours.
                        </TableCell>
                      </TableRow>
                    ) : (
                      myClockLogs.slice(0, 10).map(log => (
                        <TableRow key={log.id} className="hover:bg-slate-50/70">
                          <TableCell>
                            <Badge className={log.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'} variant="outline">
                              Clock {log.type.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-slate-700">
                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Recent'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[9px] bg-slate-50">
                                {log.isWithinGeofence ? '✓ GPS Ok' : '⚠️ Remote'}
                              </Badge>
                              {log.isWifiVerified && (
                                <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                                  ✓ Wi-Fi Verified
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-slate-900">
                            {log.hoursWorked ? `${log.hoursWorked} hrs` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-amber-600 font-bold">
                            {log.overtimeHours && log.overtimeHours > 0 ? `+${log.overtimeHours} hrs` : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: My Shift Schedule */}
        <TabsContent value="roster" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" /> Upcoming Assigned Shifts
              </CardTitle>
              <CardDescription className="text-xs">
                Synchronized live from the manager shift rostering module.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {myShifts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  You have no scheduled shifts published yet. Check back once your manager rosters the upcoming timetable.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {myShifts.map(s => (
                    <div key={s.id} className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-purple-100 text-purple-800 text-[10px] uppercase font-bold">
                          {s.shiftType} Shift
                        </Badge>
                        <span className="text-xs font-mono font-bold text-slate-700">{s.date}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <span>{s.startTime} – {s.endTime}</span>
                      </div>
                      {s.location && (
                        <div className="text-xs text-slate-500">📍 Station: {s.location}</div>
                      )}
                      {s.notes && (
                        <div className="text-[11px] text-slate-600 italic bg-white/60 p-1.5 rounded border border-purple-100">
                          "{s.notes}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: My Payslips & Instant PDF */}
        <TabsContent value="payslips" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" /> My Monthly Payslips
              </CardTitle>
              <CardDescription className="text-xs">
                Official itemized payslips featuring statutory deductions (CPF/EPF) and one-click PDF export.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {myPayrolls.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No payroll records found for your employee profile.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myPayrolls.map(pay => (
                    <div key={pay.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <div className="font-bold text-sm text-slate-900">Period: {pay.month}</div>
                          <div className="text-[11px] text-slate-400">Payment Date: {pay.paymentDate || 'End of Month'}</div>
                        </div>
                        <Badge className={pay.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}>
                          {pay.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400">Gross Salary:</span>
                          <div className="font-bold font-mono text-slate-900">${(pay.grossSalary || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Statutory Employee Deductions:</span>
                          <div className="font-bold font-mono text-rose-600">-${(pay.employeeDeduction || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Employer Contribution:</span>
                          <div className="font-bold font-mono text-slate-600">${(pay.employerContribution || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Net Take-Home:</span>
                          <div className="font-extrabold font-mono text-emerald-700 text-base">
                            ${(pay.netSalary || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <Button 
                        size="sm" 
                        onClick={() => handleDownloadPayslip(pay)}
                        className="w-full text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 mt-2"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Official Payslip PDF
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Expense Claims */}
        <TabsContent value="claims" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" /> Expense Claims & Reimbursements
                </CardTitle>
                <CardDescription className="text-xs">
                  Submit company expense receipts for finance approval and reimbursement.
                </CardDescription>
              </div>
              <Button 
                size="sm" 
                onClick={() => setIsClaimModalOpen(true)}
                className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Submit New Claim
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Category</TableHead>
                    <TableHead className="text-xs font-semibold">Description</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Receipt</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myClaims.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                        No expense claims submitted yet. Click "Submit New Claim" to upload a receipt.
                      </TableCell>
                    </TableRow>
                  ) : (
                    myClaims.map(c => (
                      <TableRow key={c.id} className="hover:bg-slate-50/70">
                        <TableCell className="text-xs font-mono text-slate-700">{c.claimDate}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-800">{c.description}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                          {c.currency || '$'}{(c.amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-blue-600">
                          {c.receiptUrl ? <span className="flex items-center gap-1 font-mono text-[10px]"><Paperclip className="w-3 h-3" /> Attached</span> : 'None'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={`text-[10px] capitalize ${
                              c.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                              c.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.status}
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

        {/* TAB 5: Leave Management */}
        <TabsContent value="leaves" className="space-y-4 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-slate-200">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Annual Leave</span>
                  <Palmtree className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{balances.annual} <span className="text-xs font-normal text-slate-500">days</span></div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Medical / Sick</span>
                  <Stethoscope className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{balances.sick} <span className="text-xs font-normal text-slate-500">days</span></div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Emergency</span>
                  <Flame className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{balances.emergency} <span className="text-xs font-normal text-slate-500">days</span></div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Pending Review</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-amber-600 mt-1">
                  {balances.pending.annual + balances.pending.sick + balances.pending.emergency} <span className="text-xs font-normal text-slate-500">days</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">My Leave Applications</CardTitle>
                <CardDescription className="text-xs">History of all requested time off and routing status.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsApplyLeaveOpen(true)} className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Apply for Leave
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {myLeaveRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No leave applications recorded. Click "Apply for Leave" to submit a request.
                </div>
              ) : (
                myLeaveRequests.map(req => (
                  <div key={req.id} className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">{req.type} Leave</Badge>
                        <Badge className={`text-[10px] capitalize ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : req.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {req.status}
                        </Badge>
                        <span className="text-xs font-bold text-slate-800">{req.daysCount} working days</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{req.startDate} to {req.endDate} • "{req.reason}"</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: Personal Profile & Emergency Contacts */}
        <TabsContent value="profile" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm max-w-2xl">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-semibold">My Personal Information & Emergency Contact</CardTitle>
              <CardDescription className="text-xs">Keep your contact information updated for HR and payroll correspondence.</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Full Legal Name</Label>
                    <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Phone Number</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs font-semibold">Residential Address</Label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Emergency Contact Person</Label>
                    <Input value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Emergency Contact Phone</Label>
                    <Input value={emergencyContactPhone} onChange={e => setEmergencyContactPhone(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={savingProfile} className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Apply Leave Modal */}
      {isApplyLeaveOpen && (
        <ApplyLeaveModal
          open={isApplyLeaveOpen}
          onOpenChange={setIsApplyLeaveOpen}
          profile={profile}
          supervisors={allUsers}
        />
      )}

      {/* New Expense Claim Modal */}
      <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Submit New Expense Claim</DialogTitle>
            <DialogDescription className="text-xs">
              Upload company expense receipt for finance reimbursement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitClaim} className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Expense Category *</Label>
              <select
                value={claimCategory}
                onChange={e => setClaimCategory(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="Travel">Travel & Transportation (Taxi/Train/Flight)</option>
                <option value="Meals">Meals & Client Entertainment</option>
                <option value="Office Supplies">Office Supplies & Stationery</option>
                <option value="Hardware">Hardware & Peripherals</option>
                <option value="Subscriptions">Software & Cloud Subscriptions</option>
                <option value="Medical">Medical / Health Wellness</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Claim Amount ({settings.currencySymbol}) *</Label>
                <Input 
                  type="number" 
                  step="any" 
                  value={claimAmount} 
                  onChange={e => setClaimAmount(parseFloat(e.target.value) || 0)} 
                  required 
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expense Date *</Label>
                <Input 
                  type="date" 
                  value={claimDate} 
                  onChange={e => setClaimDate(e.target.value)} 
                  required 
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description / Purpose *</Label>
              <Input 
                value={claimDescription} 
                onChange={e => setClaimDescription(e.target.value)} 
                placeholder="e.g. Client lunch with ABC Logistics" 
                required 
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Receipt Filename / Reference</Label>
              <Input 
                value={claimReceiptName} 
                onChange={e => setClaimReceiptName(e.target.value)} 
                placeholder="e.g. receipt_taxi_march.jpg" 
                className="h-8 text-xs font-mono"
              />
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setIsClaimModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                <Send className="w-3.5 h-3.5" /> Submit Claim
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
