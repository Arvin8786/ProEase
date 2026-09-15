import React, { useState, useEffect } from 'react';
import type { 
  GoodsIssuance, 
  GoodsIssuanceItem, 
  InventoryItem, 
  UserProfile 
} from '../../types';
import { DEPARTMENT_CODES } from '../../types';
import { 
  generateSequenceNumber, 
  isProcurementApprover 
} from '../../lib/procurementData';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  runTransaction, 
  Timestamp, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { 
  ArrowUpRight, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download, 
  AlertTriangle, 
  Building, 
  ShieldAlert, 
  User, 
  X, 
  Trash2, 
  ExternalLink, 
  Layers,
  Sparkles,
  Eye
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
import { generateGoodsIssuancePdf } from '../../lib/pdfGenerator';
import { toast } from 'sonner';

interface GoodsIssuanceProps {
  profile: UserProfile | null;
}

export function GoodsIssuance({ profile }: GoodsIssuanceProps) {
  const [issuances, setIssuances] = useState<GoodsIssuance[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'external'>('all');

  // New GI Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [issuanceType, setIssuanceType] = useState<'internal' | 'external'>('internal');
  const [departmentCode, setDepartmentCode] = useState<string>('DEPT-LOG');
  const [issuedTo, setIssuedTo] = useState('');
  const [externalRecipient, setExternalRecipient] = useState('');
  const [reasoning, setReasoning] = useState(''); // Required for external
  const [formItems, setFormItems] = useState<GoodsIssuanceItem[]>([]);

  // Item selector
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [itemQty, setItemQty] = useState<number>(1);

  // PDF Preview Modal
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [activeIssuance, setActiveIssuance] = useState<GoodsIssuance | null>(null);

  useEffect(() => {
    const qIss = query(collection(db, 'goodsIssuances'), orderBy('issuedAt', 'desc'));
    const unsubIss = onSnapshot(qIss, (snap) => {
      setIssuances(snap.docs.map(d => ({ id: d.id, ...d.data() } as GoodsIssuance)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'goodsIssuances');
    });

    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'items');
    });

    return () => {
      unsubIss();
      unsubItems();
    };
  }, []);

  const handleAddItemToForm = () => {
    if (!selectedItemId) {
      toast.error('Select an item to issue');
      return;
    }
    const item = inventory.find(i => i.id === selectedItemId);
    if (!item) return;

    if (itemQty > item.currentStock) {
      toast.error(`Insufficient stock! Available in warehouse: ${item.currentStock} ${item.unit}`);
      return;
    }

    if (formItems.find(i => i.itemId === selectedItemId)) {
      toast.error('Item is already added to issuance list');
      return;
    }

    setFormItems(prev => [
      ...prev,
      {
        itemId: item.id,
        productCode: item.productCode || item.sku,
        itemName: item.name,
        quantity: Math.max(1, itemQty),
        unit: item.unit
      }
    ]);

    setSelectedItemId('');
    setItemQty(1);
  };

  const handleRemoveFormItem = (index: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  // Submit Goods Issuance (Internal vs External)
  const handleSubmitIssuance = async () => {
    if (formItems.length === 0) {
      toast.error('Add at least one item to the issuance');
      return;
    }

    if (issuanceType === 'internal') {
      if (!departmentCode) {
        toast.error('Recipient Department Code is required');
        return;
      }
    } else {
      // External: requires reasoning and recipient
      if (!externalRecipient.trim()) {
        toast.error('External recipient name/entity is required');
        return;
      }
      if (!reasoning.trim()) {
        toast.error('Business justification / reasoning is required for external goods dispatch');
        return;
      }
    }

    setSubmitting(true);
    try {
      const ginNumber = generateSequenceNumber('GIN');
      const dept = DEPARTMENT_CODES.find(d => d.code === departmentCode);

      if (issuanceType === 'internal') {
        // Internal GI: Immediate Stock Deduction via runTransaction
        await runTransaction(db, async (transaction) => {
          // Read all items first
          const itemSnaps = await Promise.all(
            formItems.map(item => transaction.get(doc(db, 'items', item.itemId)))
          );

          // Verify stock availability
          for (let i = 0; i < formItems.length; i++) {
            const item = formItems[i];
            const snap = itemSnaps[i];
            if (!snap.exists()) {
              throw new Error(`Item ${item.itemName} not found in inventory.`);
            }
            const currentStock = snap.data().currentStock || 0;
            if (currentStock < item.quantity) {
              throw new Error(`Insufficient stock for ${item.itemName}. Current: ${currentStock}, Requested: ${item.quantity}`);
            }
          }

          // Deduct stock
          for (let i = 0; i < formItems.length; i++) {
            const item = formItems[i];
            const snap = itemSnaps[i];
            const newStock = (snap.data().currentStock || 0) - item.quantity;
            transaction.update(snap.ref, {
              currentStock: newStock,
              lastUpdated: Timestamp.now()
            });
          }

          // Create completed Goods Issuance record
          const giRef = doc(collection(db, 'goodsIssuances'));
          const giData: Omit<GoodsIssuance, 'id'> = {
            ginNumber,
            type: 'internal',
            departmentCode,
            departmentName: dept?.name || '',
            issuedTo: issuedTo.trim() || 'Department Staff',
            items: formItems,
            status: 'completed',
            issuedBy: profile?.displayName || profile?.email || 'Storekeeper',
            issuedById: profile?.uid || '',
            issuedAt: Timestamp.now(),
            stockDeducted: true,
            approvedBy: 'Auto-Approved (Internal)'
          };
          transaction.set(giRef, giData);
        });

        toast.success(`Internal GIN ${ginNumber} completed! Warehouse stock deducted.`);
      } else {
        // External GI: Route to Admin/Manager for approval (Do NOT deduct stock yet!)
        const giRef = doc(collection(db, 'goodsIssuances'));
        const giData: Omit<GoodsIssuance, 'id'> = {
          ginNumber,
          type: 'external',
          externalRecipient: externalRecipient.trim(),
          reasoning: reasoning.trim(),
          items: formItems,
          status: 'pending_approval',
          issuedBy: profile?.displayName || profile?.email || 'Storekeeper',
          issuedById: profile?.uid || '',
          issuedAt: Timestamp.now(),
          stockDeducted: false
        };

        await runTransaction(db, async (transaction) => {
          transaction.set(giRef, giData);
        });

        toast.info(`External GIN ${ginNumber} submitted. Routed to Manager/Admin for authorization.`);
      }

      setIsNewModalOpen(false);
      // Reset form
      setFormItems([]);
      setIssuedTo('');
      setExternalRecipient('');
      setReasoning('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit Goods Issuance');
    } finally {
      setSubmitting(false);
    }
  };

  // Manager/Owner Approval for External Goods Issuance
  const handleApproveExternalGi = async (gi: GoodsIssuance) => {
    if (!isProcurementApprover(profile)) {
      toast.error('Only Admin, Manager, or Owner roles can authorize external goods dispatch.');
      return;
    }

    try {
      // Deduct stock atomically and update GI status to 'approved'
      await runTransaction(db, async (transaction) => {
        const itemSnaps = await Promise.all(
          gi.items.map(item => transaction.get(doc(db, 'items', item.itemId)))
        );

        for (let i = 0; i < gi.items.length; i++) {
          const item = gi.items[i];
          const snap = itemSnaps[i];
          if (!snap.exists()) {
            throw new Error(`Inventory item ${item.itemName} not found.`);
          }
          const currentStock = snap.data().currentStock || 0;
          if (currentStock < item.quantity) {
            throw new Error(`Cannot approve: insufficient stock for ${item.itemName}. Current: ${currentStock}, Required: ${item.quantity}`);
          }
        }

        // Deduct inventory
        for (let i = 0; i < gi.items.length; i++) {
          const item = gi.items[i];
          const snap = itemSnaps[i];
          const newStock = (snap.data().currentStock || 0) - item.quantity;
          transaction.update(snap.ref, {
            currentStock: newStock,
            lastUpdated: Timestamp.now()
          });
        }

        // Update GI record
        const giRef = doc(db, 'goodsIssuances', gi.id);
        transaction.update(giRef, {
          status: 'approved',
          stockDeducted: true,
          approvedBy: profile?.displayName || profile?.email || 'Authorized Manager',
          approvedAt: Timestamp.now()
        });
      });

      toast.success(`External GIN ${gi.ginNumber} approved! Inventory has been credited out.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to authorize external goods issuance');
    }
  };

  const filteredIssuances = issuances.filter(gi => {
    const matchesSearch = 
      (gi.ginNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gi.departmentCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gi.issuedTo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gi.externalRecipient || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gi.reasoning || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || gi.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const canApprove = isProcurementApprover(profile);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Goods Issuance (GIN) & Outbound Dispatch</h1>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Dual Protocol: Internal / External
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Immediate departmental stock deductions and manager-authorized external shipments.
          </p>
        </div>

        <Button 
          onClick={() => setIsNewModalOpen(true)}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
        >
          <ArrowUpRight className="w-4 h-4" /> Issue Goods (GIN)
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search GIN#, Department, Recipient, Reason..." 
            className="pl-9 bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="Issuance Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="internal">Internal Only</SelectItem>
              <SelectItem value="external">External Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Goods Issuance Ledger */}
      <Card className="border-slate-200 overflow-hidden shadow-xs">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-slate-800">Goods Issuance Log (GIN)</CardTitle>
            <CardDescription className="text-xs">
              Review outbound departmental transfers and authorized external shipments.
            </CardDescription>
          </div>
          <div className="text-xs font-mono font-medium text-slate-500">
            {filteredIssuances.length} issuance note(s)
          </div>
        </CardHeader>

        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-32">GIN Number</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead>Destination / Recipient</TableHead>
              <TableHead>Reasoning / Justification</TableHead>
              <TableHead>Items Dispatched</TableHead>
              <TableHead>Issued By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIssuances.map(gi => {
              const isExternal = gi.type === 'external';
              const isPending = gi.status === 'pending_approval';

              return (
                <TableRow key={gi.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-mono text-xs font-bold text-slate-900">
                    {gi.ginNumber || `GIN-${gi.id.slice(0, 8).toUpperCase()}`}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-semibold uppercase ${
                      isExternal ? 'border-amber-400 text-amber-800 bg-amber-50' : 'border-slate-300 text-slate-700 bg-slate-100'
                    }`}>
                      {gi.type}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs">
                      {isExternal ? (
                        <div className="font-semibold text-slate-900">{gi.externalRecipient}</div>
                      ) : (
                        <div>
                          <span className="font-mono font-bold text-emerald-700 mr-1.5">{gi.departmentCode}</span>
                          <span className="text-slate-600">({gi.issuedTo})</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                    {isExternal ? (
                      <span className="text-slate-800 font-medium italic">"{gi.reasoning}"</span>
                    ) : (
                      <span className="text-slate-400">Standard Departmental Issuance</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {gi.items.slice(0, 2).map((item, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[11px] font-normal">
                          -{item.quantity} {item.unit} {item.itemName}
                        </Badge>
                      ))}
                      {gi.items.length > 2 && (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          +{gi.items.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-700">
                    {gi.issuedBy}
                  </TableCell>

                  <TableCell>
                    <Badge className={`text-[11px] font-medium capitalize ${
                      gi.status === 'completed' || gi.status === 'approved' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {gi.status === 'pending_approval' ? 'Pending Approval' : gi.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Approval button for external GIN if manager/owner */}
                      {isPending && canApprove && (
                        <Button 
                          size="sm" 
                          onClick={() => handleApproveExternalGi(gi)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Authorize & Deduct
                        </Button>
                      )}

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setActiveIssuance(gi);
                          setPdfModalOpen(true);
                        }}
                      >
                        <Eye className="w-3 h-3" /> View GIN
                      </Button>

                      <Button 
                        size="sm" 
                        className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => generateGoodsIssuancePdf(gi)}
                      >
                        <Download className="w-3 h-3" /> PDF
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredIssuances.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-36 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Layers className="w-8 h-8 opacity-25" />
                    <p className="text-sm">No goods issuance notes found.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* New Goods Issuance Modal */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="sm:max-w-[740px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-amber-600" />
              Issue Goods from Warehouse (GIN)
            </DialogTitle>
            <DialogDescription>
              Select Internal Department issuance (immediate stock deduct) or External Dispatch (requires management approval).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Issuance Type Toggle */}
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setIssuanceType('internal')}
                className={`py-2.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  issuanceType === 'internal'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building className="w-4 h-4 text-emerald-600" />
                Internal Departmental Dispatch
              </button>
              <button
                type="button"
                onClick={() => setIssuanceType('external')}
                className={`py-2.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  issuanceType === 'external'
                    ? 'bg-white text-amber-900 shadow-xs border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                External Dispatch (Approval Required)
              </button>
            </div>

            {/* Form Fields based on Type */}
            {issuanceType === 'internal' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Recipient Department Code *</label>
                  <Select value={departmentCode} onValueChange={setDepartmentCode}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select department..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_CODES.map(dept => (
                        <SelectItem key={dept.code} value={dept.code}>
                          <span className="font-mono font-bold mr-2">{dept.code}</span>
                          <span className="text-slate-500 text-xs">({dept.name})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Issued To (Employee / Contact)</label>
                  <Input 
                    placeholder="e.g. Alex Morgan (Lead Technician)" 
                    value={issuedTo} 
                    onChange={e => setIssuedTo(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  External Dispatch Protocol
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">External Recipient Entity / Customer / Vendor *</label>
                  <Input 
                    placeholder="e.g. OmniGlobal Trade Show Expo or Client Acme Corp" 
                    value={externalRecipient} 
                    onChange={e => setExternalRecipient(e.target.value)}
                    className="bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Business Justification & Reasoning *</label>
                  <Input 
                    placeholder="e.g. Field prototype evaluation for Q3 client contract demonstration..." 
                    value={reasoning} 
                    onChange={e => setReasoning(e.target.value)}
                    className="bg-white"
                  />
                  <p className="text-[11px] text-amber-800">
                    Stock will NOT be deducted immediately. This request will be routed to an authorized Manager/Owner for audit approval.
                  </p>
                </div>
              </div>
            )}

            {/* Line Items Selector */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Select Warehouse Items to Issue</h4>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="sm:col-span-8 space-y-1">
                  <label className="text-xs font-medium text-slate-700">Warehouse Inventory Item</label>
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Search SKU or Material..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {inventory.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="font-mono font-medium mr-2">{item.productCode || item.sku}</span>
                          <span>{item.name}</span>
                          <span className="ml-2 text-slate-500 text-xs">(Stock: {item.currentStock} {item.unit})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-700">Quantity</label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={itemQty} 
                    onChange={e => setItemQty(parseInt(e.target.value) || 1)}
                    className="bg-white font-mono"
                  />
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <Button 
                    type="button" 
                    onClick={handleAddItemToForm} 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Product Code & Name</TableHead>
                      <TableHead className="text-right w-28">Issue Qty</TableHead>
                      <TableHead className="w-20">Unit</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-slate-400 text-xs">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-mono text-xs font-semibold text-slate-900">{item.productCode}</div>
                          <div className="text-xs text-slate-600">{item.itemName}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-amber-700">
                          -{item.quantity}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{item.unit}</TableCell>
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
                        <TableCell colSpan={5} className="h-20 text-center text-slate-400 text-xs italic">
                          No items added. Select an inventory item above.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitIssuance} 
              disabled={submitting || formItems.length === 0}
              className={issuanceType === 'internal' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
            >
              <CheckCircle2 className="w-4 h-4" /> 
              {issuanceType === 'internal' ? 'Dispatch & Deduct Stock' : 'Route to Manager for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Universal PDF Document Preview Modal */}
      <UniversalPdfModal 
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        type="GI"
        data={activeIssuance}
      />
    </div>
  );
}
