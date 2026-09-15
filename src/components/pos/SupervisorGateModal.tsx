import React, { useState } from 'react';
import { CartItem, UserProfile } from '../../types';
import { ShieldCheck, Lock, AlertTriangle, KeyRound, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { soundEffects } from '../../lib/audio';
import { toast } from 'sonner';

interface SupervisorGateModalProps {
  isOpen: boolean;
  item: CartItem | null;
  currentUser: UserProfile | null;
  onClose: () => void;
  onAuthorizeOverride: (newPrice: number, supervisorName: string, reason: string) => void;
}

const DEFAULT_SUPERVISOR_PINS = ['9999', '1234', '7788', '0000'];

export const SupervisorGateModal: React.FC<SupervisorGateModalProps> = ({
  isOpen,
  item,
  currentUser,
  onClose,
  onAuthorizeOverride,
}) => {
  const [pin, setPin] = useState('');
  const [newPrice, setNewPrice] = useState<string>('');
  const [reason, setReason] = useState<string>('Manager Discretion');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetPrice = parseFloat(newPrice);
    if (isNaN(targetPrice) || targetPrice < 0) {
      setError('Please enter a valid positive unit price.');
      soundEffects.playAlertBuzz();
      return;
    }

    // Check if current logged-in user is already admin/supervisor
    const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'arvin8786@gmail.com';
    const isPinValid = DEFAULT_SUPERVISOR_PINS.includes(pin.trim());

    if (!isAdmin && !isPinValid) {
      setError('Invalid Supervisor PIN. Access denied.');
      soundEffects.playAlertBuzz();
      toast.error('Supervisor verification failed: Incorrect Security PIN');
      return;
    }

    const supervisorLabel = isAdmin 
      ? `${currentUser?.displayName || 'Administrator'} (Admin)`
      : `Supervisor (Auth PIN #${pin.slice(-2).padStart(4, '*')})`;

    soundEffects.playScanBeep();
    toast.success(`Supervisor authorized price override: $${targetPrice.toFixed(2)}`);
    onAuthorizeOverride(targetPrice, supervisorLabel, reason);
    setPin('');
    setNewPrice('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Security Gate Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-white">Supervisor Security Gate</h3>
                <span className="text-[10px] bg-amber-500/30 text-amber-300 font-bold px-1.5 py-0.5 rounded uppercase">
                  Restricted
                </span>
              </div>
              <p className="text-xs text-slate-400">Authorization required for unit price adjustment</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleVerify} className="p-6 space-y-4">
          {/* Target Line Item Info */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Line Item:</div>
            <div className="text-sm font-semibold text-white flex items-center justify-between">
              <span className="truncate">{item.name}</span>
              <span className="font-mono text-slate-300">${item.originalPrice.toFixed(2)}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              SKU: {item.sku} • Qty: {item.quantity} {item.unit}
            </div>
          </div>

          {/* New Unit Price Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              New Unit Price ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-base font-bold">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder={item.unitPrice.toFixed(2)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-white font-mono text-lg font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
          </div>

          {/* Reason Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Adjustment Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="Damaged Packaging">Damaged Packaging / Open Box</option>
              <option value="Manager Discretion">Manager Discretionary Courtesy</option>
              <option value="Competitor Price Match">Competitor Price Match</option>
              <option value="Expiring Batch Clearance">Expiring Batch Clearance</option>
              <option value="Employee / Internal Discount">Employee / Internal Discount</option>
            </select>
          </div>

          {/* Supervisor Security PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Supervisor PIN / Credential
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Default PIN: 9999 or 1234</span>
            </div>
            <div className="relative">
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-digit supervisor PIN"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white tracking-widest font-mono text-base focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required={currentUser?.role !== 'admin' && currentUser?.email !== 'arvin8786@gmail.com'}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Authorize Override
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
