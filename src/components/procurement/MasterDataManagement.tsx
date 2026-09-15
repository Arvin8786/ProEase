import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  FileSpreadsheet, 
  UploadCloud, 
  DownloadCloud, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Building2, 
  Truck, 
  Package, 
  AlertTriangle,
  RefreshCw,
  FileCheck2,
  Clock,
  ShieldCheck,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { InventoryItem, Vendor, DepartmentMaster, UserProfile } from '../../types';
import { hasPermission } from '../../lib/rbac';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { UserAccessManagement } from './UserAccessManagement';
import { TimedMarkdownSettings } from './TimedMarkdownSettings';

interface MasterDataManagementProps {
  profile: UserProfile | null;
}

export const MasterDataManagement: React.FC<MasterDataManagementProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'materials' | 'vendors' | 'departments' | 'markdown' | 'rbac'>('materials');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({
    sku: '',
    name: '',
    description: '',
    unit: 'PCS',
    currentStock: 0,
    minStock: 5,
    unitPrice: 0,
    vendorCode: '',
    vendorName: '',
    category: 'General',
  });

  // Vendor Modal State
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorForm, setVendorForm] = useState({
    vendorCode: '',
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    category: 'Supplier',
    paymentTerms: 'Net 30',
  });

  // Department Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any | null>(null);
  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    headOfDepartment: '',
    description: '',
  });

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: 'item' | 'vendor' | 'dept';
    id: string;
    title: string;
  }>({
    open: false,
    type: 'item',
    id: '',
    title: '',
  });

  // Multi-Sheet Import Preview Modal
  const [importPreview, setImportPreview] = useState<{
    open: boolean;
    fileName: string;
    materials: any[];
    vendors: any[];
    departments: any[];
    isOverwriting: boolean;
  }>({
    open: false,
    fileName: '',
    materials: [],
    vendors: [],
    departments: [],
    isOverwriting: false,
  });

  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = hasPermission(profile, 'canEditInventoryMaster');
  const canUpload = hasPermission(profile, 'canPerformMassUpload');

  // Real-time Firestore sync
  useEffect(() => {
    const qItems = query(collection(db, 'items'));
    const unsubItems = onSnapshot(qItems, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
      setItems(docs);
    });

    const qVendors = query(collection(db, 'vendors'));
    const unsubVendors = onSnapshot(qVendors, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor));
      setVendors(docs);
    });

    const qDepts = query(collection(db, 'departments'));
    const unsubDepts = onSnapshot(qDepts, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDepartments(docs);
    });

    return () => {
      unsubItems();
      unsubVendors();
      unsubDepts();
    };
  }, []);

  // Distinct Categories for Markdown Settings
  const distinctCategories = Array.from(
    new Set([
      'Bakery',
      'Beverages',
      'Perishable',
      'Grocery',
      'Household',
      'Electronics',
      'Office Supplies',
      ...items.map(i => i.category).filter(Boolean),
    ])
  ) as string[];

  // -------------------------------------------------------------
  // MasterDB.xlsx Multi-Sheet Export
  // -------------------------------------------------------------
  const handleExportMasterDbXlsx = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Materials
    // SKU | Product Name | Category | Stock Level | Min Safety Stock | Unit Price | Preferred Vendor
    const materialsData = items.map(item => ({
      'SKU': item.sku || '',
      'Product Name': item.name || '',
      'Category': item.category || 'General',
      'Stock Level': item.currentStock || 0,
      'Min Safety Stock': item.minStock || 5,
      'Unit Price': item.unitPrice || 0,
      'Preferred Vendor': item.vendorName || item.vendorCode || '',
    }));
    const wsMaterials = XLSX.utils.json_to_sheet(materialsData);
    XLSX.utils.book_append_sheet(workbook, wsMaterials, 'Materials');

    // Sheet 2: Vendors
    // Vendor Code | Vendor Name | Contact Person | Email | Phone | Address
    const vendorsData = vendors.map(v => ({
      'Vendor Code': v.vendorCode || '',
      'Vendor Name': v.name || '',
      'Contact Person': (v as any).contactPerson || '',
      'Email': v.email || '',
      'Phone': v.phone || '',
      'Address': v.address || '',
    }));
    const wsVendors = XLSX.utils.json_to_sheet(vendorsData);
    XLSX.utils.book_append_sheet(workbook, wsVendors, 'Vendors');

    // Sheet 3: Departments
    // Department Code | Department Name | Head of Department
    const deptsData = departments.map(d => ({
      'Department Code': d.code || '',
      'Department Name': d.name || '',
      'Head of Department': d.headOfDepartment || d.managerName || '',
    }));
    const wsDepts = XLSX.utils.json_to_sheet(deptsData);
    XLSX.utils.book_append_sheet(workbook, wsDepts, 'Departments');

    const fileName = 'MasterDB.xlsx';
    XLSX.writeFile(workbook, fileName);
    toast.success(`Generated standardized ${fileName} with Materials (${materialsData.length}), Vendors (${vendorsData.length}), and Departments (${deptsData.length}).`);
  };

  // -------------------------------------------------------------
  // MasterDB.xlsx Multi-Sheet Parser (Row 2 Onwards)
  // -------------------------------------------------------------
  const handleFileUpload = (file: File) => {
    if (!canUpload) {
      toast.error('Access Denied: You lack privilege to perform Mass Upload.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let parsedMaterials: any[] = [];
        let parsedVendors: any[] = [];
        let parsedDepartments: any[] = [];

        // Parse Sheet: Materials
        const matSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('material') || s.toLowerCase().includes('item') || s.toLowerCase().includes('inventor'));
        if (matSheetName) {
          const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[matSheetName]);
          parsedMaterials = rows.map((r, index) => ({
            sku: String(r['SKU'] || r['sku'] || `SKU-${Date.now()}-${index}`).trim(),
            name: String(r['Product Name'] || r['Name'] || r['name'] || 'Unnamed Product').trim(),
            category: String(r['Category'] || r['category'] || 'General').trim(),
            currentStock: Number(r['Stock Level'] ?? r['CurrentStock'] ?? r['stock'] ?? 0),
            minStock: Number(r['Min Safety Stock'] ?? r['MinStock'] ?? r['min_stock'] ?? 5),
            unitPrice: Number(r['Unit Price'] ?? r['UnitPrice'] ?? r['price'] ?? 0),
            vendorName: String(r['Preferred Vendor'] || r['VendorName'] || r['vendor'] || '').trim(),
            vendorCode: String(r['Vendor Code'] || r['VendorCode'] || '').trim(),
            unit: 'PCS',
          }));
        }

        // Parse Sheet: Vendors
        const vendSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('vendor') || s.toLowerCase().includes('supplier'));
        if (vendSheetName) {
          const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[vendSheetName]);
          parsedVendors = rows.map((r, index) => ({
            vendorCode: String(r['Vendor Code'] || r['vendorCode'] || `VEND-${index + 1}`).trim(),
            name: String(r['Vendor Name'] || r['Name'] || r['name'] || 'Unnamed Vendor').trim(),
            contactPerson: String(r['Contact Person'] || r['contact'] || '').trim(),
            email: String(r['Email'] || r['email'] || '').trim(),
            phone: String(r['Phone'] || r['phone'] || '').trim(),
            address: String(r['Address'] || r['address'] || '').trim(),
            paymentTerms: 'Net 30',
            isInEcosystem: true,
          }));
        }

        // Parse Sheet: Departments
        const deptSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('department') || s.toLowerCase().includes('dept'));
        if (deptSheetName) {
          const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[deptSheetName]);
          parsedDepartments = rows.map((r, index) => ({
            code: String(r['Department Code'] || r['Code'] || r['code'] || `DEPT-${index + 1}`).trim(),
            name: String(r['Department Name'] || r['Name'] || r['name'] || 'Department').trim(),
            headOfDepartment: String(r['Head of Department'] || r['Head'] || r['manager'] || '').trim(),
            description: `Department managed by ${r['Head of Department'] || 'HOD'}`,
          }));
        }

        if (parsedMaterials.length === 0 && parsedVendors.length === 0 && parsedDepartments.length === 0) {
          toast.error('No readable rows found in MasterDB.xlsx. Verify sheet names: Materials, Vendors, Departments.');
          return;
        }

        setImportPreview({
          open: true,
          fileName: file.name,
          materials: parsedMaterials,
          vendors: parsedVendors,
          departments: parsedDepartments,
          isOverwriting: false,
        });
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to parse MasterDB.xlsx: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Commit Import to Firestore
  const handleCommitImport = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      let totalCount = 0;

      // Commit Materials
      for (const m of importPreview.materials) {
        const existing = items.find(i => i.sku?.toLowerCase() === m.sku?.toLowerCase());
        const docRef = existing ? doc(db, 'items', existing.id) : doc(collection(db, 'items'));
        batch.set(docRef, {
          sku: m.sku,
          name: m.name,
          category: m.category,
          currentStock: m.currentStock,
          minStock: m.minStock,
          unitPrice: m.unitPrice,
          materialQuotedPrice: m.unitPrice,
          vendorName: m.vendorName,
          unit: m.unit || 'PCS',
          lastUpdated: Timestamp.now(),
        }, { merge: !importPreview.isOverwriting });
        totalCount++;
      }

      // Commit Vendors
      for (const v of importPreview.vendors) {
        const existing = vendors.find(vend => vend.vendorCode?.toLowerCase() === v.vendorCode?.toLowerCase());
        const docRef = existing ? doc(db, 'vendors', existing.id) : doc(collection(db, 'vendors'));
        batch.set(docRef, {
          vendorCode: v.vendorCode,
          name: v.name,
          contactPerson: v.contactPerson,
          email: v.email,
          phone: v.phone,
          address: v.address,
          paymentTerms: v.paymentTerms || 'Net 30',
          isInEcosystem: true,
        }, { merge: !importPreview.isOverwriting });
        totalCount++;
      }

      // Commit Departments
      for (const d of importPreview.departments) {
        const existing = departments.find(dept => dept.code?.toLowerCase() === d.code?.toLowerCase());
        const docRef = existing ? doc(db, 'departments', existing.id) : doc(collection(db, 'departments'));
        batch.set(docRef, {
          code: d.code,
          name: d.name,
          headOfDepartment: d.headOfDepartment,
          description: d.description || '',
        }, { merge: !importPreview.isOverwriting });
        totalCount++;
      }

      await batch.commit();
      toast.success(`Successfully synchronized Master Database! Processed ${totalCount} records.`);
      setImportPreview(prev => ({ ...prev, open: false }));
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to commit MasterDB sync: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------
  // In-App CRUD: Materials
  // -------------------------------------------------------------
  const handleOpenItemModal = (item?: InventoryItem) => {
    if (item) {
      setSelectedItem(item);
      setItemForm({
        sku: item.sku || '',
        name: item.name || '',
        description: item.description || '',
        unit: item.unit || 'PCS',
        currentStock: item.currentStock || 0,
        minStock: item.minStock || 5,
        unitPrice: item.unitPrice || 0,
        vendorCode: item.vendorCode || '',
        vendorName: item.vendorName || '',
        category: item.category || 'General',
      });
    } else {
      setSelectedItem(null);
      setItemForm({
        sku: `SKU-${Date.now().toString().slice(-5)}`,
        name: '',
        description: '',
        unit: 'PCS',
        currentStock: 0,
        minStock: 5,
        unitPrice: 0,
        vendorCode: '',
        vendorName: '',
        category: 'General',
      });
    }
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('Access Denied: You lack privilege to modify inventory items.');
      return;
    }
    setSaving(true);
    try {
      if (selectedItem) {
        const ref = doc(db, 'items', selectedItem.id);
        await updateDoc(ref, {
          ...itemForm,
          materialQuotedPrice: itemForm.unitPrice,
          lastUpdated: Timestamp.now(),
        });
        toast.success(`Updated item ${itemForm.name}`);
      } else {
        const ref = doc(collection(db, 'items'));
        await setDoc(ref, {
          ...itemForm,
          materialQuotedPrice: itemForm.unitPrice,
          lastUpdated: Timestamp.now(),
        });
        toast.success(`Created SKU ${itemForm.sku}`);
      }
      setIsItemModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to save SKU: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------
  // In-App CRUD: Vendors
  // -------------------------------------------------------------
  const handleOpenVendorModal = (vendor?: Vendor) => {
    if (vendor) {
      setSelectedVendor(vendor);
      setVendorForm({
        vendorCode: vendor.vendorCode || '',
        name: vendor.name || '',
        contactPerson: (vendor as any).contactPerson || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        category: vendor.category || 'Supplier',
        paymentTerms: vendor.paymentTerms || 'Net 30',
      });
    } else {
      setSelectedVendor(null);
      setVendorForm({
        vendorCode: `VEND-${Date.now().toString().slice(-4)}`,
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        category: 'Supplier',
        paymentTerms: 'Net 30',
      });
    }
    setIsVendorModalOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('Access Denied: You lack privilege to modify vendors.');
      return;
    }
    setSaving(true);
    try {
      if (selectedVendor) {
        const ref = doc(db, 'vendors', selectedVendor.id);
        await updateDoc(ref, {
          ...vendorForm,
          isInEcosystem: true,
        });
        toast.success(`Updated vendor ${vendorForm.name}`);
      } else {
        const ref = doc(collection(db, 'vendors'));
        await setDoc(ref, {
          ...vendorForm,
          isInEcosystem: true,
        });
        toast.success(`Registered vendor ${vendorForm.vendorCode}`);
      }
      setIsVendorModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to save vendor: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------
  // In-App CRUD: Departments
  // -------------------------------------------------------------
  const handleOpenDeptModal = (dept?: any) => {
    if (dept) {
      setSelectedDept(dept);
      setDeptForm({
        code: dept.code || '',
        name: dept.name || '',
        headOfDepartment: dept.headOfDepartment || '',
        description: dept.description || '',
      });
    } else {
      setSelectedDept(null);
      setDeptForm({
        code: `DEPT-${Date.now().toString().slice(-3)}`,
        name: '',
        headOfDepartment: '',
        description: '',
      });
    }
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('Access Denied: You lack privilege to modify departments.');
      return;
    }
    setSaving(true);
    try {
      if (selectedDept) {
        const ref = doc(db, 'departments', selectedDept.id);
        await updateDoc(ref, { ...deptForm });
        toast.success(`Updated department ${deptForm.name}`);
      } else {
        const ref = doc(collection(db, 'departments'));
        await setDoc(ref, { ...deptForm });
        toast.success(`Created department ${deptForm.code}`);
      }
      setIsDeptModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to save department: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete Action Executor
  const handleConfirmDelete = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      if (deleteConfirm.type === 'item') {
        await deleteDoc(doc(db, 'items', deleteConfirm.id));
        toast.success('Inventory SKU removed.');
      } else if (deleteConfirm.type === 'vendor') {
        await deleteDoc(doc(db, 'vendors', deleteConfirm.id));
        toast.success('Vendor profile removed.');
      } else {
        await deleteDoc(doc(db, 'departments', deleteConfirm.id));
        toast.success('Department entry removed.');
      }
      setDeleteConfirm({ open: false, type: 'item', id: '', title: '' });
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Search filtering
  const filteredItems = items.filter(i => 
    (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVendors = vendors.filter(v => 
    (v.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.vendorCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDepts = departments.filter(d => 
    (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.headOfDepartment || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Master Database Sync & Sheet Configuration</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                MasterDB.xlsx Engine
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              Single-file multi-sheet processing (Materials, Vendors, Departments), timed markdown window, and granular RBAC.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleExportMasterDbXlsx}
            className="text-xs h-9 gap-1.5 border-slate-300 hover:bg-slate-50"
          >
            <DownloadCloud className="w-4 h-4 text-blue-600" /> Download MasterDB.xlsx
          </Button>

          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={!canUpload}
            className="text-xs h-9 gap-1.5 border-slate-300 hover:bg-slate-50"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600" /> Upload MasterDB.xlsx
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileUpload(e.target.files[0]);
                e.target.value = '';
              }
            }} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />

          {activeTab === 'materials' && (
            <Button 
              onClick={() => handleOpenItemModal()}
              disabled={!canEdit}
              className="text-xs h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Material / SKU
            </Button>
          )}

          {activeTab === 'vendors' && (
            <Button 
              onClick={() => handleOpenVendorModal()}
              disabled={!canEdit}
              className="text-xs h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Vendor
            </Button>
          )}

          {activeTab === 'departments' && (
            <Button 
              onClick={() => handleOpenDeptModal()}
              disabled={!canEdit}
              className="text-xs h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Department
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="materials" className="gap-2 text-xs">
            <Package className="w-3.5 h-3.5" /> Materials ({items.length})
          </TabsTrigger>
          <TabsTrigger value="vendors" className="gap-2 text-xs">
            <Truck className="w-3.5 h-3.5" /> Vendors ({vendors.length})
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2 text-xs">
            <Building2 className="w-3.5 h-3.5" /> Departments ({departments.length})
          </TabsTrigger>
          <TabsTrigger value="markdown" className="gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Timed Markdown Settings
          </TabsTrigger>
          <TabsTrigger value="rbac" className="gap-2 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> User Access Matrix
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Materials Sheet */}
        <TabsContent value="materials" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Materials Master Catalog</CardTitle>
                <CardDescription className="text-xs">
                  Header Mapping: SKU | Product Name | Category | Stock Level | Min Safety Stock | Unit Price | Preferred Vendor
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search SKU, name, vendor..."
                  className="pl-9 h-8 text-xs bg-white"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">SKU</TableHead>
                    <TableHead className="text-xs font-semibold">Product Name</TableHead>
                    <TableHead className="text-xs font-semibold">Category</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Stock Level</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Min Safety Stock</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Unit Price</TableHead>
                    <TableHead className="text-xs font-semibold">Preferred Vendor</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-slate-400 text-xs">
                        No materials matching "{searchTerm}".
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map(item => (
                      <TableRow key={item.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-bold text-blue-700">
                          {item.sku}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-xs text-slate-900">{item.name}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.description}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{item.category || 'General'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {item.currentStock || 0} {item.unit || 'PCS'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-500">
                          {item.minStock || 5} {item.unit || 'PCS'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700">
                          ${(item.unitPrice || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {item.vendorName || item.vendorCode || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenItemModal(item)}
                              disabled={!canEdit}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm({
                                open: true,
                                type: 'item',
                                id: item.id,
                                title: `${item.sku} - ${item.name}`,
                              })}
                              disabled={!canEdit}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-rose-600"
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
        </TabsContent>

        {/* TAB 2: Vendors Sheet */}
        <TabsContent value="vendors" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Vendors Directory</CardTitle>
                <CardDescription className="text-xs">
                  Header Mapping: Vendor Code | Vendor Name | Contact Person | Email | Phone | Address
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search vendor code, name..."
                  className="pl-9 h-8 text-xs bg-white"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Vendor Code</TableHead>
                    <TableHead className="text-xs font-semibold">Vendor Name</TableHead>
                    <TableHead className="text-xs font-semibold">Contact Person</TableHead>
                    <TableHead className="text-xs font-semibold">Email</TableHead>
                    <TableHead className="text-xs font-semibold">Phone</TableHead>
                    <TableHead className="text-xs font-semibold">Address</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                        No vendors registered.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map(v => (
                      <TableRow key={v.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-bold text-slate-700">{v.vendorCode}</TableCell>
                        <TableCell className="font-semibold text-xs text-slate-900">{v.name}</TableCell>
                        <TableCell className="text-xs text-slate-600">{(v as any).contactPerson || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-600">{v.email}</TableCell>
                        <TableCell className="text-xs text-slate-600">{v.phone || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500 truncate max-w-xs">{v.address || '—'}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenVendorModal(v)}
                              disabled={!canEdit}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm({
                                open: true,
                                type: 'vendor',
                                id: v.id,
                                title: `${v.vendorCode} - ${v.name}`,
                              })}
                              disabled={!canEdit}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-rose-600"
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
        </TabsContent>

        {/* TAB 3: Departments Sheet */}
        <TabsContent value="departments" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Departments & Cost Centers</CardTitle>
                <CardDescription className="text-xs">
                  Header Mapping: Department Code | Department Name | Head of Department
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search department code, HOD..."
                  className="pl-9 h-8 text-xs bg-white"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Department Code</TableHead>
                    <TableHead className="text-xs font-semibold">Department Name</TableHead>
                    <TableHead className="text-xs font-semibold">Head of Department</TableHead>
                    <TableHead className="text-xs font-semibold">Description</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                        No departments registered.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDepts.map(d => (
                      <TableRow key={d.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-bold text-blue-700">{d.code}</TableCell>
                        <TableCell className="font-semibold text-xs text-slate-900">{d.name}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{d.headOfDepartment || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500">{d.description || '—'}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDeptModal(d)}
                              disabled={!canEdit}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm({
                                open: true,
                                type: 'dept',
                                id: d.id,
                                title: `${d.code} - ${d.name}`,
                              })}
                              disabled={!canEdit}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-rose-600"
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
        </TabsContent>

        {/* TAB 4: Timed Markdown Window */}
        <TabsContent value="markdown" className="space-y-4 pt-3">
          <TimedMarkdownSettings currentUser={profile} categories={distinctCategories} />
        </TabsContent>

        {/* TAB 5: User Access Management */}
        <TabsContent value="rbac" className="space-y-4 pt-3">
          <UserAccessManagement currentUser={profile} />
        </TabsContent>
      </Tabs>

      {/* Edit/Add Material Modal */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {selectedItem ? `Edit SKU: ${selectedItem.sku}` : 'Add New Material / SKU'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Directly synchronize unit price, safety stock threshold, and preferred supplier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">SKU Code *</Label>
                <Input 
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                  placeholder="e.g. SKU-1001"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category</Label>
                <Input 
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  placeholder="e.g. Office Supplies"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-semibold">Product Name *</Label>
                <Input 
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g. Wireless Ergonomic Scanner"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Stock Level</Label>
                <Input 
                  type="number"
                  value={itemForm.currentStock}
                  onChange={(e) => setItemForm({ ...itemForm, currentStock: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Min Safety Stock</Label>
                <Input 
                  type="number"
                  value={itemForm.minStock}
                  onChange={(e) => setItemForm({ ...itemForm, minStock: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Unit Price ($)</Label>
                <Input 
                  type="number"
                  step="any"
                  value={itemForm.unitPrice}
                  onChange={(e) => setItemForm({ ...itemForm, unitPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Unit of Measure</Label>
                <Input 
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  placeholder="PCS, BOX, KG"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-semibold">Preferred Vendor</Label>
                <select
                  value={itemForm.vendorName}
                  onChange={(e) => {
                    const name = e.target.value;
                    const v = vendors.find(vend => vend.name === name);
                    setItemForm({
                      ...itemForm,
                      vendorName: name,
                      vendorCode: v ? v.vendorCode : '',
                    });
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="">-- Select Preferred Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.vendorCode} value={v.name}>
                      {v.vendorCode} - {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save SKU Details
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Vendor Modal */}
      <Dialog open={isVendorModalOpen} onOpenChange={setIsVendorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {selectedVendor ? `Edit Vendor: ${selectedVendor.vendorCode}` : 'Register New Vendor'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Keep supplier contact info and payment terms up to date.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveVendor} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Vendor Code *</Label>
              <Input 
                value={vendorForm.vendorCode}
                onChange={(e) => setVendorForm({ ...vendorForm, vendorCode: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Vendor Company Name *</Label>
              <Input 
                value={vendorForm.name}
                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Contact Person</Label>
              <Input 
                value={vendorForm.contactPerson}
                onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Email</Label>
                <Input 
                  type="email"
                  value={vendorForm.email}
                  onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone</Label>
                <Input 
                  value={vendorForm.phone}
                  onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Address</Label>
              <Input 
                value={vendorForm.address}
                onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
              />
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setIsVendorModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Vendor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Department Modal */}
      <Dialog open={isDeptModalOpen} onOpenChange={setIsDeptModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {selectedDept ? `Edit Department: ${selectedDept.code}` : 'Add Department / Cost Center'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Organizational unit for PR charging and shift rostering.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDept} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Department Code *</Label>
              <Input 
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                placeholder="e.g. DEPT-WH"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Department Name *</Label>
              <Input 
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="e.g. Warehouse & Storage"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Head of Department (HOD)</Label>
              <Input 
                value={deptForm.headOfDepartment}
                onChange={(e) => setDeptForm({ ...deptForm, headOfDepartment: e.target.value })}
                placeholder="e.g. Marcus Tan"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description</Label>
              <Input 
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                placeholder="Scope of operations"
              />
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setIsDeptModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Department
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Confirm Record Deletion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete:
              <br />
              <strong className="text-slate-900 mt-1 block">{deleteConfirm.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete} 
              disabled={saving}
              className="gap-1.5"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-Sheet Import Preview Modal */}
      <Dialog open={importPreview.open} onOpenChange={(open) => !open && setImportPreview(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Sync MasterDB.xlsx Spreadsheet
            </DialogTitle>
            <DialogDescription className="text-xs">
              Processed tabs from uploaded file: <strong>{importPreview.fileName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <span className="text-[11px] font-semibold text-blue-700 block">Sheet 1: Materials</span>
                <span className="text-2xl font-bold text-blue-900">{importPreview.materials.length}</span>
                <span className="text-[10px] text-blue-600 block mt-0.5">Records parsed</span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-[11px] font-semibold text-emerald-700 block">Sheet 2: Vendors</span>
                <span className="text-2xl font-bold text-emerald-900">{importPreview.vendors.length}</span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">Records parsed</span>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                <span className="text-[11px] font-semibold text-purple-700 block">Sheet 3: Departments</span>
                <span className="text-2xl font-bold text-purple-900">{importPreview.departments.length}</span>
                <span className="text-[10px] text-purple-600 block mt-0.5">Records parsed</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <Label className="font-semibold text-slate-800">Synchronization Strategy</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="syncStrategy"
                    checked={!importPreview.isOverwriting}
                    onChange={() => setImportPreview({ ...importPreview, isOverwriting: false })}
                    className="text-blue-600"
                  />
                  <span>Update & Merge (keep non-conflicting records)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="syncStrategy"
                    checked={importPreview.isOverwriting}
                    onChange={() => setImportPreview({ ...importPreview, isOverwriting: true })}
                    className="text-blue-600"
                  />
                  <span>Batch Overwrite</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={() => setImportPreview(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button 
              onClick={handleCommitImport} 
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Commit Synchronization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
