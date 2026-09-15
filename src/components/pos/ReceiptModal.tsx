import React, { useRef } from 'react';
import { SalesTransaction } from '../../types';
import { Printer, X, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBusinessSettings } from '../../lib/businessSettings';

interface ReceiptModalProps {
  isOpen: boolean;
  transaction: SalesTransaction | null;
  onClose: () => void;
  onNewSale?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onNewSale,
}) => {
  const { settings } = useBusinessSettings();
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(transaction.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Controls Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">Transaction Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 h-8 px-3"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thermal Receipt Body */}
        <div className="p-6 overflow-y-auto bg-slate-950/50 flex justify-center">
          <div 
            ref={receiptRef}
            id="thermal-receipt"
            className="w-full max-w-sm bg-white text-black p-6 rounded shadow-lg font-mono text-xs border border-slate-300 leading-tight space-y-3"
          >
            {/* Store Header */}
            <div className="text-center space-y-1 border-b border-dashed border-black pb-3">
              <div className="font-extrabold text-base tracking-widest uppercase">{settings.companyName || 'PROEASE MART'}</div>
              <div className="text-[11px] text-zinc-700">{settings.headerTagline || 'Enterprise SME Retail Store'}</div>
              <div className="text-[10px] text-zinc-600">{settings.address || 'Branch #01 • Grand Promenade'}</div>
              <div className="text-[10px] text-zinc-600">Reg: {settings.registrationNumber || '2024-889104-X'} • Tax ID: {settings.taxId || 'TAX-99201'}</div>
              <div className="text-[10px] text-zinc-600">Tel: {settings.contactPhone || '+1 (800) 555-0199'}</div>
            </div>

            {/* Transaction Metadata */}
            <div className="text-[10px] space-y-0.5 border-b border-dashed border-black pb-2 text-zinc-800">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold">{transaction.transactionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{transaction.cashierName} ({transaction.cashierId})</span>
              </div>
              {transaction.membershipId && (
                <div className="flex justify-between font-bold text-zinc-900 pt-0.5">
                  <span>Loyalty Member:</span>
                  <span>{transaction.memberName} [{transaction.memberTier}]</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="border-b border-dashed border-black pb-2 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] border-b border-zinc-300 pb-1">
                <span className="w-1/2">Item Description</span>
                <span className="w-1/6 text-right">Qty</span>
                <span className="w-1/3 text-right">Total</span>
              </div>
              {transaction.items.map((it, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="w-1/2 font-semibold truncate">{it.name}</span>
                    <span className="w-1/6 text-right font-mono">{it.quantity}</span>
                    <span className="w-1/3 text-right font-bold font-mono">${it.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-600">
                    <span>SKU: {it.sku}</span>
                    <span>@ ${it.unitPrice.toFixed(2)}</span>
                  </div>
                  {it.priceOverridden && (
                    <div className="text-[9px] text-amber-700 italic">
                      * Price override: {it.overrideSupervisor || 'Supervisor authorized'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals & Calculations */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-black pb-3">
              <div className="flex justify-between text-zinc-700">
                <span>Subtotal</span>
                <span>${transaction.subtotal.toFixed(2)}</span>
              </div>
              {transaction.markdownDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Timed Clearance Markdown</span>
                  <span>-${transaction.markdownDiscount.toFixed(2)}</span>
                </div>
              )}
              {transaction.memberDiscount > 0 && (
                <div className="flex justify-between text-purple-700 font-semibold">
                  <span>Loyalty Savings ({transaction.memberTier})</span>
                  <span>-${transaction.memberDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-700">
                <span>Sales Tax (6.0%)</span>
                <span>${transaction.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-black pt-1 border-t border-zinc-400">
                <span>TOTAL PAID</span>
                <span>${transaction.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment & Change */}
            <div className="text-[10px] space-y-0.5 border-b border-dashed border-black pb-2 text-zinc-800">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-bold uppercase">{transaction.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Tendered:</span>
                <span>${transaction.amountTendered.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change Due:</span>
                <span>${transaction.changeDue.toFixed(2)}</span>
              </div>
            </div>

            {/* Points Summary */}
            {transaction.membershipId && (
              <div className="p-2 rounded bg-zinc-100 border border-zinc-300 text-center space-y-0.5 text-[10px]">
                <div className="flex items-center justify-center gap-1 font-bold text-zinc-900">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>LOYALTY POINTS SUMMARY</span>
                </div>
                <div>Points Earned on this sale: <strong>+{transaction.pointsEarned} pts</strong></div>
                <div className="text-zinc-600">Member: {transaction.memberName} ({transaction.membershipId})</div>
              </div>
            )}

            {/* Barcode & Thank You */}
            <div className="text-center pt-2 space-y-1.5">
              <div className="inline-block px-3 py-1 bg-zinc-100 font-mono tracking-widest text-[9px] border border-zinc-300 font-bold">
                * {transaction.transactionNumber} *
              </div>
              <div className="text-[10px] text-zinc-600 leading-normal">
                {settings.footerNote || (
                  <>
                    Thank you for shopping at ProEase Mart!<br />
                    Please retain receipt for exchange within 14 days.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            Close
          </Button>

          {onNewSale && (
            <Button
              onClick={() => {
                onClose();
                onNewSale();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Start New Sale
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
