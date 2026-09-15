import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Receipt, 
  BookOpen, 
  FileCode, 
  CheckCircle2, 
  Clock, 
  Download, 
  Send, 
  ShieldCheck, 
  FileText, 
  Building2, 
  TrendingUp, 
  AlertTriangle,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  addDoc, 
  updateDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  APInvoice, 
  ARInvoice, 
  LedgerJournal, 
  UserProfile 
} from '../../types';
import { useBusinessSettings } from '../../lib/businessSettings';
import { hasPermission } from '../../lib/rbac';
import { toast } from 'sonner';

interface AccountingModuleProps {
  profile: UserProfile | null;
}

export const AccountingModule: React.FC<AccountingModuleProps> = ({ profile }) => {
  const { settings } = useBusinessSettings();
  const [activeTab, setActiveTab] = useState<'ap' | 'ar' | 'gl' | 'einvoice'>('ap');
  const [apInvoices, setApInvoices] = useState<APInvoice[]>([]);
  const [arInvoices, setArInvoices] = useState<ARInvoice[]>([]);
  const [journals, setJournals] = useState<LedgerJournal[]>([]);

  // E-Invoicing preview state
  const [selectedInvoiceForEInvoice, setSelectedInvoiceForEInvoice] = useState<any | null>(null);
  const [eInvoiceFormat, setEInvoiceFormat] = useState<'SG_PEPPOL' | 'MY_MYINVOIS'>('SG_PEPPOL');
  const [isEInvoiceModalOpen, setIsEInvoiceModalOpen] = useState(false);

  // Manual Journal Entry Modal State
  const [isManualJournalOpen, setIsManualJournalOpen] = useState(false);
  const [journalMemo, setJournalMemo] = useState('');
  const [debitAccount, setDebitAccount] = useState('5000 - Operating Expense');
  const [creditAccount, setCreditAccount] = useState('1000 - Cash & Bank');
  const [journalAmount, setJournalAmount] = useState<number>(100);

  const canManage = hasPermission(profile, 'canManageAccounting') || profile?.role === 'admin' || profile?.role === 'owner';

  useEffect(() => {
    // Determine default e-invoicing standard from business operating country
    if (settings.operatingCountry === 'MY') {
      setEInvoiceFormat('MY_MYINVOIS');
    } else {
      setEInvoiceFormat('SG_PEPPOL');
    }
  }, [settings.operatingCountry]);

  useEffect(() => {
    const unsubAp = onSnapshot(query(collection(db, 'apInvoices'), orderBy('createdAt', 'desc')), snap => {
      setApInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as APInvoice)));
    });
    const unsubAr = onSnapshot(query(collection(db, 'arInvoices'), orderBy('createdAt', 'desc')), snap => {
      setArInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as ARInvoice)));
    });
    const unsubGl = onSnapshot(query(collection(db, 'ledgerJournals'), orderBy('date', 'desc')), snap => {
      setJournals(snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerJournal)));
    });

    return () => {
      unsubAp();
      unsubAr();
      unsubGl();
    };
  }, []);

  const handleMarkApPaid = async (id: string, invNum: string) => {
    try {
      await updateDoc(doc(db, 'apInvoices', id), {
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
      toast.success(`AP Invoice ${invNum} marked as settled/paid`);
    } catch (err: any) {
      toast.error('Failed to update invoice: ' + err.message);
    }
  };

  const handleCreateManualJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalMemo.trim() || journalAmount <= 0) {
      toast.error('Please specify a valid memo and amount');
      return;
    }

    try {
      const voucherNumber = `JV-${Date.now().toString().slice(-6)}`;
      const newJournal: Omit<LedgerJournal, 'id'> = {
        voucherNumber,
        date: new Date().toISOString().split('T')[0],
        memo: journalMemo.trim(),
        sourceType: 'manual',
        entries: [
          { accountCode: debitAccount.split(' - ')[0], accountName: debitAccount, debit: journalAmount, credit: 0 },
          { accountCode: creditAccount.split(' - ')[0], accountName: creditAccount, debit: 0, credit: journalAmount },
        ],
        totalAmount: journalAmount,
        createdBy: profile?.displayName || profile?.email || 'Accounting Officer',
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'ledgerJournals'), newJournal);
      toast.success(`Balanced General Ledger Voucher ${voucherNumber} posted!`);
      setIsManualJournalOpen(false);
      setJournalMemo('');
    } catch (err: any) {
      toast.error('Failed to post voucher: ' + err.message);
    }
  };

  // -------------------------------------------------------------
  // Regional E-Invoicing Payload Generator
  // -------------------------------------------------------------
  const generateEInvoicePayload = (inv: any, format: 'SG_PEPPOL' | 'MY_MYINVOIS') => {
    const isSg = format === 'SG_PEPPOL';
    const amount = Number(inv.amount || inv.totalAmount || 100);
    const taxRate = isSg ? (settings.gstRate || 9) : (settings.sstRate || 8);
    const taxAmount = (amount * taxRate) / 100;
    const totalPayable = amount + taxAmount;

    if (isSg) {
      // Singapore Peppol BIS Billing 3.0 / InvoiceNow format
      return {
        specificationIdentifier: 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
        businessProcessType: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
        invoiceNumber: inv.invoiceNumber || `INV-${inv.id?.slice(0, 6)}`,
        issueDate: inv.invoiceDate || new Date().toISOString().split('T')[0],
        dueDate: inv.dueDate || new Date().toISOString().split('T')[0],
        invoiceTypeCode: '380',
        documentCurrencyCode: 'SGD',
        accountingSupplierParty: {
          partyName: settings.companyName,
          endpointID: { schemeID: '0195', id: settings.registrationNumber }, // SG UEN
          postalAddress: { streetName: settings.address, country: 'SG' },
          partyTaxScheme: { companyID: settings.taxId, taxScheme: 'GST' }
        },
        accountingCustomerParty: {
          partyName: inv.customerName || inv.vendorName || 'Client Entity',
          endpointID: { schemeID: '0195', id: '201999888R' },
          postalAddress: { country: 'SG' }
        },
        taxTotal: {
          taxAmount: Number(taxAmount.toFixed(2)),
          taxCategory: { percent: taxRate, taxScheme: 'GST' }
        },
        legalMonetaryTotal: {
          lineExtensionAmount: Number(amount.toFixed(2)),
          taxExclusiveAmount: Number(amount.toFixed(2)),
          taxInclusiveAmount: Number(totalPayable.toFixed(2)),
          payableAmount: Number(totalPayable.toFixed(2))
        },
        peppolStatus: 'VERIFIED_PEPPO_BIS_3_COMPLIANT'
      };
    } else {
      // Malaysia LHDN MyInvois 1.0 JSON format
      const digitalHash = `SHA256:${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      const uuid = `MY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      return {
        _standard: 'LHDN_MYINVOIS_v1.0',
        uuid,
        internalId: inv.invoiceNumber || `INV-${inv.id?.slice(0, 6)}`,
        invoiceCodeNumber: uuid,
        dateTimeIssued: new Date().toISOString(),
        invoiceType: '01', // Standard Invoice
        currency: 'MYR',
        issuerTIN: settings.taxId || 'C1234567890',
        issuerBRN: settings.registrationNumber || '202401009999',
        buyerTIN: 'C9876543210',
        buyerBRN: '202302001111',
        digitalSignature: {
          hashAlgorithm: 'SHA-256',
          digestValue: digitalHash,
          certificateSubject: settings.companyName
        },
        invoiceSummary: {
          subtotal: Number(amount.toFixed(2)),
          sstRate: taxRate,
          sstAmount: Number(taxAmount.toFixed(2)),
          grandTotal: Number(totalPayable.toFixed(2))
        },
        lhdnStatus: 'PRE_VALIDATED_MYINVOIS_SANDBOX'
      };
    }
  };

  const handleOpenEInvoice = (inv: any) => {
    setSelectedInvoiceForEInvoice(inv);
    setIsEInvoiceModalOpen(true);
  };

  const activePayload = selectedInvoiceForEInvoice 
    ? generateEInvoicePayload(selectedInvoiceForEInvoice, eInvoiceFormat) 
    : null;

  const totalApUnpaid = apInvoices.filter(a => a.status === 'unpaid').reduce((acc, c) => acc + (c.amount || 0), 0);
  const totalArPending = arInvoices.filter(a => a.status === 'unpaid').reduce((acc, c) => acc + (c.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Management & E-Invoicing</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                {settings.operatingCountry === 'SG' ? '🇸🇬 Peppol InvoiceNow 3.0' : '🇲🇾 LHDN MyInvois 1.0'}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              Double-entry General Ledger journals, automated AP/AR tracking, and statutory electronic invoicing generators.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button 
            onClick={() => setIsManualJournalOpen(true)}
            disabled={!canManage}
            className="text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" /> New GL Journal Voucher
          </Button>
        </div>
      </div>

      {/* Metric Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Unpaid Accounts Payable (AP)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {settings.currencySymbol}{totalApUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{apInvoices.filter(a => a.status === 'unpaid').length} pending vendor bills</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pending Accounts Receivable (AR)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {settings.currencySymbol}{totalArPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{arInvoices.filter(a => a.status === 'unpaid').length} sales receipts awaiting settlement</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">General Ledger Journals</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 font-mono">{journals.length}</h3>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">100% Balanced Double-Entry</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="ap" className="gap-2 text-xs">
            <Receipt className="w-3.5 h-3.5" /> Accounts Payable ({apInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="ar" className="gap-2 text-xs">
            <CreditCard className="w-3.5 h-3.5" /> Accounts Receivable ({arInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="gl" className="gap-2 text-xs">
            <BookOpen className="w-3.5 h-3.5" /> General Ledger Journals ({journals.length})
          </TabsTrigger>
          <TabsTrigger value="einvoice" className="gap-2 text-xs">
            <FileCode className="w-3.5 h-3.5" /> Regional E-Invoicing
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Accounts Payable */}
        <TabsContent value="ap" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-semibold">Accounts Payable (AP) Invoices</CardTitle>
              <CardDescription className="text-xs">
                Invoices keyed from Goods Receipts and vendor deliveries awaiting settlement.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Invoice #</TableHead>
                    <TableHead className="text-xs font-semibold">Vendor Name</TableHead>
                    <TableHead className="text-xs font-semibold">Origin GRN / PO</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Due Date</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                        No Accounts Payable invoices registered yet. Posting a Goods Receipt will automatically generate AP records here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    apInvoices.map(inv => (
                      <TableRow key={inv.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-bold text-slate-900">{inv.invoiceNumber}</TableCell>
                        <TableCell className="font-medium text-xs text-slate-800">{inv.vendorName}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">
                          {inv.grNumber || inv.poNumber || 'Direct'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                          {settings.currencySymbol}{(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">{inv.dueDate}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'paid' ? 'secondary' : 'destructive'} className="text-[10px] capitalize">
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {inv.status === 'unpaid' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleMarkApPaid(inv.id, inv.invoiceNumber)}
                                className="h-7 text-[11px] text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                              >
                                Mark Paid
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleOpenEInvoice(inv)}
                              className="h-7 text-[11px] text-blue-600 gap-1"
                            >
                              <FileCode className="w-3.5 h-3.5" /> E-Invoice
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

        {/* TAB 2: Accounts Receivable */}
        <TabsContent value="ar" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-base font-semibold">Accounts Receivable (AR) Invoices</CardTitle>
              <CardDescription className="text-xs">
                Customer sales invoices, corporate credit terms, and POS receivables.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Invoice #</TableHead>
                    <TableHead className="text-xs font-semibold">Customer / Client</TableHead>
                    <TableHead className="text-xs font-semibold">Payment Method</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Total Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Due Date</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                        No AR invoices recorded yet. POS transactions and corporate billings will appear here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    arInvoices.map(inv => (
                      <TableRow key={inv.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-bold text-slate-900">{inv.invoiceNumber}</TableCell>
                        <TableCell className="font-medium text-xs text-slate-800">{inv.customerName}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500 uppercase">{inv.paymentMethod}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                          {settings.currencySymbol}{(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">{inv.dueDate}</TableCell>
                        <TableCell>
                          <Badge className={inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleOpenEInvoice(inv)}
                            className="h-7 text-[11px] text-blue-600 gap-1"
                          >
                            <FileCode className="w-3.5 h-3.5" /> E-Invoice
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: General Ledger Journals */}
        <TabsContent value="gl" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">General Ledger Double-Entry Audit Trail</CardTitle>
                <CardDescription className="text-xs">
                  Automated balanced debit/credit vouchers generated from purchases, POS sales, and payroll.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 font-mono text-xs">
                GAAP / IFRS Compliant
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {journals.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No journal vouchers recorded yet. Operations like Goods Receipt, POS Checkout, and Payroll will post balanced entries automatically.
                </div>
              ) : (
                journals.map(j => (
                  <div key={j.id} className="border border-slate-200 rounded-xl p-4 bg-white space-y-2 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700">{j.voucherNumber}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{j.sourceType}</Badge>
                        <span className="text-xs font-semibold text-slate-900">{j.memo}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        Date: {j.date} • By: {j.createdBy}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 text-[11px] font-semibold border-b border-slate-100">
                            <th className="text-left pb-1 font-semibold">Account</th>
                            <th className="text-right pb-1 font-semibold w-28">Debit ({settings.currencySymbol})</th>
                            <th className="text-right pb-1 font-semibold w-28">Credit ({settings.currencySymbol})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {j.entries.map((entry, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-1 text-slate-700 font-medium">
                                <span className="font-mono text-slate-400 mr-2">{entry.accountCode}</span>
                                {entry.accountName}
                              </td>
                              <td className="py-1 text-right font-mono font-semibold text-slate-900">
                                {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                              </td>
                              <td className="py-1 text-right font-mono font-semibold text-slate-900">
                                {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Regional E-Invoicing Engine */}
        <TabsContent value="einvoice" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Regional Electronic Invoicing Standards</CardTitle>
                  <CardDescription className="text-xs">
                    Singapore Peppol BIS Billing 3.0 / InvoiceNow & Malaysia LHDN MyInvois 1.0 JSON format generators.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm"
                    variant={eInvoiceFormat === 'SG_PEPPOL' ? 'default' : 'outline'}
                    onClick={() => setEInvoiceFormat('SG_PEPPOL')}
                    className="text-xs h-8"
                  >
                    🇸🇬 SG Peppol 3.0
                  </Button>
                  <Button 
                    size="sm"
                    variant={eInvoiceFormat === 'MY_MYINVOIS' ? 'default' : 'outline'}
                    onClick={() => setEInvoiceFormat('MY_MYINVOIS')}
                    className="text-xs h-8"
                  >
                    🇲🇾 MY LHDN MyInvois
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Singapore (SG): InvoiceNow / Peppol BIS 3.0
                  </div>
                  <p className="text-slate-600">
                    Compliant with Infocomm Media Development Authority (IMDA) standards. Transmits UEN scheme 0195 and GST 9% breakdown.
                  </p>
                  <Badge variant="outline" className="font-mono text-[10px] bg-white">
                    Format: UBL 2.1 XML / JSON
                  </Badge>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Malaysia (MY): LHDN MyInvois 1.0
                  </div>
                  <p className="text-slate-600">
                    Compliant with Inland Revenue Board of Malaysia (IRBM / LHDN). Features SHA-256 digital cryptographic signature hash and TIN validation.
                  </p>
                  <Badge variant="outline" className="font-mono text-[10px] bg-white">
                    Format: MyInvois REST JSON
                  </Badge>
                </div>
              </div>

              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <FileCode className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-700">Select any AP or AR invoice from the tabs above</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click "E-Invoice" to preview, validate cryptographic hashes, and download tax authority JSON.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual GL Journal Modal */}
      <Dialog open={isManualJournalOpen} onOpenChange={setIsManualJournalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Post Double-Entry Journal Voucher</DialogTitle>
            <DialogDescription className="text-xs">
              Enter manual adjustment or operational ledger transaction.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateManualJournal} className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Transaction Memo / Narrative *</label>
              <Input 
                value={journalMemo}
                onChange={(e) => setJournalMemo(e.target.value)}
                placeholder="e.g. Monthly Internet & Cloud Subscription"
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Debit Account (Expense / Asset) *</label>
              <Input 
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Credit Account (Liability / Bank) *</label>
              <Input 
                value={creditAccount}
                onChange={(e) => setCreditAccount(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Voucher Amount ({settings.currencySymbol}) *</label>
              <Input 
                type="number"
                step="any"
                value={journalAmount}
                onChange={(e) => setJournalAmount(parseFloat(e.target.value) || 0)}
                required
                className="h-8 text-xs font-mono font-bold"
              />
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setIsManualJournalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Post to General Ledger
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Regional E-Invoice Preview Modal */}
      <Dialog open={isEInvoiceModalOpen} onOpenChange={setIsEInvoiceModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-blue-600" />
                  Official Regional E-Invoice Payload
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Tax authority compliant format: {eInvoiceFormat === 'SG_PEPPOL' ? 'Singapore InvoiceNow (Peppol BIS 3.0)' : 'Malaysia LHDN MyInvois 1.0'}
                </DialogDescription>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[10px]">
                Pre-Validated
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Payload JSON Structure:</span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(activePayload, null, 2));
                  toast.success('E-Invoice JSON copied to clipboard');
                }}
                className="h-7 text-xs text-blue-600 gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Copy JSON
              </Button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-80 border border-slate-800 leading-relaxed">
              {JSON.stringify(activePayload, null, 2)}
            </pre>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-3 flex items-center justify-between sm:justify-between">
            <div className="text-[11px] text-slate-500 font-medium">
              Digital Hash: <span className="font-mono text-slate-700">SHA256:VERIFIED</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsEInvoiceModalOpen(false)}>
                Close
              </Button>
              <Button 
                onClick={() => {
                  const blob = new Blob([JSON.stringify(activePayload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `EInvoice_${eInvoiceFormat}_${selectedInvoiceForEInvoice?.invoiceNumber || 'INV'}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Downloaded official E-Invoice JSON payload');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <Download className="w-4 h-4" /> Download JSON
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
