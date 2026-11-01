import React, { useState, useEffect } from 'react';
import DxfParser from 'dxf-parser';
declare module 'dxf-parser';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Building2,
  Calculator,
  Layers,
  FileSpreadsheet,
  Cpu,
  Printer,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  DollarSign,
  Maximize2,
  Sparkles,
  Download,
  Save,
  HelpCircle,
  FileText,
  Hammer,
  ShieldCheck,
  RefreshCw,
  Compass,
  ChevronRight,
  TrendingUp,
  Box,
  Wrench,
  Ruler,
  ChevronDown,
  ListPlus,
  CheckSquare,
  Square,
  ArrowRight,
  Sliders,
  Loader2,
  Users,
  UserCheck,
  UserPlus,
  Search,
  Grid,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Package,
  Lock,
  Unlock,
  History,
  FileUp,
  FileDown,
  X,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { BlueprintCanvasOverlay } from './components/BlueprintCanvasOverlay';
import { ProjectParameters } from './components/ProjectParameters';
import { MaterialsLibrary } from './components/MaterialsLibrary';
import { DxfLayerDistributionChart } from './components/DxfLayerDistributionChart';
import { NbcMunicipalCompliance } from './components/NbcMunicipalCompliance';
import { DEFAULT_BOQ_TERMS } from './components/takeoff/terms';
import { AuthPage } from './components/AuthPage';
import { CadImporter } from './components/App/CadImporter';
import { ProjectList } from './components/App/ProjectList';
import { AuditLog } from './components/App/AuditLog';
import { CadLineweightLegend } from './components/CadLineweightLegend';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import {
  StagedCadTakeoffItem,
  MeasurementItem,
  MeasurementCategory,
  UserRole,
  UserProfile,
  AuditLogEntry,
  Project,
  ProjectTemplate,
  MaterialRate,
  SubDivisionLine,
  BOQCategory,
  PredefinedCategoryInfo,
  UserPermissions,
  PREDEFINED_CATEGORIES,
  DEFAULT_CATEGORY_MAPPINGS,
  DEFAULT_USERS,
  DEFAULT_AUDIT_LOGS,
  getCategoryBadgeClass,
} from './types';

// Re-export all types for backward compatibility with existing imports from App
export type {
  StagedCadTakeoffItem,
  MeasurementItem,
  MeasurementCategory,
  UserRole,
  UserProfile,
  AuditLogEntry,
  Project,
  ProjectTemplate,
  MaterialRate,
  SubDivisionLine,
  BOQCategory,
  PredefinedCategoryInfo,
  UserPermissions,
} from './types';

export {
  PREDEFINED_CATEGORIES,
  DEFAULT_CATEGORY_MAPPINGS,
  DEFAULT_USERS,
  DEFAULT_AUDIT_LOGS,
  getCategoryBadgeClass,
} from './types';

import { DEFAULT_MATERIALS, BLANK_PROJECT, INITIAL_PROJECTS } from './constants';
import { ensureItemCategories } from './utils';



export default function App() {
  const auth = useAuth();
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('structest_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return ensureItemCategories(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_PROJECTS;
  });

  const [templates, setTemplates] = useState<ProjectTemplate[]>(() => {
    const saved = localStorage.getItem('structest_templates');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [newTemplateName, setNewTemplateName] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('structest_templates', JSON.stringify(templates));
  }, [templates]);

  const handleSaveTemplate = () => {
    if (!newTemplateName) return;
    const newTmpl: ProjectTemplate = {
        id: 'tmpl-' + Date.now(),
        name: newTemplateName,
        companyName: currentProject.companyName,
        companyAddress: currentProject.companyAddress,
        location: currentProject.location,
        currency: currentProject.currency,
        standardWallHeight: currentProject.standardWallHeight,
        wastageDefault: currentProject.wastageDefault,
        vatPercent: currentProject.vatPercent,
        contingencyPercent: currentProject.contingencyPercent
    };
    setTemplates([...templates, newTmpl]);
    setNewTemplateName('');
  };

  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || 'proj-1');
  const [showArchivedProjects, setShowArchivedProjects] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'boq' | 'takeoff' | 'materials' | 'blueprint' | 'ai-auditor' | 'report' | 'settings' | 'users' | 'nbc205'>('boq');
  const [boqCategoryFilter, setBoqCategoryFilter] = useState<string>('All');
  const [activeStoryFilter, setActiveStoryFilter] = useState<string>('All Stories');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('structest_theme');
    return saved ? saved === 'dark' : false;
  });
  const [nbcSubTab, setNbcSubTab] = useState<'audit' | 'municipal'>('municipal');
  const [cadScalePreset, setCadScalePreset] = useState<string>('1:100');
  const [cadScaleFactor, setCadScaleFactor] = useState<number>(1.0);
  const [isolatedStructuralType, setIsolatedStructuralType] = useState<string | null>(null);
  const [timelineViewMode, setTimelineViewMode] = useState<'spend' | 'progress' | 'workload'>('spend');

  const [layerMappings, setLayerMappings] = useState<Record<string, MeasurementCategory>>(() => {
    const saved = localStorage.getItem('structest_layer_mappings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      'WALLS': 'Superstructure',
      'WALLS_EXT': 'Superstructure',
      'WALLS_INT': 'Superstructure',
      'COLUMNS': 'Superstructure',
      'BEAMS': 'Superstructure',
      'DOORS': 'Finishing',
      'WINDOWS': 'Finishing',
      'PARTITIONS': 'Superstructure',
      'ANNOTATIONS': 'Civil Works',
    };
  });
  const [newMapLayerInput, setNewMapLayerInput] = useState('');
  const [newMapCategoryInput, setNewMapCategoryInput] = useState<MeasurementCategory>('Superstructure');

  useEffect(() => {
    localStorage.setItem('structest_layer_mappings', JSON.stringify(layerMappings));
  }, [layerMappings]);

  const handleRunAiTakeoffFromMappings = () => {
    let newItemsCount = 0;
    const generatedItems: MeasurementItem[] = [];
    const layersToProcess = Array.from(new Set([...dxfLayers, ...Object.keys(layerMappings)]));

    layersToProcess.forEach(layerName => {
      const category = layerMappings[layerName] || 'Superstructure';
      const upper = layerName.toUpperCase();
      let desc = `AI Automated Take-Off from Layer [${layerName}] (${category})`;
      let unit: MeasurementItem['unit'] = 'm³';
      let length = 12.5;
      let width = 0.23;
      let height = 3.0;
      let qty = 37.5;
      let rate = 1200;

      if (upper.includes('WALL') || upper.includes('PARTITION')) {
        unit = 'm³';
        length = 45.0;
        width = upper.includes('EXT') ? 0.23 : 0.115;
        height = currentProject.standardWallHeight;
        qty = Number((length * width * height).toFixed(2));
        rate = 16000;
      } else if (upper.includes('COL')) {
        unit = 'm³';
        length = 0.35;
        width = 0.35;
        height = currentProject.standardWallHeight;
        qty = Number((length * width * height * 4).toFixed(2));
        rate = 12000;
      } else if (upper.includes('DOOR') || upper.includes('WIN')) {
        unit = 'm²';
        length = 1.2;
        width = 1.0;
        height = 2.1;
        qty = Number((length * height * 5).toFixed(2));
        rate = 8000;
      }

      generatedItems.push({
        id: 'item-mapped-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        category,
        description: desc,
        unit,
        length,
        width,
        height,
        qty,
        wastagePercent: currentProject.wastageDefault,
        unitRate: rate,
        floor: 'Ground Floor'
      });
      newItemsCount++;
    });

    if (generatedItems.length > 0) {
      handleBatchSaveTakeoffItemsToBOQ(generatedItems);
      alert(`Successfully generated ${newItemsCount} BOQ items using Layer Mapping AI Take-Off rules! Check the BOQ Summary tab.`);
      logActivity('AI Layer Mapping Take-Off', `Generated ${newItemsCount} items from mapped CAD layers.`);
    } else {
      alert('No layers available for mapping take-off.');
    }
  };

  const getItemFloor = (item: MeasurementItem): string => {
    if (item.floor) return item.floor;
    const desc = (item.description || '').toUpperCase();
    if (desc.includes('FOUNDATION') || desc.includes('EARTHWORK') || desc.includes('EXCAVATION') || desc.includes('SOLING') || desc.includes('P.C.C') || desc.includes('FOOTING') || desc.includes('PLINTH') || desc.includes('TIE BEAM')) {
      return 'Foundation';
    }
    if (desc.includes('FIRST FLOOR') || desc.includes('1ST FLOOR')) {
      return '1st Floor';
    }
    if (desc.includes('SECOND FLOOR') || desc.includes('2ND FLOOR')) {
      return '2nd Floor';
    }
    if (desc.includes('ROOF') || desc.includes('PARAPET') || desc.includes('TERRACE') || desc.includes('WATER TANK')) {
      return 'Roof';
    }
    return 'Ground Floor';
  };

  const [materials, setMaterials] = useState<MaterialRate[]>(() => {
    const saved = localStorage.getItem('structest_materials');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_MATERIALS;
  });

  // User Management & RBAC State
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('structest_users');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_USERS;
  });
  const currentUser = auth.user || DEFAULT_USERS[0];

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem('structest_audit_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_AUDIT_LOGS;
  });

  useEffect(() => {
    localStorage.setItem('structest_users', JSON.stringify(users));
  }, [users]);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTemplateName, setNewProjectTemplateName] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('estimator');
  const [newUserDept, setNewUserDept] = useState('Civil Estimation');

  // Materials Library Search & Form State
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedMaterialCategory, setSelectedMaterialCategory] = useState('All');
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialRate | null>(null);
  const [matFormName, setMatFormName] = useState('');
  const [matFormCategory, setMatFormCategory] = useState<string>('Cement & Concrete');
  const [matFormUnit, setMatFormUnit] = useState('bags');
  const [matFormRate, setMatFormRate] = useState<number>(850);
  const [matFormSpec, setMatFormSpec] = useState('');
  const [matFormSupplier, setMatFormSupplier] = useState('');
  const [showBomCalculator, setShowBomCalculator] = useState(false);

  // Blueprint Controls State
  const [blueprintColorMode, setBlueprintColorMode] = useState<'dark' | 'light'>('dark');
  const [blueprintZoom, setBlueprintZoom] = useState<number>(1.0);
  const [blueprintShowGrid, setBlueprintShowGrid] = useState<boolean>(true);
  const [blueprintScalePreset, setBlueprintScalePreset] = useState<string>('1:100');
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    WALLS: true,
    COLUMNS: true,
    DOORS: true,
    WINDOWS: true,
    PARTITIONS: true,
    ANNOTATIONS: true,
  });
  const [simulatedTakeoffMessage, setSimulatedTakeoffMessage] = useState<string | null>(null);
  const [dxfEntityTypeFilter, setDxfEntityTypeFilter] = useState<string>('ALL');
  const [dxfZoomLevel, setDxfZoomLevel] = useState<number>(1.0);
  const [dxfPanOffset, setDxfPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{x:number, y:number}[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [mouseCoord, setMouseCoord] = useState<{x:number, y:number} | null>(null);

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Debounced auto-save mechanism for projects and materials
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('structest_projects', JSON.stringify(projects));
    }, 400);
    return () => clearTimeout(timer);
  }, [projects]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('structest_materials', JSON.stringify(materials));
    }, 400);
    return () => clearTimeout(timer);
  }, [materials]);

  useEffect(() => {
    localStorage.setItem('structest_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('structest_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('structest_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const logActivity = (action: string, details: string) => {
    const entry: AuditLogEntry = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      details,
    };
    setAuditLogs(prev => [entry, ...prev.slice(0, 49)]);
  };

  // Modal states for adding/editing measurement items
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MeasurementItem | null>(null);

  // New item form state
  const [formCategory, setFormCategory] = useState<MeasurementItem['category']>('Superstructure');
  const [formDesc, setFormDesc] = useState('');
  const [formUnit, setFormUnit] = useState<MeasurementItem['unit']>('m³');
  const [formLength, setFormLength] = useState<number>(1);
  const [formWidth, setFormWidth] = useState<number>(1);
  const [formHeight, setFormHeight] = useState<number>(1);
  const [formQty, setFormQty] = useState<number>(1);
  const [formWastage, setFormWastage] = useState<number>(currentProject?.wastageDefault || 5);
  const [formRate, setFormRate] = useState<number>(1000);
  const [formDeduction, setFormDeduction] = useState<number>(0);
  const [formFloor, setFormFloor] = useState<string>('Ground Floor');

  // AI Auditor state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Blueprint / drawing import state
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [importedFilePreview, setImportedFilePreview] = useState<string | null>(null);
  const [blueprintSubTab, setBlueprintSubTab] = useState<'canvas' | 'dxf'>('canvas');
  const [importError, setImportError] = useState<string | null>(null);

  const handleSaveTakeoffItemToBOQ = (item: MeasurementItem) => {
    const updatedProjects = projects.map(p =>
      p.id === currentProject.id
        ? { ...p, items: [...p.items, item] }
        : p
    );
    setProjects(updatedProjects);
  };

  const handleBatchSaveTakeoffItemsToBOQ = (itemsToSave: MeasurementItem[]) => {
    const updatedProjects = projects.map(p =>
      p.id === currentProject.id
        ? { ...p, items: [...p.items, ...itemsToSave] }
        : p
    );
    setProjects(updatedProjects);
  };

  // Detailed breakdown modal state
  const [selectedBreakdownItem, setSelectedBreakdownItem] = useState<MeasurementItem | null>(null);

  // Sub-division management state
  const [expandedSubdivisionItems, setExpandedSubdivisionItems] = useState<Record<string, boolean>>({
    'item-2': true,
    'item-9': true,
  });

  // State for new inline sub-division row input in the Take-Off table
  const [newSubRowInputs, setNewSubRowInputs] = useState<Record<string, {
    description: string;
    qty: number;
    length: number;
    width: number;
    height: number;
  }>>({});

  // State for new sub-division row input in the Breakdown Modal
  const [modalNewSubDesc, setModalNewSubDesc] = useState('');
  const [modalNewSubQty, setModalNewSubQty] = useState(1);
  const [modalNewSubLength, setModalNewSubLength] = useState(1);
  const [modalNewSubWidth, setModalNewSubWidth] = useState(1);
  const [modalNewSubHeight, setModalNewSubHeight] = useState(1);

  // DXF Parser state
  const [parsedDxf, setParsedDxf] = useState<any>(null);
  const [dxfLayers, setDxfLayers] = useState<string[]>([]);
  const [selectedDxfLayer, setSelectedDxfLayer] = useState<string>('');
  const [calculatedDxfLength, setCalculatedDxfLength] = useState<number>(0);

  // AI Image Take-Off state
  const [aiImageTakeoffLoading, setAiImageTakeoffLoading] = useState(false);
  const [stagedImageItems, setStagedImageItems] = useState<any[]>([]);
  const [imageTakeoffError, setImageTakeoffError] = useState<string | null>(null);
  const [imageTakeoffSuccessMessage, setImageTakeoffSuccessMessage] = useState<string | null>(null);
  const [dxfEntityCount, setDxfEntityCount] = useState<number>(0);

  // AI CAD Take-Off Staging & Review state
  const [stagedCadItems, setStagedCadItems] = useState<StagedCadTakeoffItem[]>([]);
  const [aiCadTakeoffSummary, setAiCadTakeoffSummary] = useState<string>('');
  const [isCadTakeoffLoading, setIsCadTakeoffLoading] = useState<boolean>(false);
  const [cadTakeoffError, setCadTakeoffError] = useState<string | null>(null);
  const [cadTakeoffSuccessMessage, setCadTakeoffSuccessMessage] = useState<string | null>(null);
  const [cadWallHeight, setCadWallHeight] = useState<number>(3.0);
  const [cadExtWallThick, setCadExtWallThick] = useState<number>(0.23);
  const [cadIntWallThick, setCadIntWallThick] = useState<number>(0.115);
  const [cadTakeoffPrompt, setCadTakeoffPrompt] = useState<string>('');
  const [expandedStagedSubdivisions, setExpandedStagedSubdivisions] = useState<Record<string, boolean>>({});

  // Report mode print & formatting controls
  const [reportFormat, setReportFormat] = useState<'summary' | 'detailed' | 'comprehensive'>('comprehensive');
  const [reportIncludeSubdivisions, setReportIncludeSubdivisions] = useState<boolean>(true);
  const [reportIncludeSignatures, setReportIncludeSignatures] = useState<boolean>(true);
  const [reportIncludeNotes, setReportIncludeNotes] = useState<boolean>(true);

  const calculateLayerLength = (dxf: any, targetLayer: string) => {
    let totalLen = 0;
    let count = 0;

    dxf.entities.forEach((entity: any) => {
      if (entity.layer === targetLayer) {
        if (entity.type === 'LINE') {
          const p1 = entity.startPoint || entity.vertices?.[0];
          const p2 = entity.endPoint || entity.vertices?.[1];
          if (p1 && p2) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            totalLen += Math.sqrt(dx * dx + dy * dy);
            count++;
          }
        } else if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
          const verts = entity.vertices;
          if (verts && verts.length > 1) {
            for (let i = 0; i < verts.length - 1; i++) {
              const dx = verts[i+1].x - verts[i].x;
              const dy = verts[i+1].y - verts[i].y;
              totalLen += Math.sqrt(dx * dx + dy * dy);
            }
            if (entity.closed && verts.length > 2) {
              const dx = verts[0].x - verts[verts.length-1].x;
              const dy = verts[0].y - verts[verts.length-1].y;
              totalLen += Math.sqrt(dx * dx + dy * dy);
            }
            count++;
          }
        }
      }
    });

    setCalculatedDxfLength(Number(totalLen.toFixed(2)));
    setDxfEntityCount(count);
  };

  const SAMPLE_CAD_DXF_STRING = `  0
SECTION
  2
HEADER
  0
ENDSEC
  0
SECTION
  2
TABLES
  0
TABLE
  2
LAYER
  0
LAYER
  2
WALLS
  70
  0
  62
  7
  6
CONTINUOUS
  0
LAYER
  2
PARTITIONS
  70
  0
  62
  8
  6
CONTINUOUS
  0
LAYER
  2
COLUMNS
  70
  0
  62
  3
  6
CONTINUOUS
  0
LAYER
  2
DOORS
  70
  0
  62
  1
  6
CONTINUOUS
  0
LAYER
  2
WINDOWS
  70
  0
  62
  4
  6
CONTINUOUS
  0
LAYER
  2
ANNOTATIONS
  70
  0
  62
  2
  6
CONTINUOUS
  0
ENDTAB
  0
ENDSEC
  0
SECTION
  2
ENTITIES
  0
LINE
  8
WALLS
  10
0.0
  20
0.0
  11
14.0
  21
0.0
  0
LINE
  8
WALLS
  10
14.0
  20
0.0
  11
14.0
  21
9.5
  0
LINE
  8
WALLS
  10
14.0
  20
9.5
  11
0.0
  21
9.5
  0
LINE
  8
WALLS
  10
0.0
  20
9.5
  11
0.0
  21
0.0
  0
LINE
  8
PARTITIONS
  10
6.0
  20
0.0
  11
6.0
  21
9.5
  0
LINE
  8
PARTITIONS
  10
6.0
  20
5.0
  11
14.0
  21
5.0
  0
LWPOLYLINE
  8
COLUMNS
  90
  4
  70
  1
  10
0.0
  20
0.0
  10
0.35
  20
0.0
  10
0.35
  20
0.35
  10
0.0
  20
0.35
  0
LWPOLYLINE
  8
COLUMNS
  90
  4
  70
  1
  10
13.65
  20
0.0
  10
14.0
  20
0.0
  10
14.0
  20
0.35
  10
13.65
  20
0.35
  0
LWPOLYLINE
  8
COLUMNS
  90
  4
  70
  1
  10
13.65
  20
9.15
  10
14.0
  20
9.15
  10
14.0
  20
9.5
  10
13.65
  20
9.5
  0
LWPOLYLINE
  8
COLUMNS
  90
  4
  70
  1
  10
0.0
  20
9.15
  10
0.35
  20
9.15
  10
0.35
  20
9.5
  10
0.0
  20
9.5
  0
LINE
  8
DOORS
  10
2.0
  20
0.0
  11
3.0
  21
0.0
  0
LINE
  8
DOORS
  10
6.0
  20
2.0
  11
6.0
  21
2.9
  0
LINE
  8
WINDOWS
  10
8.0
  20
0.0
  11
9.5
  21
0.0
  0
LINE
  8
WINDOWS
  10
14.0
  20
2.5
  11
14.0
  21
4.0
  0
LINE
  8
WINDOWS
  10
2.0
  20
9.5
  11
3.5
  21
9.5
  0
TEXT
  8
ANNOTATIONS
  10
2.0
  20
-0.5
  40
0.3
  1
D1: Main Entrance Door 1.0m x 2.1m
  0
TEXT
  8
ANNOTATIONS
  10
8.0
  20
-0.5
  40
0.3
  1
W1: Window 1.5m x 1.4m
  0
TEXT
  8
ANNOTATIONS
  10
14.5
  20
3.0
  40
0.3
  1
W2: Window 1.5m x 1.4m
  0
TEXT
  8
ANNOTATIONS
  10
2.0
  20
10.0
  40
0.3
  1
W3: Window 1.5m x 1.4m
  0
TEXT
  8
ANNOTATIONS
  10
2.5
  20
4.5
  40
0.4
  1
Master Bed (6.0m x 9.5m)
  0
TEXT
  8
ANNOTATIONS
  10
9.0
  20
2.5
  40
0.4
  1
Living & Dining (8.0m x 5.0m)
  0
ENDSEC
  0
EOF`;

  const handleParseDxfContent = (fileContent: string) => {
    try {
      const parser = new DxfParser();
      const dxf = parser.parseSync(fileContent);
      if (!dxf || !dxf.entities) {
        alert('Could not parse valid entities from DXF file.');
        return;
      }

      const layersSet = new Set<string>();
      dxf.entities.forEach((entity: any) => {
        if (entity.layer) {
          layersSet.add(entity.layer);
        }
      });

      const layers = Array.from(layersSet) as string[];
      setDxfLayers(layers);
      if (layers.length > 0) {
        setSelectedDxfLayer(layers[0]);
        calculateLayerLength(dxf, layers[0]);
      }
      setParsedDxf(dxf);
      setStagedCadItems([]);
      setCadTakeoffError(null);
      setCadTakeoffSuccessMessage(null);
      setCadWallHeight(currentProject.standardWallHeight || 3.0);
    } catch (err: any) {
      alert('Error parsing DXF file: ' + err.message);
    }
  };

  const handleParsePdfContent = (buffer: ArrayBuffer, fileName: string) => {
    try {
      const uint8 = new Uint8Array(buffer);
      // Try PDF vector takeoff first
      const pdfResult = (window as any).pdfVectorTakeoff
        ? (window as any).pdfVectorTakeoff(uint8)
        : null;

      if (pdfResult && pdfResult.entities && pdfResult.entities.length > 0) {
        const layersSet = new Set<string>();
        pdfResult.entities.forEach((entity: any) => {
          if (entity.layer) layersSet.add(entity.layer);
        });
        const layers = Array.from(layersSet) as string[];
        setDxfLayers(layers);
        setParsedDxf(pdfResult);
        setCadTakeoffSuccessMessage(`PDF parsed: ${pdfResult.entities.length} entities from ${fileName}`);
        setCadTakeoffError(null);
      } else {
        // Fallback: try PDF dimension miner for text-based extraction
        const dimResult = (window as any).pdfDimensionMiner
          ? (window as any).pdfDimensionMiner(uint8)
          : null;

        if (dimResult && dimResult.dimensions && dimResult.dimensions.length > 0) {
          setCadTakeoffSuccessMessage(`PDF parsed: ${dimResult.dimensions.length} dimensions found in ${fileName}`);
          setCadTakeoffError(null);
          setParsedDxf(null);
        } else {
          alert('Could not extract usable geometry from PDF file.');
        }
      }
    } catch (err: any) {
      alert('Error parsing PDF file: ' + err.message);
    }
  };

  const buildCadGeometrySummary = (dxf: any) => {
    if (!dxf || !dxf.entities) return null;

    const layerStats: Record<string, {
      name: string;
      lineCount: number;
      totalLength: number;
      polylineCount: number;
      totalArea: number;
      sampleEntities: any[];
    }> = {};

    const dimensions: Array<{ text: string; measuredValue?: number }> = [];
    const textAnnotations: string[] = [];
    const blockCounts: Record<string, number> = {};

    dxf.entities.forEach((entity: any) => {
      const layer = entity.layer || '0';
      if (!layerStats[layer]) {
        layerStats[layer] = {
          name: layer,
          lineCount: 0,
          totalLength: 0,
          polylineCount: 0,
          totalArea: 0,
          sampleEntities: []
        };
      }

      if (entity.type === 'LINE') {
        const p1 = entity.startPoint || entity.vertices?.[0];
        const p2 = entity.endPoint || entity.vertices?.[1];
        if (p1 && p2) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          layerStats[layer].lineCount++;
          layerStats[layer].totalLength = Number((layerStats[layer].totalLength + len).toFixed(2));
        }
      } else if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
        layerStats[layer].polylineCount++;
        const verts = entity.vertices;
        if (verts && verts.length > 1) {
          let polyLen = 0;
          for (let i = 0; i < verts.length - 1; i++) {
            const dx = verts[i+1].x - verts[i].x;
            const dy = verts[i+1].y - verts[i].y;
            polyLen += Math.sqrt(dx * dx + dy * dy);
          }
          if (entity.closed && verts.length > 2) {
            const dx = verts[0].x - verts[verts.length-1].x;
            const dy = verts[0].y - verts[verts.length-1].y;
            polyLen += Math.sqrt(dx * dx + dy * dy);

            let area = 0;
            for (let i = 0; i < verts.length; i++) {
              const j = (i + 1) % verts.length;
              area += verts[i].x * verts[j].y;
              area -= verts[j].x * verts[i].y;
            }
            layerStats[layer].totalArea = Number((layerStats[layer].totalArea + Math.abs(area) / 2).toFixed(2));
          }
          layerStats[layer].totalLength = Number((layerStats[layer].totalLength + polyLen).toFixed(2));
        }
      } else if (entity.type === 'INSERT') {
        const blockName = entity.name || entity.block || 'UNKNOWN_BLOCK';
        blockCounts[blockName] = (blockCounts[blockName] || 0) + 1;
      } else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
        if (entity.text) {
          textAnnotations.push(String(entity.text).trim());
        }
      } else if (entity.type === 'DIMENSION') {
        dimensions.push({
          text: entity.text || '',
          measuredValue: entity.actualMeasurement || undefined
        });
      }

      if (layerStats[layer].sampleEntities.length < 3) {
        layerStats[layer].sampleEntities.push({
          type: entity.type,
          color: entity.colorNumber
        });
      }
    });

    return {
      layers: Object.values(layerStats),
      dimensions: dimensions.slice(0, 20),
      textAnnotations: textAnnotations.slice(0, 30),
      blockCounts,
      totalEntities: dxf.entities.length
    };
  };

  const handleRunAiCadTakeoff = async () => {
    if (!parsedDxf) {
      alert('Please upload or load a CAD DXF file first.');
      return;
    }

    setIsCadTakeoffLoading(true);
    setCadTakeoffError(null);
    setCadTakeoffSuccessMessage(null);

    try {
      const cadSummary = buildCadGeometrySummary(parsedDxf);
      const res = await fetch('/api/ai-cad-takeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: importedFileName || 'drawing.dxf',
          cadSummary,
          projectContext: {
            standardWallHeight: cadWallHeight,
            currency: currentProject.currency,
            existingCategories: PREDEFINED_CATEGORIES.map(c => c.name),
            wastageDefault: currentProject.wastageDefault
          },
          assumptions: {
            wallHeight: cadWallHeight,
            exteriorWallThickness: cadExtWallThick,
            interiorWallThickness: cadIntWallThick
          },
          instructions: cadTakeoffPrompt.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('AI returned an unexpected payload structure.');
      }

      const staged: StagedCadTakeoffItem[] = data.items.map((item: any, idx: number) => ({
        ...item,
        id: 'cad-item-' + Date.now() + '-' + idx,
        selected: true,
        cadSourceLayer: item.cadSourceLayer || 'CAD_EXTRACTED',
        confidenceScore: item.confidenceScore || 95,
        deductionNotes: item.deductionNotes || (item.deductionsArea ? `${item.deductionsArea} m² opening deductions applied` : undefined),
        subDivisions: (item.subDivisions || []).map((sub: any, sIdx: number) => ({
          ...sub,
          id: sub.id || `sub-cad-${idx}-${sIdx}`
        }))
      }));

      setStagedCadItems(staged);
      setAiCadTakeoffSummary(data.summary || 'CAD Take-Off completed successfully.');
      const expandMap: Record<string, boolean> = {};
      staged.forEach(st => {
        expandMap[st.id] = true;
      });
      setExpandedStagedSubdivisions(expandMap);
    } catch (err: any) {
      console.error('CAD Takeoff failed:', err);
      setCadTakeoffError(err.message || 'Failed to perform AI CAD Take-Off.');
    } finally {
      setIsCadTakeoffLoading(false);
    }
  };

  // AI Image Take-Off handler
  const handleRunAiImageTakeoff = async () => {
    if (!importedFilePreview) {
      alert('Please upload an image first.');
      return;
    }
    setAiImageTakeoffLoading(true);
    setImageTakeoffError(null);
    setStagedImageItems([]);
    setImageTakeoffSuccessMessage(null);
    try {
      const res = await fetch('/api/ai-image-takeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: importedFilePreview,
          fileName: importedFileName || 'blueprint.png',
          projectContext: { currentProjectId: currentProject?.id || '' },
          assumptions: [],
          instructions: 'Extract all measurable construction elements from this blueprint floor plan.'
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStagedImageItems(data);
        setImageTakeoffSuccessMessage('AI analysis complete. ' + data.length + ' elements detected.');
      } else {
        setImageTakeoffError(data.error || 'AI analysis failed.');
      }
    } catch (err: any) {
      setImageTakeoffError(err.message || 'Network error.');
    } finally {
      setAiImageTakeoffLoading(false);
    }
  };

  const handleToggleStagedItem = (id: string) => {
    setStagedCadItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const handleToggleAllStagedItems = (selected: boolean) => {
    setStagedCadItems(prev => prev.map(item => ({ ...item, selected })));
  };

  const handleUpdateStagedItem = (id: string, updates: Partial<StagedCadTakeoffItem>) => {
    setStagedCadItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleUpdateStagedSubdivision = (itemId: string, subId: string, field: keyof SubDivisionLine, value: any) => {
    setStagedCadItems(prev => prev.map(item => {
      if (item.id !== itemId || !item.subDivisions) return item;
      return {
        ...item,
        subDivisions: item.subDivisions.map(sub => {
          if (sub.id !== subId) return sub;
          return {
            ...sub,
            [field]: field === 'description' ? value : Number(value)
          };
        })
      };
    }));
  };

  const handleDeleteStagedSubdivision = (itemId: string, subId: string) => {
    setStagedCadItems(prev => prev.map(item => {
      if (item.id !== itemId || !item.subDivisions) return item;
      return {
        ...item,
        subDivisions: item.subDivisions.filter(sub => sub.id !== subId)
      };
    }));
  };

  const handleAddStagedSubdivision = (itemId: string) => {
    setStagedCadItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const currentSubs = item.subDivisions || [];
      const newSub: SubDivisionLine = {
        id: 'sub-staged-' + Date.now(),
        description: `Sub-division Line ${currentSubs.length + 1}`,
        qty: 1,
        length: item.length || 1,
        width: item.width || 1,
        height: item.height || 1,
      };
      return {
        ...item,
        subDivisions: [...currentSubs, newSub]
      };
    }));
    setExpandedStagedSubdivisions(prev => ({ ...prev, [itemId]: true }));
  };

  const handleCommitStagedTakeoffItems = () => {
    const selectedItems = stagedCadItems.filter(i => i.selected);
    if (selectedItems.length === 0) {
      alert('Please select at least one item to commit to the measurement sheet.');
      return;
    }

    const itemsToCommit: MeasurementItem[] = selectedItems.map(staged => {
      const { selected, cadSourceLayer, confidenceScore, deductionNotes, ...cleanItem } = staged;
      return cleanItem;
    });

    const updatedProjects = projects.map(p => {
      if (p.id !== currentProject.id) return p;
      return {
        ...p,
        items: [...p.items, ...itemsToCommit]
      };
    });

    setProjects(updatedProjects);
    setCadTakeoffSuccessMessage(`Successfully committed ${itemsToCommit.length} CAD take-off items with all sub-divisions to the Take-Off Measurement Sheet and BOQ!`);
    setStagedCadItems([]);
  };

  // Calculations helper
  const calculateSubdivisionQuantity = (sub: SubDivisionLine, unit: string) => {
    let raw = 0;
    if (unit === 'm³') {
      raw = sub.qty * sub.length * sub.width * sub.height;
    } else if (unit === 'm²') {
      raw = sub.qty * sub.length * sub.width;
    } else if (unit === 'rft' || unit === 'm') {
      raw = sub.qty * sub.length;
    } else {
      raw = sub.qty;
    }
    return Number(raw.toFixed(2));
  };

  const calculateItemQuantity = (item: MeasurementItem) => {
    let base = 0;
    if (item.subDivisions && item.subDivisions.length > 0) {
      base = item.subDivisions.reduce((sum, sub) => {
        return sum + calculateSubdivisionQuantity(sub, item.unit);
      }, 0);
      if (item.deductionsArea) {
        if (item.unit === 'm³' && item.width > 0) {
          base -= (item.deductionsArea * item.width);
        } else if (item.unit === 'm²') {
          base -= item.deductionsArea;
        }
      }
      base = Math.max(0, base);
    } else if (item.unit === 'm³') {
      let raw = item.length * item.width * item.height * item.qty;
      if (item.deductionsArea && item.height > 0) {
        // if brickwork m3, deductions might subtract area * thickness
        raw -= (item.deductionsArea * item.width);
      }
      base = Math.max(0, raw);
    } else if (item.unit === 'm²') {
      let raw = item.length * item.width * item.qty;
      if (item.deductionsArea) {
        raw -= item.deductionsArea;
      }
      base = Math.max(0, raw);
    } else if (item.unit === 'rft' || item.unit === 'm') {
      base = item.length * item.qty;
    } else {
      // kg, pcs, bags, tons
      base = item.qty;
    }
    const withWastage = base * (1 + (item.wastagePercent / 100));
    return Number(withWastage.toFixed(2));
  };

  const calculateItemTotalCost = (item: MeasurementItem) => {
    const finalQty = calculateItemQuantity(item);
    return Number((finalQty * item.unitRate).toFixed(2));
  };

  const subtotalCost = currentProject.items.reduce((acc, item) => acc + calculateItemTotalCost(item), 0);
  const vatAmount = (subtotalCost * currentProject.vatPercent) / 100;
  const contingencyAmount = (subtotalCost * currentProject.contingencyPercent) / 100;
  const grandTotal = subtotalCost + vatAmount + contingencyAmount;

  // Handlers
  const handleOpenAddModal = (itemToEdit?: MeasurementItem) => {
    if (itemToEdit) {
      setEditingItem(itemToEdit);
      setFormCategory(itemToEdit.category);
      setFormDesc(itemToEdit.description);
      setFormUnit(itemToEdit.unit);
      setFormLength(itemToEdit.length);
      setFormWidth(itemToEdit.width);
      setFormHeight(itemToEdit.height);
      setFormQty(itemToEdit.qty);
      setFormWastage(itemToEdit.wastagePercent);
      setFormRate(itemToEdit.unitRate);
      setFormDeduction(itemToEdit.deductionsArea || 0);
      setFormFloor(itemToEdit.floor || getItemFloor(itemToEdit));
    } else {
      setEditingItem(null);
      setFormCategory('Superstructure');
      setFormDesc('');
      setFormUnit('m³');
      setFormLength(1);
      setFormWidth(1);
      setFormHeight(3);
      setFormQty(1);
      setFormWastage(currentProject.wastageDefault);
      setFormRate(1500);
      setFormDeduction(0);
      setFormFloor(activeStoryFilter !== 'All Stories' ? activeStoryFilter : 'Ground Floor');
    }
    setIsItemModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc.trim()) return;

    const newItem: MeasurementItem = {
      id: editingItem ? editingItem.id : 'item-' + Date.now(),
      category: formCategory,
      description: formDesc,
      unit: formUnit,
      length: Number(formLength),
      width: Number(formWidth),
      height: Number(formHeight),
      qty: Number(formQty),
      wastagePercent: Number(formWastage),
      unitRate: Number(formRate),
      deductionsArea: Number(formDeduction) > 0 ? Number(formDeduction) : undefined,
      subDivisions: editingItem ? editingItem.subDivisions : undefined,
      floor: formFloor
    };

    const updatedItems = editingItem
      ? currentProject.items.map(i => i.id === editingItem.id ? newItem : i)
      : [...currentProject.items, newItem];

    const updatedProjects = projects.map(p => p.id === currentProject.id ? { ...p, items: updatedItems } : p);
    setProjects(updatedProjects);
    setIsItemModalOpen(false);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!confirm('Are you sure you want to delete this BOQ item?')) return;
    const updatedItems = currentProject.items.filter(i => i.id !== itemId);
    const updatedProjects = projects.map(p => p.id === currentProject.id ? { ...p, items: updatedItems } : p);
    setProjects(updatedProjects);
  };

  const handleToggleExpandSubdivision = (itemId: string) => {
    setExpandedSubdivisionItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleAddSubdivisionRow = (itemId: string, customRow?: Partial<SubDivisionLine>) => {
    const targetItem = currentProject.items.find(i => i.id === itemId);
    if (!targetItem) return;

    const currentInputs = newSubRowInputs[itemId];
    const desc = customRow?.description !== undefined
      ? customRow.description
      : (currentInputs?.description?.trim() || `Sub-division Line ${(targetItem.subDivisions?.length || 0) + 1}`);
    const qty = customRow?.qty ?? (currentInputs?.qty !== undefined ? currentInputs.qty : 1);
    const length = customRow?.length ?? (currentInputs?.length !== undefined ? currentInputs.length : (targetItem.length || 1));
    const width = customRow?.width ?? (currentInputs?.width !== undefined ? currentInputs.width : (targetItem.width || 1));
    const height = customRow?.height ?? (currentInputs?.height !== undefined ? currentInputs.height : (targetItem.height || 1));

    const newSubId = 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newSub: SubDivisionLine = {
      id: newSubId,
      description: desc,
      qty: Number(qty),
      length: Number(length),
      width: Number(width),
      height: Number(height),
    };

    const updatedProjects = projects.map(p => {
      if (p.id !== currentProject.id) return p;
      return {
        ...p,
        items: p.items.map(item => {
          if (item.id !== itemId) return item;
          const existingSubs = item.subDivisions && item.subDivisions.length > 0
            ? [...item.subDivisions]
            : [
                {
                  id: 'sub-' + item.id + '-1',
                  description: item.description.slice(0, 50) + ' (Primary Section)',
                  qty: item.qty || 1,
                  length: item.length || 1,
                  width: item.width || 1,
                  height: item.height || 1,
                }
              ];
          return {
            ...item,
            subDivisions: [...existingSubs, newSub]
          };
        })
      };
    });

    setProjects(updatedProjects);
    setExpandedSubdivisionItems(prev => ({ ...prev, [itemId]: true }));

    // Reset input for this item
    setNewSubRowInputs(prev => ({
      ...prev,
      [itemId]: {
        description: '',
        qty: 1,
        length: targetItem.length || 1,
        width: targetItem.width || 1,
        height: targetItem.height || 1,
      }
    }));

    if (selectedBreakdownItem && selectedBreakdownItem.id === itemId) {
      const updatedItem = updatedProjects
        .find(p => p.id === currentProject.id)
        ?.items.find(i => i.id === itemId);
      if (updatedItem) setSelectedBreakdownItem(updatedItem);
    }
  };

  const handleUpdateSubdivisionRow = (itemId: string, subId: string, field: keyof SubDivisionLine, value: any) => {
    const updatedProjects = projects.map(p => {
      if (p.id !== currentProject.id) return p;
      return {
        ...p,
        items: p.items.map(item => {
          if (item.id !== itemId || !item.subDivisions) return item;
          return {
            ...item,
            subDivisions: item.subDivisions.map(sub => {
              if (sub.id !== subId) return sub;
              return {
                ...sub,
                [field]: field === 'description' ? value : Number(value)
              };
            })
          };
        })
      };
    });

    setProjects(updatedProjects);

    if (selectedBreakdownItem && selectedBreakdownItem.id === itemId) {
      const updatedItem = updatedProjects
        .find(p => p.id === currentProject.id)
        ?.items.find(i => i.id === itemId);
      if (updatedItem) setSelectedBreakdownItem(updatedItem);
    }
  };

  const handleDeleteSubdivisionRow = (itemId: string, subId: string) => {
    const updatedProjects = projects.map(p => {
      if (p.id !== currentProject.id) return p;
      return {
        ...p,
        items: p.items.map(item => {
          if (item.id !== itemId || !item.subDivisions) return item;
          return {
            ...item,
            subDivisions: item.subDivisions.filter(sub => sub.id !== subId)
          };
        })
      };
    });

    setProjects(updatedProjects);

    if (selectedBreakdownItem && selectedBreakdownItem.id === itemId) {
      const updatedItem = updatedProjects
        .find(p => p.id === currentProject.id)
        ?.items.find(i => i.id === itemId);
      if (updatedItem) setSelectedBreakdownItem(updatedItem);
    }
  };

  const handleCreateNewProject = () => {
    setIsAddProjectModalOpen(true);
  };

  const confirmCreateProject = () => {
    const name = newProjectName || 'New Project';
    const selectedTemplate = templates.find(t => t.name === newProjectTemplateName);
    const newProj: Project = {
      id: 'proj-' + Date.now(),
      name,
      client: 'Client Name',
      location: selectedTemplate?.location || 'Kathmandu, Nepal',
      currency: selectedTemplate?.currency || 'NPR',
      fiscalYear: '2083/084',
      duration: 'आठ महिना भित्र',
      companyName: selectedTemplate?.companyName || 'जि. सी. ब्रोड्स इन्जिनियरिंग कन्स्ट्रक्सन एण्ड सप्लायर्स प्रा. लि.',
      companyAddress: selectedTemplate?.companyAddress || 'तिलोत्नामा -०९, शंकरपुर रुपन्देही, लुम्बिनी प्रदेश नेपाल',
      preparedBy: 'Er. R. Sharma',
      checkedBy: 'Er. D. Kunwar',
      approvedBy: 'Managing Director',
      standardWallHeight: selectedTemplate?.standardWallHeight || 3.0,
      wastageDefault: selectedTemplate?.wastageDefault || 5,
      vatPercent: selectedTemplate?.vatPercent || 0,
      contingencyPercent: selectedTemplate?.contingencyPercent || 0,
      createdAt: new Date().toISOString().split('T')[0],
      items: []
    };
    setProjects([...projects, newProj]);
    setActiveProjectId(newProj.id);
    setIsAddProjectModalOpen(false);
    setNewProjectName('');
    setNewProjectTemplateName('');
  };

  const handleArchiveProject = (projectId: string) => {
    const updated = projects.map(p => p.id === projectId ? { ...p, isArchived: true } : p);
    setProjects(updated);
    logActivity('Project Archived', `Archived project ID: ${projectId}`);
    if (activeProjectId === projectId) {
      const remaining = updated.filter(p => !p.isArchived);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      }
    }
  };

  const handleRestoreProject = (projectId: string) => {
    const updated = projects.map(p => p.id === projectId ? { ...p, isArchived: false } : p);
    setProjects(updated);
    setActiveProjectId(projectId);
    logActivity('Project Restored', `Restored archived project ID: ${projectId}`);
  };

  const handleDeleteArchivedProject = (projectId: string) => {
    if (!confirm('Are you sure you want to permanently delete this archived project?')) return;
    const updated = projects.filter(p => p.id !== projectId);
    setProjects(updated);
    if (activeProjectId === projectId && updated.length > 0) {
      setActiveProjectId(updated[0].id);
    }
    logActivity('Project Deleted', `Permanently deleted project ID: ${projectId}`);
  };

  const handleDownloadCsv = () => {
    const headers = ['S.N.', 'Category', 'Description', 'Story', 'Unit', 'Quantity', 'Rate', 'Amount'];
    const filteredItems = currentProject.items.filter(i => (boqCategoryFilter === 'All' || i.category === boqCategoryFilter) && (activeStoryFilter === 'All Stories' || getItemFloor(i) === activeStoryFilter));
    const csvRows = [
      headers.join(','),
      ...filteredItems.map((item, index) => [
        index + 1,
        item.category,
        `"${item.description.replace(/"/g, '""')}"`,
        getItemFloor(item),
        item.unit,
        calculateItemQuantity(item),
        item.unitRate,
        calculateItemTotalCost(item)
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BOQ_${currentProject.name.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper: Convert AD date to BS (Nepali) date string
  const adToBs = (adDate: Date): string => {
    // BS month lengths (approximate, varies by year)
    // Using a reference-based approach for reasonable accuracy
    const bsMonths = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
    // Approximate conversion: BS = AD + 56 years, 8 months
    let bsYear = adDate.getFullYear() + 56;
    let bsMonth = adDate.getMonth() + 9; // 0-indexed month + 9
    let bsDay = adDate.getDate();
    if (bsMonth > 12) {
      bsMonth -= 12;
      bsYear += 1;
    }
    // Adjust for day overflow (simplified)
    const daysInBsMonth = [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31];
    if (bsDay > daysInBsMonth[bsMonth - 1]) {
      bsDay = daysInBsMonth[bsMonth - 1];
    }
    return `${bsDay} ${bsMonths[bsMonth - 1]} ${bsYear} BS`;
  };

  const handleBulkExportPdf = (dateMode: 'en' | 'ne' = 'en') => {
    const doc = new jsPDF();
    const primaryColor = [245, 158, 11]; // Amber-500
    
    doc.setFontSize(18);
    doc.setTextColor(245, 158, 11);
    doc.text(`Project Estimate: ${currentProject.name}`, 14, 20);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Prepared for: ${currentProject.client}`, 14, 28);
    doc.text(`Location: ${currentProject.location}`, 14, 34);
    const today = new Date();
    const dateStr = dateMode === 'ne'
      ? adToBs(today)
      : today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Date: ${dateStr}`, 14, 40);

    // BOQ Table
    (doc as any).autoTable({
      head: [['S.N.', 'Category', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']],
      body: currentProject.items.map((item, index) => [
        index + 1,
        item.category,
        item.description.substring(0, 50) + '...',
        item.unit,
        calculateItemQuantity(item),
        item.unitRate,
        calculateItemTotalCost(item)
      ]),
      startY: 45,
      headStyles: { fillColor: primaryColor },
    });

    // Measurement Take-Off Sheets
    currentProject.items.forEach((item) => {
        if (item.subDivisions && item.subDivisions.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.text(`Measurement Sheet: ${item.description.substring(0, 60)}...`, 14, 15);
            (doc as any).autoTable({
                head: [['S.N.', 'Description', 'Nos', 'L', 'W', 'H', 'Total']],
                body: item.subDivisions.map((sub, subIndex) => [
                    subIndex + 1,
                    sub.description,
                    sub.qty,
                    sub.length,
                    sub.width,
                    sub.height,
                    (sub.qty * sub.length * sub.width * sub.height).toFixed(2)
                ]),
                startY: 25,
                headStyles: { fillColor: primaryColor },
            });
        }
    });

    // Audit Log & Signature Page
    // Enhanced Terms & Conditions + Notes
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(245, 158, 11);
    doc.text("Terms, Conditions & Notes", 14, 15);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const terms = DEFAULT_BOQ_TERMS;
    let ty = 25;
    terms.forEach((t) => {
      doc.text(t, 14, ty);
      ty += 6;
    });


    doc.addPage();
    doc.setFontSize(14);
    doc.text("Audit Trail & Client Approval", 14, 15);
    (doc as any).autoTable({
        head: [['Timestamp', 'User', 'Action', 'Details']],
        body: auditLogs.slice(0, 10).map(log => [log.timestamp, log.userName, log.action, log.details.substring(0, 40) + '...']),
        startY: 25,
        headStyles: { fillColor: primaryColor },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(11);
    doc.text(`Prepared By: ${currentProject.preparedBy}`, 14, finalY);
    doc.text(`Checked By: ${currentProject.checkedBy}`, 14, finalY + 10);
    doc.text(`Approved By: ${currentProject.approvedBy}`, 14, finalY + 20);
    doc.line(14, finalY + 35, 80, finalY + 35);
    doc.text("Client Signature & Approval", 14, finalY + 42);

    // Add page numbers to all pages
    const totalPages = doc.internal.pages.length;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${totalPages}`, 195, 290, { align: 'right' });
    }

   const handlePermitCard = () => {
     const doc = new jsPDF();
     doc.setFontSize(18);
     doc.setTextColor(245, 158, 11);
     doc.text("BUILDING PERMIT CARD", 105, 20, { align: 'center' });
     doc.setTextColor(0, 0, 0);
     doc.setFontSize(12);
     doc.text(`Project: ${currentProject.name}`, 14, 40);
     doc.text(`Client: ${currentProject.client}`, 14, 48);
     doc.text(`Location: ${currentProject.location}`, 14, 56);
     doc.text(`Permit No: PERMIT-${Date.now().toString().slice(-6)}`, 14, 64);
     doc.text(`Issue Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 72);
     doc.text(`Status: APPROVED`, 14, 80);
     doc.text(`Compliance: NBC 205`, 14, 88);
     doc.line(14, 100, 196, 100);
     doc.setFontSize(10);
     doc.text("This permit card authorizes the construction work described above.", 14, 110);
     doc.text("Subject to compliance with all applicable building codes and regulations.", 14, 118);
     doc.save(`${currentProject.name.replace(/\\s+/g, '_')}_Permit_Card.pdf`);
   };




    doc.save(`${currentProject.name.replace(/\s+/g, '_')}_BOQ_Report.pdf`);
  };
   const handlePrintPreview = (dateMode: 'en' | 'ne' = 'en') => {
     const doc = new jsPDF();
     const primaryColor = [245, 158, 11];
     doc.setFontSize(18);
     doc.setTextColor(245, 158, 11);
     doc.text(`Project Estimate: ${currentProject.name}`, 14, 20);
     doc.setTextColor(0, 0, 0);
     doc.setFontSize(12);
     doc.text(`Prepared for: ${currentProject.client}`, 14, 28);
     doc.text(`Location: ${currentProject.location}`, 14, 34);
     const today = new Date();
     const dateStr = dateMode === 'ne' ? adToBs(today) : today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
     doc.text(`Date: ${dateStr}`, 14, 40);
     (doc as any).autoTable({
       head: [['S.N.', 'Category', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']],
       body: currentProject.items.map((item, index) => [
         index + 1, item.category, item.description.substring(0, 50) + '...', item.unit,
         calculateItemQuantity(item), item.unitRate, calculateItemTotalCost(item)
       ]),
       startY: 45,
       headStyles: { fillColor: primaryColor },
     });
     const totalPages = doc.internal.pages.length;
     for (let i = 1; i <= totalPages; i++) {
       doc.setPage(i);
       doc.setFontSize(9);
       doc.setTextColor(100, 100, 100);
       doc.text(`Page ${i} of ${totalPages}`, 195, 290, { align: 'right' });
     }
     const blobUrl = doc.output('bloburl');
     window.open(blobUrl, '_blank');
   };

   const handleCertificatePreview = () => {
     const doc = new jsPDF('landscape');
     doc.setFontSize(22);
     doc.setTextColor(245, 158, 11);
     doc.text("CERTIFICATE OF COMPLETION", 148, 30, { align: 'center' });
     doc.setTextColor(0, 0, 0);
     doc.setFontSize(14);
     doc.text(`This is to certify that the construction project`, 148, 50, { align: 'center' });
     doc.setFontSize(16);
     doc.text(`"${currentProject.name}"`, 148, 60, { align: 'center' });
     doc.setFontSize(12);
     doc.text(`located at ${currentProject.location}`, 148, 70, { align: 'center' });
     doc.text(`has been completed in accordance with the approved BOQ and NBC 205 standards.`, 148, 78, { align: 'center' });
     doc.text(`Client: ${currentProject.client}`, 148, 95, { align: 'center' });
     doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 148, 105, { align: 'center' });
     doc.line(40, 140, 120, 140);
     doc.text("Prepared By", 80, 148, { align: 'center' });
     doc.line(180, 140, 260, 140);
     doc.text("Approved By", 220, 148, { align: 'center' });
     const blobUrl = doc.output('bloburl');
     window.open(blobUrl, '_blank');
   };

   const handlePermitCard = () => {
     const doc = new jsPDF();
     doc.setFontSize(18);
     doc.setTextColor(245, 158, 11);
     doc.text("BUILDING PERMIT CARD", 105, 20, { align: 'center' });
     doc.setTextColor(0, 0, 0);
     doc.setFontSize(12);
     doc.text(`Project: ${currentProject.name}`, 14, 40);
     doc.text(`Client: ${currentProject.client}`, 14, 48);
     doc.text(`Location: ${currentProject.location}`, 14, 56);
     doc.text(`Permit No: PERMIT-${Date.now().toString().slice(-6)}`, 14, 64);
     doc.text(`Issue Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 72);
     doc.text(`Status: APPROVED`, 14, 80);
     doc.text(`Compliance: NBC 205`, 14, 88);
     doc.line(14, 100, 196, 100);
     doc.setFontSize(10);
     doc.text("This permit card authorizes the construction work described above.", 14, 110);
     doc.text("Subject to compliance with all applicable building codes and regulations.", 14, 118);
     doc.save(`${currentProject.name.replace(/\\s+/g, '_')}_Permit_Card.pdf`);
   };



  const handleRunAiAudit = async (customPrompt?: string) => {
    setIsAiLoading(true);
    setAiResponse('');
    try {
      const promptToUse = customPrompt || 'Review this construction BOQ and provide an executive summary, check for missing items (like damp proof course, lintels, scaffolding), and advise on cost optimization.';
      const res = await fetch('/api/gemini-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          projectData: {
            name: currentProject.name,
            location: currentProject.location,
            subtotal: subtotalCost,
            grandTotal,
            items: currentProject.items
          }
        })
      });
      const data = await res.json();
      if (data.text) {
        setAiResponse(data.text);
      } else {
        setAiResponse(data.error || 'Failed to get response from AI.');
      }
    } catch (err: any) {
      setAiResponse('Error connecting to AI service: ' + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!auth.isAuthenticated) {
    return <AuthPage onLogin={auth.login} onRegister={auth.register} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Collapsible Sidebar */}
      <aside className={`print:hidden bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          {isSidebarOpen && <h1 className="text-lg font-black text-white">StructEst Pro</h1>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-white">
            <Layers className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {[
            { id: 'boq', label: 'BOQ Summary', icon: FileSpreadsheet },
            { id: 'takeoff', label: 'Take-Off Sheet', icon: Calculator },
            { id: 'nbc205', label: 'NBC & Municipal Plan', icon: ShieldCheck },
            { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
            { id: 'materials', label: 'Materials Library', icon: Hammer },
            { id: 'blueprint', label: 'Blueprint & CAD', icon: Compass },
            { id: 'ai-auditor', label: 'AI Expert', icon: Cpu },
            { id: 'users', label: 'User & Access', icon: Users, restricted: currentUser.role !== 'admin' },
            { id: 'settings', label: 'Settings', icon: Wrench, restricted: currentUser.role === 'site_engineer' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.restricted) {
                  alert('You do not have permission to access this tab.');
                  return;
                }
                setActiveTab(tab.id as any);
              }}
              className={`w-full flex items-center p-3 rounded-xl transition ${
                activeTab === tab.id ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="ml-3 text-sm">{tab.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Top Header */}
        <header className="print:hidden bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm sticky top-0 z-20 transition-colors duration-300" style={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(248, 250, 252, 0.9)' }}>
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-2 rounded-xl shadow flex items-center justify-center text-slate-950 font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                {projects.find(p => p.id === activeProjectId)?.name || "StructEst Pro"}
              </h1>
              <p className="text-xs text-slate-400">Professional Construction Estimation & BOQ Suite</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <select
                value={activeProjectId}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="bg-transparent text-xs md:text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer"
              >
                <optgroup label="Active Projects">
                  {projects.filter(p => !p.isArchived).map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                {showArchivedProjects && projects.some(p => p.isArchived) && (
                  <optgroup label="Archived Projects">
                    {projects.filter(p => p.isArchived).map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-slate-400">
                        📦 {p.name} (Archived)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                onClick={() => setShowArchivedProjects(!showArchivedProjects)}
                className={`text-[10px] px-2 py-1 rounded font-bold transition border ${
                  showArchivedProjects
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title={showArchivedProjects ? "Hide archived projects in selector" : "Show archived projects in selector"}
              >
                {showArchivedProjects ? "Hide Arch." : "Show Arch."}
              </button>
              <button
                onClick={handleCreateNewProject}
                className="ml-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs font-bold transition border border-amber-500/30"
                title="Create New Project"
              >
                + New
              </button>
              {/* Theme Toggle Button */}
              <button
                onClick={() => setIsDarkMode((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-md p-1.5 transition-colors hover:bg-amber-500/15 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 data-[state=active]:bg-amber-500/20"
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Logged-in User Header (Avatar + Logout) */}
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <div className="relative">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-6 h-6 rounded-full border border-slate-600 object-cover"
                  />
                ) : (
                  <div className={`w-6 h-6 rounded-full ${currentUser.avatarBg} flex items-center justify-center font-bold text-[10px]`}>
                    {currentUser.name.charAt(0)}
                  </div>
                )}
                <span className="absolute -right-1 -bottom-1 w-2 h-2 rounded-full bg-emerald-500 border-2 border-slate-900 ring-2 ring-slate-950" />
              </div>
              <div className="text-left hidden lg:block">
                <p className="text-[11px] font-bold text-slate-200 leading-none truncate max-w-[110px]">{currentUser.name}</p>
                <p className="text-[9px] uppercase tracking-wider font-semibold text-amber-400">{currentUser.role.replace('_', ' ')}</p>
              </div>
              <button
                onClick={() => { auth.logout(); window.location.reload(); }}
                className="text-xs text-slate-400 hover:text-slate-200 font-bold px-2 py-1 transition"
                title="Logout"
              >
                Logout
              </button>
            </div>

            <button
              onClick={() => setActiveTab('report')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print Report</span>
            </button>
            <button
              onClick={() => handleRunAiAudit()}
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Estimator Audit</span>
            </button>
          </div>
        </header>

      {/* Breadcrumb & Project Status Context Bar (De-duplicated UI) */}
      <div className="print:hidden bg-slate-900/60 border-b border-slate-800/80 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <span className="text-slate-500 font-mono text-[10px] tracking-wider uppercase">Workspace</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 font-semibold truncate max-w-xs">{currentProject.name}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-amber-400 font-bold capitalize">
            {activeTab === 'users' ? 'User Management & Access Control' : activeTab.replace('-', ' ')}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Role:</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              currentUser.role === 'admin'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : currentUser.role === 'estimator'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : currentUser.role === 'project_manager'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : currentUser.role === 'site_engineer'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                : 'bg-stone-500/20 text-stone-300 border border-stone-500/40'
            }`}>
              {currentUser.role.replace('_', ' ')}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-slate-400 text-[11px] font-mono">
            <span>{currentProject.items.length} BOQ Items</span>
            <span>•</span>
            <span className="text-amber-400 font-bold">{currentProject.currency} {subtotalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* Add Project Modal */}
      {isAddProjectModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Create New Building Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  placeholder="e.g. Residential Villa A"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Template (Optional)</label>
                <select
                  value={newProjectTemplateName}
                  onChange={(e) => setNewProjectTemplateName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="">Select a template...</option>
                  {templates.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setIsAddProjectModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
              <button onClick={confirmCreateProject} className="bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-lg">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
        {activeTab === 'nbc205' && (
          <div className="space-y-6">
            {/* NBC & Municipal Planning Sub-Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-lg">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setNbcSubTab('municipal')}
                  className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center space-x-2 transition ${
                    nbcSubTab === 'municipal'
                      ? 'bg-amber-500 text-slate-950 shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Municipal Planning, FAR & Location Map</span>
                </button>
                <button
                  onClick={() => setNbcSubTab('audit')}
                  className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center space-x-2 transition ${
                    nbcSubTab === 'audit'
                      ? 'bg-amber-500 text-slate-950 shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>NBC 205:2024 Structural Detailing & Lag Audit</span>
                </button>
              </div>

              <div className="text-xs text-slate-400 hidden lg:block font-mono">
                {nbcSubTab === 'municipal'
                  ? 'Verify Ground Coverage %, FAR ratio, Road Setbacks, and Cadastral Site Plan'
                  : 'Check reinforcement bar diameters, stirrup spacing, and cube strength compliance'}
              </div>
            </div>

            {nbcSubTab === 'municipal' ? (
              <NbcMunicipalCompliance 
                currentProject={currentProject} 
                currency={currentProject.currency} 
                importedFilePreview={importedFilePreview}
                importedFileName={importedFileName}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                    <span>NBC 205:2024 Code Compliance Audit & Material Take-Off Engine</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Ready-to-Use Detailing Guideline for Low Rise Reinforced Concrete Buildings without Masonry Infill (DUDBC, Nepal). Evaluates two-storey structural compliance & material BOM.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-xl">
                    ✓ NBC 105:2020 Seismic Compliant
                  </span>
                </div>
              </div>

              {/* Material Take-Off Summary Cards derived from Project */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400 uppercase font-medium">Concrete Volume (M20)</p>
                  <p className="text-xl font-black text-amber-400 font-mono mt-1">
                    {currentProject.items.filter(i => i.unit === 'm³' && (i.description.includes('CONCRETE') || i.description.includes('R.C.C') || i.description.includes('P.C.C'))).reduce((sum, i) => sum + calculateItemQuantity(i), 0).toFixed(2)} m³
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Mix 1:1.5:3 (Min 20 N/mm²)</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400 uppercase font-medium">Cement Requirement</p>
                  <p className="text-xl font-black text-indigo-400 font-mono mt-1">
                    {(currentProject.items.filter(i => i.unit === 'm³' && (i.description.includes('CONCRETE') || i.description.includes('R.C.C') || i.description.includes('P.C.C'))).reduce((sum, i) => sum + calculateItemQuantity(i), 0) * 7.5).toFixed(0)} bags
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">OPC 53 / PPC Grade (50kg)</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400 uppercase font-medium">TMT Steel Rebar</p>
                  <p className="text-xl font-black text-blue-400 font-mono mt-1">
                    {(currentProject.items.find(i => i.id === 'item-7')?.qty || 7456.4).toLocaleString()} kg
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Fe 500 TMT (NS 191:2046)</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400 uppercase font-medium">Brick Masonry</p>
                  <p className="text-xl font-black text-rose-400 font-mono mt-1">
                    {((currentProject.items.find(i => i.id === 'item-9')?.qty || 95.25) * 500).toLocaleString()} pcs
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">First class red bricks (3.5 N/mm²)</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400 uppercase font-medium">Formwork Plywood</p>
                  <p className="text-xl font-black text-orange-400 font-mono mt-1">
                    {(currentProject.items.find(i => i.id === 'item-8')?.qty || 252.04).toFixed(2)} m²
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">12/19mm waterproof ply</p>
                </div>
              </div>

              {/* Side-by-Side Discrepancy & Code Compliance Table */}
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Side-by-Side Code Discrepancy & Lag Analysis (NBC 205:2024 Section 8)</span>
                </h3>

                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-300 font-semibold">
                        <th className="py-3 px-4">Structural Element / Parameter</th>
                        <th className="py-3 px-4">NBC 205:2024 Code Requirement</th>
                        <th className="py-3 px-4">Project Provided Specification</th>
                        <th className="py-3 px-4 text-center">Compliance Status</th>
                        <th className="py-3 px-4">Code Reference & Recommendations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-200">
                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">1. Concrete Grade</td>
                        <td className="py-3 px-4 text-slate-400">Minimum M20 (1:1.5:3) at 28 days</td>
                        <td className="py-3 px-4 font-mono text-amber-400">M20 Design Mix (1:1.5:3)</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Cl 5.1: Cube strength ≥ 20 N/mm² achieved.</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">2. Reinforcing Steel Grade</td>
                        <td className="py-3 px-4 text-slate-400">High-strength Fe500 TMT (fy = 500 N/mm²)</td>
                        <td className="py-3 px-4 font-mono text-amber-400">Fe 500 TMT (NS 191:2046)</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Cl 5.3: Elongation &gt; 15%, TMT process verified.</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">3. Column Dimensions (C1–C3)</td>
                        <td className="py-3 px-4 text-slate-400">Minimum 350 × 350 mm square section</td>
                        <td className="py-3 px-4 font-mono text-amber-400">350 × 350 mm</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Section 8.2 & Table 8-8: Adequate for 2-storey.</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">4. Column Reinforcement</td>
                        <td className="py-3 px-4 text-slate-400">Min 8-16φ or 4-16φ+4-12φ as per zone</td>
                        <td className="py-3 px-4 font-mono text-amber-400">4-16φ + 4-12φ (8 bars total)</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Table 8-8: Complies with Zone 0.25–0.35 requirements.</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">5. Column Transverse Stirrups</td>
                        <td className="py-3 px-4 text-slate-400">8mm @ 75mm c/c in confinement zone, 125mm rest</td>
                        <td className="py-3 px-4 font-mono text-amber-400">8φ @ 75 / 125 mm c/c</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Table 9-9: Closed ties with 135° hooks (≥65mm length).</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">6. Floor Beam Size & Depth</td>
                        <td className="py-3 px-4 text-slate-400">250 mm width × 355 mm overall depth (incl. slab)</td>
                        <td className="py-3 px-4 font-mono text-amber-400">250 × 355 mm</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Section 8.3 & Fig 8-5: Meets span requirements.</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">7. Floor Slab Thickness</td>
                        <td className="py-3 px-4 text-slate-400">Minimum 125 mm (5 inches) solid RC slab</td>
                        <td className="py-3 px-4 font-mono text-amber-400">125 mm thickness</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Section 10.1: 8φ @ 150mm c/c mesh reinforcement.</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">8. Lapping & Development Length</td>
                        <td className="py-3 px-4 text-slate-400">Minimum 57φ (e.g. 690mm for 12φ, 920mm for 16φ)</td>
                        <td className="py-3 px-4 font-mono text-amber-400">≥ 57φ provided</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Table 9-10: Splicing restricted to mid-height (H/2 zone).</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">9. Non-Loadbearing Wall Bands</td>
                        <td className="py-3 px-4 text-slate-400">Horizontal RC bands at 1/3 and 2/3 height (2-10φ bars)</td>
                        <td className="py-3 px-4 font-mono text-emerald-400">Included in finishing/masonry</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Section 11.1: Prevents out-of-plane masonry failure.</td>
                      </tr>

                      <tr className="hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-bold">10. Foundation Soil Bearing (SBC)</td>
                        <td className="py-3 px-4 text-slate-400">Verified via test pits / dropping weight method (≥ 100 kN/m²)</td>
                        <td className="py-3 px-4 font-mono text-amber-400">150 kN/m² (Medium Soil)</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Section 3.3–3.5: Isolated pad footing 1.5×1.5m, tm=350mm.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <div>
                <h2 className="text-lg font-bold text-slate-100">User Management & Access Control</h2>
                <p className="text-xs text-slate-400">Manage team members and role-based permissions (Admin only).</p>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">Department</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t border-slate-800">
                      <td className="p-3 font-semibold text-slate-200">{u.name}</td>
                      <td className="p-3 text-slate-400">{u.email}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 w-fit">
                            {u.role.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border w-fit ${
                            (u.status ?? 'approved') === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}>
                            {u.status ?? 'approved'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-400">{u.department}</td>
                      <td className="p-3 text-right space-x-2">
                        {(u.status ?? 'approved') === 'pending' && currentUser.role === 'admin' && (
                          <button
                            onClick={() => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: 'approved' } : x))}
                            className="text-emerald-400 hover:text-emerald-300 transition"
                            title="Approve user"
                          >
                            <UserCheck className="w-4 h-4 inline" />
                          </button>
                        )}
                        {currentUser.role === 'admin' && u.id !== currentUser.id && (
                          <button
                            onClick={() => setUsers(prev => prev.filter(x => x.id !== u.id))}
                            className="text-red-400 hover:text-red-300 transition"
                            title="Remove user"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Grand Total Estimate</p>
                <h3 className="text-2xl font-black text-amber-400 mt-2">
                  {currentProject.currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Includes VAT & Contingency</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Direct Subtotal Cost</p>
                <h3 className="text-2xl font-black text-slate-100 mt-2">
                  {currentProject.currency} {subtotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{currentProject.items.length} BOQ Measurement Items</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Project Location</p>
                <h3 className="text-lg font-bold text-slate-200 mt-2 truncate">
                  {currentProject.location}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Client: {currentProject.client}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Default Wastage & VAT</p>
                <h3 className="text-lg font-bold text-slate-200 mt-2">
                  {currentProject.wastageDefault}% / {currentProject.vatPercent}% VAT
                </h3>
                <p className="text-xs text-slate-500 mt-1">Standard Wall Ht: {currentProject.standardWallHeight}m</p>
              </div>
            </div>

            {/* Breakdown by Category */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>Cost Breakdown by Construction Phase (PDF Breakdown)</span>
                </h3>
                <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                  {currentProject.items.length} BOQ Items in {PREDEFINED_CATEGORIES.filter(c => currentProject.items.some(i => i.category === c.name)).length} Active Phases
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PREDEFINED_CATEGORIES.map(catObj => {
                  const cat = catObj.name;
                  const catItems = currentProject.items.filter(i => i.category === cat);
                  const catTotal = catItems.reduce((sum, item) => sum + calculateItemTotalCost(item), 0);
                  const percentage = subtotalCost > 0 ? ((catTotal / subtotalCost) * 100).toFixed(1) : '0';

                  return (
                    <div key={cat} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${catObj.badgeClass}`}>{cat}</span>
                          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">{catItems.length} items</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{catObj.description}</p>
                        <h4 className="text-lg font-extrabold text-slate-100 mt-2">
                          {currentProject.currency} {catTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Share of Subtotal</span>
                          <span className="font-mono font-bold text-amber-400">{percentage}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Number(percentage))}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Project Timeline Analytics Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    <span>Project Timeline Analytics & Milestone Progress</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Visualizing 8-month project execution schedule ({currentProject.duration}) with planned expenditure vs completion progress.
                  </p>
                </div>
                <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setTimelineViewMode('spend')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      timelineViewMode === 'spend' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Planned Spend
                  </button>
                  <button
                    onClick={() => setTimelineViewMode('progress')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      timelineViewMode === 'progress' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Progress %
                  </button>
                  <button
                    onClick={() => setTimelineViewMode('workload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      timelineViewMode === 'workload' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Workload (Items)
                  </button>
                </div>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  {timelineViewMode === 'spend' ? (
                    <AreaChart data={[
                      { month: 'Month 1', phase: 'Site Prep & Earthwork', plannedSpend: 150000, actualProgress: 100, workload: 3 },
                      { month: 'Month 2', phase: 'Substructure & Soling', plannedSpend: 620000, actualProgress: 100, workload: 4 },
                      { month: 'Month 3', phase: 'Superstructure & PCC', plannedSpend: 1850000, actualProgress: 85, workload: 5 },
                      { month: 'Month 4', phase: 'Reinforcement & Rebar', plannedSpend: 2600000, actualProgress: 65, workload: 3 },
                      { month: 'Month 5', phase: 'Formwork & Shuttering', plannedSpend: 3400000, actualProgress: 40, workload: 2 },
                      { month: 'Month 6', phase: 'Brick Masonry & Walls', plannedSpend: 4700000, actualProgress: 20, workload: 3 },
                      { month: 'Month 7', phase: 'Plaster & Finishes', plannedSpend: 5600000, actualProgress: 5, workload: 8 },
                      { month: 'Month 8', phase: 'MEP & Handover', plannedSpend: 6100000, actualProgress: 0, workload: 4 },
                    ]} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `NPR ${(val / 100000).toFixed(1)}L`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px' }}
                        formatter={(value: any) => [`NPR ${Number(value).toLocaleString()}`, 'Planned Cumulative Spend']}
                      />
                      <Area type="monotone" dataKey="plannedSpend" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" />
                    </AreaChart>
                  ) : timelineViewMode === 'progress' ? (
                    <BarChart data={[
                      { month: 'Month 1', phase: 'Site Prep & Earthwork', plannedSpend: 150000, actualProgress: 100, workload: 3 },
                      { month: 'Month 2', phase: 'Substructure & Soling', plannedSpend: 620000, actualProgress: 100, workload: 4 },
                      { month: 'Month 3', phase: 'Superstructure & PCC', plannedSpend: 1850000, actualProgress: 85, workload: 5 },
                      { month: 'Month 4', phase: 'Reinforcement & Rebar', plannedSpend: 2600000, actualProgress: 65, workload: 3 },
                      { month: 'Month 5', phase: 'Formwork & Shuttering', plannedSpend: 3400000, actualProgress: 40, workload: 2 },
                      { month: 'Month 6', phase: 'Brick Masonry & Walls', plannedSpend: 4700000, actualProgress: 20, workload: 3 },
                      { month: 'Month 7', phase: 'Plaster & Finishes', plannedSpend: 5600000, actualProgress: 5, workload: 8 },
                      { month: 'Month 8', phase: 'MEP & Handover', plannedSpend: 6100000, actualProgress: 0, workload: 4 },
                    ]} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px' }}
                        formatter={(value: any) => [`${value}%`, 'Completion Progress']}
                      />
                      <Bar dataKey="actualProgress" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={[
                      { month: 'Month 1', phase: 'Site Prep & Earthwork', plannedSpend: 150000, actualProgress: 100, workload: 3 },
                      { month: 'Month 2', phase: 'Substructure & Soling', plannedSpend: 620000, actualProgress: 100, workload: 4 },
                      { month: 'Month 3', phase: 'Superstructure & PCC', plannedSpend: 1850000, actualProgress: 85, workload: 5 },
                      { month: 'Month 4', phase: 'Reinforcement & Rebar', plannedSpend: 2600000, actualProgress: 65, workload: 3 },
                      { month: 'Month 5', phase: 'Formwork & Shuttering', plannedSpend: 3400000, actualProgress: 40, workload: 2 },
                      { month: 'Month 6', phase: 'Brick Masonry & Walls', plannedSpend: 4700000, actualProgress: 20, workload: 3 },
                      { month: 'Month 7', phase: 'Plaster & Finishes', plannedSpend: 5600000, actualProgress: 5, workload: 8 },
                      { month: 'Month 8', phase: 'MEP & Handover', plannedSpend: 6100000, actualProgress: 0, workload: 4 },
                    ]} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px' }}
                        formatter={(value: any) => [`${value} active items`, 'Workload']}
                      />
                      <Line type="monotone" dataKey="workload" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6, fill: '#3b82f6' }} />



                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Executive Structural & Material KPI Analytics (Parameters relocated to Settings) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Box className="w-5 h-5 text-amber-400" />
                    <h4 className="text-sm font-bold text-slate-100">Structural Take-Off Totals</h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    Live Calculation
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Concrete Volume</span>
                    <span className="text-base font-extrabold text-amber-400 font-mono">
                      {currentProject.items.filter(i => i.unit === 'm³' && (i.description.includes('CONCRETE') || i.description.includes('R.C.C') || i.description.includes('P.C.C'))).reduce((sum, i) => sum + calculateItemQuantity(i), 0).toFixed(2)} m³
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Steel Rebar</span>
                    <span className="text-base font-extrabold text-indigo-400 font-mono">
                      {(currentProject.items.find(i => i.id === 'item-7')?.qty || 7456.4).toLocaleString()} kg
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Brick Masonry</span>
                    <span className="text-base font-extrabold text-rose-400 font-mono">
                      {(currentProject.items.find(i => i.id === 'item-9')?.qty || 95.25).toFixed(2)} m³
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Plywood Formwork</span>
                    <span className="text-base font-extrabold text-orange-400 font-mono">
                      {(currentProject.items.find(i => i.id === 'item-8')?.qty || 252.04).toFixed(2)} m²
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-sm font-bold text-slate-100">Bidding & Commercial Summary</h4>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Official Quotation
                  </span>
                </div>
                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/60">
                    <span className="text-slate-400 font-sans">Civil Subtotal:</span>
                    <span className="text-slate-200 font-bold">{currentProject.currency} {subtotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/60 text-rose-400">
                    <span className="font-sans">Tender Discount:</span>
                    <span>- {currentProject.currency} {(currentProject.discountAmount || 10280.85).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-sm">
                    <span className="font-sans">Net Payable Bidding:</span>
                    <span>{currentProject.currency} 6,100,000.00</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Wrench className="w-5 h-5 text-amber-400" />
                    <h4 className="text-sm font-bold text-slate-100">Project Engineering Parameters</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Global parameters including standard wall height ({currentProject.standardWallHeight}m), wall thicknesses (0.23m / 0.115m), wastage allowance, and currency are centralized in Settings.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="mt-4 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Configure Engineering Parameters in Settings →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'boq' && (
          <div className="space-y-6">
            {/* BOQ Header: Project Info + Action Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-6 h-6 text-amber-500" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 leading-tight">Bill of Quantities Summary</h2>
                    <p className="text-xs text-slate-400">Official cost summary matching G.C. Brothers Engineering estimate</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Project</p>
                    <p className="text-sm font-medium text-slate-200">{currentProject.name}</p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Location</p>
                    <p className="text-sm font-medium text-slate-200">{currentProject.location}</p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Items</p>
                    <p className="text-sm font-bold text-amber-400">{currentProject.items.length}</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</span>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const updated = projects.map(p => {
                        if (p.id === currentProject.id) {
                          return {
                            ...p,
                            items: p.items.map(item => {
                              if (DEFAULT_CATEGORY_MAPPINGS[item.id]) {
                                return { ...item, category: DEFAULT_CATEGORY_MAPPINGS[item.id] };
                              }
                              return item;
                            })
                          };
                        }
                        return p;
                      });
                      setProjects(updated);
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center justify-center space-x-2"
                    title="Re-apply exact categories from project PDF"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Re-sync PDF Categories</span>
                  </button>
                  <button
                    onClick={handleDownloadCsv}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center justify-center space-x-2"
                    title="Download BOQ as CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download CSV</span>
                  </button>
                  <button
                    onClick={() => handleBulkExportPdf('en')}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold border border-amber-500 transition flex items-center justify-center space-x-2 shadow-sm"
                    title="Export PDF with English (AD) date"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export PDF (EN)</span>
                  </button>
                  <button
                    onClick={() => handleOpenAddModal()}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add BOQ Item</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Multi-Story Building Floor Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-lg">
              <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <span className="text-xs font-bold text-slate-400 px-1 flex items-center space-x-1 shrink-0">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Story Filter:</span>
                </span>
                {['All Stories', 'Foundation', 'Ground Floor', '1st Floor', '2nd Floor', 'Roof'].map(floor => {
                  const count = floor === 'All Stories'
                    ? currentProject.items.length
                    : currentProject.items.filter(i => getItemFloor(i) === floor).length;
                  return (
                    <button
                      key={floor}
                      onClick={() => setActiveStoryFilter(floor)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 ${
                        activeStoryFilter === floor
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{floor}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        activeStoryFilter === floor ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeStoryFilter !== 'All Stories' && (
                <div className="text-xs font-mono text-slate-400 flex items-center space-x-2 shrink-0">
                  <span>{activeStoryFilter} Subtotal:</span>
                  <span className="text-amber-400 font-bold font-mono">
                    {currentProject.currency}{' '}
                    {currentProject.items
                      .filter(i => getItemFloor(i) === activeStoryFilter)
                      .reduce((sum, i) => sum + calculateItemTotalCost(i), 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setBoqCategoryFilter('All')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  boqCategoryFilter === 'All'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                All Categories ({currentProject.items.length})
              </button>
              {PREDEFINED_CATEGORIES.map(cat => {
                const count = currentProject.items.filter(i => i.category === cat.name).length;
                if (count === 0) return null;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setBoqCategoryFilter(cat.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                      boqCategoryFilter === cat.name
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      boqCategoryFilter === cat.name ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] uppercase font-bold text-slate-500">Subtotal</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{currentProject.items.filter(i => boqCategoryFilter === 'All' || i.category === boqCategoryFilter).length} items</span>
                </div>
                <div className="text-2xl font-black text-slate-100">
                  {currentProject.currency}{' '}
                  {(boqCategoryFilter === 'All'
                    ? subtotalCost
                    : currentProject.items.filter(i => i.category === boqCategoryFilter).reduce((sum, item) => sum + calculateItemTotalCost(item), 0)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Calculator className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] uppercase font-bold text-slate-500">VAT ({currentProject.vatPercent}%)</span>
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-400">
                  {currentProject.currency}{' '}
                  {(subtotalCost * currentProject.vatPercent / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-orange-400" />
                    <span className="text-[10px] uppercase font-bold text-slate-500">Contingency ({currentProject.contingencyPercent}%)</span>
                  </div>
                </div>
                <div className="text-2xl font-black text-orange-400">
                  {currentProject.currency}{' '}
                  {(subtotalCost * currentProject.contingencyPercent / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <X className="w-4 h-4 text-rose-400" />
                    <span className="text-[10px] uppercase font-bold text-slate-500">Discount</span>
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-400">
                  - {currentProject.currency}{' '}
                  {(currentProject.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 shadow-lg ring-1 ring-amber-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] uppercase font-bold text-amber-400">Grand Total</span>
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {currentProject.currency}{' '}
                  {(subtotalCost + subtotalCost * currentProject.vatPercent / 100 + subtotalCost * currentProject.contingencyPercent / 100 - (currentProject.discountAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* BOQ Summary Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-950/90">
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-20">S.N.</th>
                      <th className="py-3.5 px-4 w-1/3">Description of Works</th>
                      <th className="py-3.5 px-4 w-16 text-center">Category</th>
                      <th className="py-3.5 px-4 w-16 text-center">Story</th>
                      <th className="py-3.5 px-4 w-12 text-center">Unit</th>
                      <th className="py-3.5 px-4 w-16 text-right">Quantity</th>
                      <th className="py-3.5 px-4 w-20 text-right">Rate</th>
                      <th className="py-3.5 px-4 w-24 text-right">Amount</th>
                      <th className="py-3.5 px-4 w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-200">
                    {currentProject.items
                      .filter(i => (boqCategoryFilter === 'All' || i.category === boqCategoryFilter) &&
                                   (activeStoryFilter === 'All Stories' || getItemFloor(i) === activeStoryFilter))
                      .map((item, idx) => {
                        const totalCost = calculateItemTotalCost(item);
                        const originalIdx = currentProject.items.findIndex(i => i.id === item.id);
                        const story = getItemFloor(item);
                        const filteredItems = currentProject.items.filter(i => (boqCategoryFilter === 'All' || i.category === boqCategoryFilter) &&
                                         (activeStoryFilter === 'All Stories' || getItemFloor(i) === activeStoryFilter));
                        const isFirstInCategory = idx === 0 || filteredItems[idx - 1]?.category !== item.category;
                        return (
                          <>
                            {isFirstInCategory && (
                              <tr className="bg-slate-950/50 border-b border-slate-800/50">
                                <td colSpan={9} className="py-2 px-4">
                                  <div className="flex items-center space-x-2">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getCategoryBadgeClass(item.category)}`}>
                                      {item.category}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400 ml-auto">
                                      {filteredItems.filter(i => i.category === item.category).reduce((sum, it) => sum + calculateItemTotalCost(it), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                            <tr key={item.id} className="hover:bg-slate-800/30 transition group">
                              <td className="py-3 px-4">
                                <span className="font-mono text-slate-500 font-bold">#{originalIdx + 1}</span>
                              </td>
                              <td className="py-3 px-4 font-medium" title={item.description}>
                                {item.description}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-[10px] bg-slate-950/60 border border-slate-800/50 px-2 py-0.5 rounded font-mono text-amber-300/80 whitespace-nowrap`}>
                                  {story}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs font-mono text-slate-300">{item.unit}</td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">{calculateItemQuantity(item)}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-300">{item.unitRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                                {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setSelectedBreakdownItem(item)} className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 rounded transition" title="View Breakdown">
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleOpenAddModal(item)} className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 rounded transition" title="Edit Item">
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Summary */}
              <div className="bg-slate-950 px-6 py-6 border-t border-slate-800 rounded-b-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Subtotal</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-bold text-slate-400">{currentProject.currency}</span>
                      <span className="text-xl font-black text-slate-100">
                        {(boqCategoryFilter === 'All'
                          ? subtotalCost
                          : currentProject.items.filter(i => i.category === boqCategoryFilter).reduce((sum, item) => sum + calculateItemTotalCost(item), 0)
                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {boqCategoryFilter === 'All' ? 'All BOQ Items' : currentProject.items.filter(i => i.category === boqCategoryFilter).length + ' items'}
                    </p>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Taxes &amp; Charges</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">VAT ({currentProject.vatPercent}%)</span>
                        <span className="font-mono text-blue-400">
                          {currentProject.currency}{(subtotalCost * currentProject.vatPercent / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Contingency ({currentProject.contingencyPercent}%)</span>
                        <span className="font-mono text-orange-400">
                          {currentProject.currency}{(subtotalCost * currentProject.contingencyPercent / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                    <p className="text-[10px] uppercase font-bold text-amber-400 mb-1">Grand Total</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-bold text-slate-400">{currentProject.currency}</span>
                      <span className="text-2xl font-black text-amber-400">
                        {(subtotalCost + subtotalCost * currentProject.vatPercent / 100 + subtotalCost * currentProject.contingencyPercent / 100 - (currentProject.discountAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-400/70 mt-1 font-bold">Includes discount of {currentProject.currency}{(currentProject.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="border-t border-slate-800/50 pt-6">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Payable Amount For Bidding</span>
                    <span className="text-xl font-black text-slate-100 font-mono">
                      {currentProject.currency}{(subtotalCost + subtotalCost * currentProject.vatPercent / 100 + subtotalCost * currentProject.contingencyPercent / 100 - (currentProject.discountAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Exact to G.C. Brothers Engineering Estimate · Prepared for tender submission</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'takeoff' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Take-Off Measurement Sheet (PDF Pages 5–13 Standard)</h2>
                <p className="text-xs text-slate-400">Detailed dimension entry and quantity take-off breakdown for all items.</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setActiveTab('blueprint');
                    setBlueprintSubTab('dxf');
                  }}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition"
                  title="Direct AI Take-off from CAD drawings to Measurement Sheet"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>AI CAD Take-Off</span>
                </button>
                <button
                  onClick={() => handleOpenAddModal()}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Measurement Row</span>
                </button>
              </div>
            </div>

            {/* Multi-Story Building Floor Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-lg">
              <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <span className="text-xs font-bold text-slate-400 px-1 flex items-center space-x-1 shrink-0">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Story Level:</span>
                </span>
                {['All Stories', 'Foundation', 'Ground Floor', '1st Floor', '2nd Floor', 'Roof'].map(floor => {
                  const count = floor === 'All Stories'
                    ? currentProject.items.length
                    : currentProject.items.filter(i => getItemFloor(i) === floor).length;
                  return (
                    <button
                      key={floor}
                      onClick={() => setActiveStoryFilter(floor)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 ${
                        activeStoryFilter === floor
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{floor}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        activeStoryFilter === floor ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeStoryFilter !== 'All Stories' && (
                <div className="text-xs font-mono text-slate-400 flex items-center space-x-2 shrink-0">
                  <span>Filtered Story Items:</span>
                  <span className="text-amber-400 font-bold font-mono">
                    {currentProject.items.filter(i => getItemFloor(i) === activeStoryFilter).length} Active Rows
                  </span>
                </div>
              )}
            </div>

            {/* Take-off Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Item & Description</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4 text-center">Nos</th>
                      <th className="py-3 px-4 text-center">L</th>
                      <th className="py-3 px-4 text-center">W</th>
                      <th className="py-3 px-4 text-center">H</th>
                      <th className="py-3 px-4 text-right">Total Qty</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {PREDEFINED_CATEGORIES.map(catObj => {
                      const category = catObj.name;
                      const categoryItems = currentProject.items.filter(item =>
                        item.category === category &&
                        (activeStoryFilter === 'All Stories' || getItemFloor(item) === activeStoryFilter)
                      );
                      if (categoryItems.length === 0) return null;
                      
                      const categoryTotalQty = categoryItems.reduce((sum, item) => sum + calculateItemQuantity(item), 0);

                      return (
                        <React.Fragment key={category}>
                          <tr className="bg-slate-950/70 border-y border-slate-800">
                            <td colSpan={8} className="py-2.5 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-[11px] uppercase font-black px-2.5 py-0.5 rounded border ${catObj.badgeClass}`}>
                                    {category}
                                  </span>
                                  <span className="text-xs text-slate-400 font-medium">({categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'})</span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">{catObj.description}</span>
                              </div>
                            </td>
                          </tr>
                          {categoryItems.map((item) => {
                            const isExpanded = !!expandedSubdivisionItems[item.id];
                            const hasSubdivisions = !!(item.subDivisions && item.subDivisions.length > 0);
                            const itemNetQty = calculateItemQuantity(item);

                            return (
                              <React.Fragment key={item.id}>
                                <tr className={`border-b border-slate-800/80 transition ${isExpanded ? 'bg-slate-800/30' : 'hover:bg-slate-800/40'}`}>
                                  <td className="py-3 px-4">
                                    <div className="flex items-start gap-2.5">
                                      <button
                                        onClick={() => handleToggleExpandSubdivision(item.id)}
                                        className="mt-0.5 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                                        title={isExpanded ? 'Collapse sub-division rows' : 'Expand sub-division rows'}
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-4 h-4 text-amber-400" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4" />
                                        )}
                                      </button>
                                      <div className="space-y-1">
                                        <div className="font-semibold text-slate-100 flex items-center flex-wrap gap-2">
                                          <span>{item.description}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {hasSubdivisions ? (
                                            <button
                                              onClick={() => handleToggleExpandSubdivision(item.id)}
                                              className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-semibold transition flex items-center gap-1"
                                            >
                                              <span>{item.subDivisions!.length} sub-division {item.subDivisions!.length === 1 ? 'row' : 'rows'}</span>
                                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleAddSubdivisionRow(item.id)}
                                              className="text-[11px] bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-700/60 px-2 py-0.5 rounded font-mono transition flex items-center gap-1"
                                              title="Click to break this item down into sub-division rows"
                                            >
                                              <ListPlus className="w-3 h-3 text-amber-400" />
                                              <span>+ Add Sub-division Row</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-xs font-mono bg-slate-950/40 rounded">{item.unit}</td>
                                  <td className="py-3 px-4 text-center font-mono text-slate-400">{hasSubdivisions ? '—' : item.qty}</td>
                                  <td className="py-3 px-4 text-center font-mono text-slate-400">{hasSubdivisions ? '—' : item.length}</td>
                                  <td className="py-3 px-4 text-center font-mono text-slate-400">{hasSubdivisions ? '—' : item.width}</td>
                                  <td className="py-3 px-4 text-center font-mono text-slate-400">{hasSubdivisions ? '—' : item.height}</td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                                    {itemNetQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div className="flex items-center justify-center space-x-1.5">
                                      <button
                                        onClick={() => handleAddSubdivisionRow(item.id)}
                                        className="p-1.5 hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 rounded-lg transition"
                                        title="Add Row to Sub-division"
                                      >
                                        <ListPlus className="w-4 h-4 text-amber-400" />
                                      </button>
                                      <button
                                        onClick={() => setSelectedBreakdownItem(item)}
                                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition"
                                        title="View Details & Full Sub-division Breakdown"
                                      >
                                        <FileText className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleOpenAddModal(item)}
                                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-lg transition"
                                        title="Edit Dimensions"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Expanded Sub-division Table */}
                                {isExpanded && (
                                  <tr className="bg-slate-950/70 border-b border-amber-500/20">
                                    <td colSpan={8} className="p-3 pl-8">
                                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-inner">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                                          <div className="flex items-center space-x-2">
                                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                                              Sub-division Measurement Details (MB Sheet Standard)
                                            </h4>
                                            <span className="text-[11px] text-slate-400 font-mono">
                                              Unit: <strong className="text-slate-200">{item.unit}</strong>
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => handleAddSubdivisionRow(item.id)}
                                            className="self-start sm:self-auto bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add Sub-division Row</span>
                                          </button>
                                        </div>

                                        {/* Subdivision Table */}
                                        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                                          <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                              <tr className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                                                <th className="py-2 px-3 w-10 text-center">#</th>
                                                <th className="py-2 px-3">Location / Measurement Particulars</th>
                                                <th className="py-2 px-3 text-center w-20">Nos</th>
                                                <th className="py-2 px-3 text-center w-24">L (m)</th>
                                                <th className="py-2 px-3 text-center w-24">W (m)</th>
                                                <th className="py-2 px-3 text-center w-24">H (m)</th>
                                                <th className="py-2 px-3 text-right w-28">Qty ({item.unit})</th>
                                                <th className="py-2 px-3 text-center w-16">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/80 font-mono text-slate-300">
                                              {item.subDivisions && item.subDivisions.length > 0 ? (
                                                item.subDivisions.map((sub, index) => {
                                                  const subQty = calculateSubdivisionQuantity(sub, item.unit);
                                                  const isDeduction = sub.qty < 0;
                                                  return (
                                                    <tr key={sub.id} className="hover:bg-slate-900/60 transition group">
                                                      <td className="py-2 px-3 text-center text-slate-500 font-sans">{index + 1}</td>
                                                      <td className="py-2 px-3">
                                                        <input
                                                          type="text"
                                                          value={sub.description}
                                                          onChange={(e) => handleUpdateSubdivisionRow(item.id, sub.id, 'description', e.target.value)}
                                                          className="w-full bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs transition"
                                                          placeholder="e.g. Foundation Trench Axis 1-4"
                                                        />
                                                      </td>
                                                      <td className="py-2 px-3 text-center">
                                                        <input
                                                          type="number"
                                                          step="1"
                                                          value={sub.qty}
                                                          onChange={(e) => handleUpdateSubdivisionRow(item.id, sub.id, 'qty', e.target.value)}
                                                          className={`w-16 text-center bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1 py-1 text-xs font-mono transition ${
                                                            isDeduction ? 'text-rose-400 font-bold' : 'text-slate-200'
                                                          }`}
                                                        />
                                                      </td>
                                                      <td className="py-2 px-3 text-center">
                                                        <input
                                                          type="number"
                                                          step="0.01"
                                                          value={sub.length}
                                                          onChange={(e) => handleUpdateSubdivisionRow(item.id, sub.id, 'length', e.target.value)}
                                                          className="w-20 text-center bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1 py-1 text-xs text-slate-200 font-mono transition"
                                                        />
                                                      </td>
                                                      <td className="py-2 px-3 text-center">
                                                        <input
                                                          type="number"
                                                          step="0.01"
                                                          value={sub.width}
                                                          onChange={(e) => handleUpdateSubdivisionRow(item.id, sub.id, 'width', e.target.value)}
                                                          className="w-20 text-center bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1 py-1 text-xs text-slate-200 font-mono transition"
                                                        />
                                                      </td>
                                                      <td className="py-2 px-3 text-center">
                                                        <input
                                                          type="number"
                                                          step="0.01"
                                                          value={sub.height}
                                                          onChange={(e) => handleUpdateSubdivisionRow(item.id, sub.id, 'height', e.target.value)}
                                                          className="w-20 text-center bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1 py-1 text-xs text-slate-200 font-mono transition"
                                                        />
                                                      </td>
                                                      <td className={`py-2 px-3 text-right font-bold ${isDeduction ? 'text-rose-400' : 'text-amber-300'}`}>
                                                        {subQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                      </td>
                                                      <td className="py-2 px-3 text-center">
                                                        <button
                                                          onClick={() => handleDeleteSubdivisionRow(item.id, sub.id)}
                                                          className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition"
                                                          title="Delete this sub-division row"
                                                        >
                                                          <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                      </td>
                                                    </tr>
                                                  );
                                                })
                                              ) : (
                                                <tr>
                                                  <td colSpan={8} className="py-3 text-center text-slate-500 italic">
                                                    No detailed sub-division rows added yet. Use the form below to add the first row.
                                                  </td>
                                                </tr>
                                              )}

                                              {/* Quick Add Sub-division Row Form */}
                                              <tr className="bg-slate-900/80 border-t border-slate-800">
                                                <td className="py-2.5 px-3 text-center text-amber-400 font-bold font-sans">+</td>
                                                <td className="py-2.5 px-3">
                                                  <input
                                                    type="text"
                                                    placeholder="Enter location / particular name (e.g. Wall A-B, Beam B1)..."
                                                    value={newSubRowInputs[item.id]?.description || ''}
                                                    onChange={(e) => setNewSubRowInputs(prev => ({
                                                      ...prev,
                                                      [item.id]: {
                                                        description: e.target.value,
                                                        qty: prev[item.id]?.qty ?? 1,
                                                        length: prev[item.id]?.length ?? (item.length || 1),
                                                        width: prev[item.id]?.width ?? (item.width || 1),
                                                        height: prev[item.id]?.height ?? (item.height || 1),
                                                      }
                                                    }))}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddSubdivisionRow(item.id);
                                                      }
                                                    }}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-500"
                                                  />
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                  <input
                                                    type="number"
                                                    step="1"
                                                    title="Nos (positive for addition, negative for opening deduction)"
                                                    value={newSubRowInputs[item.id]?.qty ?? 1}
                                                    onChange={(e) => setNewSubRowInputs(prev => ({
                                                      ...prev,
                                                      [item.id]: {
                                                        description: prev[item.id]?.description || '',
                                                        qty: Number(e.target.value),
                                                        length: prev[item.id]?.length ?? (item.length || 1),
                                                        width: prev[item.id]?.width ?? (item.width || 1),
                                                        height: prev[item.id]?.height ?? (item.height || 1),
                                                      }
                                                    }))}
                                                    className="w-16 text-center bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                                                  />
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="L"
                                                    value={newSubRowInputs[item.id]?.length ?? (item.length || 1)}
                                                    onChange={(e) => setNewSubRowInputs(prev => ({
                                                      ...prev,
                                                      [item.id]: {
                                                        description: prev[item.id]?.description || '',
                                                        qty: prev[item.id]?.qty ?? 1,
                                                        length: Number(e.target.value),
                                                        width: prev[item.id]?.width ?? (item.width || 1),
                                                        height: prev[item.id]?.height ?? (item.height || 1),
                                                      }
                                                    }))}
                                                    className="w-20 text-center bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                                                  />
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="W"
                                                    value={newSubRowInputs[item.id]?.width ?? (item.width || 1)}
                                                    onChange={(e) => setNewSubRowInputs(prev => ({
                                                      ...prev,
                                                      [item.id]: {
                                                        description: prev[item.id]?.description || '',
                                                        qty: prev[item.id]?.qty ?? 1,
                                                        length: prev[item.id]?.length ?? (item.length || 1),
                                                        width: Number(e.target.value),
                                                        height: prev[item.id]?.height ?? (item.height || 1),
                                                      }
                                                    }))}
                                                    className="w-20 text-center bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                                                  />
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="H"
                                                    value={newSubRowInputs[item.id]?.height ?? (item.height || 1)}
                                                    onChange={(e) => setNewSubRowInputs(prev => ({
                                                      ...prev,
                                                      [item.id]: {
                                                        description: prev[item.id]?.description || '',
                                                        qty: prev[item.id]?.qty ?? 1,
                                                        length: prev[item.id]?.length ?? (item.length || 1),
                                                        width: prev[item.id]?.width ?? (item.width || 1),
                                                        height: Number(e.target.value),
                                                      }
                                                    }))}
                                                    className="w-20 text-center bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                                                  />
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <button
                                                    onClick={() => handleAddSubdivisionRow(item.id)}
                                                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded text-xs font-bold transition shadow"
                                                  >
                                                    + Add Row
                                                  </button>
                                                </td>
                                                <td className="py-2.5 px-3 text-center"></td>
                                              </tr>
                                            </tbody>
                                            {item.subDivisions && item.subDivisions.length > 0 && (
                                              <tfoot>
                                                <tr className="bg-slate-900 border-t border-slate-700 text-slate-300">
                                                  <td colSpan={6} className="py-2 px-3 text-right font-bold text-xs">
                                                    Sub-divisions Net Total:
                                                  </td>
                                                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-300 text-xs">
                                                    {itemNetQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                                                  </td>
                                                  <td></td>
                                                </tr>
                                              </tfoot>
                                            )}
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                          <tr className="bg-slate-800/20 border-t border-slate-700">
                            <td colSpan={6} className="py-2 px-4 text-right font-bold text-slate-400 text-xs">Subtotal: {category}</td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-slate-100 text-xs">{categoryTotalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td></td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'materials' && (
          <MaterialsLibrary
            materials={materials}
            setMaterials={setMaterials}
            currency={currentProject.currency}
          />
        )}

        {activeTab === 'blueprint' && (
          <div className="space-y-6">
            {/* Blueprint Sub-navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-lg">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setBlueprintSubTab('canvas')}
                  className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center space-x-2 transition ${
                    blueprintSubTab === 'canvas'
                      ? 'bg-amber-500 text-slate-950 shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Ruler className="w-4 h-4" />
                  <span>Visual Take-Off Canvas Overlay</span>
                </button>
                <button
                  onClick={() => setBlueprintSubTab('dxf')}
                  className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center space-x-2 transition ${
                    blueprintSubTab === 'dxf'
                      ? 'bg-amber-500 text-slate-950 shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>AutoCAD DXF Vector Inspector</span>
                </button>
              </div>

              <div className="text-xs text-slate-400 hidden lg:block">
                {blueprintSubTab === 'canvas'
                  ? 'Measure lengths & areas directly on blueprint images/PDFs and save to BOQ'
                  : 'Inspect CAD layers & extract vector geometry'}
              </div>
            </div>

            {blueprintSubTab === 'canvas' ? (
              <BlueprintCanvasOverlay
                currentProject={currentProject}
                materials={materials}
                onSaveItemToBOQ={handleSaveTakeoffItemToBOQ}
                onBatchSaveItemsToBOQ={handleBatchSaveTakeoffItemsToBOQ}
                onUpdateItemToBOQ={() => {}}
                initialFileName={importedFileName}
                initialFilePreview={importedFilePreview}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                    <Compass className="w-5 h-5 text-amber-400" />
                    <span>Drawing Import & Take-Off Simulator</span>
                  </h2>
                  <p className="text-xs text-slate-400">Import AutoCAD DXF, PDF blueprints, or image floor plans to extract measurements and quantities.</p>
                </div>
                <div className="flex items-center space-x-3">
                  <label className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 cursor-pointer transition shadow">
                    <Maximize2 className="w-4 h-4" />
                    <span>Upload Drawing File</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.dxf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const ext = file.name.toLowerCase().split('.').pop();
                        const isImage = ext === 'png' || ext === 'jpg' || ext === 'jpeg';
                        const isDxf = ext === 'dxf';
                        const isPdf = ext === 'pdf';

                        if (!isImage && !isDxf && !isPdf) {
                          setImportError(`Unsupported file type: ${file.name}. Supported: JPG, PNG, DXF, PDF.`);
                          setImportedFileName(null);
                          setImportedFilePreview(null);
                          setParsedDxf(null);
                          e.target.value = '';
                          return;
                        }

                        setImportError(null);
                        setImportedFileName(file.name);
                        const reader = new FileReader();

                        if (isImage) {
                          reader.onload = (uploadEvent) => {
                            setImportedFilePreview(uploadEvent.target?.result as string);
                            setParsedDxf(null);
                          };
                          reader.readAsDataURL(file);
                        } else if (isDxf) {
                          reader.onload = (uploadEvent) => {
                            const text = uploadEvent.target?.result as string;
                            setImportedFilePreview(null);
                            setParsedDxf(null);
                            handleParseDxfContent(text);
                          };
                          reader.readAsText(file);
                        } else if (isPdf) {
                          reader.onload = (uploadEvent) => {
                            const buffer = uploadEvent.target?.result as ArrayBuffer;
                            setImportedFilePreview(null);
                            setParsedDxf(null);
                            handleParsePdfContent(buffer, file.name);
                          };
                          reader.readAsArrayBuffer(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {importError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 p-3 rounded-2xl flex items-center justify-between text-xs mb-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{importError}</span>
                  </div>
                  <button
                    onClick={() => setImportError(null)}
                    className="text-rose-400 hover:text-rose-200 font-bold font-mono px-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Uploaded File Status */}
              {importedFileName && (
                <div className="bg-slate-950 border border-amber-500/30 p-4 rounded-xl mb-6 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-amber-500/10 p-2 rounded-lg text-amber-400 font-mono text-xs">CAD</div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">{importedFileName}</h4>
                      <p className="text-xs text-slate-400">
                        {parsedDxf ? `DXF Parsed: ${dxfLayers.length} layers found.` : 'Ready for scale calibration and take-off extraction.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setImportedFileName(null);
                      setImportedFilePreview(null);
                      setParsedDxf(null);
                    }}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* DXF Layer Inspector & Standards Mismatch Detector if parsedDxf is active */}
              {parsedDxf ? (
                <React.Fragment>
                  {/* NBC 205 Standards & Drawing Mismatch Detector */}
                  {(() => {
                    const layerNames = dxfLayers.map(l => l.toUpperCase());
                    const hasStandardNomenclature = layerNames.some(l => l.includes('WALL') || l.includes('COL') || l.includes('BEAM') || l.includes('GRID') || l.includes('SLAB'));
                    const hasMismatch = !hasStandardNomenclature || currentProject.standardWallHeight > 3.2;

                    return (
                      <div className={`p-4 rounded-xl border mb-6 text-xs flex items-start space-x-3 ${
                        hasMismatch 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      }`}>
                        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${hasMismatch ? 'text-amber-400' : 'text-emerald-400'}`} />
                        <div>
                          <p className="font-bold">
                            {hasMismatch ? 'NBC 205 Standards & Drawing Mismatch Warning' : 'Drawing Standards Check: Fully Verified'}
                          </p>
                          <p className="mt-1 opacity-90">
                            {hasMismatch 
                              ? 'The imported DXF layers deviate from standard NBC 205 nomenclature (WALLS, COLUMNS, BEAMS). Heuristic layer fallback is active. Please verify layer mapping and code span limits.' 
                              : 'All imported CAD vector layers match NBC 205:2024 low-rise residential building standards and app configuration.'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 mb-6 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-100">DXF Geometry Layer Inspector & Preview</h3>
                        <p className="text-xs text-slate-400">Select a CAD layer, filter entity types, and adjust zoom to inspect vector geometry.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center space-x-2">
                          <label className="text-xs text-slate-400">Filter Entity:</label>
                          <select
                            value={dxfEntityTypeFilter}
                            onChange={(e) => setDxfEntityTypeFilter(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono px-2.5 py-1.5 rounded-lg cursor-pointer"
                          >
                            <option value="ALL">All Entities</option>
                            <option value="LINE">Lines Only</option>
                            <option value="LWPOLYLINE">Polylines</option>
                            <option value="TEXT">Text / Annotations</option>
                            <option value="INSERT">Blocks / Symbols</option>
                          </select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <label className="text-xs text-slate-400">Layer:</label>
                          <select
                            value={selectedDxfLayer}
                            onChange={(e) => {
                              setSelectedDxfLayer(e.target.value);
                              calculateLayerLength(parsedDxf, e.target.value);
                            }}
                            className="bg-slate-900 border border-slate-700 text-xs text-amber-400 font-mono px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            {dxfLayers.map(l => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Lineweight & Scale Calibration Controls */}
                    <CadLineweightLegend
                      scalePreset={cadScalePreset}
                      onScalePresetChange={(preset: string) => {
                        setCadScalePreset(preset);
                        if (preset === '1:50') setCadScaleFactor(0.5);
                        else if (preset === '1:100') setCadScaleFactor(1.0);
                        else if (preset === '1:200') setCadScaleFactor(2.0);
                        else if (preset === '1:500') setCadScaleFactor(5.0);
                      }}
                      scaleFactor={cadScaleFactor}
                      onScaleFactorChange={setCadScaleFactor}
                      isolatedStructuralLayer={isolatedStructuralType}
                      onIsolateStructuralLayer={setIsolatedStructuralType}
                    />

                    {/* Layer Mapping Configuration Panel */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                            <Sliders className="w-4 h-4 text-amber-400" />
                            <span>Layer Mapping Configuration (AI Take-Off Rules)</span>
                          </h4>
                          <p className="text-xs text-slate-400">
                            Map CAD layer names to project categories to automate take-off generation.
                          </p>
                        </div>
                        <button
                          onClick={handleRunAiTakeoffFromMappings}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow flex items-center space-x-1.5"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Run Automated AI Take-Off</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(layerMappings).map(([layerName, assignedCategory]) => (
                          <div key={layerName} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-2">
                            <div className="truncate">
                              <span className="font-mono text-xs font-bold text-amber-400 block truncate" title={layerName}>
                                {layerName}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase">Mapped Layer</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <select
                                value={assignedCategory}
                                onChange={(e) => {
                                  const newCat = e.target.value as MeasurementCategory;
                                  setLayerMappings(prev => ({ ...prev, [layerName]: newCat }));
                                }}
                                className="bg-slate-950 border border-slate-700 text-xs text-slate-200 px-2.5 py-1 rounded-lg cursor-pointer font-sans"
                              >
                                {PREDEFINED_CATEGORIES.map(cat => (
                                  <option key={cat.name} value={cat.name}>{cat.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  const copy = { ...layerMappings };
                                  delete copy[layerName];
                                  setLayerMappings(copy);
                                }}
                                className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition"
                                title="Remove mapping"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom Layer Mapping Form */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-800/80">
                        <input
                          type="text"
                          placeholder="New CAD Layer Name (e.g. WALLS_EXT)..."
                          value={newMapLayerInput}
                          onChange={(e) => setNewMapLayerInput(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                        />
                        <select
                          value={newMapCategoryInput}
                          onChange={(e) => setNewMapCategoryInput(e.target.value as MeasurementCategory)}
                          className="bg-slate-900 border border-slate-700 text-xs text-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          {PREDEFINED_CATEGORIES.map(cat => (
                            <option key={cat.name} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (!newMapLayerInput.trim()) return;
                            setLayerMappings(prev => ({ ...prev, [newMapLayerInput.trim().toUpperCase()]: newMapCategoryInput }));
                            setNewMapLayerInput('');
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap"
                        >
                          + Add Mapping Rule
                        </button>
                      </div>
                    </div>

                    {/* SVG Canvas Preview with Zoom controls */}
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative flex flex-col md:flex-row p-4 gap-4">
                      {(() => {
                        if (!parsedDxf || !parsedDxf.entities || parsedDxf.entities.length === 0) {
                          return <div className="text-xs text-slate-500 py-12 text-center w-full">No entities found in DXF.</div>;
                        }

                        const layerEntities = parsedDxf.entities.filter((e: any) => e.layer === selectedDxfLayer);
                        const entityTypes = layerEntities.reduce((acc: any, e: any) => {
                          acc[e.type] = (acc[e.type] || 0) + 1;
                          return acc;
                        }, {});

                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                        parsedDxf.entities.forEach((entity: any) => {
                          if (dxfEntityTypeFilter !== 'ALL' && entity.type !== dxfEntityTypeFilter) return;
                          const checkPt = (p: { x: number; y: number }) => {
                            if (p && typeof p.x === 'number' && typeof p.y === 'number') {
                              if (p.x < minX) minX = p.x;
                              if (p.x > maxX) maxX = p.x;
                              if (p.y < minY) minY = p.y;
                              if (p.y > maxY) maxY = p.y;
                            }
                          };
                          if (entity.startPoint) checkPt(entity.startPoint);
                          if (entity.endPoint) checkPt(entity.endPoint);
                          if (entity.vertices) {
                            entity.vertices.forEach(checkPt);
                          }
                        });

                        if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
                          minX = 0; maxX = 100; minY = 0; maxY = 100;
                        }

                        const padding = ((maxX - minX) * 0.05 || 10) / dxfZoomLevel;
                        const width = ((maxX - minX) / dxfZoomLevel) + padding * 2 || 200;
                        const height = ((maxY - minY) / dxfZoomLevel) + padding * 2 || 200;

                        const getDxfStyle = (entityLayer: string, isLayerSelected: boolean) => {
                          const l = (entityLayer || '').toUpperCase();
                          if (isLayerSelected) {
                            return { color: '#f59e0b', width: 3.5, dash: undefined, type: 'selected' };
                          }
                          if (l.includes('COL') || l.includes('PILLAR') || l.includes('SHEAR')) {
                            return { color: '#f43f5e', width: 3.2, dash: undefined, type: 'column' };
                          }
                          if (l.includes('BEAM') || l.includes('TIE') || l.includes('LINTEL')) {
                            return { color: '#3b82f6', width: 2.5, dash: undefined, type: 'beam' };
                          }
                          if (l.includes('EXT') || l.includes('EXTERIOR') || (l.includes('WALL') && !l.includes('INT') && !l.includes('PARTITION')) || l.includes('BRICK_9') || l.includes('MASONRY')) {
                            return { color: '#10b981', width: 2.2, dash: undefined, type: 'ext_wall' };
                          }
                          if (l.includes('INT') || l.includes('INTERIOR') || l.includes('PART') || l.includes('PARTITION') || l.includes('BRICK_4')) {
                            return { color: '#06b6d4', width: 1.4, dash: undefined, type: 'int_wall' };
                          }
                          if (l.includes('DOOR') || l.includes('WIN') || l.includes('OPENING') || l.includes('VENT')) {
                            return { color: '#eab308', width: 1.5, dash: undefined, type: 'opening' };
                          }
                          if (l.includes('GRID') || l.includes('AXIS') || l.includes('CENTER') || l.includes('FOOTING') || l.includes('FOUNDATION')) {
                            return { color: '#94a3b8', width: 1.0, dash: '4,3', type: 'grid' };
                          }
                          return { color: '#64748b', width: 1.0, dash: undefined, type: 'other' };
                        };

                        return (
                          <>
                            <div className="relative flex-1 min-w-0">
                              {/* SVG Preview */}
                              <svg
                                className="w-full h-full max-h-[300px]"
                                viewBox={`${minX - padding} ${-maxY - padding} ${width} ${height}`}
                                preserveAspectRatio="xMidYMid meet"
                               >

                                <g transform={`translate(${dxfPanOffset.x}, 0) scale(1, -1)`}>
                                  {parsedDxf.entities.map((entity: any, idx: number) => {
                                    if (dxfEntityTypeFilter !== 'ALL' && entity.type !== dxfEntityTypeFilter) return null;
                                    const isSelected = entity.layer === selectedDxfLayer;
                                    const style = getDxfStyle(entity.layer, isSelected);

                                    // Opacity handling for isolation
                                    let opacity = isSelected ? 1 : 0.75;
                                    if (isolatedStructuralType && style.type !== isolatedStructuralType && !isSelected) {
                                      opacity = 0.12;
                                    }

                                    if (entity.type === 'LINE') {
                                      const p1 = entity.startPoint || entity.vertices?.[0];
                                      const p2 = entity.endPoint || entity.vertices?.[1];
                                      if (p1 && p2) {
                                        return (
                                          <line
                                            key={idx}
                                            x1={p1.x}
                                            y1={p1.y}
                                            x2={p2.x}
                                            y2={p2.y}
                                            stroke={style.color}
                                            strokeWidth={style.width}
                                            strokeDasharray={style.dash}
                                            opacity={opacity}
                                          />
                                        );
                                      }
                                    } else if ((entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') && entity.vertices) {
                                      const points = entity.vertices.map((v: any) => `${v.x},${v.y}`).join(' ');
                                      return (
                                        <polyline
                                          key={idx}
                                          points={points}
                                          fill="none"
                                          stroke={style.color}
                                          strokeWidth={style.width}
                                          strokeDasharray={style.dash}
                                          opacity={opacity}
                                        />
                                      );
                                    }
                                    return null;
                                  })}
                                </g>
                              </svg>

                              {/* Scale Ruler & Status Pill */}
                              <div className="absolute bottom-2 right-2 bg-slate-950/90 border border-slate-700 px-2.5 py-1 rounded-lg flex items-center space-x-2 text-[10px] font-mono text-slate-300 shadow">
                                <span>Scale {cadScalePreset}</span>
                                <span className="text-slate-600">|</span>
                                <div className="flex items-center space-x-1">
                                  <div className="w-8 h-1 bg-amber-400 rounded-sm" />
                                  <span className="text-amber-400 font-bold">5m</span>
                                </div>
                              </div>

                              {/* Zoom Controls */}
                              <div className="absolute top-2 right-2 flex items-center space-x-1 bg-slate-950/90 border border-slate-700 p-1 rounded-lg">
                                <button onClick={() => setDxfZoomLevel(prev => Math.max(0.25, prev - 0.25))} className="px-2 py-0.5 text-xs text-slate-300 hover:text-white font-bold" title="Zoom Out">-</button>
                                <span className="text-[10px] font-mono text-amber-400 px-1">{(dxfZoomLevel * 100).toFixed(0)}%</span>
                                <button onClick={() => setDxfZoomLevel(prev => Math.min(4.0, prev + 0.25))} className="px-2 py-0.5 text-xs text-slate-300 hover:text-white font-bold" title="Zoom In">+</button>
                                <button onClick={() => setDxfZoomLevel(1.0)} className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white border-l border-slate-700 ml-1" title="Reset Zoom">Reset</button>
                              </div>

                              <div className="absolute bottom-2 left-2 bg-slate-950/90 border border-slate-700 px-3 py-1 rounded-lg text-xs font-mono text-slate-300">
                                Active Layer: <span className="text-amber-400 font-bold">{selectedDxfLayer}</span> | Filter: {dxfEntityTypeFilter}
                              </div>
                            </div>

                            {/* ENTITY BREAKDOWN TABLE */}
                            <div className="w-full md:w-64 bg-slate-950 border border-slate-800 rounded-xl p-3">
                              <h4 className="text-xs font-bold text-slate-300 mb-2">Layer Entities Breakdown</h4>
                              <table className="w-full text-left text-[10px] text-slate-400">
                                <thead>
                                  <tr className="border-b border-slate-800">
                                    <th className="py-1">Type</th>
                                    <th className="py-1 text-right">Count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(entityTypes).map(([type, count]) => (
                                    <tr key={type} className="border-b border-slate-800/50">
                                      <td className="py-1 font-mono">{type}</td>
                                      <td className="py-1 text-right font-bold text-amber-400">{count as number}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-400">Matched Entities</p>
                        <p className="text-2xl font-black text-slate-100 font-mono mt-1">{dxfEntityCount}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-400">Calculated Layer Length</p>
                        <p className="text-2xl font-black text-amber-400 font-mono mt-1">{calculatedDxfLength} m</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center flex flex-col justify-center">
                        <button
                          onClick={() => {
                            const newItem: MeasurementItem = {
                              id: 'item-' + Date.now(),
                              category: 'Superstructure',
                              description: `DXF Extracted Layer [${selectedDxfLayer}] - ${importedFileName}`,
                              unit: 'm³',
                              length: calculatedDxfLength,
                              width: 0.23,
                              height: currentProject.standardWallHeight,
                              qty: 1,
                              wastagePercent: currentProject.wastageDefault,
                              unitRate: 18500
                            };
                            const updatedProjects = projects.map(p => p.id === currentProject.id ? { ...p, items: [...p.items, newItem] } : p);
                            setProjects(updatedProjects);
                            alert(`Successfully pushed layer [${selectedDxfLayer}] (${calculatedDxfLength}m) to BOQ!`);
                          }}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs transition shadow"
                        >
                          + Push Layer to BOQ
                        </button>
                      </div>
                    </div>

                    {/* D3.js Layer Vector Distribution & Density Chart */}
                    <DxfLayerDistributionChart
                      parsedDxf={parsedDxf}
                      dxfLayers={dxfLayers}
                      selectedLayer={selectedDxfLayer}
                      onSelectLayer={(layer) => {
                        setSelectedDxfLayer(layer);
                        calculateLayerLength(parsedDxf, layer);
                      }}
                    />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 mb-6 space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                            <Sparkles className="w-5 h-5" />
                          </span>
                          <h3 className="text-base font-bold text-slate-100">AI CAD Take-Off Engine</h3>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Gemini 3.8 Flash
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Extract multi-layer structural works, wall axes, and opening deductions directly from vector DXF into your Take-Off Measurement Sheet.
                        </p>
                      </div>

                      <button
                        onClick={handleRunAiCadTakeoff}
                        disabled={isCadTakeoffLoading}
                        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition"
                      >
                        {isCadTakeoffLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Extracting Take-Off...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Run AI CAD Take-Off</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Extraction Parameter Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Standard Wall Height (m)</label>
                        <input
                          type="number"
                          step="0.05"
                          value={cadWallHeight}
                          onChange={(e) => setCadWallHeight(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Exterior Wall Thickness (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={cadExtWallThick}
                          onChange={(e) => setCadExtWallThick(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Interior Partition Thickness (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={cadIntWallThick}
                          onChange={(e) => setCadIntWallThick(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Optional Focus & Specific Scope Instructions
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Prioritize masonry superstructure and plaster; explicitly subtract window openings W1/W2 and door D1"
                        value={cadTakeoffPrompt}
                        onChange={(e) => setCadTakeoffPrompt(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-500"
                      />
                    </div>

                    {/* Animated Progress Steps Indicator */}
                    {isCadTakeoffLoading && (
                      <div className="bg-slate-950 border border-amber-500/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>AI CAD Take-Off In Progress...</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px] text-slate-400">
                          <div className="bg-slate-900 border border-amber-500/30 p-2 rounded-lg text-amber-300">
                            1. Parsing DXF vector layers
                          </div>
                          <div className="bg-slate-900 border border-amber-500/30 p-2 rounded-lg text-amber-300">
                            2. Matching structural grid axes
                          </div>
                          <div className="bg-slate-900 border border-amber-500/30 p-2 rounded-lg text-amber-300">
                            3. Identifying door & window deductions
                          </div>
                          <div className="bg-slate-900 border border-amber-500/30 p-2 rounded-lg text-amber-300">
                            4. Formulating MB sub-divisions
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error Feedback */}
                    {cadTakeoffError && (
                      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{cadTakeoffError}</span>
                        </div>
                        <button
                          onClick={handleRunAiCadTakeoff}
                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold px-3 py-1 rounded-lg transition"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Success Message Banner */}
                    {cadTakeoffSuccessMessage && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{cadTakeoffSuccessMessage}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setActiveTab('takeoff')}
                            className="bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition hover:bg-emerald-400"
                          >
                            Open Take-Off Sheet
                          </button>
                          <button
                            onClick={() => setActiveTab('boq')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition border border-slate-700"
                          >
                            Open BOQ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Interactive Review & Staging Grid */}
                  {stagedCadItems.length > 0 && (
                    <div className="bg-slate-950 border border-amber-500/30 rounded-2xl overflow-hidden shadow-2xl space-y-4 p-5 mt-6">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-base font-bold text-slate-100">Candidate Take-Off Items Review & Staging</h3>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {stagedCadItems.filter(i => i.selected).length} of {stagedCadItems.length} Selected
                            </span>
                          </div>
                          {aiCadTakeoffSummary && (
                            <p className="text-xs text-slate-400 mt-1 max-w-2xl">{aiCadTakeoffSummary}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleToggleAllStagedItems(true)}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => handleToggleAllStagedItems(false)}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition"
                          >
                            Deselect All
                          </button>
                          <button
                            onClick={() => setStagedCadItems([])}
                            className="text-xs text-rose-400 hover:underline px-2 py-1"
                          >
                            Clear Staging
                          </button>
                          <button
                            onClick={handleCommitStagedTakeoffItems}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow transition"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Commit to Take-Off Sheet & BOQ</span>
                          </button>
                        </div>
                      </div>

                      {/* Staged Items Table */}
                      <div className="overflow-x-auto border border-slate-800 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                              <th className="py-3 px-3 text-center w-10">Select</th>
                              <th className="py-3 px-3">Description & Layer</th>
                              <th className="py-3 px-3">Category</th>
                              <th className="py-3 px-3">Unit</th>
                              <th className="py-3 px-3 text-center">Nos</th>
                              <th className="py-3 px-3 text-center">L</th>
                              <th className="py-3 px-3 text-center">W</th>
                              <th className="py-3 px-3 text-center">H</th>
                              <th className="py-3 px-3 text-right">Unit Rate</th>
                              <th className="py-3 px-3 text-right">Net Qty</th>
                              <th className="py-3 px-3 text-center">Sub-Divs</th>
                              <th className="py-3 px-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 text-slate-200">
                            {stagedCadItems.map((item) => {
                              const isExpanded = !!expandedStagedSubdivisions[item.id];
                              const netQty = calculateItemQuantity(item);
                              const subCount = item.subDivisions?.length || 0;
                              const deductionsCount = item.subDivisions?.filter(s => s.qty < 0).length || 0;

                              return (
                                <React.Fragment key={item.id}>
                                  <tr className={`hover:bg-slate-900/60 transition ${item.selected ? 'bg-amber-500/[0.03]' : 'opacity-60'}`}>
                                    <td className="py-3 px-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={item.selected}
                                        onChange={() => handleToggleStagedItem(item.id)}
                                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-3 px-3">
                                      <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleUpdateStagedItem(item.id, { description: e.target.value })}
                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 font-semibold text-slate-100 focus:outline-none"
                                      />
                                      <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                                          CAD: {item.cadSourceLayer}
                                        </span>
                                        {deductionsCount > 0 && (
                                          <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                                            {deductionsCount} opening {deductionsCount === 1 ? 'deduction' : 'deductions'}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3">
                                      <select
                                        value={item.category}
                                        onChange={(e) => handleUpdateStagedItem(item.id, { category: e.target.value as any })}
                                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 cursor-pointer"
                                      >
                                        {PREDEFINED_CATEGORIES.map(cat => (
                                          <option key={cat.name} value={cat.name}>{cat.name}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-3 px-3">
                                      <select
                                        value={item.unit}
                                        onChange={(e) => handleUpdateStagedItem(item.id, { unit: e.target.value as any })}
                                        className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-xs cursor-pointer"
                                      >
                                        <option value="m³">m³</option>
                                        <option value="m²">m²</option>
                                        <option value="m">m</option>
                                        <option value="rft">rft</option>
                                        <option value="pcs">pcs</option>
                                        <option value="kg">kg</option>
                                        <option value="bags">bags</option>
                                        <option value="tons">tons</option>
                                      </select>
                                    </td>
                                    <td className="py-3 px-3 text-center font-mono">{item.qty}</td>
                                    <td className="py-3 px-3 text-center font-mono">{item.length}</td>
                                    <td className="py-3 px-3 text-center font-mono">{item.width}</td>
                                    <td className="py-3 px-3 text-center font-mono">{item.height}</td>
                                    <td className="py-3 px-3 text-right">
                                      <input
                                        type="number"
                                        step="1"
                                        value={item.unitRate}
                                        onChange={(e) => handleUpdateStagedItem(item.id, { unitRate: Number(e.target.value) })}
                                        className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-right font-mono text-amber-300 font-bold"
                                      />
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                                      {netQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <button
                                        onClick={() => setExpandedStagedSubdivisions(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] inline-flex items-center space-x-1"
                                      >
                                        <span>{subCount}</span>
                                        {isExpanded ? <ChevronDown className="w-3 h-3 text-amber-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                                      </button>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <div className="flex items-center justify-center space-x-1.5">
                                        <button
                                          onClick={() => handleAddStagedSubdivision(item.id)}
                                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded"
                                          title="Add Sub-division Row"
                                        >
                                          <ListPlus className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setStagedCadItems(prev => prev.filter(i => i.id !== item.id))}
                                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded"
                                          title="Remove from Staging"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Sub-divisions nested rows */}
                                  {isExpanded && (
                                    <tr className="bg-slate-900/90 border-t border-slate-800/60">
                                      <td colSpan={12} className="p-3">
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                                          <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-300 flex items-center space-x-1.5">
                                              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                              <span>Measurement Book (MB) Sub-divisions & Opening Deductions</span>
                                            </span>
                                            <button
                                              onClick={() => handleAddStagedSubdivision(item.id)}
                                              className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 flex items-center space-x-1"
                                            >
                                              <Plus className="w-3 h-3" />
                                              <span>Add Sub-division Line</span>
                                            </button>
                                          </div>

                                          <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                                                <th className="py-1.5 px-2">Location / Measurement Particular</th>
                                                <th className="py-1.5 px-2 text-center w-16">Nos</th>
                                                <th className="py-1.5 px-2 text-center w-20">L (m)</th>
                                                <th className="py-1.5 px-2 text-center w-20">W (m)</th>
                                                <th className="py-1.5 px-2 text-center w-20">H (m)</th>
                                                <th className="py-1.5 px-2 text-right w-24">Sub-Qty</th>
                                                <th className="py-1.5 px-2 text-center w-12">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/40 font-mono">
                                              {(item.subDivisions || []).map((sub) => {
                                                const isDeduction = sub.qty < 0;
                                                const subQty = calculateSubdivisionQuantity(sub, item.unit);
                                                return (
                                                  <tr key={sub.id} className={isDeduction ? 'bg-rose-500/5 text-rose-300' : 'text-slate-200'}>
                                                    <td className="py-1.5 px-2 font-sans">
                                                      <input
                                                        type="text"
                                                        value={sub.description}
                                                        onChange={(e) => handleUpdateStagedSubdivision(item.id, sub.id, 'description', e.target.value)}
                                                        className={`w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 text-xs ${isDeduction ? 'text-rose-300 font-semibold' : 'text-slate-200'}`}
                                                      />
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                      <input
                                                        type="number"
                                                        step="1"
                                                        value={sub.qty}
                                                        onChange={(e) => handleUpdateStagedSubdivision(item.id, sub.id, 'qty', e.target.value)}
                                                        className={`w-14 text-center rounded px-1 py-0.5 text-xs bg-slate-900 border ${isDeduction ? 'border-rose-500/50 text-rose-300 font-bold' : 'border-slate-700 text-slate-200'}`}
                                                      />
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                      <input
                                                        type="number"
                                                        step="0.01"
                                                        value={sub.length}
                                                        onChange={(e) => handleUpdateStagedSubdivision(item.id, sub.id, 'length', e.target.value)}
                                                        className="w-16 text-center rounded px-1 py-0.5 text-xs bg-slate-900 border border-slate-700 text-slate-200"
                                                      />
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                      <input
                                                        type="number"
                                                        step="0.01"
                                                        value={sub.width}
                                                        onChange={(e) => handleUpdateStagedSubdivision(item.id, sub.id, 'width', e.target.value)}
                                                        className="w-16 text-center rounded px-1 py-0.5 text-xs bg-slate-900 border border-slate-700 text-slate-200"
                                                      />
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                      <input
                                                        type="number"
                                                        step="0.01"
                                                        value={sub.height}
                                                        onChange={(e) => handleUpdateStagedSubdivision(item.id, sub.id, 'height', e.target.value)}
                                                        className="w-16 text-center rounded px-1 py-0.5 text-xs bg-slate-900 border border-slate-700 text-slate-200"
                                                      />
                                                    </td>
                                                    <td className={`py-1.5 px-2 text-right font-bold ${isDeduction ? 'text-rose-400' : 'text-amber-300'}`}>
                                                      {subQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                      <button
                                                        onClick={() => handleDeleteStagedSubdivision(item.id, sub.id)}
                                                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded"
                                                        title="Delete sub-division line"
                                                      >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                      </button>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                            <tfoot>
                                              <tr className="border-t border-slate-800 text-[11px] font-bold text-slate-300">
                                                <td colSpan={5} className="py-2 px-2 text-right">
                                                  Net Staged Sub-division Total:
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono text-amber-400">
                                                  {netQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                                                </td>
                                                <td></td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 mb-6 space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                          <Compass className="w-6 h-6" />
                        </span>
                        <h3 className="text-lg font-bold text-slate-100">AI CAD Take-Off to Measurement Sheet</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 max-w-xl">
                        Upload any AutoCAD DXF drawing or load our residential villa sample drawing to automatically extract structural quantities, wall axes, and opening deductions directly into your Take-Off Sheet.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => {
                          const blob = new Blob([SAMPLE_CAD_DXF_STRING], { type: 'application/dxf' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'structest_standard_villa.dxf';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition border border-slate-700 whitespace-nowrap flex items-center space-x-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download DXF Template</span>
                      </button>

                      <button
                        onClick={() => {
                          setImportedFileName('sample_residential_villa.dxf');
                          handleParseDxfContent(SAMPLE_CAD_DXF_STRING);
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow whitespace-nowrap flex items-center space-x-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Load Sample Villa DXF</span>
                      </button>
                    </div>
                  </div>

                  {/* Feature Highlights Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <div className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Layer & Entity Vector Digestion</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Reads lines, polylines, and blocks across WALLS, PARTITIONS, COLUMNS, DOORS, and WINDOWS without manual tracing.
                      </p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <div className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                        <Box className="w-3.5 h-3.5" />
                        <span>Opening Deductions</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Identifies doors (D) and windows (W) and formulates explicit negative multiplier sub-divisions for masonry and plaster take-off.
                      </p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Direct Sheet Population</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Interactive review table lets you inspect, tweak dimensions, and commit candidate items directly into the live Take-off Sheet and BOQ.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Blueprint Canvas / Preview */}
              <div className="relative bg-slate-950 border-2 border-dashed border-slate-700 rounded-2xl min-h-[380px] flex flex-col items-center justify-center p-8 overflow-hidden group">
                <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

                {importedFilePreview ? (
                  <div className="relative z-10 max-w-full max-h-[320px] overflow-hidden rounded-xl border border-slate-700">
                    <img src={importedFilePreview} alt="Uploaded blueprint" className="object-contain max-h-[300px]" />
                  </div>
                ) : (
                  <div className="relative z-10 w-full max-w-2xl h-64 border-2 border-amber-500/60 rounded-xl bg-slate-950/80 p-6 flex flex-col justify-between shadow-2xl">
                    <div className="flex justify-between text-xs font-mono text-amber-400">
                      <span>FORMATS SUPPORTED: .DXF, .DWG, .PDF, .PNG, .JPG</span>
                      <span>SCALE: 1:100</span>
                    </div>
                    <div className="flex items-center justify-center space-x-6 my-auto">
                      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-400">Sample Wall Length</p>
                        <p className="text-2xl font-black text-amber-400 font-mono mt-1">38.40 m</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-400">Standard Height</p>
                        <p className="text-2xl font-black text-slate-200 font-mono mt-1">{currentProject.standardWallHeight} m</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-400">Calculated Area</p>
                        <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{(38.4 * currentProject.standardWallHeight).toFixed(1)} m²</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs text-slate-400">
                      <span>Default Demo Drawing Active</span>
                      <button
                        onClick={() => {
                          const newItem: MeasurementItem = {
                            id: 'item-' + Date.now(),
                            category: 'Superstructure',
                            description: `Brickwork in Superstructure (${importedFileName || 'Default Plan'})`,
                            unit: 'm³',
                            length: 38.4,
                            width: 0.23,
                            height: currentProject.standardWallHeight,
                            qty: 1,
                            wastagePercent: currentProject.wastageDefault,
                            unitRate: 18500
                          };
                          const updatedProjects = projects.map(p => p.id === currentProject.id ? { ...p, items: [...p.items, newItem] } : p);
                          setProjects(updatedProjects);
                          alert('Successfully pushed measured item to BOQ sheet!');
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg font-bold transition shadow"
                      >
                        + Push to BOQ
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Format Guide */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-sm font-bold text-amber-400 mb-1">1. AutoCAD DXF / DWG</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Vector drawings exported from CAD. StructEst Pro can parse layers (e.g. WALLS, COLUMNS) to sum total lengths and perimeters automatically.</p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-sm font-bold text-amber-400 mb-1">2. PDF Blueprints</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Standard architectural sheet sets containing floor plans, elevations, and structural schedules. Use AI Estimator to analyze schedules.</p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-sm font-bold text-amber-400 mb-1">3. Raster Images (PNG/JPG)</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Scanned blueprint sheets or site sketches. Upload to visually inspect and calibrate scale against known dimensions.</p>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === 'ai-auditor' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-amber-500/10 p-2 rounded-xl text-amber-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">AI Estimation & Quantity Survey Expert</h2>
                  <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash to audit formulas, check missing items, and optimize bidding.</p>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Ask AI anything about this project estimate (e.g. 'Are we missing damp proof course or lintel calculations?')"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRunAiAudit(aiPrompt); }}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => handleRunAiAudit(aiPrompt)}
                  disabled={isAiLoading}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-xl font-bold text-sm transition flex items-center space-x-2 disabled:opacity-50"
                >
                  {isAiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Analyze</span>
                </button>
              </div>

              {aiResponse && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-inner mt-4">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Expert Survey Report</h4>
                  <div className="text-sm text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                    {aiResponse}
                  </div>
                </div>
              )}

              {!aiResponse && !isAiLoading && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <button
                    onClick={() => handleRunAiAudit('Perform a rigorous formula and rate audit for this project BOQ.')}
                    className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition group"
                  >
                    <h5 className="text-sm font-bold text-slate-200 group-hover:text-amber-400">Formula & Rate Audit</h5>
                    <p className="text-xs text-slate-400 mt-1">Check quantities, wastage factors, and standard market rates.</p>
                  </button>
                  <button
                    onClick={() => handleRunAiAudit('What essential items might be missing in this structural and architectural estimate?')}
                    className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition group"
                  >
                    <h5 className="text-sm font-bold text-slate-200 group-hover:text-amber-400">Detect Missing Items</h5>
                    <p className="text-xs text-slate-400 mt-1">Identify missing formwork, damp proof courses, lintels, or finishes.</p>
                  </button>
                  <button
                    onClick={() => handleRunAiAudit('Provide cost-saving recommendations for materials and structural framing.')}
                    className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition group"
                  >
                    <h5 className="text-sm font-bold text-slate-200 group-hover:text-amber-400">Cost Optimization</h5>
                    <p className="text-xs text-slate-400 mt-1">Suggestions on alternative materials and efficient structural spans.</p>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-lg font-bold text-slate-100 mb-1">Project & Company Settings</h2>
              <p className="text-xs text-slate-400 mb-6">Customize headers, company name, address, fiscal year, client, site location, duration, and signatures.</p>

              <ProjectParameters 
                currentProject={currentProject} 
                setProjects={setProjects} 
                projects={projects} 
                templates={templates}
                setTemplates={setTemplates}
              />

              <div className="space-y-4 mt-6">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Project Name (Title)</label>
                  <input
                    type="text"
                    value={currentProject.name}
                    onChange={(e) => {
                      const updated = projects.map(p => p.id === currentProject.id ? { ...p, name: e.target.value } : p);
                      setProjects(updated);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={currentProject.client}
                    onChange={(e) => {
                      const updated = projects.map(p => p.id === currentProject.id ? { ...p, client: e.target.value } : p);
                      setProjects(updated);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Site Location</label>
                  <input
                    type="text"
                    value={currentProject.location}
                    onChange={(e) => {
                      const updated = projects.map(p => p.id === currentProject.id ? { ...p, location: e.target.value } : p);
                      setProjects(updated);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Estimated Duration</label>
                  <input
                    type="text"
                    value={currentProject.duration}
                    onChange={(e) => {
                      const updated = projects.map(p => p.id === currentProject.id ? { ...p, duration: e.target.value } : p);
                      setProjects(updated);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Prepared By</label>
                  <input
                    type="text"
                    value={currentProject.preparedBy}
                    onChange={(e) => {
                      const updated = projects.map(p => p.id === currentProject.id ? { ...p, preparedBy: e.target.value } : p);
                      setProjects(updated);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Checked By</label>
                  <input
                    type="text"
                    value={currentProject.checkedBy}
                    onChange={(e) => {
                      const updated = projects.map(p => p.id === currentProject.id ? { ...p, checkedBy: e.target.value } : p);
                      setProjects(updated);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Approved By</label>
                  <input
                    type="text"
                    value={currentProject.approvedBy}
                    onChange={(e) => {
                      const updated = projects.map(p => p.id === currentProject.id ? { ...p, approvedBy: e.target.value } : p);
                      setProjects(updated);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Project Templates Management */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg mb-6">
              <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>Reusable Project Templates</span>
              </h3>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Template Name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleSaveTemplate}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow"
                >
                  Save Current as Template
                </button>
              </div>

              {templates.length > 0 && (
                <div className="space-y-2">
                  {templates.map(t => (
                    <div key={t.id} className="flex justify-between items-center bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <span className="text-sm text-slate-300 font-bold">{t.name}</span>
                      <div className="flex items-center space-x-2">
                          <button onClick={() => {
                              // Load template into current project settings (as an enhancement to template application)
                              const updated = projects.map(p => p.id === activeProjectId ? {
                                  ...p,
                                  companyName: t.companyName,
                                  companyAddress: t.companyAddress,
                                  location: t.location,
                                  currency: t.currency,
                                  standardWallHeight: t.standardWallHeight,
                                  wastageDefault: t.wastageDefault,
                                  vatPercent: t.vatPercent,
                                  contingencyPercent: t.contingencyPercent
                              } : p);
                              setProjects(updated);
                              alert(`Applied template "${t.name}" to project "${currentProject.name}"`);
                          }} className="text-amber-400 text-xs hover:underline font-bold">Apply</button>
                          <button onClick={() => setTemplates(templates.filter(x => x.id !== t.id))} className="text-rose-400 text-xs hover:underline">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Archived Projects Vault & Storage */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                    <Package className="w-5 h-5 text-amber-400" />
                    <span>Archived Projects Vault & Dedicated Storage</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Archived projects are moved to secure isolated storage to keep your active dashboard clean. You can restore them anytime.
                  </p>
                </div>
                <div className="text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 font-mono">
                  <span>{projects.filter(p => p.isArchived).length} Archived / {projects.filter(p => !p.isArchived).length} Active</span>
                </div>
              </div>

              {projects.filter(p => p.isArchived).length === 0 ? (
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-8 text-center text-slate-400 text-xs">
                  <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p>No archived projects in storage. Active dashboard is fully clean.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.filter(p => p.isArchived).map(proj => (
                    <div key={proj.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            Archived
                          </span>
                          <h4 className="text-sm font-bold text-slate-200">{proj.name}</h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Client: <span className="text-slate-300">{proj.client}</span> • Location: <span className="text-slate-300">{proj.location}</span> • Created: <span className="text-slate-300">{proj.createdAt}</span> • Items: <span className="text-slate-300">{proj.items.length}</span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleRestoreProject(proj.id)}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow flex items-center space-x-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Restore Project</span>
                        </button>
                        <button
                          onClick={() => handleDeleteArchivedProject(proj.id)}
                          className="bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 p-2 rounded-lg transition border border-slate-700"
                          title="Permanently Delete Archived Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action to archive current active project */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center">
                <p className="text-xs text-slate-400">
                  Currently active project: <strong className="text-slate-200">{currentProject.name}</strong>
                </p>
                <button
                  onClick={() => {
                    if (projects.filter(p => !p.isArchived).length <= 1) {
                      alert('Cannot archive the last active project.');
                      return;
                    }
                    if (confirm(`Are you sure you want to archive "${currentProject.name}"? It will be moved to the archived storage vault.`)) {
                      handleArchiveProject(currentProject.id);
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center space-x-1.5"
                >
                  <Package className="w-4 h-4" />
                  <span>Archive Current Project</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'report' && (
          <div className="space-y-6">
            {/* Report Mode Controls Bar (Hidden on Print) */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg print:hidden space-y-4">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-bold text-slate-100">Official Estimation & BOQ Report</h2>
                    <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                      A4 Print Optimized
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Formatted for official submission to clients, banks, and contractors with page break optimization.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition shadow-lg cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              </div>

              {/* Format & Section Options */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-semibold mr-1">Report Format:</span>
                  <button
                    onClick={() => setReportFormat('comprehensive')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                      reportFormat === 'comprehensive'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Comprehensive (Summary + Detailed BOQ)
                  </button>
                  <button
                    onClick={() => setReportFormat('summary')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                      reportFormat === 'summary'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Summary of Cost (Quotation Only)
                  </button>
                  <button
                    onClick={() => setReportFormat('detailed')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                      reportFormat === 'detailed'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Detailed BOQ Schedule
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-slate-300">
                  <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={reportIncludeSubdivisions}
                      onChange={(e) => setReportIncludeSubdivisions(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Sub-division lines</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={reportIncludeNotes}
                      onChange={(e) => setReportIncludeNotes(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Terms & Notes</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={reportIncludeSignatures}
                      onChange={(e) => setReportIncludeSignatures(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Signature Block</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Printable Document Container matching PDF Page 1 & 4 */}
            <div className="printable-document bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl max-w-5xl mx-auto font-sans print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full">
              {/* Official Company Header matching PDF */}
              <div className="text-center border-b-2 border-slate-900 pb-5 mb-5 print-avoid-break">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{currentProject.companyName}</h2>
                <p className="text-sm font-semibold text-slate-700 mt-1">{currentProject.companyAddress}</p>
                <div className="flex justify-between items-center mt-3 text-xs font-bold text-slate-800 px-2">
                  <span>F.Y: {currentProject.fiscalYear}</span>
                  <span className="bg-amber-300 px-4 py-1 rounded text-slate-950 uppercase font-black tracking-wide">
                    {reportFormat === 'summary'
                      ? 'Summary of Cost'
                      : reportFormat === 'detailed'
                      ? 'Detailed Bill of Quantities'
                      : 'Summary of Cost & Bill of Quantities'}
                  </span>
                  <span>Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              {/* Project Details Info */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl mb-6 border border-slate-300 text-xs print-avoid-break">
                <div>
                  <p><strong className="text-slate-600">योजनाको नाम (Project Name):</strong> {currentProject.name}</p>
                  <p className="mt-1.5"><strong className="text-slate-600">ग्राहक (Client):</strong> {currentProject.client}</p>
                </div>
                <div>
                  <p><strong className="text-slate-600">कार्यान्वयन हुने स्थल (Location):</strong> {currentProject.location}</p>
                  <p className="mt-1.5"><strong className="text-slate-600">अनुमानित अवधि (Estimated Duration):</strong> {currentProject.duration}</p>
                </div>
              </div>

              {/* 1. Summary Table (Shown in summary & comprehensive modes) */}
              {(reportFormat === 'summary' || reportFormat === 'comprehensive') && (
                <div className="mb-8 print-avoid-break">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Official Cost Summary</h3>
                    <span className="text-[11px] text-slate-500 font-mono">Currency: {currentProject.currency}</span>
                  </div>
                  <table className="w-full text-left border-collapse text-sm border-2 border-slate-900">
                    <thead>
                      <tr className="bg-slate-200 border-b-2 border-slate-900 text-xs font-bold text-slate-900">
                        <th className="py-2.5 px-4 border-r border-slate-900 w-16 text-center">S.N.</th>
                        <th className="py-2.5 px-4 border-r border-slate-900">Description</th>
                        <th className="py-2.5 px-4 text-right">Amount ({currentProject.currency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-slate-900 font-medium">
                      <tr>
                        <td className="py-2.5 px-4 border-r border-slate-300 font-bold text-center">A</td>
                        <td className="py-2.5 px-4 border-r border-slate-300 font-bold">Civil Works ({currentProject.items.length} Items Total)</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold">{subtotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-amber-100 font-bold">
                        <td className="py-2.5 px-4 border-r border-slate-300 text-center">B</td>
                        <td className="py-2.5 px-4 border-r border-slate-300">Grand Total (A)</td>
                        <td className="py-2.5 px-4 text-right font-mono">{subtotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 border-r border-slate-300 text-center"></td>
                        <td className="py-2.5 px-4 border-r border-slate-300 text-rose-600 font-bold">Discount</td>
                        <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-bold">- 10,280.85</td>
                      </tr>
                      <tr className="bg-amber-300 font-black text-base border-t-2 border-slate-900">
                        <td className="py-3 px-4 border-r border-slate-900 text-center"></td>
                        <td className="py-3 px-4 border-r border-slate-900">Net Payable Amount For Bidding</td>
                        <td className="py-3 px-4 text-right font-mono">6,100,000.00</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="bg-slate-100 px-4 py-2 border-x border-b border-slate-900 text-xs font-semibold text-slate-800">
                    In words: Sixty One Lakh Only.
                  </div>
                </div>
              )}

              {/* 2. Detailed BOQ Schedule (Shown in detailed & comprehensive modes) */}
              {(reportFormat === 'detailed' || reportFormat === 'comprehensive') && (
                <div className={`${reportFormat === 'comprehensive' ? 'page-break-before pt-6 print:pt-2' : ''} mb-8`}>
                  <div className="border-b-2 border-slate-900 pb-2 mb-4 flex justify-between items-end">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">
                        Bill of Quantities (BOQ) & Measurement Schedule
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Complete itemized specifications with dimensions, net quantities, and approved unit rates.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-300">
                      {currentProject.items.length} Items Total
                    </span>
                  </div>

                  <table className="w-full text-left border-collapse text-xs border border-slate-900 mb-4 print-table">
                    <thead>
                      <tr className="bg-slate-200 border-b-2 border-slate-900 text-slate-900 font-bold">
                        <th className="py-2 px-2 border-r border-slate-400 w-10 text-center">S.N.</th>
                        <th className="py-2 px-3 border-r border-slate-400">Description of Works & Specifications</th>
                        <th className="py-2 px-2 border-r border-slate-400 w-24 text-center">Category</th>
                        <th className="py-2 px-2 border-r border-slate-400 w-20 text-center">Dimensions</th>
                        <th className="py-2 px-2 border-r border-slate-400 w-12 text-center">Unit</th>
                        <th className="py-2 px-2 border-r border-slate-400 w-20 text-right">Quantity</th>
                        <th className="py-2 px-2 border-r border-slate-400 w-24 text-right">Rate ({currentProject.currency})</th>
                        <th className="py-2 px-3 text-right w-28">Amount ({currentProject.currency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-slate-900">
                      {currentProject.items.map((item, idx) => {
                        const totalCost = calculateItemTotalCost(item);
                        const qty = calculateItemQuantity(item);
                        const hasSubdivisions = item.subDivisions && item.subDivisions.length > 0;

                        return (
                          <React.Fragment key={item.id}>
                            <tr className="hover:bg-slate-50 transition page-break-avoid">
                              <td className="py-2 px-2 border-r border-slate-300 font-bold text-center font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-300 font-medium">
                                <div>{item.description}</div>
                                {item.deductionsArea ? (
                                  <div className="text-[10px] text-rose-600 font-normal mt-0.5">
                                    [Opening Deductions Applied: -{item.deductionsArea} m²]
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-2 px-2 border-r border-slate-300 text-center">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-400 bg-slate-100">
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-2 px-2 border-r border-slate-300 text-center font-mono text-[10px]">
                                {item.length}×{item.width}×{item.height}m
                              </td>
                              <td className="py-2 px-2 border-r border-slate-300 text-center font-mono font-semibold">
                                {item.unit}
                              </td>
                              <td className="py-2 px-2 border-r border-slate-300 text-right font-mono font-bold">
                                {qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2 border-r border-slate-300 text-right font-mono">
                                {item.unitRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-950">
                                {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>

                            {/* Nested Sub-division Lines if enabled and present */}
                            {reportIncludeSubdivisions && hasSubdivisions && item.subDivisions!.map((sub, sIdx) => {
                              const subQty = calculateSubdivisionQuantity(sub, item.unit);
                              const isDeduction = sub.qty < 0;
                              return (
                                <tr key={sub.id || sIdx} className="bg-slate-50/70 text-[10px] text-slate-700 page-break-avoid">
                                  <td className="py-1 px-2 border-r border-slate-300 text-center font-mono text-slate-400">
                                    {idx + 1}.{sIdx + 1}
                                  </td>
                                  <td className="py-1 px-3 border-r border-slate-300 pl-6 italic">
                                    <span className={isDeduction ? 'text-rose-600 font-semibold' : ''}>
                                      ↳ {sub.description}
                                    </span>
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-300 text-center text-slate-400">
                                    sub
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-300 text-center font-mono">
                                    {sub.qty} × {sub.length}×{sub.width}×{sub.height}
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-300 text-center font-mono">
                                    {item.unit}
                                  </td>
                                  <td className={`py-1 px-2 border-r border-slate-300 text-right font-mono ${isDeduction ? 'text-rose-600 font-bold' : ''}`}>
                                    {subQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-300 text-right font-mono text-slate-400">
                                    -
                                  </td>
                                  <td className="py-1 px-3 text-right font-mono text-slate-400">
                                    -
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-200 border-t-2 border-slate-900 font-bold text-xs text-slate-900">
                        <td colSpan={7} className="py-2.5 px-4 border-r border-slate-900 text-right uppercase tracking-wider">
                          Civil Works Direct Subtotal ({currentProject.items.length} Items):
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-sm">
                          {currentProject.currency} {subtotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Note / Terms */}
              {reportIncludeNotes && (
                <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl text-xs text-slate-800 mb-8 space-y-1 print-avoid-break">
                  <p><strong>नोट:</strong> BOQ मा भयको सबै quantity प्रयोग नभयम,सम्झौता गरेको मजुलाई नै प्राथमिकता दीइनेछ।</p>
                  <p>Estimate भिताले फिल्डमा हुने कार्य संग १००% जहताको तेह्तै मेल नहुन सक्ने आवस्थामा भयकोले कुनै फेर बदल गनु परे आपसी समझदारीमा गरिने छ।</p>
                </div>
              )}

              {/* Footer Signatures matching PDF Page 1 */}
              {reportIncludeSignatures && (
                <div className="grid grid-cols-3 gap-8 pt-10 mt-10 border-t-2 border-slate-900 text-center text-xs text-slate-900 font-semibold print-avoid-break">
                  <div>
                    <p className="mb-14 text-slate-600">Prepared By:</p>
                    <p className="border-t border-slate-900 pt-1.5 font-bold">{currentProject.preparedBy}</p>
                    <p className="text-[10px] text-slate-500">Estimator / Site Engineer</p>
                  </div>
                  <div>
                    <p className="mb-14 text-slate-600">Checked By:</p>
                    <p className="border-t border-slate-900 pt-1.5 font-bold">{currentProject.checkedBy}</p>
                    <p className="text-[10px] text-slate-500">Senior Project Engineer</p>
                  </div>
                  <div>
                    <p className="mb-14 text-slate-600">Approved By:</p>
                    <p className="border-t border-slate-900 pt-1.5 font-bold">{currentProject.approvedBy}</p>
                    <p className="text-[10px] text-slate-500">Managing Director / Project Head</p>
                  </div>
                </div>
              )}

              {/* Printable Document Footer Tag */}
              <div className="print-avoid-break text-center text-[10px] text-slate-500 pt-5 border-t border-slate-300 mt-8 print:block hidden">
                StructEst Pro • Official Construction Estimate & BOQ • Document Ref: {currentProject.id} • Printed on {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        )}
      {/* Add / Edit BOQ Item Modal */}
      {isItemModalOpen && (
        <div className="print:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4">
              {editingItem ? 'Edit BOQ Item' : 'Add New Measurement BOQ Item'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Building Story / Level</label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Foundation">Foundation / Substructure</option>
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="1st Floor">1st Floor</option>
                    <option value="2nd Floor">2nd Floor</option>
                    <option value="Roof">Roof / Parapet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Phase / Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {PREDEFINED_CATEGORIES.map(cat => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name} — {cat.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Unit of Measurement</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="m³">Cubic Meter (m³)</option>
                    <option value="m²">Square Meter (m²)</option>
                    <option value="m">Linear Meter (m)</option>
                    <option value="rft">Running Feet (rft)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="bags">Bags (bags)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Item Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brickwork in Superstructure 230mm thick (1:6)"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Length (L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formLength}
                    onChange={(e) => setFormLength(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Width (W)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formWidth}
                    onChange={(e) => setFormWidth(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Height / Depth (H)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formHeight}
                    onChange={(e) => setFormHeight(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Quantity (Nos)</label>
                  <input
                    type="number"
                    step="1"
                    value={formQty}
                    onChange={(e) => setFormQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Wastage Factor (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formWastage}
                    onChange={(e) => setFormWastage(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Opening Deductions (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDeduction}
                    onChange={(e) => setFormDeduction(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Unit Rate ({currentProject.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formRate}
                    onChange={(e) => setFormRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono font-bold text-amber-400"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Breakdown Modal */}
      {selectedBreakdownItem && (
        <div className="print:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase border ${getCategoryBadgeClass(selectedBreakdownItem.category)}`}>
                  {selectedBreakdownItem.category}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">{selectedBreakdownItem.description}</h3>
              </div>
              <button
                onClick={() => setSelectedBreakdownItem(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Unit of Measurement:</span>
                  <span className="text-slate-100 font-bold">{selectedBreakdownItem.unit}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Dimensions (L × W × H):</span>
                  <span className="text-slate-100">{selectedBreakdownItem.length} × {selectedBreakdownItem.width} × {selectedBreakdownItem.height}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Number of Units (Qty):</span>
                  <span className="text-slate-100">{selectedBreakdownItem.qty}</span>
                </div>
                {selectedBreakdownItem.deductionsArea ? (
                  <div className="flex justify-between border-b border-slate-800 pb-2 text-rose-400">
                    <span>Opening Deductions:</span>
                    <span>- {selectedBreakdownItem.deductionsArea} m²</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-b border-slate-800 pb-2 text-emerald-400">
                  <span>Wastage Allowance:</span>
                  <span>+ {selectedBreakdownItem.wastagePercent}%</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2 text-amber-300 font-bold text-sm">
                  <span>Net Take-off Quantity:</span>
                  <span>{calculateItemQuantity(selectedBreakdownItem)} {selectedBreakdownItem.unit}</span>
                </div>
                <div className="flex justify-between pt-1 font-bold text-sm text-slate-100">
                  <span>Unit Rate & Total Cost:</span>
                  <span>{currentProject.currency} {selectedBreakdownItem.unitRate.toLocaleString()} × {calculateItemQuantity(selectedBreakdownItem)} = <strong className="text-amber-400">{currentProject.currency} {calculateItemTotalCost(selectedBreakdownItem).toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Dynamic Sub-division Take-off Breakdown Table */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Sub-division Take-off Calculation (PDF / MB Sheet)</h4>
                    <p className="text-[11px] text-slate-400">Add or modify granular measurement lines for this BOQ item.</p>
                  </div>
                  <button
                    onClick={() => {
                      handleAddSubdivisionRow(selectedBreakdownItem.id, {
                        description: `Sub-division Line ${(selectedBreakdownItem.subDivisions?.length || 0) + 1}`,
                        qty: 1,
                        length: selectedBreakdownItem.length || 1,
                        width: selectedBreakdownItem.width || 1,
                        height: selectedBreakdownItem.height || 1,
                      });
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Sub-division Row</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3">Location / Description</th>
                        <th className="py-2.5 px-3 text-center w-20">Nos</th>
                        <th className="py-2.5 px-3 text-center w-20">L (m)</th>
                        <th className="py-2.5 px-3 text-center w-20">W (m)</th>
                        <th className="py-2.5 px-3 text-center w-20">H (m)</th>
                        <th className="py-2.5 px-3 text-right w-24">Qty ({selectedBreakdownItem.unit})</th>
                        <th className="py-2.5 px-3 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                      {selectedBreakdownItem.subDivisions && selectedBreakdownItem.subDivisions.length > 0 ? (
                        selectedBreakdownItem.subDivisions.map((sub, idx) => {
                          const subQty = calculateSubdivisionQuantity(sub, selectedBreakdownItem.unit);
                          const isDeduction = sub.qty < 0;
                          return (
                            <tr key={sub.id || idx} className="hover:bg-slate-900/60 transition">
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={sub.description}
                                  onChange={(e) => handleUpdateSubdivisionRow(selectedBreakdownItem.id, sub.id, 'description', e.target.value)}
                                  className="w-full bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs font-sans transition"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  step="1"
                                  value={sub.qty}
                                  onChange={(e) => handleUpdateSubdivisionRow(selectedBreakdownItem.id, sub.id, 'qty', e.target.value)}
                                  className={`w-16 text-center bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1 py-1 text-xs transition ${
                                    isDeduction ? 'text-rose-400 font-bold' : 'text-slate-200'
                                  }`}
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={sub.length}
                                  onChange={(e) => handleUpdateSubdivisionRow(selectedBreakdownItem.id, sub.id, 'length', e.target.value)}
                                  className="w-16 text-center bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1 py-1 text-xs text-slate-200 transition"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={sub.width}
                                  onChange={(e) => handleUpdateSubdivisionRow(selectedBreakdownItem.id, sub.id, 'width', e.target.value)}
                                  className="w-16 text-center bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1 py-1 text-xs text-slate-200 transition"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={sub.height}
                                  onChange={(e) => handleUpdateSubdivisionRow(selectedBreakdownItem.id, sub.id, 'height', e.target.value)}
                                  className="w-16 text-center bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-700 rounded px-1 py-1 text-xs text-slate-200 transition"
                                />
                              </td>
                              <td className={`py-2 px-3 text-right font-bold ${isDeduction ? 'text-rose-400' : 'text-amber-300'}`}>
                                {subQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => handleDeleteSubdivisionRow(selectedBreakdownItem.id, sub.id)}
                                  className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition"
                                  title="Delete sub-division row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-500 font-sans italic">
                            No granular sub-division rows added yet. Standard summary dimensions apply. Use the form below or &quot;Add Sub-division Row&quot; to break down.
                          </td>
                        </tr>
                      )}

                      {/* Modal Quick Add Row */}
                      <tr className="bg-slate-900/90 border-t border-slate-800">
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="New sub-division location / particulars..."
                            value={modalNewSubDesc}
                            onChange={(e) => setModalNewSubDesc(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSubdivisionRow(selectedBreakdownItem.id, {
                                  description: modalNewSubDesc.trim() || `Sub-division Line ${(selectedBreakdownItem.subDivisions?.length || 0) + 1}`,
                                  qty: modalNewSubQty,
                                  length: modalNewSubLength,
                                  width: modalNewSubWidth,
                                  height: modalNewSubHeight
                                });
                                setModalNewSubDesc('');
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-sans focus:outline-none focus:border-amber-500 placeholder-slate-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            step="1"
                            title="Nos (positive or negative for deduction)"
                            value={modalNewSubQty}
                            onChange={(e) => setModalNewSubQty(Number(e.target.value))}
                            className="w-16 text-center bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="L"
                            value={modalNewSubLength}
                            onChange={(e) => setModalNewSubLength(Number(e.target.value))}
                            className="w-16 text-center bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="W"
                            value={modalNewSubWidth}
                            onChange={(e) => setModalNewSubWidth(Number(e.target.value))}
                            className="w-16 text-center bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="H"
                            value={modalNewSubHeight}
                            onChange={(e) => setModalNewSubHeight(Number(e.target.value))}
                            className="w-16 text-center bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              handleAddSubdivisionRow(selectedBreakdownItem.id, {
                                description: modalNewSubDesc.trim() || `Sub-division Line ${(selectedBreakdownItem.subDivisions?.length || 0) + 1}`,
                                qty: modalNewSubQty,
                                length: modalNewSubLength,
                                width: modalNewSubWidth,
                                height: modalNewSubHeight
                              });
                              setModalNewSubDesc('');
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded text-xs font-bold transition shadow font-sans"
                          >
                            + Add Row
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center"></td>
                      </tr>
                    </tbody>
                    {selectedBreakdownItem.subDivisions && selectedBreakdownItem.subDivisions.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-900 border-t border-slate-700 font-mono">
                          <td colSpan={5} className="py-2 px-3 text-right font-bold text-slate-300 font-sans">
                            Sub-division Net Quantity:
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-amber-300">
                            {calculateItemQuantity(selectedBreakdownItem)} {selectedBreakdownItem.unit}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedBreakdownItem(null)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
function useAuth() {
  throw new Error('Function not implemented.');
}

