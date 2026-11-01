import React from 'react';
import { Building2, FileSpreadsheet, Loader2, TrendingUp, Users, Wrench, ShieldCheck, Cpu, Calculator, FileText, FolderOpen, RefreshCw, Download, Layers } from 'lucide-react';

// Project List Component - Extracted from App.tsx boq tab
// Displays project information and management actions

export interface ProjectListItem {
  id: string | number;
  totalCost: number;
  category: string;
  floor?: string;
}

export interface ProjectListProject {
  id: string | number;
  name: string;
  location: string;
  currency: string;
  items: ProjectListItem[];
}

export interface ProjectListProps {
  currentProject: ProjectListProject;
  projects: ProjectListProject[];
  setProjects: (projects: ProjectListProject[]) => void;
  boqCategoryFilter: string;
  setBoqCategoryFilter: (filter: string) => void;
  activeStoryFilter: string;
  setActiveStoryFilter: (filter: string) => void;
  handleDownloadCsv: () => void;
  showArchivedProjects: boolean;
  setShowArchivedProjects: (show: boolean) => void;
  DEFAULT_CATEGORY_MAPPINGS: Record<string, string>;
}
// Predefined BOQ categories for filtering
const PREDEFINED_CATEGORIES = [
  { name: 'Concrete' },
  { name: 'Formwork' },
  { name: 'Rebar' },
  { name: 'Masonry' },
  { name: 'Finishes' },
  { name: 'Carpentry' },
  { name: 'Waterproofing' },
  { name: 'Steel' },
  { name: 'Plumbing' },
  { name: 'Electrical' },
  { name: 'Painting' },
  { name: 'Other' },
];

export const ProjectList: React.FC<ProjectListProps> = ({
  currentProject,
  projects,
  setProjects,
  boqCategoryFilter,
  setBoqCategoryFilter,
  activeStoryFilter,
  setActiveStoryFilter,
  handleDownloadCsv,
  showArchivedProjects,
  setShowArchivedProjects,
  DEFAULT_CATEGORY_MAPPINGS,
}) => {
  const grandTotal = projects.reduce((sum: number, p) => sum + p.items.reduce((itemSum: number, item) => itemSum + item.totalCost, 0), 0);
  const subtotalCost = currentProject.items.reduce((sum: number, item) => sum + item.totalCost, 0);

  function calculateItemTotalCost(i: ProjectListItem) {
    return i.totalCost;
  }

  return (
    <div>
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
            >
              <Download className="w-3.5 h-3.5 text-amber-400" /> Download CSV
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
              : currentProject.items.filter(i => i.floor === floor).length;
            return (
              <button
                key={floor}
                onClick={() => setActiveStoryFilter(floor)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 ${activeStoryFilter === floor ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                <span>{floor}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeStoryFilter === floor ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
          {activeStoryFilter !== 'All Stories' && (
            <div className="text-xs font-mono text-slate-400 flex items-center space-x-2 shrink-0">
              <span>{activeStoryFilter} Subtotal:</span>
              <span className="text-amber-400 font-bold font-mono">
                {currentProject.currency}{' '}
                {currentProject.items
                  .filter(i => i.floor === activeStoryFilter)
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
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${boqCategoryFilter === 'All' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'}`}
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${boqCategoryFilter === cat.name ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'}`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};