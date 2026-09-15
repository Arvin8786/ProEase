import React from 'react';
import { UserProfile, Role } from '../types';
import { getVisibleModules } from '../lib/rbac';
import { 
  Store, 
  LogOut, 
  ShieldCheck, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  profile: UserProfile | null;
  onLogout: () => void;
  onSimulateRole?: (role: Role) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  profile,
  onLogout,
  onSimulateRole,
}) => {
  const visibleModules = getVisibleModules(profile);

  // Group modules logically
  const retailModules = visibleModules.filter(m => m.id === 'pos');
  const erpCoreModules = visibleModules.filter(m => ['dashboard', 'sales', 'executive-ai'].includes(m.id));
  const warehouseModules = visibleModules.filter(m => ['inventory', 'master-data', 'goods-receipt', 'goods-issuance', 'purchase-requests'].includes(m.id));
  const personalAndHrModules = visibleModules.filter(m => ['self-service', 'roster', 'hrm'].includes(m.id));
  const financeModules = visibleModules.filter(m => m.id === 'accounting');
  const adminModules = visibleModules.filter(m => m.id === 'business-settings');

  const roleColors: Record<Role, string> = {
    owner: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    admin: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    manager: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    cashier: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    storekeeper: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    sales: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    hr_manager: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    employee: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    requester: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  };

  const renderNavGroup = (title: string, modules: typeof visibleModules) => {
    if (modules.length === 0) return null;
    return (
      <div className="space-y-1 mb-4">
        {isOpen && (
          <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {title}
          </div>
        )}
        {modules.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative
                ${isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold' 
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}
              `}
              title={!isOpen ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? 'scale-105' : 'text-slate-400 group-hover:text-white'}`} />
              
              {isOpen && (
                <div className="flex-1 flex items-center justify-between text-left truncate">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 uppercase tracking-wider border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {isActive && isOpen && (
                <ChevronRight className="w-4 h-4 text-white/70" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <aside 
      className={`
        bg-slate-950 text-slate-200 shrink-0 transition-all duration-300 ease-in-out z-40 border-r border-slate-800/80
        ${isOpen ? 'w-64' : 'w-0 lg:w-20'} 
        fixed lg:relative h-full flex flex-col justify-between overflow-hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header Branding */}
        <div className="h-16 flex items-center px-4 gap-3 border-b border-slate-800 shrink-0 bg-slate-950/60">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/30">
            <Store className="w-5 h-5 text-white" />
          </div>
          {isOpen && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base text-white tracking-tight leading-tight flex items-center gap-1.5">
                ProEase<span className="text-blue-400">ERP</span>
                <span className="text-[10px] bg-slate-800 text-blue-300 px-1 py-0.5 rounded font-mono font-medium">v2.0</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium truncate">Enterprise Retail & POS</span>
            </div>
          )}
        </div>

        {/* User Identity & Active Role Badge */}
        {isOpen && profile && (
          <div className="p-3 mx-3 my-2 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
                  {profile.displayName?.charAt(0) || 'U'}
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">{profile.displayName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{profile.email}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                {profile.employeeId ? `ID: ${profile.employeeId}` : 'Access Tier:'}
              </span>
              <Badge 
                variant="outline" 
                className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 border ${roleColors[profile.role] || 'bg-slate-800 text-slate-300'}`}
              >
                {profile.role.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        )}

        {/* Navigation List filtered strictly by role */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto custom-scrollbar">
          {renderNavGroup('Retail & POS Terminal', retailModules)}
          {renderNavGroup('Core Operations', erpCoreModules)}
          {renderNavGroup('Logistics & Inventory', warehouseModules)}
          {renderNavGroup('HRM & Rostering', personalAndHrModules)}
          {renderNavGroup('Financial Management', financeModules)}
          {renderNavGroup('Administration & Setup', adminModules)}
        </nav>

        {/* Footer Actions / Role Switcher for Testing */}
        <div className="p-3 border-t border-slate-800/90 bg-slate-950/80 space-y-2">
          {/* Quick role simulator for testing all roles if super admin or admin */}
          {isOpen && (profile?.role === 'admin' || profile?.email === 'arvin8786@gmail.com') && onSimulateRole && (
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
                <span className="flex items-center gap-1 text-amber-400">
                  <Sparkles className="w-3 h-3" />
                  RBAC Preview:
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {(['owner', 'admin', 'manager', 'storekeeper', 'cashier', 'sales', 'hr_manager', 'employee'] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => onSimulateRole(r)}
                    className={`px-1 py-1 rounded text-center truncate transition-colors border ${
                      profile.role === r 
                        ? 'bg-blue-600 text-white border-blue-500 font-bold' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {r.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors text-sm font-medium"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-rose-400" />
            {isOpen && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
