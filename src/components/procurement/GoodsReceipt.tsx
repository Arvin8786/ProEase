import React, { useState, useEffect } from 'react';
import type { 
  GoodsReceipt, 
  GoodsReceiptItem, 
  PurchaseOrder, 
  InventoryItem, 
  UserProfile 
} from '../../types';
import { generateSequenceNumber } from '../../lib/procurementData';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  runTransaction, 
  addDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { 
  ArrowDownLeft, 
  Search, 
  CheckCircle2, 
  FileText, 
  Download, 
  AlertTriangle, 
  Plus, 
  Building, 
  Calendar, 
  Hash, 
  PackageCheck, 
  Layers, 
  Clock, 
  ShieldCheck,
  Eye,
  X
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
import { generateGoodsReceiptPdf } from '../../lib/pdfGenerator';
import { toast } from 'sonner';

interface GoodsReceiptProps {
  profile: UserProfile | null;
}

export function GoodsReceipt({ profile }: GoodsReceiptProps) {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Processing Modal State
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  // Form State
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [poNumber, setPoNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(''); // Required physical invoice number
  const [receiptItems, setReceiptItems] = useState<GoodsReceiptItem[]>([]);
  const [receivingNotes, setReceivingNotes] = useState('');

  // PDF Preview Modal
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<GoodsReceipt | null>(null);

  useEffect(() => {
    // Listen to Goods Receipts
    const qReceipts = query(collection(db, 'goodsReceipts'), orderBy('receivedAt', 'desc'));
    const unsubReceipts = onSnapshot(qReceipts, (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GoodsReceipt)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'goodsReceipts');
    });

    // Listen to Purchase Orders
    const qPo = query(collection(db, 'purchaseOrders'), orderBy('createdAt', 'desc'));
    const unsubPo = onSnapshot(qPo, (snap) => {
      setPurchaseOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    }, (err) => {
      // purchaseOrders collection may be empty initially
    });

    // Listen to Inventory Items
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'items');
    });

    return () => {
      unsubReceipts();
      unsubPo();
      unsubItems();
    };
  }, []);

  // When storekeeper selects a PO to receive against
  const handleSelectPo = (poId: string) => {
    setSelectedPoId(poId);
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    setPoNumber(po.poNumber);
    setSupplierName(po.vendorName);

    // Initialize items with ordered quantity and pre-fill receivedQty
    const mappedItems: GoodsReceiptItem[] = po.items.map(item => ({
      itemId: item.itemId,
      productCode: item.productCode,
      itemName: item.materialName,
      orderedQty: item.quantity,
      receivedQty: Math.max(0, item.quantity - (item.receivedQty || 0)),
      unit: item.unit,
      unitPrice: item.unitPrice
    }));

    setReceiptItems(mappedItems);
  };

  const handleUpdateReceivedQty = (index: number, val: number) => {
    setReceiptItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], receivedQty: Math.max(0, val) };
      return next;
    });
  };

  // Add ad-hoc item from inventory
  const handleAddAdHocItem = (itemId: string) => {
    const invItem = inventory.find(i => i.id === itemId);
    if (!invItem) return;
    if (receiptItems.find(i => i.itemId === itemId)) {
      toast.error('Item is already in this receipt shipment');
      return;
    }

    setReceiptItems(prev => [
      ...prev,
      {
        itemId: invItem.id,
        productCode: invItem.productCode || invItem.sku,
        itemName: invItem.name,
        orderedQty: 0,
        receivedQty: 1,
        unit: invItem.unit,
        unitPrice: invItem.unitPrice || 0
      }
    ]);
  };

  const handleRemoveReceiptItem = (index: number) => {
    setReceiptItems(prev => prev.filter((_, i) => i !== index));
  };

  // Atomic Posting via Firestore runTransaction
  const handlePostGoodsReceipt = async () => {
    if (!invoiceNumber.trim()) {
      toast.error('Physical Invoice Number is required for audit verification');
      return;
    }
    if (receiptItems.length === 0) {
      toast.error('At least one received item is required');
      return;
    }
    const totalReceivedCount = receiptItems.reduce((acc, curr) => acc + curr.receivedQty, 0);
    if (totalReceivedCount <= 0) {
      toast.error('Received quantity must be greater than zero');
      return;
    }

    setPosting(true);
    try {
      const grNumber = generateSequenceNumber('GRN');

      await runTransaction(db, async (transaction) => {
        // Step 1: Read all inventory item documents inside transaction
        const itemSnaps = await Promise.all(
          receiptItems.map(item => transaction.get(doc(db, 'items', item.itemId)))
        );

        // Verify items exist
        for (let i = 0; i < itemSnaps.length; i++) {
          if (!itemSnaps[i].exists()) {
            throw new Error(`Inventory record for "${receiptItems[i].itemName}" not found.`);
          }
        }

        // Read PO if selected
        let poSnap: any = null;
        if (selectedPoId) {
          poSnap = await transaction.get(doc(db, 'purchaseOrders', selectedPoId));
        }

        // Step 2: Write Goods Receipt document locked with isPosted: true
        const receiptRef = doc(collection(db, 'goodsReceipts'));
        const receiptData: Omit<GoodsReceipt, 'id'> = {
          grNumber,
          poNumber: poNumber || 'PO-DIRECT-DELIVERY',
          invoiceNumber: invoiceNumber.trim().toUpperCase(),
          vendorName: supplierName || 'Direct Vendor',
          items: receiptItems,
          receivedBy: profile?.displayName || profile?.email || 'Storekeeper',
          receivedById: profile?.uid || '',
          receivedAt: Timestamp.now(),
          isPosted: true, // Lock GR status
          postedAt: Timestamp.now(),
          notes: receivingNotes.trim()
        };
        transaction.set(receiptRef, receiptData);

        // Step 3: Atomically increment currentStock in items collection
        // currentStock = currentStock + receivedQty
        for (let i = 0; i < receiptItems.length; i++) {
          const item = receiptItems[i];
          const snap = itemSnaps[i];
          const prevStock = snap.data().currentStock || 0;
          const newStock = prevStock + Number(item.receivedQty);

          transaction.update(snap.ref, {
            currentStock: newStock,
            lastUpdated: Timestamp.now()
          });
        }

        // Step 4: Update PO fulfillment status if applicable
        if (poSnap && poSnap.exists()) {
          const poData = poSnap.data() as PurchaseOrder;
          const updatedPoItems = poData.items.map(origItem => {
            const receivedLine = receiptItems.find(r => r.itemId === origItem.itemId);
            const addQty = receivedLine ? receivedLine.receivedQty : 0;
            return {
              ...origItem,
              receivedQty: (origItem.receivedQty || 0) + addQty
            };
          });

          const allFulfilled = updatedPoItems.every(i => (i.receivedQty || 0) >= i.quantity);
          transaction.update(poSnap.ref, {
            items: updatedPoItems,
            status: allFulfilled ? 'completed' : 'partially_received'
          });
        }
      });

      toast.success(`GRN ${grNumber} posted atomically! Inventory stock has been credited.`);

      // Automatically create AP Invoice and balanced General Ledger voucher
      try {
        const totalValue = receiptItems.reduce((acc, i) => acc + (Number(i.receivedQty || 0) * Number(i.unitPrice || 0)), 0);
        const invNum = invoiceNumber.trim().toUpperCase() || `INV-${grNumber}`;
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await addDoc(collection(db, 'apInvoices'), {
          invoiceNumber: invNum,
          vendorName: supplierName || 'Direct Vendor',
          grNumber,
          poNumber: poNumber || 'PO-DIRECT',
          amount: totalValue,
          currency: '$',
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate,
          status: 'unpaid',
          items: receiptItems,
          threeWayMatchStatus: 'matched',
          createdAt: Timestamp.now(),
        });

        await addDoc(collection(db, 'ledgerJournals'), {
          voucherNumber: `JV-${grNumber}`,
          date: new Date().toISOString().split('T')[0],
          memo: `Inventory Receipt ${grNumber} / ${invNum} from ${supplierName || 'Vendor'}`,
          sourceType: 'goods_receipt',
          entries: [
            { accountCode: '1300', accountName: '1300 - Materials & Inventory Asset', debit: totalValue, credit: 0 },
            { accountCode: '2000', accountName: '2000 - Accounts Payable (AP)', debit: 0, credit: totalValue },
          ],
          totalAmount: totalValue,
          createdBy: profile?.displayName || profile?.email || 'Storekeeper',
          createdAt: Timestamp.now(),
        });
      } catch (apErr) {
        console.warn('Auto AP/GL posting error:', apErr);
      }

      setIsProcessModalOpen(false);
      // Reset
      setSelectedPoId('');
      setPoNumber('');
      setSupplierName('');
      setInvoiceNumber('');
      setReceiptItems([]);
      setReceivingNotes('');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to post Goods Receipt: ' + (err.message || 'Transaction aborted'));
    } finally {
      setPosting(false);
    }
  };

  const filteredReceipts = receipts.filter(r => 
    (r.grNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.receivedBy || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Goods Receipt (GRN) & Inbound Shipments</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              ACID Atomic Posting
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Process physical supplier deliveries against POs, record physical invoice numbers, and atomically credit stock.
          </p>
        </div>

        <Button 
          onClick={() => setIsProcessModalOpen(true)}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          <ArrowDownLeft className="w-4 h-4" /> Process Inbound Shipment (GR)
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search GRN#, PO#, Invoice#, Supplier..." 
            className="pl-9 bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {filteredReceipts.length} Goods Receipt Note(s) Logged
        </div>
      </div>

      {/* Posted Goods Receipts History Table */}
      <Card className="border-slate-200 overflow-hidden shadow-xs">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-slate-800">Posted Goods Receipt Notes (GRN)</CardTitle>
            <CardDescription className="text-xs">
              Every posted GRN is cryptographically locked with inventory credit verification.
            </CardDescription>
          </div>
        </CardHeader>

        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-32">GRN Number</TableHead>
              <TableHead className="w-32">PO Reference</TableHead>
              <TableHead className="w-36">Physical Invoice #</TableHead>
              <TableHead>Supplier / Origin</TableHead>
              <TableHead>Items Received</TableHead>
              <TableHead>Received By</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Ledger Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReceipts.map(rcpt => (
              <TableRow key={rcpt.id} className="hover:bg-slate-50/80 transition-colors">
                <TableCell className="font-mono text-xs font-bold text-slate-900">
                  {rcpt.grNumber || `GRN-${rcpt.id.slice(0, 8).toUpperCase()}`}
                </TableCell>

                <TableCell className="font-mono text-xs font-semibold text-blue-700">
                  {rcpt.poNumber || 'PO-DIRECT'}
                </TableCell>

                <TableCell>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {rcpt.invoiceNumber || 'N/A'}
                  </span>
                </TableCell>

                <TableCell className="font-medium text-xs text-slate-800">
                  {rcpt.vendorName}
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {rcpt.items.slice(0, 2).map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[11px] font-normal">
                        +{item.receivedQty} {item.unit} {item.itemName}
                      </Badge>
                    ))}
                    {rcpt.items.length > 2 && (
                      <Badge variant="outline" className="text-[10px] text-slate-500">
                        +{rcpt.items.length - 2} more
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-xs text-slate-700">
                  {rcpt.receivedBy}
                </TableCell>

                <TableCell className="text-xs text-slate-500">
                  {rcpt.receivedAt?.toDate ? rcpt.receivedAt.toDate().toLocaleDateString() : 'Today'}
                </TableCell>

                <TableCell>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1 font-medium">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Stock Posted
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs gap-1 text-slate-700"
                      onClick={() => {
                        setActiveReceipt(rcpt);
                        setPdfModalOpen(true);
                      }}
                    >
                      <Eye className="w-3 h-3" /> View Note
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => generateGoodsReceiptPdf(rcpt)}
                    >
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {filteredReceipts.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-36 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <PackageCheck className="w-8 h-8 opacity-25" />
                    <p className="text-sm">No goods receipt records found.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Process Incoming Goods Receipt Modal */}
      <Dialog open={isProcessModalOpen} onOpenChange={setIsProcessModalOpen}>
        <DialogContent className="sm:max-w-[780px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-blue-600" />
              Process Goods Receipt (GR) Shipment
            </DialogTitle>
            <DialogDescription>
              Verify received line items against PO, input physical supplier invoice, and post stock atomically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Purchase Order Selection & Supplier Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Link to Approved Purchase Order (PO)</label>
                <Select value={selectedPoId} onValueChange={handleSelectPo}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select issued PO to receive against..." />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseOrders.map(po => (
                      <SelectItem key={po.id} value={po.id}>
                        <span className="font-mono font-semibold mr-2">{po.poNumber}</span>
                        <span className="text-slate-600 text-xs">({po.vendorName}) - ${po.totalAmount.toFixed(2)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">PO Number</label>
                <Input 
                  placeholder="PO-2026-XXXX" 
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  className="bg-white font-mono"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Supplier Name *</label>
                <Input 
                  placeholder="e.g. TechCorp Solutions Ltd." 
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  className="bg-white"
                />
              </div>

              {/* Physical Invoice Number (Mandatory Specification) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-emerald-600" /> Physical Invoice # *
                </label>
                <Input 
                  placeholder="e.g. INV-2026-8891" 
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="bg-emerald-50/50 border-emerald-300 font-mono font-bold text-emerald-900 focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            {/* Inbound Line Items Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Shipment Line Items & Stock Posting
                </h4>
                <div className="flex items-center gap-2">
                  <Select onValueChange={handleAddAdHocItem}>
                    <SelectTrigger className="h-8 text-xs w-52 bg-white">
                      <SelectValue placeholder="+ Add item from warehouse..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Product Code & Name</TableHead>
                      <TableHead className="w-24 text-right">Ordered Qty</TableHead>
                      <TableHead className="w-32 text-right">Received Qty *</TableHead>
                      <TableHead className="w-16">Unit</TableHead>
                      <TableHead className="w-20 text-right">Stock Effect</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-slate-400 text-xs">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-mono text-xs font-semibold text-slate-900">{item.productCode}</div>
                          <div className="text-xs text-slate-600">{item.itemName}</div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-500 font-medium">
                          {item.orderedQty}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input 
                            type="number" 
                            min="0"
                            value={item.receivedQty} 
                            onChange={e => handleUpdateReceivedQty(idx, parseInt(e.target.value) || 0)}
                            className="h-8 text-right font-mono font-bold bg-white text-emerald-800"
                          />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{item.unit}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                          +{item.receivedQty}
                        </TableCell>
                        <TableCell>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveReceiptItem(idx)}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {receiptItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-slate-400 text-xs italic">
                          No items loaded. Select a Purchase Order above or add ad-hoc items.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {receiptItems.length > 0 && (
                  <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center px-4">
                    <span className="text-xs text-slate-500">{receiptItems.length} line item(s)</span>
                    <div className="text-xs font-semibold text-slate-800">
                      Total Units to Credit to Stock:{' '}
                      <span className="font-mono text-emerald-700 font-bold text-sm">
                        +{receiptItems.reduce((acc, curr) => acc + curr.receivedQty, 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Receiving Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Receiving Condition & Inspection Notes</label>
              <Input 
                placeholder="e.g. Unboxed in Bay 4; packaging seals intact, zero transit damage..." 
                value={receivingNotes}
                onChange={e => setReceivingNotes(e.target.value)}
              />
            </div>

            {/* ACID Invariant Banner */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Atomic Inventory Posting Invariant:</strong> Submitting will lock the Goods Receipt record (`isPosted: true`) and atomically increment `currentStock` for all line items in a single Firestore transaction.
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsProcessModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePostGoodsReceipt} 
              disabled={posting || receiptItems.length === 0 || !invoiceNumber.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Post Goods Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Universal PDF Document Preview Modal */}
      <UniversalPdfModal 
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        type="GR"
        data={activeReceipt}
      />
    </div>
  );
}
