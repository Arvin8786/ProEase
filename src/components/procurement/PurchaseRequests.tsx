import React, { useState, useEffect } from 'react';
import { 
  PurchaseRequest, 
  PurchaseRequestItem, 
  PurchaseOrder, 
  InventoryItem, 
  Vendor, 
  UserProfile, 
  DEPARTMENT_CODES 
} from '../../types';
import { 
  DEFAULT_VENDORS, 
  generateSequenceNumber, 
  isProcurementApprover 
} from '../../lib/procurementData';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download, 
  Send, 
  AlertTriangle, 
  Building, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  ArrowRight, 
  Trash2, 
  Eye, 
  X,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { UniversalPdfModal } from './UniversalPdfModal';
import { generatePurchaseOrderPdf, generatePurchaseRequestPdf } from '../../lib/pdfGenerator';
import { toast } from 'sonner';

interface PurchaseRequestsProps {
  profile: UserProfile | null;
}

export function PurchaseRequests({ profile }: PurchaseRequestsProps) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>(DEFAULT_VENDORS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // New PR Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [departmentCode, setDepartmentCode] = useState<string>('DEPT-LOG');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [formItems, setFormItems] = useState<PurchaseRequestItem[]>([]);

  // Item selector in form
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedVendorCode, setSelectedVendorCode] = useState<string>('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemQuotedPrice, setItemQuotedPrice] = useState<number>(0);

  // PDF Preview Modal
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfDocType, setPdfDocType] = useState<'PR' | 'PO'>('PR');
  const [activeDocData, setActiveDocData] = useState<any>(null);

  // External Vendor Prompt Modal (Upon PO Generation)
  const [externalVendorPromptOpen, setExternalVendorPromptOpen] = useState(false);
  const [lastGeneratedPo, setLastGeneratedPo] = useState<PurchaseOrder | null>(null);

  // Subscribe to requests, items, and vendors
  useEffect(() => {
    const qReq = query(collection(db, 'purchaseRequests'), orderBy('createdAt', 'desc'));
    const unsubReq = onSnapshot(qReq, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseRequest)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'purchaseRequests');
    });

    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      const itemsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
      setInventory(itemsList);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'items');
    });

    // Also fetch vendors if collection exists, else use DEFAULT_VENDORS
    const unsubVendors = onSnapshot(collection(db, 'vendors'), (snap) => {
      if (!snap.empty) {
        setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
      }
    }, (err) => {
      // Vendors collection may not be populated yet, fallback is active
    });

    return () => {
      unsubReq();
      unsubItems();
      unsubVendors();
    };
  }, []);

  // When an item is selected, trigger the Auto-Fill Engine:
  // Automatically populate vendorCode, vendorName, and materialQuotedPrice
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    // Determine default vendor
    let resolvedVendorCode = item.vendorCode || '';
    let resolvedVendorName = item.vendorName || '';

    // If item has no assigned vendor, match by category or pick default
    if (!resolvedVendorCode) {
      const catLower = (item.category || '').toLowerCase();
      const matchedVendor = vendors.find(v => 
        (catLower.includes('it') || catLower.includes('electronic')) && v.vendorCode === 'VEND-TECH' ||
        (catLower.includes('office') || catLower.includes('stationery')) && v.vendorCode === 'VEND-OFFICE' ||
        (catLower.includes('warehouse') || catLower.includes('box') || catLower.includes('packaging')) && v.vendorCode === 'VEND-APEX'
      ) || vendors[0];

      if (matchedVendor) {
        resolvedVendorCode = matchedVendor.vendorCode;
        resolvedVendorName = matchedVendor.name;
      }
    }

    setSelectedVendorCode(resolvedVendorCode);

    // Auto-fill material quoted price from item master
    const defaultQuotedPrice = item.materialQuotedPrice || item.unitPrice || 25.00;
    setItemQuotedPrice(defaultQuotedPrice);
  };

  const handleAddItemToForm = () => {
    if (!selectedItemId) {
      toast.error('Please select an item');
      return;
    }
    const item = inventory.find(i => i.id === selectedItemId);
    if (!item) return;

    const vendor = vendors.find(v => v.vendorCode === selectedVendorCode) || {
      vendorCode: selectedVendorCode || 'VEND-DEFAULT',
      name: item.vendorName || 'Preferred Supplier'
    };

    const newItem: PurchaseRequestItem = {
      itemId: item.id,
      productCode: item.productCode || item.sku,
      materialName: item.name,
      quantity: Math.max(1, itemQty),
      unit: item.unit || 'PCS',
      vendorCode: vendor.vendorCode,
      vendorName: vendor.name,
      materialQuotedPrice: Number(itemQuotedPrice) || 0,
      totalQuotedPrice: (Number(itemQuotedPrice) || 0) * Math.max(1, itemQty)
    };

    setFormItems(prev => [...prev, newItem]);
    // Reset selection
    setSelectedItemId('');
    setSelectedVendorCode('');
    setItemQty(1);
    setItemQuotedPrice(0);
    toast.success(`Added ${item.name} to requisition`);
  };

  const handleRemoveFormItem = (index: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalEstimatedCost = formItems.reduce((acc, curr) => acc + curr.totalQuotedPrice, 0);

  // Submit PR
  const handleSubmitPr = async () => {
    if (!departmentCode) {
      toast.error('Department code is required');
      return;
    }
    if (!deliveryDate) {
      toast.error('Target delivery date is required');
      return;
    }
    if (formItems.length === 0) {
      toast.error('Please add at least one line item to the request');
      return;
    }

    setSubmitting(true);
    try {
      const prNumber = generateSequenceNumber('PR');
      const dept = DEPARTMENT_CODES.find(d => d.code === departmentCode);

      const prData: Omit<PurchaseRequest, 'id'> = {
        prNumber,
        requesterId: profile?.uid || 'anonymous-requester',
        requesterName: profile?.displayName || 'Authorized Employee',
        requesterEmail: profile?.email || '',
        departmentCode,
        departmentName: dept?.name || '',
        deliveryDate,
        status: 'pending',
        items: formItems,
        totalEstimatedCost,
        notes: notes.trim(),
        poNumber: null, // Critical: unassigned pending approval
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'purchaseRequests'), prData);
      toast.success(`Purchase Requisition ${prNumber} submitted for management review`);
      
      // Reset
      setIsNewModalOpen(false);
      setFormItems([]);
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'purchaseRequests');
    } finally {
      setSubmitting(false);
    }
  };

  // Manager/Owner Approval & PO Generation Pipeline
  const handleApprovePr = async (pr: PurchaseRequest) => {
    if (!isProcurementApprover(profile)) {
      toast.error('Access Denied: Only Admin, Manager, or Owner roles can approve purchase requests.');
      return;
    }

    try {
      // 1. Generate dynamic PO number
      const poNumber = generateSequenceNumber('PO');
      const now = new Date().toISOString();

      // Determine vendor from primary items
      const primaryVendorCode = pr.items[0]?.vendorCode || 'VEND-TECH';
      const vendorDoc = vendors.find(v => v.vendorCode === primaryVendorCode);
      const isEcosystemVendor = vendorDoc ? vendorDoc.isInEcosystem : false;

      // Construct Purchase Order items
      const poItems = pr.items.map(item => ({
        itemId: item.itemId,
        productCode: item.productCode,
        materialName: item.materialName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.materialQuotedPrice,
        totalPrice: item.totalQuotedPrice,
        receivedQty: 0
      }));

      const newPo: Omit<PurchaseOrder, 'id'> = {
        poNumber,
        prId: pr.id,
        prNumber: pr.prNumber || `PR-${pr.id.slice(0, 8).toUpperCase()}`,
        vendorCode: primaryVendorCode,
        vendorName: pr.items[0]?.vendorName || vendorDoc?.name || 'Authorized Supplier',
        vendorEmail: vendorDoc?.email || '',
        isEcosystemVendor,
        deliveryDate: pr.deliveryDate,
        departmentCode: pr.departmentCode,
        items: poItems,
        totalAmount: pr.totalEstimatedCost,
        status: 'issued',
        approvedBy: profile?.displayName || profile?.email || 'Authorized Manager',
        approvedAt: now,
        routedToVendorPortal: isEcosystemVendor,
        routedAt: isEcosystemVendor ? now : undefined,
        createdAt: Timestamp.now()
      };

      // 2. Save PO in purchaseOrders collection
      const poRef = await addDoc(collection(db, 'purchaseOrders'), newPo);

      // 3. If vendor is in ecosystem, automatically route order payload to vendorOrders collection
      if (isEcosystemVendor) {
        await addDoc(collection(db, 'vendorOrders'), {
          poNumber,
          vendorCode: primaryVendorCode,
          vendorName: newPo.vendorName,
          orderDate: now.split('T')[0],
          deliveryDate: pr.deliveryDate,
          totalAmount: pr.totalEstimatedCost,
          items: poItems,
          status: 'new',
          sentAt: Timestamp.now()
        });
      }

      // 4. Update the Purchase Request in store PR history:
      // Status becomes 'approved' and poNumber is instantly visible!
      await updateDoc(doc(db, 'purchaseRequests', pr.id), {
        status: 'approved',
        poNumber,
        approvedBy: profile?.displayName || 'Authorized Manager',
        approvedAt: now
      });

      const generatedPoWithId: PurchaseOrder = { id: poRef.id, ...newPo };

      if (isEcosystemVendor) {
        toast.success(`PR Approved! ${poNumber} issued & transmitted to Vendor Portal (${primaryVendorCode})`);
      } else {
        toast.info(`PR Approved! ${poNumber} generated for External Vendor (${primaryVendorCode})`);
        setLastGeneratedPo(generatedPoWithId);
        setExternalVendorPromptOpen(true);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'purchaseRequests');
    }
  };

  const handleOpenPdf = (type: 'PR' | 'PO', data: any) => {
    setPdfDocType(type);
    setActiveDocData(data);
    setPdfModalOpen(true);
  };

  // Filtered list
  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      (req.prNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.requesterName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.departmentCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.items.some(i => i.materialName.toLowerCase().includes(searchTerm.toLowerCase()) || i.productCode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesDept = deptFilter === 'all' || req.departmentCode === deptFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  const canApprove = isProcurementApprover(profile);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Purchase Requests & Store PR History</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              Procurement Lifecycle
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Requisition auto-fill engine, manager PO generation, and registered vendor ecosystem dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsNewModalOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Purchase Request
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search PR#, PO#, Requester, SKU..." 
            className="pl-9 bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENT_CODES.map(d => (
                <SelectItem key={d.code} value={d.code}>{d.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Store PR History Ledger */}
      <Card className="border-slate-200 overflow-hidden shadow-xs">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-slate-800">Store PR History Log</CardTitle>
            <CardDescription className="text-xs">
              Pending requests show immediately without a PO number; PO numbers are assigned upon Manager/Owner sign-off.
            </CardDescription>
          </div>
          <div className="text-xs font-mono font-medium text-slate-500">
            Showing {filteredRequests.length} record(s)
          </div>
        </CardHeader>

        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-32">PR Number</TableHead>
              <TableHead className="w-32">PO Number</TableHead>
              <TableHead>Requester & Dept</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Items Summary</TableHead>
              <TableHead className="text-right">Estimated Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.map(req => {
              const hasPo = Boolean(req.poNumber);
              const isPending = req.status === 'pending';

              return (
                <TableRow key={req.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-mono text-xs font-semibold text-slate-900">
                    {req.prNumber || `PR-${req.id.slice(0, 8).toUpperCase()}`}
                  </TableCell>

                  <TableCell>
                    {hasPo ? (
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                        {req.poNumber}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Unassigned (Pending)
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-xs">
                      <div className="font-semibold text-slate-800">{req.requesterName}</div>
                      <div className="font-mono text-slate-500 text-[11px]">{req.departmentCode}</div>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-600">
                    {req.deliveryDate ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {req.deliveryDate}
                      </span>
                    ) : (
                      'Immediate'
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {req.items.slice(0, 2).map((item, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[11px] font-normal">
                          {item.quantity}× {item.materialName}
                        </Badge>
                      ))}
                      {req.items.length > 2 && (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          +{req.items.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-mono font-semibold text-slate-900 text-xs">
                    ${Number(req.totalEstimatedCost || 0).toFixed(2)}
                  </TableCell>

                  <TableCell>
                    <Badge className={`text-[11px] font-medium capitalize ${
                      req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {req.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Approval Action for Manager/Owner */}
                      {isPending && canApprove && (
                        <Button 
                          size="sm" 
                          onClick={() => handleApprovePr(req)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve & Issue PO
                        </Button>
                      )}

                      {/* PDF Action */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1"
                        onClick={() => handleOpenPdf('PR', req)}
                      >
                        <FileText className="w-3 h-3 text-slate-500" /> View PR
                      </Button>

                      {hasPo && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                          onClick={() => {
                            // Construct PO preview data
                            const poData: PurchaseOrder = {
                              id: req.id,
                              poNumber: req.poNumber!,
                              prId: req.id,
                              prNumber: req.prNumber,
                              vendorCode: req.items[0]?.vendorCode || 'VEND-DEFAULT',
                              vendorName: req.items[0]?.vendorName || 'Supplier',
                              isEcosystemVendor: true,
                              deliveryDate: req.deliveryDate,
                              departmentCode: req.departmentCode,
                              items: req.items.map(i => ({
                                itemId: i.itemId,
                                productCode: i.productCode,
                                materialName: i.materialName,
                                quantity: i.quantity,
                                unit: i.unit,
                                unitPrice: i.materialQuotedPrice,
                                totalPrice: i.totalQuotedPrice
                              })),
                              totalAmount: req.totalEstimatedCost,
                              status: 'issued',
                              approvedBy: req.approvedBy || 'Authorized Manager',
                              approvedAt: req.approvedAt || new Date().toISOString(),
                              createdAt: req.createdAt
                            };
                            handleOpenPdf('PO', poData);
                          }}
                        >
                          <Download className="w-3 h-3" /> PO PDF
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShoppingCart className="w-8 h-8 opacity-25" />
                    <p className="text-sm">No purchase requests matching current criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Enhanced Purchase Request (PR) Form Modal with Auto-Fill Engine */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              Create Purchase Requisition (PR)
            </DialogTitle>
            <DialogDescription>
              Select product code or material to auto-populate vendor details and quoted price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Department & Delivery Date (Required Inputs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-500" /> Department Code *
                </label>
                <Select value={departmentCode} onValueChange={setDepartmentCode}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_CODES.map(dept => (
                      <SelectItem key={dept.code} value={dept.code}>
                        <span className="font-mono font-semibold mr-2">{dept.code}</span>
                        <span className="text-slate-500 text-xs">- {dept.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Required Delivery Date *
                </label>
                <Input 
                  type="date" 
                  value={deliveryDate} 
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Auto-Fill Line Item Entry Box */}
            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Line Item Auto-Fill Engine
                </h4>
                <span className="text-[11px] text-emerald-700">Select product code to auto-load vendor & quote</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Item / Product Selector */}
                <div className="sm:col-span-6 space-y-1">
                  <label className="text-xs font-medium text-slate-700">Select Product Code / Material Name</label>
                  <Select value={selectedItemId} onValueChange={handleItemSelect}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Search SKU or Material..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {inventory.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="font-mono font-medium mr-2">{item.productCode || item.sku}</span>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Vendor Code (Auto-populated from item master/vendor database) */}
                <div className="sm:col-span-6 space-y-1">
                  <label className="text-xs font-medium text-slate-700">Vendor Code & Name (Auto-filled)</label>
                  <Select value={selectedVendorCode} onValueChange={setSelectedVendorCode}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Auto-populated vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => (
                        <SelectItem key={v.vendorCode} value={v.vendorCode}>
                          <span className="font-mono font-semibold mr-1.5">{v.vendorCode}</span>
                          <span>{v.name}</span>
                          {v.isInEcosystem ? (
                            <span className="ml-2 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Ecosystem</span>
                          ) : (
                            <span className="ml-2 text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">External</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-medium text-slate-700">Quantity</label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={itemQty} 
                    onChange={e => setItemQty(parseInt(e.target.value) || 1)}
                    className="bg-white"
                  />
                </div>

                {/* Material Quoted Price (Auto-filled) */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-medium text-slate-700">Quoted Price ($)</label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={itemQuotedPrice} 
                      onChange={e => setItemQuotedPrice(parseFloat(e.target.value) || 0)}
                      className="pl-7 bg-white font-mono"
                    />
                  </div>
                </div>

                {/* Row Subtotal */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-medium text-slate-700">Row Total</label>
                  <div className="h-9 px-3 flex items-center bg-slate-100 rounded-md font-mono font-bold text-slate-800 text-xs">
                    ${((Number(itemQuotedPrice) || 0) * (Number(itemQty) || 1)).toFixed(2)}
                  </div>
                </div>

                {/* Add Button */}
                <div className="sm:col-span-2 flex items-end">
                  <Button 
                    type="button" 
                    onClick={handleAddItemToForm} 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Added Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Product Code & Name</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="w-16 text-right">Qty</TableHead>
                    <TableHead className="w-24 text-right">Quoted ($)</TableHead>
                    <TableHead className="w-24 text-right">Total ($)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-slate-400 text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-slate-900">{item.productCode}</div>
                        <div className="text-xs text-slate-600">{item.materialName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-[11px] font-mono text-slate-700 font-medium">{item.vendorCode}</div>
                        <div className="text-[10px] text-slate-400">{item.vendorName}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-xs">{item.quantity} {item.unit}</TableCell>
                      <TableCell className="text-right font-mono text-xs">${item.materialQuotedPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs text-emerald-700">${item.totalQuotedPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveFormItem(idx)}
                          className="h-7 w-7 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {formItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-slate-400 text-xs italic">
                        No line items added yet. Use the auto-fill selector above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {formItems.length > 0 && (
                <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center px-4">
                  <span className="text-xs text-slate-500 font-medium">{formItems.length} item(s) selected</span>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 mr-2">Estimated Total Cost:</span>
                    <span className="text-base font-mono font-bold text-emerald-700">
                      ${totalEstimatedCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Requisition Notes & Justification</label>
              <Input 
                placeholder="e.g. Q4 warehouse packing supplies restock..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitPr} 
              disabled={submitting || formItems.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Submit Purchase Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* External Vendor PO Prompt Modal */}
      {externalVendorPromptOpen && lastGeneratedPo && (
        <Dialog open={externalVendorPromptOpen} onOpenChange={setExternalVendorPromptOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <DialogTitle className="text-lg text-slate-900">External Vendor Dispatch Required</DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Purchase Order <strong>{lastGeneratedPo.poNumber}</strong> was issued for vendor <strong>{lastGeneratedPo.vendorName} ({lastGeneratedPo.vendorCode})</strong>, who is not registered in the digital supplier portal.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-amber-700" /> Manual Transmission Protocol:
              </p>
              <p>
                Please download the system-generated official PO document and transmit it to the supplier via email or fax to guarantee contractual fulfillment.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setExternalVendorPromptOpen(false)}>
                Dismiss
              </Button>
              <Button 
                onClick={() => {
                  generatePurchaseOrderPdf(lastGeneratedPo);
                  setExternalVendorPromptOpen(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Download className="w-4 h-4" /> Download PO PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Universal PDF Document Preview Modal */}
      <UniversalPdfModal 
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        type={pdfDocType}
        data={activeDocData}
      />
    </div>
  );
}
