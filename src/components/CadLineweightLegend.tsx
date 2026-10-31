import React from 'react';
import {
  Ruler,
  Sliders,
  Layers,
  Eye,
  EyeOff,
  Maximize2
} from 'lucide-react';

export interface CadLineweightLegendProps {
  scalePreset: string;
  onScalePresetChange: (scale: string) => void;
  scaleFactor: number;
  onScaleFactorChange: (factor: number) => void;
  isolatedStructuralLayer?: string | null;
  onIsolateStructuralLayer?: (layer: string | null) => void;
}

export const STRUCTURAL_LINEWEIGHT_STYLES = [
  {
    type: 'column',
    name: 'Columns & Shear Walls',
    color: '#f43f5e', // ruby
    strokeWidth: 3.5,
    sampleClass: 'w-5 h-2 bg-rose-500 rounded-sm shadow-sm',
    desc: 'Primary vertical load path'
  },
  {
    type: 'beam',
    name: 'Structural Beams',
    color: '#3b82f6', // blue
    strokeWidth: 2.5,
    sampleClass: 'w-5 h-1 bg-blue-500 rounded-full',
    desc: 'Main & secondary floor beams'
  },
  {
    type: 'ext_wall',
    name: 'Exterior Walls (230mm / 9")',
    color: '#10b981', // emerald
    strokeWidth: 2.2,
    sampleClass: 'w-5 h-1 bg-emerald-500',
    desc: 'Main superstructure perimeter'
  },
  {
    type: 'int_wall',
    name: 'Interior Partitions (115mm / 4.5")',
    color: '#06b6d4', // cyan
    strokeWidth: 1.4,
    sampleClass: 'w-5 h-0.5 bg-cyan-400',
    desc: 'Internal partition masonry'
  },
  {
    type: 'opening',
    name: 'Door & Window Openings',
    color: '#f59e0b', // amber
    strokeWidth: 1.5,
    sampleClass: 'w-5 h-0.5 bg-amber-400',
    desc: 'Deductions (D1-D4, W1-W5)'
  },
  {
    type: 'grid',
    name: 'Structural Grid & Footings',
    color: '#64748b', // slate
    strokeWidth: 1.0,
    dashed: true,
    sampleClass: 'w-5 h-0.5 border-t border-dashed border-slate-400',
    desc: 'Centerline grid axes & footings'
  }
];

export const CadLineweightLegend: React.FC<CadLineweightLegendProps> = ({
  scalePreset,
  onScalePresetChange,
  scaleFactor,
  onScaleFactorChange,
  isolatedStructuralLayer,
  onIsolateStructuralLayer
}) => {
  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-3 text-xs">
      {/* Top Bar: Drawing Scale & Ratio Calibration */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <Ruler className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-slate-200">Drawing Scale Calibration</span>
          <span className="text-[10px] text-slate-400 font-mono">
            (1 CAD Unit = {scaleFactor.toFixed(2)}m)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-[10px] text-slate-400 font-semibold uppercase">Scale Ratio:</label>
          <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-[10px]">
            {['1:50', '1:100', '1:200', '1:500'].map(preset => (
              <button
                key={preset}
                onClick={() => onScalePresetChange(preset)}
                className={`px-2 py-0.5 rounded font-mono font-bold transition ${
                  scalePreset === preset
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Scale Ruler Bar Visualizer */}
          <div className="hidden md:flex items-center space-x-1 pl-2 border-l border-slate-800">
            <span className="text-[9px] font-mono text-slate-400">0m</span>
            <div className="w-16 h-1.5 bg-slate-800 border-x border-amber-400 flex">
              <div className="w-1/2 h-full bg-amber-500/30 border-r border-slate-600" />
            </div>
            <span className="text-[9px] font-mono text-amber-400 font-bold">5m</span>
          </div>
        </div>
      </div>

      {/* Lineweight & Layer Palette Swatches */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STRUCTURAL_LINEWEIGHT_STYLES.map(style => {
          const isIsolated = isolatedStructuralLayer === style.type;
          return (
            <button
              key={style.type}
              type="button"
              onClick={() => onIsolateStructuralLayer?.(isIsolated ? null : style.type)}
              className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                isIsolated
                  ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[11px] font-bold truncate max-w-[110px]" title={style.name}>
                  {style.name}
                </span>
                <span className="text-[9px] font-mono opacity-80" style={{ color: style.color }}>
                  {style.strokeWidth}px
                </span>
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <div
                  className="h-1 rounded-full flex-1"
                  style={{
                    backgroundColor: style.color,
                    borderTop: style.dashed ? '1px dashed' : undefined
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
