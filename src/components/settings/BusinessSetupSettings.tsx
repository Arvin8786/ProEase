import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Save, 
  ShieldCheck, 
  Globe2, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  Sparkles, 
  MapPinned, 
  Wifi, 
  CreditCard,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useBusinessSettings, DEFAULT_BUSINESS_SETTINGS } from '../../lib/businessSettings';
import { UserProfile, BusinessSettings } from '../../types';
import { toast } from 'sonner';

interface BusinessSetupSettingsProps {
  profile: UserProfile | null;
}

export const BusinessSetupSettings: React.FC<BusinessSetupSettingsProps> = ({ profile }) => {
  const { settings, loading, updateSettings } = useBusinessSettings();
  const [formData, setFormData] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Executive Director/Owner check
  const isAuthorized = 
    profile?.email === 'arvin8786@gmail.com' ||
    profile?.role === 'owner' ||
    profile?.role === 'admin' ||
    profile?.position?.toLowerCase().includes('director');

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white rounded-2xl border border-rose-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Restricted Director Console</h2>
        <p className="text-sm text-slate-600 mb-6">
          Master Business Setup and Document Branding configuration is restricted exclusively to Company Directors, Business Owners, and System Setup Administrators.
        </p>
        <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50 font-mono">
          Required Role: Director / Owner / Super Admin
        </Badge>
      </div>
    );
  }

  const handleChange = (field: keyof BusinessSettings, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCountryChange = (country: 'SG' | 'MY') => {
    setFormData(prev => ({
      ...prev,
      operatingCountry: country,
      currencySymbol: country === 'SG' ? 'S$' : 'RM',
      gstRate: country === 'SG' ? 9 : 0,
      sstRate: country === 'MY' ? 8 : 0,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(formData);
      toast.success('Master business settings & branding saved. Updated across all headers, footers & PDFs!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save business settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        <span>Loading corporate profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Master Business Setup & Branding</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-xs">
                Director Console
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              Configure corporate entity attributes, tax registrations, document letterheads, and geofenced attendance rules.
            </p>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm shrink-0"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving Changes...' : 'Save & Publish Branding'}
        </Button>
      </div>

      {/* Main Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Legal Identity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Corporate Legal Entity</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Official Registry</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Company Legal Name *</Label>
                <Input 
                  value={formData.companyName} 
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  placeholder="e.g. Acme Corporation Pte Ltd"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Registration / UEN Number *</Label>
                <Input 
                  value={formData.registrationNumber} 
                  onChange={(e) => handleChange('registrationNumber', e.target.value)}
                  placeholder="e.g. 202412345M"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tax ID / GST / SST Number *</Label>
                <Input 
                  value={formData.taxId} 
                  onChange={(e) => handleChange('taxId', e.target.value)}
                  placeholder="e.g. GST-REG-98765432"
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Operating Country & Regional Tax Mandate</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleCountryChange('SG')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      formData.operatingCountry === 'SG' 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold ring-1 ring-blue-600' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        <span>🇸🇬 Singapore (SG)</span>
                      </div>
                      <div className="text-xs text-slate-500 font-normal">GST: 9% | InvoiceNow Peppol</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">SGD (S$)</Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCountryChange('MY')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      formData.operatingCountry === 'MY' 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold ring-1 ring-blue-600' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        <span>🇲🇾 Malaysia (MY)</span>
                      </div>
                      <div className="text-xs text-slate-500 font-normal">SST: 8% | LHDN MyInvois</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">MYR (RM)</Badge>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Official Registered Address *</Label>
                <Input 
                  value={formData.address} 
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Street, Unit, Postal Code"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Official Contact Email *</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input 
                    value={formData.contactEmail} 
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    type="email"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Official Contact Phone *</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input 
                    value={formData.contactPhone} 
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Document Branding & Letterhead */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Document Branding & Letterhead Engine</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Universal PDF Engine</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Header Tagline / Subtitle</Label>
                <Input 
                  value={formData.headerTagline} 
                  onChange={(e) => handleChange('headerTagline', e.target.value)}
                  placeholder="e.g. Next-Generation SME Resource Planning & Retail POS Engine"
                />
                <p className="text-[11px] text-slate-400">Renders directly underneath company name in all official PO, PR, and Invoice documents.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Custom Logo URL (Optional)</Label>
                <Input 
                  value={formData.logoUrl || ''} 
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Footer Legal Notice & Disclaimer Note</Label>
                <Textarea 
                  value={formData.footerNote} 
                  onChange={(e) => handleChange('footerNote', e.target.value)}
                  rows={2}
                  placeholder="This document is system-generated and officially authorized..."
                />
                <p className="text-[11px] text-slate-400">Printed at the bottom of all exported PDFs (POs, GRNs, Invoices, Payslips).</p>
              </div>
            </div>
          </div>

          {/* Workplace Geofence & Wi-Fi Attendance Rules */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPinned className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">Workplace Geofencing & Wi-Fi Attendance Setup</h3>
              </div>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                ESS Automated
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Office Latitude</Label>
                <Input 
                  type="number"
                  step="any"
                  value={formData.officeLatitude || 1.2801} 
                  onChange={(e) => handleChange('officeLatitude', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Office Longitude</Label>
                <Input 
                  type="number"
                  step="any"
                  value={formData.officeLongitude || 103.8540} 
                  onChange={(e) => handleChange('officeLongitude', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Max Geofence Radius (meters)</Label>
                <Input 
                  type="number"
                  value={formData.geofenceRadiusMeters || 300} 
                  onChange={(e) => handleChange('geofenceRadiusMeters', parseInt(e.target.value, 10) || 300)}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Authorized Office Wi-Fi SSID</Label>
                <div className="relative">
                  <Wifi className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input 
                    value={formData.authorizedWifiSsid || 'ProEase_Corp_Secure'} 
                    onChange={(e) => handleChange('authorizedWifiSsid', e.target.value)}
                    className="pl-9"
                    placeholder="e.g. ProEase_Office_5G"
                  />
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          handleChange('officeLatitude', pos.coords.latitude);
                          handleChange('officeLongitude', pos.coords.longitude);
                          toast.success(`Current GPS captured: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
                        },
                        (err) => toast.error('Could not capture GPS: ' + err.message)
                      );
                    }
                  }}
                  className="w-full text-xs h-9"
                >
                  <MapPin className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Use Current Location
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Letterhead Preview & Subscription Gate */}
        <div className="space-y-6">
          {/* Executive AI Analytics Subscription Gate */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-indigo-900/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Executive AI Tier</h3>
              </div>
              <Badge className={formData.isPremiumSubscriber ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}>
                {formData.isPremiumSubscriber ? 'ACTIVE TIER' : 'STANDARD'}
              </Badge>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Unlocks Gemini-powered P&L synthesis, predictive low-stock reorder forecasting, and peak-hour roster optimization across all stores.
            </p>

            <div className="pt-2 border-t border-indigo-800/60 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Executive AI Analytics:</span>
              <button
                type="button"
                onClick={() => handleChange('isPremiumSubscriber', !formData.isPremiumSubscriber)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  formData.isPremiumSubscriber ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    formData.isPremiumSubscriber ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Live Document Letterhead Preview Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm">Live Letterhead Preview</span>
              <span className="text-[10px] text-slate-400 font-mono">Auto-Syncing</span>
            </div>

            {/* Document letterhead sample */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 font-sans">
              <div className="flex items-start gap-3 border-b border-slate-900 pb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex flex-col items-center justify-center font-bold text-xs shrink-0">
                  <span className="text-blue-400 text-[9px]">PRO</span>
                  <span className="text-[11px] leading-none">ERP</span>
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 truncate">{formData.companyName || 'Company Name'}</h4>
                  <p className="text-[10px] font-medium text-slate-500 truncate">{formData.headerTagline || 'Tagline'}</p>
                  <p className="text-[9px] text-slate-400 truncate">{formData.address || 'Address'}</p>
                  <p className="text-[9px] text-slate-400">
                    Reg: {formData.registrationNumber || 'UEN'} • Tax ID: {formData.taxId || 'GST'}
                  </p>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sample Document Body</span>
                <div className="my-1.5 text-xs font-semibold text-slate-700">Official Purchase Order / Invoice</div>
                <span className="text-[9px] text-slate-400 font-mono">Currency: {formData.currencySymbol} • Country: {formData.operatingCountry}</span>
              </div>

              <div className="text-[8px] text-slate-400 text-center italic border-t border-slate-200 pt-2">
                {formData.footerNote || 'Footer note preview'}
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-blue-600" />
                Global Synchronization
              </div>
              <p className="text-[11px] text-blue-700">
                Any changes saved here immediately update the top navigation bar, invoice templates, and PDF downloads without server restart.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
