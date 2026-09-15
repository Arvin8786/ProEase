import React, { useState, useEffect } from 'react';
import { CustomerMembership } from '../../types';
import { 
  CreditCard, 
  Search, 
  UserPlus, 
  Check, 
  X, 
  Crown, 
  Phone, 
  Sparkles,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { soundEffects } from '../../lib/audio';

interface MembershipModalProps {
  isOpen: boolean;
  activeMember: CustomerMembership | null;
  onClose: () => void;
  onSelectMember: (member: CustomerMembership | null) => void;
}

const TIER_BENEFITS: Record<string, { discount: number; color: string; bg: string }> = {
  Silver: { discount: 5, color: 'text-slate-300', bg: 'bg-slate-700/60' },
  Gold: { discount: 10, color: 'text-amber-300', bg: 'bg-amber-500/20' },
  Platinum: { discount: 15, color: 'text-cyan-300', bg: 'bg-cyan-500/20' },
  VIP: { discount: 20, color: 'text-purple-300', bg: 'bg-purple-500/20' },
};

export const MembershipModal: React.FC<MembershipModalProps> = ({
  isOpen,
  activeMember,
  onClose,
  onSelectMember,
}) => {
  const [members, setMembers] = useState<CustomerMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // New member form
  const [newCardId, setNewCardId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTier, setNewTier] = useState<'Silver' | 'Gold' | 'Platinum' | 'VIP'>('Gold');

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'memberships'));
      const list: CustomerMembership[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as CustomerMembership);
      });

      // If database is empty, seed demo sample members for instant seamless usage
      if (list.length === 0) {
        const seedMembers: Omit<CustomerMembership, 'id'>[] = [
          {
            membershipId: 'MEM-8801',
            name: 'Sophia Davis',
            phone: '+1 555-0192',
            email: 'sophia.davis@example.com',
            tier: 'VIP',
            discountPercent: 20,
            points: 1250,
            joinedDate: '2024-03-12',
          },
          {
            membershipId: 'MEM-8802',
            name: 'Marcus Sterling',
            phone: '+1 555-0144',
            email: 'marcus.s@example.com',
            tier: 'Platinum',
            discountPercent: 15,
            points: 840,
            joinedDate: '2024-06-20',
          },
          {
            membershipId: 'MEM-8803',
            name: 'Elena Rostova',
            phone: '+1 555-0177',
            email: 'elena.rostova@example.com',
            tier: 'Gold',
            discountPercent: 10,
            points: 490,
            joinedDate: '2024-09-01',
          },
          {
            membershipId: 'MEM-8804',
            name: 'David Chen',
            phone: '+1 555-0123',
            email: 'david.chen@example.com',
            tier: 'Silver',
            discountPercent: 5,
            points: 120,
            joinedDate: '2025-01-15',
          },
        ];

        for (const sm of seedMembers) {
          const ref = await addDoc(collection(db, 'memberships'), {
            ...sm,
            createdAt: serverTimestamp(),
          });
          list.push({ id: ref.id, ...sm });
        }
      }

      setMembers(list);
    } catch (e) {
      console.error('Error fetching memberships', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.name?.toLowerCase().includes(q) ||
      m.membershipId?.toLowerCase().includes(q) ||
      m.phone?.toLowerCase().includes(q) ||
      m.tier?.toLowerCase().includes(q)
    );
  });

  const handleRegisterNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const cardNum = newCardId.trim() || `MEM-${Math.floor(1000 + Math.random() * 9000)}`;
      const discount = TIER_BENEFITS[newTier].discount;

      const memberData: Omit<CustomerMembership, 'id'> = {
        membershipId: cardNum,
        name: newName.trim(),
        phone: newPhone.trim() || 'N/A',
        email: newEmail.trim() || '',
        tier: newTier,
        discountPercent: discount,
        points: 50, // Welcome bonus points
        joinedDate: new Date().toISOString().split('T')[0],
      };

      const docRef = await addDoc(collection(db, 'memberships'), {
        ...memberData,
        createdAt: serverTimestamp(),
      });

      const registered: CustomerMembership = { id: docRef.id, ...memberData };
      setMembers([registered, ...members]);
      soundEffects.playScanBeep();
      toast.success(`Membership card registered: ${registered.name} (${registered.tier})`);
      onSelectMember(registered);
      setIsRegistering(false);
      onClose();
    } catch (err) {
      console.error('Failed to create membership', err);
      toast.error('Failed to register membership');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Customer Membership Engine</h3>
              <p className="text-xs text-slate-400">Scan membership card or lookup loyalty points</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeMember && !isRegistering && (
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{activeMember.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500 text-white font-bold">
                      {activeMember.tier} ({activeMember.discountPercent}% OFF)
                    </span>
                  </div>
                  <div className="text-xs text-purple-300/80 font-mono">
                    ID: {activeMember.membershipId} • Points Balance: <strong>{activeMember.points} pts</strong>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onSelectMember(null);
                  toast.info('Membership detached from current cart');
                }}
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-rose-500 hover:text-white"
              >
                Detach
              </Button>
            </div>
          )}

          {isRegistering ? (
            <form onSubmit={handleRegisterNewMember} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-400" />
                  Enroll New Loyalty Member
                </h4>
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Back to search
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Card Number / Barcode</label>
                  <input
                    type="text"
                    value={newCardId}
                    onChange={(e) => setNewCardId(e.target.value)}
                    placeholder="e.g. MEM-9021 (auto if empty)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Membership Tier</label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                  >
                    <option value="Silver">Silver (5% Discount)</option>
                    <option value="Gold">Gold (10% Discount)</option>
                    <option value="Platinum">Platinum (15% Discount)</option>
                    <option value="VIP">VIP (20% Discount)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rachel Adams"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Phone Number</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRegistering(false)}
                  className="flex-1 bg-slate-800 border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Save & Apply Card
                </Button>
              </div>
            </form>
          ) : (
            <>
              {/* Search input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Scan card barcode or search by name / phone..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <Button
                  onClick={() => setIsRegistering(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Member
                </Button>
              </div>

              {/* Members List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {loading ? (
                  <div className="text-center py-6 text-slate-500 text-xs">Loading membership records...</div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No membership records found matching &ldquo;{searchQuery}&rdquo;.
                  </div>
                ) : (
                  filteredMembers.map((m) => {
                    const isSelected = activeMember?.id === m.id;
                    const tierMeta = TIER_BENEFITS[m.tier] || TIER_BENEFITS.Gold;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          soundEffects.playScanBeep();
                          onSelectMember(m);
                          toast.success(`Member applied: ${m.name} (${m.discountPercent}% OFF)`);
                          onClose();
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-purple-900/30 border-purple-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg ${tierMeta.bg} ${tierMeta.color} flex items-center justify-center font-bold text-sm shrink-0`}>
                            {m.tier.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-2">
                              <span>{m.name}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${tierMeta.bg} ${tierMeta.color} border-current/20`}>
                                {m.tier} • {m.discountPercent}% OFF
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-3">
                              <span className="font-mono">{m.membershipId}</span>
                              {m.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-bold text-purple-400">{m.points} pts</div>
                          <span className="text-[10px] text-slate-500">Loyalty Balance</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
