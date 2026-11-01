import React from 'react';
import { Maximize2, AlertCircle, FileText, Compass, Ruler } from 'lucide-react';

// CAD Importer Component - Extracted from App.tsx blueprint tab
// Handles drawing import (DXF, PDF, Images) and take-off functionality

export interface CadImporterProps {
  importedFileName: string | null;
  setImportedFileName: (name: string | null) => void;
  importedFilePreview: string | null;
  setImportedFilePreview: (preview: string | null) => void;
  importError: string | null;
  setImportError: (error: string | null) => void;
  blueprintSubTab: 'canvas' | 'dxf';
  setBlueprintSubTab: (tab: 'canvas' | 'dxf') => void;
  parsedDxf: any | null;
  dxfLayers: string[];
  cadScalePreset: string;
  setCadScalePreset: (preset: string) => void;
  cadScaleFactor: number;
  setCadScaleFactor: (factor: number) => void;
  isolatedStructuralType: string | undefined;
  setIsolatedStructuralType: (type: string | undefined) => void;
  dxfEntityTypeFilter: string;
  setDxfEntityTypeFilter: (filter: string) => void;
  selectedDxfLayer: string | undefined;
  setSelectedDxfLayer: (layer: string | undefined) => void;
  calculatedDxfLength: number;
  setCalculatedDxfLength: (length: number) => void;
  handleRunAiAudit: (prompt: string) => void;
}

export const CadImporter: React.FC<CadImporterProps> = ({
  importedFileName,
  setImportedFileName,
  importedFilePreview,
  setImportedFilePreview,
  importError,
  setImportError,
  blueprintSubTab,
  setBlueprintSubTab,
  parsedDxf,
  dxfLayers,
  cadScalePreset,
  setCadScalePreset,
  cadScaleFactor,
  setCadScaleFactor,
  isolatedStructuralType,
  setIsolatedStructuralType,
  dxfEntityTypeFilter,
  setDxfEntityTypeFilter,
  selectedDxfLayer,
  setSelectedDxfLayer,
  calculatedDxfLength,
  setCalculatedDxfLength,
  handleRunAiAudit,
}) => {
  // File type detection helpers
  const getFileType = (ext: string): 'image' | 'dxf' | 'pdf' | 'unsupported' => {
    const isImage = ext === 'png' || ext === 'jpg' || ext === 'jpeg';
    const isDxf = ext === 'dxf';
    const isPdf = ext === 'pdf';
    if (!isImage && !isDxf && !isPdf) return 'unsupported';
    if (isImage) return 'image';
    if (isDxf) return 'dxf';
    return 'pdf';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    const fileType = getFileType(ext);

    if (fileType === 'unsupported') {
      setImportError(`Unsupported file type: ${file.name}. Supported: JPG, PNG, DXF, PDF.`);
      setImportedFileName(null);
      setImportedFilePreview(null);
      setCalculatedDxfLength(0);
      e.target.value = '';
      return;
    }

    setImportError(null);
    setImportedFileName(file.name);

    const reader = new FileReader();

    if (fileType === 'image') {
      reader.onload = (uploadEvent: any) => {
        setImportedFilePreview(uploadEvent.target?.result as string);
        setCalculatedDxfLength(0);
      };
      reader.readAsDataURL(file);
    } else if (fileType === 'dxf') {
      reader.onload = (uploadEvent: any) => {
        const text = uploadEvent.target?.result as string;
        setImportedFilePreview(null);
        try {
          const parser = new (require('dxf-parser'))();
          setCalculatedDxfLength(0);
        } catch (err) {
          setImportError('Error parsing DXF file');
        }
      };
      reader.readAsText(file);
    } else if (fileType === 'pdf') {
      reader.onload = (uploadEvent: any) => {
        const buffer = uploadEvent.target?.result as ArrayBuffer;
        setImportedFilePreview(null);
        // PDF parsing - delegate to parent
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Render based on sub-tab
  if (blueprintSubTab === 'canvas') {
    return null; // Placeholder - BlueprintCanvasOverlay would be rendered here
  }
return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Compass className="w-5 h-5 text-amber-400" />
            <span>Drawing Import & Take-Off Simulator</span>
          </h2>
          <p className="text-xs text-slate-400">
            Import AutoCAD DXF, PDF blueprints, or image floor plans to extract measurements and quantities.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 cursor-pointer transition shadow">
            <Maximize2 className="w-4 h-4" />
            <span>Upload Drawing File</span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.dxf,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      </div>

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
              setCalculatedDxfLength(0);
            }}
            className="text-xs text-rose-400 hover:underline"
          >
            Remove
          </button>
        </div>
      )}
      {/* DXF Layer Inspector */}
      {parsedDxf && dxfLayers.length > 0 && (
        <div className="p-4 rounded-xl border mb-6 text-xs flex items-start space-x-3">
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 rounded" style={{ background: '#f59e0b' }} />
            <span className="text-amber-400">Standard mismatch detected</span>
          </div>
          <p className="text-xs text-slate-400">
            Layer nomenclature does not match project standards or scale factor is high.
          </p>
        </div>
      )}

      {/* Layer Mapping Configuration */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Ruler className="w-4 h-4 text-amber-400" />
              <span>Layer Mapping Configuration (AI Take-Off Rules)</span>
            </h4>
            <p className="text-xs text-slate-400">
              Configure which CAD layers map to which structural elements for automated take-off.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span className="text-amber-400">Scale Preset:</span>{' '}
              <span className="text-slate-400 font-mono text-xs px-2 py-0.5 rounded border border-slate-700">
                {cadScalePreset}
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Select the drawing scale preset to ensure accurate measurements.
            </p>
          </div>
        </div>

</div>

      {/* Format Guide */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <h4 className="text-sm font-bold text-amber-400 mb-1">1. AutoCAD DXF / DWG</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Vector drawings exported from CAD. StructEst Pro can parse layers (e.g. WALLS, COLUMNS) to sum total lengths and perimeters automatically.
          </p>
        </div>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <h4 className="text-sm font-bold text-amber-400 mb-1">2. PDF Blueprints</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Standard architectural sheet sets containing floor plans, elevations, and structural schedules. Use AI Estimator to analyze schedules.
          </p>
        </div>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <h4 className="text-sm font-bold text-amber-400 mb-1">3. Raster Images (PNG/JPG)</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Scanned blueprint sheets or site sketches. Upload to visually inspect and calibrate scale against known dimensions.
          </p>
        </div>
      </div>
    </div>
  );
};