import React, { useState, useEffect } from 'react';
import { SalesTransaction } from '../../types';
import { History, Search, Printer, Calendar, ArrowUpRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ReceiptHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReceipt: (tx: SalesTransaction) => void;
}

export const ReceiptHistoryModal: React.FC<ReceiptHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectReceipt,
}) => {
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'salesTransactions'), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      const list: SalesTransaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as SalesTransaction);
      });
      setTransactions(list);
    } catch (e) {
      console.error('Error fetching sales transactions history', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter((t) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      t.transactionNumber?.toLowerCase().includes(s) ||
      t.cashierName?.toLowerCase().includes(s) ||
      t.memberName?.toLowerCase().includes(s) ||
      t.paymentMethod?.toLowerCase().includes(s)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sales Transactions Archive</h3>
              <p className="text-xs text-slate-400">View recent POS register sales and re-print receipts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by receipt number, cashier, member name, payment method..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading transaction records...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">No sales transactions found in database.</div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Customer / Tier</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                        {tx.transactionNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {new Date(tx.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {tx.cashierName}
                      </td>
                      <td className="py-3 px-4">
                        {tx.memberName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white">{tx.memberName}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {tx.memberTier}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Walk-in Customer</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300 font-mono">
                        {tx.items?.reduce((acc, it) => acc + it.quantity, 0) || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                        ${tx.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          onClick={() => {
                            onSelectReceipt(tx);
                            onClose();
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-7 px-2.5 flex items-center gap-1 mx-auto"
                        >
                          <Printer className="w-3 h-3" />
                          View / Re-print
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs text-slate-400">
          <span>Displaying last {filtered.length} transactions</span>
          <Button variant="outline" size="sm" onClick={onClose} className="bg-slate-800 border-slate-700 text-slate-300">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
