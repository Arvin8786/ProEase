import { Vendor, DepartmentInfo, DEPARTMENT_CODES, UserProfile } from '../types';

export const DEFAULT_VENDORS: Vendor[] = [
  {
    id: 'vend-tech-corp',
    vendorCode: 'VEND-TECH',
    name: 'TechCorp Solutions Ltd.',
    email: 'orders@techcorpsolutions.com',
    phone: '+1 (555) 234-8901',
    address: '400 Innovation Way, Silicon Valley, CA 94025',
    category: 'IT & Electronics',
    isInEcosystem: true, // Registered on ProEase Portal
    paymentTerms: 'Net 30'
  },
  {
    id: 'vend-apex-logistics',
    vendorCode: 'VEND-APEX',
    name: 'Apex Industrial & Packaging Supplies',
    email: 'dispatch@apexsupply.com',
    phone: '+1 (555) 345-6789',
    address: '12 Harbor Logistics Blvd, Newark, NJ 07114',
    category: 'Packaging & Warehouse Gear',
    isInEcosystem: true, // Registered on ProEase Portal
    paymentTerms: 'Net 45'
  },
  {
    id: 'vend-global-office',
    vendorCode: 'VEND-OFFICE',
    name: 'Global Stationery & Office Direct',
    email: 'sales@globalofficedirect.com',
    phone: '+1 (555) 890-1234',
    address: '880 Commerce Park, Suite 200, Chicago, IL 60606',
    category: 'Office & Consumables',
    isInEcosystem: true, // Registered on ProEase Portal
    paymentTerms: 'Net 15'
  },
  {
    id: 'vend-quantum-hardware',
    vendorCode: 'VEND-QUANTUM',
    name: 'Quantum Precision Parts (External)',
    email: 'contact@quantum-precision.de',
    phone: '+49 89 1234567',
    address: 'Industriestrasse 14, 80331 Munich, Germany',
    category: 'Heavy Machinery & Specialized Parts',
    isInEcosystem: false, // External / Off-Platform Vendor
    paymentTerms: 'Prepayment / Wire'
  },
  {
    id: 'vend-metro-print',
    vendorCode: 'VEND-METRO',
    name: 'Metro Custom Print & Marketing (External)',
    email: 'billing@metroprintco.net',
    phone: '+1 (555) 678-9012',
    address: '77 Print District, Austin, TX 78701',
    category: 'Marketing & Print Collateral',
    isInEcosystem: false, // External / Off-Platform Vendor
    paymentTerms: 'Net 30'
  }
];

export function getDepartmentByCode(code: string): DepartmentInfo | undefined {
  return DEPARTMENT_CODES.find(d => d.code === code);
}

export function generateSequenceNumber(prefix: string): string {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}-${randomPart}`;
}

export function isProcurementApprover(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.email === 'arvin8786@gmail.com') return true;
  
  const role = profile.role?.toLowerCase() || '';
  if (role === 'admin' || role === 'manager' || role === 'owner') {
    return true;
  }
  
  const position = profile.position?.toLowerCase() || '';
  if (
    position.includes('director') ||
    position.includes('manager') ||
    position.includes('head') ||
    position.includes('chief') ||
    position.includes('officer')
  ) {
    return true;
  }
  
  return false;
}
