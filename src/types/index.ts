// Shared types, interfaces, enums, and constants for StructEst

// AI CAD Takeoff Review item interface
export interface StagedCadTakeoffItem extends MeasurementItem {
  selected: boolean;
  cadSourceLayer: string;
  confidenceScore: number;
  deductionNotes?: string;
}

// Types
export enum BOQCategory {
  SITE_PREP = 'Site Prep',
  EARTHWORK = 'Earthwork',
  SUBSTRUCTURE = 'Substructure',
  SUPERSTRUCTURE = 'Superstructure',
  FORMWORK = 'Formwork',
  REINFORCEMENT = 'Reinforcement',
  FINISHING = 'Finishing',
  MEP_WORKS = 'MEP Works',
  CIVIL_WORKS = 'Civil Works',
  FINISHES_MEP = 'Finishes & MEP',
}

export type MeasurementCategory =
  | 'Site Prep'
  | 'Earthwork'
  | 'Substructure'
  | 'Superstructure'
  | 'Formwork'
  | 'Reinforcement'
  | 'Finishing'
  | 'MEP Works'
  | 'Civil Works'
  | 'Finishes & MEP';

export interface PredefinedCategoryInfo {
  name: MeasurementCategory;
  description: string;
  badgeClass: string;
}

export const PREDEFINED_CATEGORIES: PredefinedCategoryInfo[] = [
  { name: 'Site Prep', description: 'Site layout, clearing & preparation', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { name: 'Earthwork', description: 'Excavation & soil filling in foundations', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { name: 'Substructure', description: 'Soling & plain cement concrete (PCC)', badgeClass: 'bg-stone-500/10 text-stone-300 border-stone-500/30' },
  { name: 'Superstructure', description: 'RCC M20 concrete & brick masonry', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { name: 'Formwork', description: 'Centering & shuttering with waterproof plywood', badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  { name: 'Reinforcement', description: 'Fe 500 TMT steel rebar bending & binding', badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { name: 'Finishing', description: 'Plaster, paints, tiles, doors, windows & woodwork', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { name: 'MEP Works', description: 'Electrical wiring & sanitary/plumbing works', badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { name: 'Civil Works', description: 'General civil engineering & miscellaneous', badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-500/30' },
];

export const getCategoryBadgeClass = (cat: MeasurementCategory | string) => {
  switch (cat) {
    case 'Site Prep':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Earthwork':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Substructure':
      return 'bg-stone-500/10 text-stone-300 border-stone-500/30';
    case 'Superstructure':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'Formwork':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    case 'Reinforcement':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    case 'Finishing':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'MEP Works':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'Civil Works':
    case 'Finishes & MEP':
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
};

export const DEFAULT_CATEGORY_MAPPINGS: Record<string, MeasurementCategory> = {
  'item-1': 'Site Prep',
  'item-2': 'Earthwork',
  'item-3': 'Earthwork',
  'item-4': 'Substructure',
  'item-5': 'Substructure',
  'item-6': 'Superstructure',
  'item-7': 'Reinforcement',
  'item-8': 'Formwork',
  'item-9': 'Superstructure',
  'item-10': 'Finishing',
  'item-11': 'Finishing',
  'item-12': 'Finishing',
  'item-13': 'Finishing',
  'item-14': 'Finishing',
  'item-15': 'Finishing',
  'item-16': 'MEP Works',
  'item-17': 'MEP Works',
  'item-18': 'Finishing',
  'item-19': 'Finishing',
  'item-20': 'Finishing',
  'item-21': 'Finishing',
  'item-22': 'Finishing',
  'item-23': 'Finishing',
};

export interface SubDivisionLine {
  id: string;
  description: string;
  qty: number;
  length: number;
  width: number;
  height: number;
}

export interface MeasurementItem {
  id: string;
  category: MeasurementCategory;
  description: string;
  unit: 'm³' | 'm²' | 'm' | 'rft' | 'pcs' | 'kg' | 'bags' | 'tons';
  length: number;
  width: number;
  height: number;
  qty: number;
  wastagePercent: number;
  unitRate: number;
  deductionsArea?: number;
  subDivisions?: SubDivisionLine[];
  floor?: 'Foundation' | 'Ground Floor' | '1st Floor' | '2nd Floor' | 'Roof' | string;
}

export interface MaterialRate {
  id: string;
  name: string;
  category: 'Cement & Concrete' | 'Steel & Rebar' | 'Bricks & Masonry' | 'Aggregates & Sand' | 'Formwork & Timber' | 'Finishing & Tiles' | 'Finishing & Paints' | 'Plumbing & MEP' | 'Labor' | string;
  unit: string;
  rate: number;
  supplier?: string;
  spec?: string;
}

export type UserRole = 'admin' | 'estimator' | 'project_manager' | 'site_engineer' | 'client';

export interface UserPermissions {
  canEditBoq: boolean;
  canRunAiTakeoff: boolean;
  canEditRates: boolean;
  canManageUsers: boolean;
  canApproveReport: boolean;
  canExportData: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  avatar?: string | null;
  role: UserRole;
  department: string;
  status?: 'pending' | 'approved';
  avatarBg: string;
  permissions: UserPermissions;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  currency: string;
  fiscalYear: string;
  duration: string;
  companyName: string;
  companyAddress: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  standardWallHeight: number;
  extWallThickness?: number;
  intWallThickness?: number;
  discountAmount?: number;
  measurementStandard?: string;
  wastageDefault: number;
  vatPercent: number;
  contingencyPercent: number;
  items: MeasurementItem[];
  createdAt: string;
  isArchived?: boolean;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  companyName: string;
  companyAddress: string;
  location: string;
  currency: string;
  standardWallHeight: number;
  wastageDefault: number;
  vatPercent: number;
  contingencyPercent: number;
}

export const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'user-1',
    firstName: 'Dharma',
    middleName: '',
    lastName: 'Kunwar',
    name: 'Dharma Kunwar',
    email: 'dharmadkunwar20@gmail.com',
    password: 'ddK@152207',
    role: 'admin',
    department: 'Engineering & Project Leadership',
    avatarBg: 'bg-amber-500 text-slate-950',
    status: 'approved',
    permissions: {
      canEditBoq: true,
      canRunAiTakeoff: true,
      canEditRates: true,
      canManageUsers: true,
      canApproveReport: true,
      canExportData: true,
    },
  },
  {
    id: 'user-2',
    name: 'Er. Suman Shrestha',
    email: 'suman.qs@structest.np',
    role: 'estimator',
    department: 'Quantity Surveying & Take-Off',
    avatarBg: 'bg-blue-600 text-white',
    permissions: {
      canEditBoq: true,
      canRunAiTakeoff: true,
      canEditRates: true,
      canManageUsers: false,
      canApproveReport: false,
      canExportData: true,
    },
  },
  {
    id: 'user-3',
    name: 'Er. Ramesh Adhikari',
    email: 'ramesh.pm@structest.np',
    role: 'project_manager',
    department: 'Project Management & Contracts',
    avatarBg: 'bg-emerald-600 text-white',
    permissions: {
      canEditBoq: true,
      canRunAiTakeoff: false,
      canEditRates: true,
      canManageUsers: false,
      canApproveReport: true,
      canExportData: true,
    },
  },
  {
    id: 'user-4',
    name: 'Sita Thapa',
    email: 'sita.site@structest.np',
    role: 'site_engineer',
    department: 'Site Execution & Quality Control',
    avatarBg: 'bg-purple-600 text-white',
    permissions: {
      canEditBoq: false,
      canRunAiTakeoff: false,
      canEditRates: false,
      canManageUsers: false,
      canApproveReport: false,
      canExportData: false,
    },
  },
  {
    id: 'user-5',
    name: 'Apex Holdings (Client Auditor)',
    email: 'auditor@apexholdings.np',
    role: 'client',
    department: 'Client Representative & Audit',
    avatarBg: 'bg-stone-600 text-white',
    permissions: {
      canEditBoq: false,
      canRunAiTakeoff: false,
      canEditRates: false,
      canManageUsers: false,
      canApproveReport: false,
      canExportData: true,
    },
  },
];

export const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [];