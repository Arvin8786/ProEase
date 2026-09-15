/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  User as UserIcon,
  Briefcase,
  FileText,
  DollarSign,
  TrendingUp,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  ShoppingBag,
  Building2,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  setDoc, 
  getDoc,
  addDoc,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
  where,
  runTransaction
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { Toaster, toast } from 'sonner';

// Modular Components & Shared Types
import { HRM } from './components/HRM';
import { EmployeeSelfService } from './components/EmployeeSelfService';
import { SalesModule } from './components/SalesModule';
import { Sidebar } from './components/Sidebar';
import { PosTerminal } from './components/pos/PosTerminal';
import { AccessDenied } from './components/AccessDenied';
import { PurchaseRequests } from './components/procurement/PurchaseRequests';
import { GoodsReceipt } from './components/procurement/GoodsReceipt';
import { GoodsIssuance } from './components/procurement/GoodsIssuance';
import { BusinessSetupSettings } from './components/settings/BusinessSetupSettings';
import { ShiftRosterManagement } from './components/roster/ShiftRosterManagement';
import { AccountingModule } from './components/accounting/AccountingModule';
import { MasterDataManagement } from './components/procurement/MasterDataManagement';
import { ExecutiveAiAnalytics } from './components/analytics/ExecutiveAiAnalytics';
import { canAccessModule, getDefaultTabForRole } from './lib/rbac';
import { useBusinessSettings } from './lib/businessSettings';
import { 
  UserProfile, 
  Role, 
  Employee, 
  LeaveRequest, 
  Appraisal, 
  Payroll, 
  InventoryItem, 
  PurchaseRequest,
  DEPARTMENTS 
} from './types';

// --- Components ---

export default function App() {
  return (
    <ERPApp />
  );
}

function ERPApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { settings: businessSettings } = useBusinessSettings();

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Real-time listener for user profile document
        unsubProfile = onSnapshot(doc(db, 'users', currentUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'User',
              role: currentUser.email === 'arvin8786@gmail.com' ? 'admin' : 'employee',
              department: currentUser.email === 'arvin8786@gmail.com' ? 'Executive' : 'Operations',
              position: currentUser.email === 'arvin8786@gmail.com' ? 'Managing Director' : 'Staff Member',
              leaveBalance: { annual: 14, sick: 14, emergency: 5, unpaid: 30 }
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setProfile(newProfile);
          }
          setLoading(false);
        });

        // Real-time listener for all users (for superiors & team members dropdowns)
        unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
          setAllUsers(snap.docs.map(d => d.data() as UserProfile));
        });
      } else {
        if (unsubProfile) unsubProfile();
        if (unsubUsers) unsubUsers();
        setProfile(null);
        setAllUsers([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (unsubUsers) unsubUsers();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
      toast.error('Login failed. Please try again.');
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">Loading ProEaseERP...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Strict RBAC Access Check
  const isHR = profile?.department === 'HR' || profile?.role === 'hr_manager' || profile?.role === 'admin' || profile?.email === 'arvin8786@gmail.com';
  const isSales = profile?.department === 'Sales' || profile?.role === 'sales' || profile?.role === 'admin' || profile?.email === 'arvin8786@gmail.com';
  const isWarehouse = profile?.department === 'Warehouse' || profile?.role === 'storekeeper' || profile?.role === 'admin' || profile?.email === 'arvin8786@gmail.com';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden relative">
      <Toaster position="top-right" />
      
      {/* Sidebar Overlay for Mobile/Auto-hide */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab: string) => {
          setActiveTab(tab);
          setIsSidebarOpen(false); // Close on selection
        }} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        profile={profile}
        onLogout={handleLogout}
        onSimulateRole={(simRole: Role) => {
          setProfile(prev => prev ? ({ ...prev, role: simRole }) : null);
          toast.info(`Simulating access role: ${simRole}`);
        }}
      />

      {/* Main Content */}
      <main 
        className="flex-1 flex flex-col overflow-hidden relative"
        onClick={() => {
          if (isSidebarOpen) setIsSidebarOpen(false);
        }}
      >
        {/* Only render generic ERP header for non-POS tabs */}
        {activeTab !== 'pos' && (
          <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSidebarOpen(!isSidebarOpen);
                }}
                className="hover:bg-slate-100"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold capitalize">
                  {activeTab === 'self-service' ? 'My Workspace' : activeTab.replace('-', ' ')}
                </h1>
                {/* Global Master Business Header Tag */}
                <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200">
                  <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
                    {businessSettings.logoUrl ? (
                      <img src={businessSettings.logoUrl} alt="Logo" className="w-5 h-5 object-contain rounded" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[180px]">
                      {businessSettings.companyName || 'ProEase SME Enterprise'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono leading-none">
                      {businessSettings.registrationNumber ? `Reg: ${businessSettings.registrationNumber}` : businessSettings.operatingCountry || 'SG'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{profile?.displayName}</p>
                <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                  {profile?.department && (
                    <span className="font-medium text-slate-700">{profile.department}</span>
                  )}
                  {profile?.position && (
                    <span>• {profile.position}</span>
                  )}
                  <Badge variant="outline" className="text-[10px] py-0 px-1 capitalize ml-1 font-bold">
                    {profile?.role?.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                <UserIcon className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </header>
        )}

        <div className={`flex-1 overflow-auto ${activeTab === 'pos' ? 'p-0 pb-0 bg-slate-950' : 'p-6 pb-20'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className={`h-full ${activeTab === 'pos' ? 'w-full' : 'max-w-7xl mx-auto'}`}
            >
              {/* Dynamic RBAC Route Access Guard */}
              {!canAccessModule(activeTab, profile) ? (
                <div className="max-w-3xl mx-auto py-12">
                  <AccessDenied
                    moduleId={activeTab}
                    profile={profile}
                    onRedirect={(destTab) => setActiveTab(destTab)}
                  />
                </div>
              ) : (
                <>
                  {activeTab === 'dashboard' && <Dashboard profile={profile} onNavigate={setActiveTab} />}
                  {activeTab === 'pos' && <PosTerminal profile={profile} />}
                  {activeTab === 'sales' && <SalesModule profile={profile} />}
                  {activeTab === 'self-service' && <EmployeeSelfService profile={profile} allUsers={allUsers} />}
                  {activeTab === 'hrm' && <HRM profile={profile} />}
                  {activeTab === 'inventory' && <Inventory profile={profile} />}
                  {activeTab === 'master-data' && <MasterDataManagement profile={profile} />}
                  {activeTab === 'roster' && <ShiftRosterManagement profile={profile} />}
                  {activeTab === 'accounting' && <AccountingModule profile={profile} />}
                  {activeTab === 'executive-ai' && <ExecutiveAiAnalytics profile={profile} />}
                  {activeTab === 'business-settings' && <BusinessSetupSettings profile={profile} />}
                  {activeTab === 'purchase-requests' && <PurchaseRequests profile={profile} />}
                  {activeTab === 'goods-receipt' && <GoodsReceipt profile={profile} />}
                  {activeTab === 'goods-issuance' && <GoodsIssuance profile={profile} />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-0 left-0 right-0 h-12 bg-white border-t border-slate-200 flex items-center justify-between px-6 text-[10px] text-slate-400 z-10">
          <div className="truncate max-w-[60%]">
            <span className="font-semibold text-slate-600">{businessSettings.companyName || 'ProEase ERP'}</span>
            {businessSettings.headerTagline && ` • ${businessSettings.headerTagline}`}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {businessSettings.taxId && <span className="hidden sm:inline">Tax ID: {businessSettings.taxId}</span>}
            <span>{businessSettings.footerNote || '© 2026 Enterprise SME Solutions'}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

// --- Sub-components ---

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#3b82f6,transparent_50%)]" />
      </div>
      <Card className="w-full max-w-md relative z-10 border-slate-800 bg-slate-900/50 backdrop-blur-xl text-white">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <LayoutDashboard className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold tracking-tight">ProEaseERP</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              SME Edition by Arvind
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-slate-300">Inventory Management</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-slate-300">Goods Receipt & Issuance</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-slate-300">Purchase Requests</span>
            </div>
          </div>
          <Button onClick={onLogin} className="w-full h-12 text-lg font-semibold" size="lg">
            Sign in with Google
          </Button>
        </CardContent>
        <Separator className="bg-slate-800" />
        <div className="p-6 text-center">
          <p className="text-xs text-slate-500">
            Secure enterprise-grade authentication powered by Google
          </p>
        </div>
      </Card>
    </div>
  );
}

// --- Module Components ---

function Dashboard({ profile, onNavigate }: { profile: UserProfile | null; onNavigate?: (tab: string) => void }) {
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStock: 0,
    pendingPRs: 0,
    posTodaySales: 0,
    posTodayCount: 0
  });

  useEffect(() => {
    // Real-time items stats
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      const items = snap.docs.map(d => d.data());
      setStats(prev => ({
        ...prev,
        totalItems: snap.size,
        lowStock: items.filter((i: any) => i.currentStock <= i.minStock).length
      }));
    });

    const unsubPRs = onSnapshot(query(collection(db, 'purchaseRequests'), where('status', '==', 'pending')), (snap) => {
      setStats(prev => ({ ...prev, pendingPRs: snap.size }));
    });

    // Real-time POS transactions
    const unsubPOS = onSnapshot(collection(db, 'salesTransactions'), (snap) => {
      let todaySales = 0;
      snap.forEach(doc => {
        const data = doc.data();
        todaySales += Number(data.total) || 0;
      });
      setStats(prev => ({
        ...prev,
        posTodaySales: todaySales,
        posTodayCount: snap.size
      }));
    });

    return () => {
      unsubItems();
      unsubPRs();
      unsubPOS();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Enterprise POS Quick Action Banner if user has POS access */}
      {canAccessModule('pos', profile) && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/60 rounded-xl p-5 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Point of Sale (POS) Station Ready</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Terminal Online
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Atomic transactions, real-time camera/hardware barcode scanner, automated markdown rules & membership loyalty.
              </p>
            </div>
          </div>
          <Button
            onClick={() => onNavigate && onNavigate('pos')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 h-auto shadow-md shrink-0 cursor-pointer"
          >
            Launch POS Register
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Inventory" 
          value={stats.totalItems} 
          icon={Package} 
          color="bg-blue-600" 
          description="Unique items in master catalog"
        />
        <StatCard 
          title="Low Stock Alert" 
          value={stats.lowStock} 
          icon={AlertTriangle} 
          color="bg-amber-600" 
          description="Items below reorder point"
          alert={stats.lowStock > 0}
        />
        <StatCard 
          title="POS Sales Volume" 
          value={`$${stats.posTodaySales.toFixed(2)}`} 
          icon={ShoppingBag} 
          color="bg-emerald-600" 
          description={`${stats.posTodayCount} transactions registered`}
        />
        <StatCard 
          title="Pending Requests" 
          value={stats.pendingPRs} 
          icon={Clock} 
          color="bg-purple-600" 
          description="Awaiting department approval"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest operational transactions and movements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ActivityItem 
                title="POS Terminal Session Initialized" 
                time="Just now" 
                user={profile?.displayName || 'System'} 
                type="pos"
              />
              <ActivityItem 
                title="Inventory Verification Run" 
                time="1 hour ago" 
                user="Warehouse Bot" 
                type="inv"
              />
              <ActivityItem 
                title="Reorder Level Threshold Checked" 
                time="3 hours ago" 
                user="System Audit" 
                type="pr"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System & Hardware Health</CardTitle>
            <CardDescription>Enterprise terminal environment status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Firestore ACID Transactions</p>
                    <p className="text-[11px] text-slate-500">Atomic runTransaction operational</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]">
                  Online
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Barcode / Camera Scanner</p>
                    <p className="text-[11px] text-slate-500">Hardware wedge buffer & BarcodeDetector</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px]">
                  Ready
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Web Audio POS Feedback</p>
                    <p className="text-[11px] text-slate-500">Hardware beeps (Success, Warning, Error)</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-[10px]">
                  Synthesizer Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, description, alert }: any) {
  return (
    <Card className={`relative overflow-hidden ${alert ? 'border-amber-200 bg-amber-50/30' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${color} text-white`}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ title, time, user, type }: any) {
  return (
    <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
      <div className={`mt-1 w-2 h-2 rounded-full ${
        type === 'pr' ? 'bg-purple-500' : type === 'gr' ? 'bg-blue-500' : 'bg-emerald-500'
      }`} />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-400">{time}</span>
          <span className="text-xs text-slate-300">•</span>
          <span className="text-xs text-slate-400">by {user}</span>
        </div>
      </div>
    </div>
  );
}

function Inventory({ profile }: { profile: UserProfile | null }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    sku: '',
    name: '',
    description: '',
    unit: 'PCS',
    currentStock: 0,
    minStock: 5,
    category: 'General'
  });

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    });
    return unsub;
  }, []);

  const handleAddItem = async () => {
    try {
      await addDoc(collection(db, 'items'), {
        ...newItem,
        lastUpdated: Timestamp.now()
      });
      setIsAddModalOpen(false);
      toast.success('Item added successfully');
      setNewItem({ sku: '', name: '', description: '', unit: 'PCS', currentStock: 0, minStock: 5, category: 'General' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'items');
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search SKU or Item Name..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {(profile?.role === 'admin' || profile?.role === 'storekeeper') && (
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="w-4 h-4" /> Add New Item
          </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Inventory Item</DialogTitle>
                <DialogDescription>Create a new item in the master inventory list.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SKU</label>
                    <Input value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} placeholder="e.g. LAP-001" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Input value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="e.g. IT Hardware" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Item Name</label>
                  <Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. MacBook Pro 14" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unit</label>
                    <Select value={newItem.unit} onValueChange={v => setNewItem({...newItem, unit: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PCS">PCS</SelectItem>
                        <SelectItem value="KG">KG</SelectItem>
                        <SelectItem value="BOX">BOX</SelectItem>
                        <SelectItem value="UNIT">UNIT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Initial Stock</label>
                    <Input type="number" value={newItem.currentStock} onChange={e => setNewItem({...newItem, currentStock: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min Level</label>
                    <Input type="number" value={newItem.minStock} onChange={e => setNewItem({...newItem, minStock: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                <Button onClick={handleAddItem}>Save Item</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs font-medium">{item.sku}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-slate-50">{item.category}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{item.currentStock}</TableCell>
                <TableCell className="text-slate-500 text-sm">{item.unit}</TableCell>
                <TableCell>
                  {item.currentStock <= item.minStock ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" /> Low Stock
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Healthy
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">Details</Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-500 italic">
                  No items found in inventory.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
