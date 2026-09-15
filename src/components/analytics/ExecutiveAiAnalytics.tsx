import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle, 
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  DollarSign,
  Clock,
  Layers,
  BarChart3,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBusinessSettings } from '../../lib/businessSettings';
import { collection, onSnapshot, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile, InventoryItem, Shift, LedgerJournal } from '../../types';
import { toast } from 'sonner';

interface ExecutiveAiAnalyticsProps {
  profile: UserProfile | null;
  onNavigateToSettings?: () => void;
}

export const ExecutiveAiAnalytics: React.FC<ExecutiveAiAnalyticsProps> = ({
  profile,
  onNavigateToSettings,
}) => {
  const { settings } = useBusinessSettings();
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'financial' | 'inventory' | 'labor'>('financial');
  const [loading, setLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<{
    financial?: string;
    inventory?: string;
    labor?: string;
  }>({});

  // Contextual enterprise data for AI prompt
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [journals, setJournals] = useState<LedgerJournal[]>([]);

  useEffect(() => {
    const unsubItems = onSnapshot(collection(db, 'items'), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    });
    const unsubShifts = onSnapshot(collection(db, 'shifts'), snap => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
    });
    const unsubGl = onSnapshot(collection(db, 'ledgerJournals'), snap => {
      setJournals(snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerJournal)));
    });

    return () => {
      unsubItems();
      unsubShifts();
      unsubGl();
    };
  }, []);

  // Premium Subscription Gate Check
  if (!settings.isPremiumSubscriber) {
    return (
      <div className="max-w-4xl mx-auto my-12 space-y-6">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 rounded-3xl border border-indigo-900/60 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Executive AI Analytics Tier Required
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              AI-Powered Decision Intelligence for SME Leaders
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Unlock Gemini 2.5 Flash synthesis across your entire enterprise dataset: real-time P&L diagnostic, predictive stock-out depletion forecasting, and automated cashier shift optimization.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <TrendingUp className="w-5 h-5 text-amber-400 mb-2" />
                <div className="font-bold text-sm">CFO P&L Synthesis</div>
                <p className="text-[11px] text-slate-400">Instant revenue run-rate and expense anomalies.</p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <AlertTriangle className="w-5 h-5 text-blue-400 mb-2" />
                <div className="font-bold text-sm">Predictive Reorder</div>
                <p className="text-[11px] text-slate-400">Stock depletion run-rate & MOQ suggestions.</p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <Users className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="font-bold text-sm">Roster Optimization</div>
                <p className="text-[11px] text-slate-400">Align cashier shifts to peak checkout hours.</p>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
              <Button 
                onClick={onNavigateToSettings}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 h-11 gap-2 shadow-lg shadow-blue-500/20 w-full sm:w-auto"
              >
                <span>Activate in Master Business Settings</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Execute Gemini AI analysis
  const runAiAnalysis = async (taskType: 'financial' | 'inventory' | 'labor') => {
    setLoading(true);
    try {
      let taskKey = 'financial_summary';
      let contextData: any = {};

      if (taskType === 'financial') {
        taskKey = 'financial_summary';
        contextData = {
          company: settings.companyName,
          operatingCountry: settings.operatingCountry,
          currency: settings.currencySymbol,
          generalLedgerJournalsCount: journals.length,
          recentJournals: journals.slice(0, 15).map(j => ({
            voucher: j.voucherNumber,
            date: j.date,
            memo: j.memo,
            totalAmount: j.totalAmount,
            entries: j.entries,
          })),
        };
      } else if (taskType === 'inventory') {
        taskKey = 'inventory_reorder';
        contextData = {
          company: settings.companyName,
          totalSkuCount: items.length,
          itemsAtRisk: items.filter(i => (i.currentStock || 0) <= (i.minStock || 5)).map(i => ({
            sku: i.sku,
            name: i.name,
            currentStock: i.currentStock,
            minStock: i.minStock,
            unitPrice: i.unitPrice,
            vendorName: i.vendorName,
          })),
          sampleCatalog: items.slice(0, 20).map(i => ({
            sku: i.sku,
            name: i.name,
            currentStock: i.currentStock,
            minStock: i.minStock,
          })),
        };
      } else {
        taskKey = 'labor_optimization';
        contextData = {
          company: settings.companyName,
          totalWeeklyShifts: shifts.length,
          shiftsAssigned: shifts.map(s => ({
            employee: s.employeeName,
            shiftType: s.shiftType,
            date: s.date,
            hours: `${s.startTime}-${s.endTime}`,
            location: s.location,
          })),
          posCheckoutPeakHoursEstimated: '12:00-14:00 (Lunch Rush) and 18:30-20:30 (Evening Peak)',
        };
      }

      const res = await fetch('/api/gemini/executive-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: taskKey,
          contextData,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI generation failed');
      }

      setAnalysisResults(prev => ({
        ...prev,
        [taskType]: data.analysis,
      }));

      toast.success('Executive AI analysis synthesized successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('AI Analysis error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-indigo-900/60 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Executive AI Analytics</h1>
              <Badge className="bg-amber-400 text-slate-950 font-bold text-xs">
                Gemini 2.5 Flash
              </Badge>
            </div>
            <p className="text-xs text-slate-300">
              Autonomous cognitive advisory for corporate profit optimization, inventory risk mitigation, and staffing efficiencies.
            </p>
          </div>
        </div>

        <Button
          onClick={() => runAiAnalysis(activeAnalysisTab)}
          disabled={loading}
          className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold gap-2 shadow-md shrink-0"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          {loading ? 'Synthesizing...' : 'Run Live AI Diagnostic'}
        </Button>
      </div>

      {/* Analysis Tabs */}
      <Tabs value={activeAnalysisTab} onValueChange={(v: any) => setActiveAnalysisTab(v)}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="financial" className="gap-2 text-xs">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Financial P&L & Cash Flow
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Inventory Depletion & Reorder
          </TabsTrigger>
          <TabsTrigger value="labor" className="gap-2 text-xs">
            <Users className="w-3.5 h-3.5 text-purple-600" /> Labor & Shift Roster Alignment
          </TabsTrigger>
        </TabsList>

        {/* Content Box */}
        <div className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {activeAnalysisTab === 'financial' && 'Executive P&L & Liquidity Synthesis'}
                  {activeAnalysisTab === 'inventory' && 'Predictive Stock-Out & Reorder Advisory'}
                  {activeAnalysisTab === 'labor' && 'Workforce Rostering & Shift Efficiency'}
                </CardTitle>
                <CardDescription className="text-xs">
                  Grounded in real-time ERP operational data and statutory parameters.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[11px] font-mono">
                Model: gemini-2.5-flash
              </Badge>
            </CardHeader>

            <CardContent className="p-6">
              {loading ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin" />
                  <p className="text-sm font-semibold text-slate-800">Gemini 2.5 Flash is analyzing your enterprise ledger...</p>
                  <p className="text-xs text-slate-400">Computing variances, depletion trajectories, and labor coverage.</p>
                </div>
              ) : analysisResults[activeAnalysisTab] ? (
                <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800 bg-slate-50/60 p-6 rounded-xl border border-slate-200">
                  {analysisResults[activeAnalysisTab]}
                </div>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">Ready to Generate Diagnostic</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Click "Run Live AI Diagnostic" to have Gemini synthesize your latest operational transactions, inventory levels, or shift schedules into structured recommendations.
                  </p>
                  <Button 
                    onClick={() => runAiAnalysis(activeAnalysisTab)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  >
                    <Bot className="w-4 h-4" /> Start Analysis
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
};
