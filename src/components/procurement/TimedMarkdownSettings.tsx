import React, { useState, useEffect } from 'react';
import { UserProfile, TimedMarkdownRule } from '../../types';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Clock, 
  Tag, 
  Save, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Zap, 
  ShieldAlert,
  Percent
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface TimedMarkdownSettingsProps {
  currentUser: UserProfile | null;
  categories: string[];
}

export const TimedMarkdownSettings: React.FC<TimedMarkdownSettingsProps> = ({ currentUser, categories }) => {
  const [rule, setRule] = useState<TimedMarkdownRule>({
    id: 'rule_evening_clearance',
    name: 'Evening Clearance & Perishable Markdown',
    startHour: 18,
    endHour: 22,
    discountPercent: 20,
    targetTag: 'clearance',
    targetCategories: ['Bakery', 'Beverages', 'Perishable', 'Grocery'],
    isActive: true,
    description: 'Automatic price reduction window for end-of-day perishables to minimize food waste.',
  });

  const [saving, setSaving] = useState(false);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const isExecutive = 
    currentUser?.email === 'arvin8786@gmail.com' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'owner' ||
    currentUser?.role === 'manager' ||
    currentUser?.position?.toLowerCase().includes('director');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'markdownRules'), (snapshot) => {
      if (snapshot.exists()) {
        setRule(snapshot.data() as TimedMarkdownRule);
      }
    });

    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 30000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const isCurrentlyActive = 
    rule.isActive && 
    currentHour >= rule.startHour && 
    currentHour < rule.endHour;

  const handleToggleCategory = (cat: string) => {
    const currentList = rule.targetCategories || [];
    if (currentList.includes(cat)) {
      setRule({
        ...rule,
        targetCategories: currentList.filter(c => c !== cat),
      });
    } else {
      setRule({
        ...rule,
        targetCategories: [...currentList, cat],
      });
    }
  };

  const handleSave = async () => {
    if (!isExecutive) {
      toast.error('Access Denied: Only Managers, Directors, or Owners can modify Markdown Window settings.');
      return;
    }

    if (rule.startHour >= rule.endHour) {
      toast.error('Start hour must be before End hour (24-hour format).');
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'markdownRules'), {
        ...rule,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.displayName || currentUser?.email || 'Admin',
      });
      toast.success('Timed Markdown Window settings saved! POS registers will automatically apply.');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save markdown settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900">
                  Timed Markdown & Happy Hour Window
                </CardTitle>
                {isCurrentlyActive ? (
                  <Badge className="bg-emerald-500 text-white text-[10px] animate-pulse">
                    Live Active Now
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-400 text-[10px]">
                    Inactive Window
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Protected configuration in Master Database to prevent cashier tampering.
              </CardDescription>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !isExecutive}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-xs"
          >
            {saving ? <Check className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Window Policy
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* Main Activation Banner */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              Enable Automated Timed Markdown Engine
            </Label>
            <p className="text-xs text-slate-500">
              When toggled ON, the POS Terminal automatically applies discounts to targeted items during the configured hours.
            </p>
          </div>
          <Switch
            checked={rule.isActive}
            onCheckedChange={(checked) => setRule({ ...rule, isActive: checked })}
            disabled={!isExecutive}
          />
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-3">
            <Label className="text-xs font-semibold text-slate-700">Rule Name / Campaign Title</Label>
            <Input
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              placeholder="e.g., Evening Fresh Markdown"
              className="text-xs bg-white"
              disabled={!isExecutive}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Start Hour (24h)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                value={rule.startHour}
                onChange={(e) => setRule({ ...rule, startHour: parseInt(e.target.value, 10) || 0 })}
                className="text-xs bg-white font-mono"
                disabled={!isExecutive}
              />
              <span className="text-xs text-slate-400 font-mono">
                {String(rule.startHour).padStart(2, '0')}:00
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              End Hour (24h)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={24}
                value={rule.endHour}
                onChange={(e) => setRule({ ...rule, endHour: parseInt(e.target.value, 10) || 0 })}
                className="text-xs bg-white font-mono"
                disabled={!isExecutive}
              />
              <span className="text-xs text-slate-400 font-mono">
                {String(rule.endHour).padStart(2, '0')}:00
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-emerald-600" />
              Discount Rate (%)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={90}
                value={rule.discountPercent}
                onChange={(e) => setRule({ ...rule, discountPercent: parseInt(e.target.value, 10) || 0 })}
                className="text-xs bg-white font-mono"
                disabled={!isExecutive}
              />
              <span className="text-xs font-bold text-emerald-700">
                {rule.discountPercent}% OFF
              </span>
            </div>
          </div>
        </div>

        {/* Target Categories */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-purple-600" />
            Targeted Product Categories (Multi-select)
          </Label>
          <div className="flex flex-wrap gap-2 pt-1">
            {categories.map((cat) => {
              const isSelected = (rule.targetCategories || []).includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => isExecutive && handleToggleCategory(cat)}
                  disabled={!isExecutive}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                  {cat}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400">
            Selected categories will automatically have {rule.discountPercent}% deducted at POS checkout between {rule.startHour}:00 and {rule.endHour}:00.
          </p>
        </div>

        {/* Security Notice */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
          <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            <strong>Tamper-Proof Audit Lock:</strong> Only authorized Management profiles can adjust markdown windows. Cashier stations observe and apply these parameters in real time via Firestore synchronization.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
