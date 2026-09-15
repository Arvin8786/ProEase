import React from 'react';
import { UserProfile } from '../types';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDefaultTabForRole, ERP_MODULES } from '../lib/rbac';

interface AccessDeniedProps {
  moduleId: string;
  profile: UserProfile | null;
  onRedirect: (tabId: string) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  moduleId,
  profile,
  onRedirect,
}) => {
  const mod = ERP_MODULES.find((m) => m.id === moduleId);
  const defaultTab = getDefaultTabForRole(profile);
  const defaultMod = ERP_MODULES.find((m) => m.id === defaultTab);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-6 shadow-sm">
        <ShieldAlert className="w-8 h-8 text-rose-600" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100/60 border border-rose-200 text-rose-800 text-xs font-semibold mb-3">
        <Lock className="w-3.5 h-3.5" />
        Strict RBAC Route Guard
      </div>

      <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
        Access Denied: {mod?.label || moduleId}
      </h2>

      <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
        Your active security profile (<span className="font-semibold text-slate-900 capitalize">{profile?.role?.replace('_', ' ') || 'User'}</span>) does not have authorization to view this enterprise module.
      </p>

      <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600 max-w-md text-left mb-8 space-y-1.5">
        <div className="font-medium text-slate-700">Security Clearance Requirements:</div>
        <div>
          • Allowed Roles: <span className="font-mono text-slate-800 font-semibold">{mod?.allowedRoles.join(', ')}</span>
        </div>
        {mod?.allowedDepartments && (
          <div>
            • Allowed Departments: <span className="font-mono text-slate-800 font-semibold">{mod.allowedDepartments.join(', ')}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => onRedirect(defaultTab)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 shadow-sm"
        >
          <Home className="w-4 h-4" />
          Return to {defaultMod?.shortLabel || 'Home'}
        </Button>
      </div>
    </div>
  );
};
