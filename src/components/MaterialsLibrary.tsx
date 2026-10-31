import React, { useState, useRef, useMemo } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit3,
  Search,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  FileText,
  Layers,
  ArrowRight,
  Sparkles,
  CheckSquare,
  Square
} from 'lucide-react';
import { MaterialRate } from '../App';

export interface MaterialsLibraryProps {
  materials: MaterialRate[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialRate[]>>;
  currency?: string;
}

const MATERIAL_CATEGORIES = [
  'All',
  'Cement & Concrete',
  'Steel & Rebar',
  'Bricks & Masonry',
  'Aggregates & Sand',
  'Formwork & Timber',
  'Finishing & Tiles',
  'Finishing & Paints',
  'Plumbing & MEP',
  'Labor'
];

// Sample CSV template content with standard construction items
const SAMPLE_CSV_CONTENT = `Name,Category,Unit,Rate,Supplier,Specification
"OPC 53 Grade Cement (50kg bag)","Cement & Concrete","bags",850,"Shivam / UltraTech Cement","IS 12269 certified, 53 grade high early strength"
"PPC Cement (50kg bag)","Cement & Concrete","bags",750,"Jagdamba / Agni Cement","Flyash based Portland Pozzolana Cement"
"TMT Fe 500D Rebar (12mm/16mm)","Steel & Rebar","kg",108,"Tata Tiscon / Jagdamba","High ductile earthquake resistant grade"
"Structural Steel Sections (ISMB/Angles)","Steel & Rebar","kg",115,"Jindal / Panchakanya","Standard structural framing sections"
"Machine-Made First Class Red Bricks","Bricks & Masonry","pcs",20,"Standard Kiln Rupandehi","Compressive strength > 10.5 N/mm²"
"AAC Lightweight Blocks (600x200x150mm)","Bricks & Masonry","pcs",95,"Siporex / Magicrete","Density 550-650 kg/m³, dry laying"
"Coarse Riverbed Sand (Zone II)","Aggregates & Sand","m³",3200,"Tinau / Rapti River Quarry","Washed river sand, silt content < 3%"
"Crushed Blue Stone Aggregate (20mm)","Aggregates & Sand","m³",2800,"Butwal Stone Crushers","Clean angular basalt graded aggregate"
"River Boulder / Stone Soling (150mm)","Aggregates & Sand","m³",1800,"Local Quarry Bed","Clean solid boulder for foundation bed"
"Design Mix Concrete M25","Cement & Concrete","m³",12500,"RMC Plant Batching","Design 28-day characteristic strength 25 N/mm²"
"Plain Cement Concrete M15","Cement & Concrete","m³",9500,"Site Mixed Batcher","For foundation bedding and soling cap"
"Phenolic Film-Faced Shuttering Ply 12mm","Formwork & Timber","m²",650,"Kitply / CenturyPly","BWP Marine grade 10-cycle reusable ply"
"Vitrified Floor Tiles (600x600mm)","Finishing & Tiles","m²",1450,"Kajaria / Somany","Double charged polished vitrified tiles"
"Anti-Skid Ceramic Bathroom Tiles","Finishing & Tiles","m²",1100,"Somany / Johnson","Matte textured slip-resistant tiles"
"Exterior Weathercoat Acrylic Paint","Finishing & Paints","liter",750,"Asian Paints Apex","100% acrylic UV resistant exterior coating"
"Interior Acrylic Emulsion Paint","Finishing & Paints","liter",680,"Asian Paints Royale","Low VOC washable luxury emulsion"
"Wall Putty & Primer Polymer Base","Finishing & Paints","kg",65,"Birla White / Asian Paints","White cement based water resistant putty"
"Class A Skilled Mason / Bar Bender","Labor","day",1600,"Direct Subcontract","Licensed tradesman 8-hour shift"
"Site Helper / Unskilled Labor","Labor","day",1100,"Daily Wage Pool","Material shifting, concrete mixing & curing"
"Licensed Master Electrician","Labor","day",1800,"MEP Contractor","Concealed conduit and wiring layout"`;

// RFC 4180 compliant CSV line tokenizer
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Clean and convert string to valid numeric rate
function sanitizeRate(value: string): number {
  if (!value) return 0;
  // Remove currency symbols, commas, spaces
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

interface ParsedCandidateItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  rate: number;
  supplier: string;
  spec: string;
  selected: boolean;
  isExisting: boolean;
  existingId?: string;
  existingRate?: number;
}

export const MaterialsLibrary: React.FC<MaterialsLibraryProps> = ({
  materials,
  setMaterials,
  currency = 'NPR'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Single Add / Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialRate | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Cement & Concrete');
  const [formUnit, setFormUnit] = useState('bags');
  const [formRate, setFormRate] = useState<number>(850);
  const [formSupplier, setFormSupplier] = useState('');
  const [formSpec, setFormSpec] = useState('');

  // Bulk Import Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [parsedCandidates, setParsedCandidates] = useState<ParsedCandidateItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'append' | 'replace'>('merge');
  const [pastedCsvText, setPastedCsvText] = useState('');
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.supplier && item.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.spec && item.spec.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [materials, searchTerm, selectedCategory]);

  // Total summary statistics
  const totalValue = useMemo(() => {
    return materials.reduce((acc, m) => acc + (m.rate || 0), 0);
  }, [materials]);

  // Trigger Sample CSV Download
  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'structest_material_rates_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({
      type: 'success',
      message: 'Sample CSV template downloaded! You can fill in your custom rates and re-upload.'
    });
  };

  // Export current active materials library to CSV
  const handleExportCurrentLibrary = () => {
    if (materials.length === 0) {
      alert('The material library is currently empty.');
      return;
    }

    const headers = ['Name', 'Category', 'Unit', 'Rate', 'Supplier', 'Specification'];
    const rows = materials.map(m => [
      `"${(m.name || '').replace(/"/g, '""')}"`,
      `"${(m.category || '').replace(/"/g, '""')}"`,
      `"${(m.unit || '').replace(/"/g, '""')}"`,
      m.rate ?? 0,
      `"${(m.supplier || '').replace(/"/g, '""')}"`,
      `"${(m.spec || '').replace(/"/g, '""')}"`
    ]);

    const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `material_rates_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({
      type: 'success',
      message: `Exported ${materials.length} material rates to CSV.`
    });
  };

  // CSV Parser Engine
  const parseCsvData = (csvText: string) => {
    const cleanText = csvText.trim();
    if (!cleanText) {
      setParseErrors(['CSV file or text is empty.']);
      setParsedCandidates([]);
      return;
    }

    const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      setParseErrors(['CSV must contain a header row and at least one data row.']);
      setParsedCandidates([]);
      return;
    }

    // Parse header
    const rawHeader = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Map column indices
    let nameIdx = rawHeader.findIndex(h => h === 'name' || h === 'material' || h === 'item' || h === 'materialname' || h === 'title');
    let catIdx = rawHeader.findIndex(h => h === 'category' || h === 'cat' || h === 'group' || h === 'type');
    let unitIdx = rawHeader.findIndex(h => h === 'unit' || h === 'uom' || h === 'units' || h === 'measurementunit');
    let rateIdx = rawHeader.findIndex(h => h === 'rate' || h === 'unitrate' || h === 'price' || h === 'unitprice' || h === 'cost');
    let supplierIdx = rawHeader.findIndex(h => h === 'supplier' || h === 'vendor' || h === 'brand' || h === 'source');
    let specIdx = rawHeader.findIndex(h => h === 'specification' || h === 'spec' || h === 'specs' || h === 'description' || h === 'notes');

    // Default column fallback if headers not recognized
    if (nameIdx === -1 && lines[0].length > 0) nameIdx = 0;
    if (catIdx === -1 && rawHeader.length > 1) catIdx = 1;
    if (unitIdx === -1 && rawHeader.length > 2) unitIdx = 2;
    if (rateIdx === -1 && rawHeader.length > 3) rateIdx = 3;
    if (supplierIdx === -1 && rawHeader.length > 4) supplierIdx = 4;
    if (specIdx === -1 && rawHeader.length > 5) specIdx = 5;

    const candidates: ParsedCandidateItem[] = [];
    const errors: string[] = [];

    // Map existing materials by lowercase normalized name for duplicate checking
    const existingMap = new Map<string, MaterialRate>();
    materials.forEach(m => {
      existingMap.set(m.name.trim().toLowerCase(), m);
    });

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = parseCsvLine(line);
      if (cols.length === 0 || cols.every(c => c === '')) continue;

      const rawName = (cols[nameIdx] || '').trim();
      if (!rawName) {
        errors.push(`Row ${i + 1}: Skipped because material name is blank.`);
        continue;
      }

      const rawRate = cols[rateIdx] !== undefined ? sanitizeRate(cols[rateIdx]) : 0;
      const rawCategory = (cols[catIdx] || 'Cement & Concrete').trim();
      const rawUnit = (cols[unitIdx] || 'pcs').trim();
      const rawSupplier = supplierIdx !== -1 && cols[supplierIdx] ? cols[supplierIdx].trim() : '';
      const rawSpec = specIdx !== -1 && cols[specIdx] ? cols[specIdx].trim() : '';

      const matchedExisting = existingMap.get(rawName.toLowerCase());

      candidates.push({
        id: `imported-${Date.now()}-${i}`,
        name: rawName,
        category: rawCategory || 'General Civil',
        unit: rawUnit || 'pcs',
        rate: rawRate,
        supplier: rawSupplier,
        spec: rawSpec,
        selected: true,
        isExisting: !!matchedExisting,
        existingId: matchedExisting?.id,
        existingRate: matchedExisting?.rate
      });
    }

    setParsedCandidates(candidates);
    setParseErrors(errors);
    setIsBulkModalOpen(true);
  };

  // Handle file input upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseCsvData(text);
      }
    };
    reader.readAsText(file);
    // Reset file input so user can re-upload same file if desired
    e.target.value = '';
  };

  // Commit parsed items to state
  const handleCommitBulkImport = () => {
    const selectedItems = parsedCandidates.filter(c => c.selected);
    if (selectedItems.length === 0) {
      alert('Please select at least one material rate to import.');
      return;
    }

    let updatedList: MaterialRate[] = [];
    let updatedCount = 0;
    let addedCount = 0;

    if (importMode === 'replace') {
      if (!confirm(`Warning: Replace mode will overwrite your entire existing library with the ${selectedItems.length} selected materials. Continue?`)) {
        return;
      }
      updatedList = selectedItems.map((item, idx) => ({
        id: `mat-${Date.now()}-${idx}`,
        name: item.name,
        category: item.category,
        unit: item.unit,
        rate: item.rate,
        supplier: item.supplier,
        spec: item.spec
      }));
      addedCount = selectedItems.length;
    } else if (importMode === 'append') {
      // Append all as brand new entries
      const newEntries: MaterialRate[] = selectedItems.map((item, idx) => ({
        id: `mat-${Date.now()}-${idx}`,
        name: item.name,
        category: item.category,
        unit: item.unit,
        rate: item.rate,
        supplier: item.supplier,
        spec: item.spec
      }));
      updatedList = [...materials, ...newEntries];
      addedCount = newEntries.length;
    } else {
      // 'merge' (default): Update existing if matched, append if new
      const listCopy = [...materials];
      const existingNameMap = new Map<string, number>();
      listCopy.forEach((m, idx) => {
        existingNameMap.set(m.name.trim().toLowerCase(), idx);
      });

      selectedItems.forEach(item => {
        const normName = item.name.trim().toLowerCase();
        if (existingNameMap.has(normName)) {
          const idx = existingNameMap.get(normName)!;
          listCopy[idx] = {
            ...listCopy[idx],
            rate: item.rate,
            unit: item.unit || listCopy[idx].unit,
            category: item.category || listCopy[idx].category,
            supplier: item.supplier || listCopy[idx].supplier,
            spec: item.spec || listCopy[idx].spec
          };
          updatedCount++;
        } else {
          listCopy.push({
            id: `mat-${Date.now()}-${listCopy.length}`,
            name: item.name,
            category: item.category,
            unit: item.unit,
            rate: item.rate,
            supplier: item.supplier,
            spec: item.spec
          });
          addedCount++;
        }
      });
      updatedList = listCopy;
    }

    setMaterials(updatedList);
    setIsBulkModalOpen(false);
    setParsedCandidates([]);
    setPastedCsvText('');
    setIsPasteMode(false);

    setNotification({
      type: 'success',
      message: `Bulk import complete! ${updatedCount > 0 ? `${updatedCount} updated, ` : ''}${addedCount} newly added to the master rate library.`
    });
  };

  // Toggle selection for candidates
  const handleToggleSelectAll = (select: boolean) => {
    setParsedCandidates(prev => prev.map(c => ({ ...c, selected: select })));
  };

  // Open single add/edit modal
  const handleOpenEdit = (item?: MaterialRate) => {
    if (item) {
      setEditingItem(item);
      setFormName(item.name);
      setFormCategory(item.category || 'Cement & Concrete');
      setFormUnit(item.unit || 'pcs');
      setFormRate(item.rate || 0);
      setFormSupplier(item.supplier || '');
      setFormSpec(item.spec || '');
    } else {
      setEditingItem(null);
      setFormName('');
      setFormCategory('Cement & Concrete');
      setFormUnit('pcs');
      setFormRate(100);
      setFormSupplier('');
      setFormSpec('');
    }
    setIsEditModalOpen(true);
  };

  // Save single item
  const handleSaveSingleItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Material name is required.');
      return;
    }

    if (editingItem) {
      // Update
      setMaterials(materials.map(m => m.id === editingItem.id ? {
        ...m,
        name: formName.trim(),
        category: formCategory,
        unit: formUnit.trim(),
        rate: Number(formRate) || 0,
        supplier: formSupplier.trim(),
        spec: formSpec.trim()
      } : m));
      setNotification({
        type: 'success',
        message: `Updated rate for "${formName}".`
      });
    } else {
      // Add new
      const newItem: MaterialRate = {
        id: `mat-${Date.now()}`,
        name: formName.trim(),
        category: formCategory,
        unit: formUnit.trim(),
        rate: Number(formRate) || 0,
        supplier: formSupplier.trim(),
        spec: formSpec.trim()
      };
      setMaterials([...materials, newItem]);
      setNotification({
        type: 'success',
        message: `Added "${formName}" to materials library.`
      });
    }
    setIsEditModalOpen(false);
  };

  // Delete item
  const handleDeleteItem = (item: MaterialRate) => {
    if (confirm(`Are you sure you want to delete "${item.name}" from the rate library?`)) {
      setMaterials(materials.filter(m => m.id !== item.id));
      setNotification({
        type: 'success',
        message: `Deleted "${item.name}".`
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs transition shadow-lg ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header Card with CSV Actions */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <FileSpreadsheet className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Master Material & Rate Library</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Standardized material unit rates, specifications, and suppliers for BOQ estimation and automated rate analysis.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Template, Bulk Import, Export, Add */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Generate & Download Sample CSV Template */}
            <button
              onClick={handleDownloadSampleCsv}
              className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 hover:border-amber-500/50 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow"
              title="Download pre-formatted CSV template with standard civil, structural, and finishing items"
            >
              <Download className="w-4 h-4" />
              <span>Sample CSV Template</span>
            </button>

            {/* Bulk Import CSV File */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow"
              title="Upload CSV to update or add material rates in bulk"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Bulk Import CSV</span>
            </button>

            {/* Paste CSV button */}
            <button
              onClick={() => {
                setIsPasteMode(true);
                setIsBulkModalOpen(true);
                setParsedCandidates([]);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition flex items-center space-x-1.5"
              title="Paste raw CSV text directly"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Paste CSV</span>
            </button>

            {/* Export Current Library */}
            <button
              onClick={handleExportCurrentLibrary}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition flex items-center space-x-1.5"
              title="Export all current rates to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export CSV</span>
            </button>

            {/* Add Material Single */}
            <button
              onClick={() => handleOpenEdit()}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
            </button>
          </div>
        </div>

        {/* Search, Category Filter & Stats Bar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search materials, brand, or specs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {MATERIAL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <div>
              Total Items: <span className="text-slate-200 font-bold font-mono">{materials.length}</span>
            </div>
            <div>
              Showing: <span className="text-amber-400 font-bold font-mono">{filteredMaterials.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Material / Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4 text-right">Unit Rate ({currency})</th>
                <th className="py-3 px-4">Brand / Supplier</th>
                <th className="py-3 px-4">Specification</th>
                <th className="py-3 px-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 space-y-2">
                    <p className="text-sm">No material rates found matching your criteria.</p>
                    <p className="text-xs text-slate-600">
                      Click <strong className="text-amber-400">"Sample CSV Template"</strong> above to download a pre-filled template and import in bulk!
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMaterials.map(mat => (
                  <tr key={mat.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-slate-100">
                      {mat.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] bg-slate-800 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded-md font-medium whitespace-nowrap">
                        {mat.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">
                      per {mat.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {mat.rate?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-xs">
                      {mat.supplier || <span className="text-slate-600 italic">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs max-w-xs truncate" title={mat.spec}>
                      {mat.spec || <span className="text-slate-600 italic">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(mat)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded transition"
                          title="Edit Rate & Specification"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(mat)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition"
                          title="Delete Material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Bulk Import Modal & Candidate Review */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Bulk Import Material Rates (CSV)</h3>
                  <p className="text-xs text-slate-400">
                    Review parsed rates, configure merge options, and commit updates to your master library.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setIsPasteMode(false);
                  setParsedCandidates([]);
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* If Paste Mode is Active */}
              {isPasteMode && (
                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-slate-200">
                      Paste CSV Content (Comma or Tab Separated):
                    </label>
                    <button
                      onClick={() => setPastedCsvText(SAMPLE_CSV_CONTENT)}
                      className="text-amber-400 hover:underline text-[11px] font-medium"
                    >
                      Paste Sample Construction Rates
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={pastedCsvText}
                    onChange={(e) => setPastedCsvText(e.target.value)}
                    placeholder="Name,Category,Unit,Rate,Supplier,Specification&#10;OPC Cement 53 Grade,Cement & Concrete,bags,850,Shivam Cement,50kg bag&#10;TMT Rebar 12mm,Steel & Rebar,kg,108,Tata Tiscon,Fe500D"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setIsPasteMode(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Back to File Upload
                    </button>
                    <button
                      onClick={() => {
                        parseCsvData(pastedCsvText);
                        setIsPasteMode(false);
                      }}
                      disabled={!pastedCsvText.trim()}
                      className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50"
                    >
                      Parse CSV Text
                    </button>
                  </div>
                </div>
              )}

              {/* Parsing Errors Banner */}
              {parseErrors.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl space-y-1">
                  <p className="font-bold flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Parser Warnings ({parseErrors.length})</span>
                  </p>
                  <ul className="list-disc list-inside text-[11px] opacity-90 pl-1">
                    {parseErrors.slice(0, 3).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {parseErrors.length > 3 && (
                      <li>...and {parseErrors.length - 3} more minor warnings</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Parsed Summary Stats */}
              {parsedCandidates.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                      <p className="text-slate-400">Total Valid Detected</p>
                      <p className="text-xl font-bold font-mono text-slate-100 mt-1">
                        {parsedCandidates.length} Items
                      </p>
                    </div>
                    <div className="bg-slate-950 border border-amber-500/30 p-3.5 rounded-xl">
                      <p className="text-slate-400">Matches Existing (Updates)</p>
                      <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                        {parsedCandidates.filter(c => c.isExisting).length} Items
                      </p>
                    </div>
                    <div className="bg-slate-950 border border-emerald-500/30 p-3.5 rounded-xl">
                      <p className="text-slate-400">New Items to Add</p>
                      <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                        {parsedCandidates.filter(c => !c.isExisting).length} Items
                      </p>
                    </div>
                  </div>

                  {/* Import Mode Selector */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                    <label className="font-bold text-slate-200 block">Select Import Strategy:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                        importMode === 'merge'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'merge'}
                            onChange={() => setImportMode('merge')}
                            className="text-amber-500 focus:ring-amber-500"
                          />
                          <span className="font-bold text-slate-200">Merge & Update (Recommended)</span>
                        </div>
                        <p className="text-[11px] mt-1 opacity-80 pl-6">
                          Updates unit rate for existing names, and appends all new items.
                        </p>
                      </label>

                      <label className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                        importMode === 'append'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'append'}
                            onChange={() => setImportMode('append')}
                            className="text-amber-500 focus:ring-amber-500"
                          />
                          <span className="font-bold text-slate-200">Append Only</span>
                        </div>
                        <p className="text-[11px] mt-1 opacity-80 pl-6">
                          Keeps all existing materials and creates new entries for all imported items.
                        </p>
                      </label>

                      <label className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                        importMode === 'replace'
                          ? 'bg-rose-500/10 border-rose-500 text-rose-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                            className="text-rose-500 focus:ring-rose-500"
                          />
                          <span className="font-bold text-slate-200">Replace All</span>
                        </div>
                        <p className="text-[11px] mt-1 opacity-80 pl-6">
                          Clears entire existing library and sets only the imported items.
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* Candidate Table Preview */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-300">
                        Item Preview ({parsedCandidates.filter(c => c.selected).length} selected for commit)
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleSelectAll(true)}
                          className="text-amber-400 hover:underline text-[11px]"
                        >
                          Select All
                        </button>
                        <span className="text-slate-600">•</span>
                        <button
                          onClick={() => handleToggleSelectAll(false)}
                          className="text-slate-400 hover:underline text-[11px]"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                            <th className="py-2.5 px-3 text-center w-8">Include</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Material Name</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3">Unit</th>
                            <th className="py-2.5 px-3 text-right">New Rate</th>
                            <th className="py-2.5 px-3">Supplier / Spec</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                          {parsedCandidates.map((candidate, idx) => (
                            <tr
                              key={candidate.id}
                              className={`hover:bg-slate-800/40 transition ${!candidate.selected ? 'opacity-40' : ''}`}
                            >
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={candidate.selected}
                                  onChange={() => {
                                    setParsedCandidates(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
                                  }}
                                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {candidate.isExisting ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Update (was {candidate.existingRate})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    New Item
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-sans font-medium text-slate-100">
                                {candidate.name}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-400">
                                {candidate.category}
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {candidate.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-amber-400">
                                {candidate.rate.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-400 truncate max-w-xs" title={`${candidate.supplier} - ${candidate.spec}`}>
                                {candidate.supplier || candidate.spec || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-slate-400">
                {parsedCandidates.length > 0 && (
                  <span>
                    Ready to commit <strong className="text-amber-400">{parsedCandidates.filter(c => c.selected).length}</strong> rates to library.
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setIsBulkModalOpen(false);
                    setIsPasteMode(false);
                    setParsedCandidates([]);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                {parsedCandidates.length > 0 && (
                  <button
                    onClick={handleCommitBulkImport}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2 rounded-xl text-xs font-bold transition shadow flex items-center space-x-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Update Rates</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Add / Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>{editingItem ? 'Edit Material Rate' : 'Add New Material Rate'}</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleItem} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Material / Item Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. OPC 53 Grade Cement (50kg bag)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {MATERIAL_CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="bags, kg, m³, pcs, m², liter"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Unit Rate ({currency}) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formRate}
                  onChange={(e) => setFormRate(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-amber-400 font-bold font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Brand / Supplier (Optional)</label>
                <input
                  type="text"
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  placeholder="e.g. Shivam / UltraTech, Tata Tiscon"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Technical Specification (Optional)</label>
                <input
                  type="text"
                  value={formSpec}
                  onChange={(e) => setFormSpec(e.target.value)}
                  placeholder="e.g. IS 12269 certified, 28-day target strength"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2 rounded-xl text-xs font-bold transition shadow"
                >
                  {editingItem ? 'Save Changes' : 'Add Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
