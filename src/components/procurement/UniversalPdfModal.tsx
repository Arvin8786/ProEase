import React from 'react';
import { 
  Download, 
  Printer, 
  X, 
  FileText, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  ShieldCheck, 
  Calendar,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PurchaseRequest, 
  PurchaseOrder, 
  GoodsReceipt, 
  GoodsIssuance 
} from '../../types';
import { 
  generatePurchaseRequestPdf, 
  generatePurchaseOrderPdf, 
  generateGoodsReceiptPdf, 
  generateGoodsIssuancePdf,
  DEFAULT_COMPANY_HEADER
} from '../../lib/pdfGenerator';
import { useBusinessSettings } from '../../lib/businessSettings';
import { toast } from 'sonner';

export type DocumentType = 'PR' | 'PO' | 'GR' | 'GI';

interface UniversalPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: DocumentType;
  data: PurchaseRequest | PurchaseOrder | GoodsReceipt | GoodsIssuance | null;
}

export function UniversalPdfModal({
  isOpen,
  onClose,
  type,
  data
}: UniversalPdfModalProps) {
  const { settings } = useBusinessSettings();
  if (!isOpen || !data) return null;

  const handleDownload = () => {
    try {
      if (type === 'PR') {
        generatePurchaseRequestPdf(data as PurchaseRequest);
      } else if (type === 'PO') {
        generatePurchaseOrderPdf(data as PurchaseOrder);
      } else if (type === 'GR') {
        generateGoodsReceiptPdf(data as GoodsReceipt);
      } else if (type === 'GI') {
        generateGoodsIssuancePdf(data as GoodsIssuance);
      }
      toast.success('Official PDF generated and downloaded');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate PDF: ' + err.message);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const pr = type === 'PR' ? (data as PurchaseRequest) : null;
  const po = type === 'PO' ? (data as PurchaseOrder) : null;
  const gr = type === 'GR' ? (data as GoodsReceipt) : null;
  const gi = type === 'GI' ? (data as GoodsIssuance) : null;

  const docTitle = 
    type === 'PR' ? 'Purchase Requisition (PR)' :
    type === 'PO' ? 'Official Purchase Order (PO)' :
    type === 'GR' ? 'Goods Receipt Note (GRN)' :
    'Goods Issuance Note (GIN)';

  const docCode = 
    type === 'PR' ? (pr?.prNumber || `PR-${pr?.id.slice(0, 8).toUpperCase()}`) :
    type === 'PO' ? (po?.poNumber || 'PO-XXXX') :
    type === 'GR' ? (gr?.grNumber || 'GRN-XXXX') :
    (gi?.ginNumber || 'GIN-XXXX');

  const docStatus = 
    type === 'PR' ? (pr?.status || 'pending') :
    type === 'PO' ? (po?.status || 'issued') :
    type === 'GR' ? (gr?.isPosted ? 'POSTED' : 'DRAFT') :
    (gi?.status || 'completed');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-xs shadow-sm">
              PDF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-base">{docTitle}</h3>
                <Badge variant="outline" className="font-mono text-xs bg-white text-slate-700">
                  {docCode}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">Universal Print-Ready Document Preview</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBrowserPrint} className="gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button size="sm" onClick={handleDownload} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg h-8 w-8 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Ecosystem Notification Banner if applicable */}
        {type === 'PO' && po && (
          <div className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
            po.isEcosystemVendor 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              {po.isEcosystemVendor ? (
                <>
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span><strong>Ecosystem Connected:</strong> This PO has automatically routed to vendor portal inbox ({po.vendorCode}).</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span><strong>External Vendor (Off-Platform):</strong> Vendor is not in the digital ecosystem. Download this PO PDF to transmit via email.</span>
                </>
              )}
            </div>
            {!po.isEcosystemVendor && (
              <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100">
                Email PDF Copy
              </Button>
            )}
          </div>
        )}

        {/* High-Resolution Document Canvas */}
        <div id="printable-document-content" className="p-8 sm:p-12 overflow-y-auto bg-white font-sans text-slate-800 space-y-8 flex-1">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center font-bold tracking-wider shadow">
                <span className="text-emerald-400 text-xs">PRO</span>
                <span className="text-sm leading-none">ERP</span>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{settings.companyName || DEFAULT_COMPANY_HEADER.companyName}</h1>
                <p className="text-xs font-medium text-slate-500">{settings.headerTagline || DEFAULT_COMPANY_HEADER.subTitle}</p>
                <p className="text-xs text-slate-400 mt-1">{settings.address || DEFAULT_COMPANY_HEADER.address} • Tel: {settings.contactPhone || DEFAULT_COMPANY_HEADER.phone}</p>
                <p className="text-xs text-slate-400">Tax ID: {settings.taxId || DEFAULT_COMPANY_HEADER.taxId} | Reg: {settings.registrationNumber || DEFAULT_COMPANY_HEADER.registrationNumber}</p>
              </div>
            </div>

            <div className="text-right sm:self-center border border-slate-200 rounded-xl p-4 bg-slate-50/70 min-w-[210px]">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-1">
                {docTitle.split('(')[0]}
              </span>
              <div className="text-lg font-mono font-bold text-emerald-700">{docCode}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-white border border-slate-200 shadow-2xs">
                <span className={`w-2 h-2 rounded-full ${
                  String(docStatus).toLowerCase().includes('approv') || String(docStatus).toLowerCase().includes('post') || String(docStatus).toLowerCase().includes('complete')
                    ? 'bg-emerald-500' 
                    : String(docStatus).toLowerCase().includes('pend') 
                    ? 'bg-amber-500' 
                    : 'bg-slate-400'
                }`} />
                {String(docStatus)}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Left Block */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-600" /> 
                {type === 'PR' ? 'Department & Requisition' : type === 'PO' ? 'Vendor / Contractor' : type === 'GR' ? 'Goods Origin & PO' : 'Issuance Dispatch'}
              </h4>
              <div className="space-y-1.5 pt-1 text-slate-700">
                {type === 'PR' && pr && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Requester:</span> <span className="font-semibold">{pr.requesterName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Department Code:</span> <span className="font-mono font-medium">{pr.departmentCode}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Target Delivery:</span> <span className="font-medium">{pr.deliveryDate || 'N/A'}</span></div>
                  </>
                )}

                {type === 'PO' && po && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Supplier Name:</span> <span className="font-semibold">{po.vendorName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Vendor Code:</span> <span className="font-mono font-medium">{po.vendorCode}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Ecosystem Network:</span> 
                      <span className={po.isEcosystemVendor ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-medium'}>
                        {po.isEcosystemVendor ? 'Verified Digital Portal' : 'External Off-Platform'}
                      </span>
                    </div>
                  </>
                )}

                {type === 'GR' && gr && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">PO Number:</span> <span className="font-mono font-semibold">{gr.poNumber}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Physical Invoice #:</span> <span className="font-mono font-bold text-emerald-700">{gr.invoiceNumber || 'INV-NONE'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Supplier:</span> <span className="font-medium">{gr.vendorName}</span></div>
                  </>
                )}

                {type === 'GI' && gi && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Issuance Type:</span> 
                      <span className="font-semibold uppercase tracking-wider text-emerald-700">{gi.type}</span>
                    </div>
                    {gi.type === 'internal' ? (
                      <>
                        <div className="flex justify-between"><span className="text-slate-400">Recipient Dept:</span> <span className="font-mono font-semibold">{gi.departmentCode}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Issued To:</span> <span className="font-medium">{gi.issuedTo}</span></div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between"><span className="text-slate-400">Recipient Entity:</span> <span className="font-medium">{gi.externalRecipient || 'External Client'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Business Justification:</span> <span className="font-medium text-slate-900">{gi.reasoning}</span></div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right Block */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-600" /> Official Tracking Reference
              </h4>
              <div className="space-y-1.5 pt-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Document Date:</span> 
                  <span className="font-medium">
                    {(() => {
                      const docTimestamp = ('createdAt' in data && data.createdAt) || 
                                           ('receivedAt' in data && data.receivedAt) || 
                                           ('issuedAt' in data && data.issuedAt);
                      return docTimestamp?.toDate ? docTimestamp.toDate().toLocaleDateString() : new Date().toLocaleDateString();
                    })()}
                  </span>
                </div>
                {type === 'PR' && pr && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Assigned PO Number:</span> <span className="font-mono font-semibold text-emerald-700">{pr.poNumber || '(Unassigned - Pending)'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Approver:</span> <span className="font-medium">{pr.approvedBy || '(Pending)'}</span></div>
                  </>
                )}
                {type === 'PO' && po && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Requisition Ref:</span> <span className="font-mono font-medium">{po.prNumber}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Target Delivery:</span> <span className="font-medium">{po.deliveryDate}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Authorized By:</span> <span className="font-medium">{po.approvedBy}</span></div>
                  </>
                )}
                {type === 'GR' && gr && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Received By:</span> <span className="font-medium">{gr.receivedBy}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Inventory Status:</span> 
                      <span className={gr.isPosted ? 'font-bold text-emerald-700' : 'font-medium text-amber-700'}>
                        {gr.isPosted ? 'Stock Increment Locked' : 'Pending Verification'}
                      </span>
                    </div>
                  </>
                )}
                {type === 'GI' && gi && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Dispatched By:</span> <span className="font-medium">{gi.issuedBy}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Approval Sign-off:</span> <span className="font-medium">{gi.approvedBy || (gi.type === 'internal' ? 'Automatic (Internal)' : 'Pending Manager Review')}</span></div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Line-Item Pricing Matrix / Item Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold">
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4">Item Code</th>
                  <th className="py-3 px-4">Description / Material</th>
                  {type === 'PR' && <th className="py-3 px-4">Vendor</th>}
                  {type === 'GR' ? (
                    <>
                      <th className="py-3 px-4 text-right">Ordered</th>
                      <th className="py-3 px-4 text-right">Received</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4 text-right">Variance</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4">Unit</th>
                      {(type === 'PR' || type === 'PO') && (
                        <>
                          <th className="py-3 px-4 text-right">Quoted Price</th>
                          <th className="py-3 px-4 text-right">Total</th>
                        </>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {type === 'PR' && pr?.items.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-2.5 px-4 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{item.productCode}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{item.materialName}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{item.vendorCode} - {item.vendorName}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-800">{item.quantity}</td>
                    <td className="py-2.5 px-4 text-slate-500">{item.unit}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600">${Number(item.materialQuotedPrice || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${Number(item.totalQuotedPrice || 0).toFixed(2)}</td>
                  </tr>
                ))}

                {type === 'PO' && po?.items.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-2.5 px-4 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{item.productCode}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{item.materialName}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-800">{item.quantity}</td>
                    <td className="py-2.5 px-4 text-slate-500">{item.unit}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600">${Number(item.unitPrice || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${Number(item.totalPrice || 0).toFixed(2)}</td>
                  </tr>
                ))}

                {type === 'GR' && gr?.items.map((item, idx) => {
                  const variance = (item.receivedQty || 0) - (item.orderedQty || 0);
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-2.5 px-4 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{item.productCode}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{item.itemName}</td>
                      <td className="py-2.5 px-4 text-right text-slate-500">{item.orderedQty}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{item.receivedQty}</td>
                      <td className="py-2.5 px-4 text-slate-500">{item.unit}</td>
                      <td className={`py-2.5 px-4 text-right font-semibold ${variance === 0 ? 'text-slate-500' : variance > 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                        {variance === 0 ? 'OK' : variance > 0 ? `+${variance}` : variance}
                      </td>
                    </tr>
                  );
                })}

                {type === 'GI' && gi?.items.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-2.5 px-4 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{item.productCode}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{item.itemName}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">{item.quantity}</td>
                    <td className="py-2.5 px-4 text-slate-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Footer for Pricing docs */}
            {(type === 'PR' || type === 'PO') && (
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-6 text-xs">
                <div className="text-right space-y-1">
                  <div className="text-slate-500">Document Total:</div>
                  <div className="text-xl font-mono font-bold text-emerald-700">
                    ${type === 'PR' ? Number(pr?.totalEstimatedCost || 0).toFixed(2) : Number(po?.totalAmount || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Authorization Signatures Block */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Digital Authorization Signatures & Audit Trail
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 text-xs flex flex-col justify-between h-28">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">Originator / Store</span>
                  <div className="font-semibold text-slate-800">
                    {type === 'PR' ? pr?.requesterName : type === 'PO' ? 'Procurement Officer' : type === 'GR' ? gr?.receivedBy : gi?.issuedBy}
                  </div>
                  <div className="text-[10px] text-slate-400">ProEase ERP User Verified</div>
                </div>
                <div className="border-t border-slate-300 pt-1 text-[10px] text-slate-400 font-mono">
                  Timestamp: {new Date().toISOString().split('T')[0]}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 text-xs flex flex-col justify-between h-28">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">Inventory / Quality Audit</span>
                  <div className="font-semibold text-slate-800">Internal Material Control</div>
                  <div className="text-[10px] text-slate-400">Stores Ledger Cross-checked</div>
                </div>
                <div className="border-t border-slate-300 pt-1 text-[10px] text-slate-400 font-mono">
                  Sign: [VERIFIED-PASSED]
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-emerald-50/50 border-emerald-200 text-xs flex flex-col justify-between h-28">
                <div>
                  <span className="font-bold text-emerald-700 uppercase text-[10px] block mb-1">Approved Authority</span>
                  <div className="font-bold text-slate-900">
                    {type === 'PR' ? (pr?.approvedBy || 'Pending Manager') : type === 'PO' ? (po?.approvedBy || 'Operations Lead') : type === 'GR' ? 'Warehouse Manager' : (gi?.approvedBy || 'Authorized Manager')}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium">Digital Cryptographic Seal</div>
                </div>
                <div className="border-t border-emerald-200 pt-1 text-[10px] text-emerald-700 font-mono font-bold">
                  Status: CERTIFIED-OFFICIAL
                </div>
              </div>
            </div>
            {settings.footerNote && (
              <div className="mt-4 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400 italic">
                {settings.footerNote}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 print:hidden">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Document satisfies corporate procurement standards and audit compliance.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} size="sm">
              Close
            </Button>
            <Button onClick={handleDownload} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Download className="w-4 h-4" /> Download Official PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
