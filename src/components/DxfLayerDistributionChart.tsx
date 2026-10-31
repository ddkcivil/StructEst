import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { PieChart, BarChart3, Layers, Filter, Info, Eye } from 'lucide-react';

export interface DxfLayerDistributionChartProps {
  parsedDxf: any;
  dxfLayers: string[];
  selectedLayer: string;
  onSelectLayer: (layer: string) => void;
}

export interface LayerStat {
  layer: string;
  totalEntities: number;
  linesCount: number;
  polylinesCount: number;
  otherCount: number;
  totalLength: number; // in meters (assuming CAD units or scaled)
  density: number; // lines + polylines
  percentage: number;
  color: string;
}

const PALETTE = [
  '#f59e0b', // amber-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#ec4899', // pink-500
  '#8b5cf6', // purple-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#eab308', // yellow-500
  '#a855f7', // violet-500
  '#64748b'  // slate-500
];

export const DxfLayerDistributionChart: React.FC<DxfLayerDistributionChartProps> = ({
  parsedDxf,
  dxfLayers,
  selectedLayer,
  onSelectLayer
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [metric, setMetric] = useState<'total' | 'density' | 'length'>('density');
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);

  // Compute stats per layer from parsedDxf
  const layerStats = useMemo(() => {
    if (!parsedDxf || !parsedDxf.entities || parsedDxf.entities.length === 0) {
      return [];
    }

    const layerMap: Record<string, {
      total: number;
      lines: number;
      polylines: number;
      others: number;
      length: number;
    }> = {};

    // Initialize map for all declared layers
    dxfLayers.forEach(l => {
      layerMap[l] = { total: 0, lines: 0, polylines: 0, others: 0, length: 0 };
    });

    let overallTotal = 0;

    parsedDxf.entities.forEach((entity: any) => {
      const layerName = entity.layer || '0';
      if (!layerMap[layerName]) {
        layerMap[layerName] = { total: 0, lines: 0, polylines: 0, others: 0, length: 0 };
      }

      layerMap[layerName].total++;
      overallTotal++;

      if (entity.type === 'LINE') {
        layerMap[layerName].lines++;
        const p1 = entity.startPoint || entity.vertices?.[0];
        const p2 = entity.endPoint || entity.vertices?.[1];
        if (p1 && p2 && typeof p1.x === 'number' && typeof p2.x === 'number') {
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          layerMap[layerName].length += dist;
        }
      } else if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
        layerMap[layerName].polylines++;
        if (entity.vertices && entity.vertices.length > 1) {
          for (let i = 0; i < entity.vertices.length - 1; i++) {
            const v1 = entity.vertices[i];
            const v2 = entity.vertices[i + 1];
            if (v1 && v2 && typeof v1.x === 'number' && typeof v2.x === 'number') {
              layerMap[layerName].length += Math.hypot(v2.x - v1.x, v2.y - v1.y);
            }
          }
        }
      } else {
        layerMap[layerName].others++;
      }
    });

    const stats: LayerStat[] = Object.keys(layerMap).map((layer, index) => {
      const d = layerMap[layer];
      return {
        layer,
        totalEntities: d.total,
        linesCount: d.lines,
        polylinesCount: d.polylines,
        otherCount: d.others,
        totalLength: Math.round(d.length * 100) / 100,
        density: d.lines + d.polylines,
        percentage: overallTotal > 0 ? (d.total / overallTotal) * 100 : 0,
        color: PALETTE[index % PALETTE.length]
      };
    });

    // Sort by selected metric descending
    return stats.sort((a, b) => {
      if (metric === 'density') return b.density - a.density;
      if (metric === 'length') return b.totalLength - a.totalLength;
      return b.totalEntities - a.totalEntities;
    });
  }, [parsedDxf, dxfLayers, metric]);

  // Active layer stat
  const activeStat = useMemo(() => {
    const target = hoveredLayer || selectedLayer;
    return layerStats.find(s => s.layer === target) || layerStats[0] || null;
  }, [hoveredLayer, selectedLayer, layerStats]);

  // Total summary of current metric
  const metricTotal = useMemo(() => {
    return layerStats.reduce((sum, s) => {
      if (metric === 'density') return sum + s.density;
      if (metric === 'length') return sum + s.totalLength;
      return sum + s.totalEntities;
    }, 0);
  }, [layerStats, metric]);

  // Render D3 chart whenever data, metric, or chartType changes
  useEffect(() => {
    if (!svgRef.current || layerStats.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 360;
    const height = 300;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    if (chartType === 'donut') {
      // DONUT / PIE CHART RENDERING
      const radius = Math.min(width, height) / 2 - 20;
      const innerRadius = radius * 0.58;

      g.attr('transform', `translate(${width / 2}, ${height / 2})`);

      // D3 Pie Generator
      const pie = d3.pie<LayerStat>()
        .value(d => {
          if (metric === 'density') return d.density || 0.001;
          if (metric === 'length') return d.totalLength || 0.001;
          return d.totalEntities || 0.001;
        })
        .sort(null)
        .padAngle(0.025);

      // D3 Arc Generator
      const arc = d3.arc<d3.PieArcDatum<LayerStat>>()
        .innerRadius(innerRadius)
        .outerRadius(radius)
        .cornerRadius(4);

      const arcHover = d3.arc<d3.PieArcDatum<LayerStat>>()
        .innerRadius(innerRadius - 2)
        .outerRadius(radius + 8)
        .cornerRadius(5);

      const arcs = g.selectAll('.arc')
        .data(pie(layerStats))
        .enter()
        .append('g')
        .attr('class', 'arc')
        .style('cursor', 'pointer');

      // Draw Arcs
      arcs.append('path')
        .attr('d', d => (d.data.layer === selectedLayer ? arcHover(d) : arc(d)))
        .attr('fill', d => d.data.color)
        .attr('stroke', d => (d.data.layer === selectedLayer ? '#ffffff' : '#0f172a'))
        .attr('stroke-width', d => (d.data.layer === selectedLayer ? 2.5 : 1))
        .attr('opacity', d => (selectedLayer && d.data.layer !== selectedLayer ? 0.75 : 1))
        .on('mouseenter', function (event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('d', () => arcHover(d))
            .attr('opacity', 1)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2);

          setHoveredLayer(d.data.layer);
        })
        .on('mouseleave', function (event, d) {
          const isSelected = d.data.layer === selectedLayer;
          d3.select(this)
            .transition()
            .duration(150)
            .attr('d', () => (isSelected ? arcHover(d) : arc(d)))
            .attr('opacity', isSelected ? 1 : 0.75)
            .attr('stroke', isSelected ? '#ffffff' : '#0f172a')
            .attr('stroke-width', isSelected ? 2.5 : 1);

          setHoveredLayer(null);
        })
        .on('click', (event, d) => {
          onSelectLayer(d.data.layer);
        });

      // Center Donut Hole Text
      const centerGroup = g.append('g').attr('text-anchor', 'middle');

      centerGroup.append('text')
        .attr('dy', '-0.6em')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('letter-spacing', '0.05em')
        .text(hoveredLayer ? 'HOVERED LAYER' : 'ACTIVE LAYER');

      centerGroup.append('text')
        .attr('dy', '0.7em')
        .attr('fill', '#f8fafc')
        .attr('font-size', '13px')
        .attr('font-weight', '700')
        .attr('class', 'truncate')
        .text((activeStat?.layer || 'All').substring(0, 14));

      centerGroup.append('text')
        .attr('dy', '2.2em')
        .attr('fill', activeStat ? activeStat.color : '#f59e0b')
        .attr('font-size', '11px')
        .attr('font-family', 'monospace')
        .attr('font-weight', '700')
        .text(() => {
          if (!activeStat) return '';
          if (metric === 'density') return `${activeStat.density} lines/poly`;
          if (metric === 'length') return `${activeStat.totalLength.toFixed(1)} m`;
          return `${activeStat.totalEntities} entities (${activeStat.percentage.toFixed(1)}%)`;
        });

    } else {
      // D3 HORIZONTAL BAR CHART RENDERING
      const margin = { top: 15, right: 40, bottom: 25, left: 95 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      g.attr('transform', `translate(${margin.left}, ${margin.top})`);

      const topStats = layerStats.slice(0, 8); // Top 8 layers

      const yScale = d3.scaleBand()
        .domain(topStats.map(d => d.layer))
        .range([0, innerH])
        .padding(0.28);

      const maxVal = d3.max(topStats, d => {
        if (metric === 'density') return d.density;
        if (metric === 'length') return d.totalLength;
        return d.totalEntities;
      }) || 1;

      const xScale = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([0, innerW]);

      // Y Axis (Layer Names)
      g.selectAll('.layer-label')
        .data(topStats)
        .enter()
        .append('text')
        .attr('x', -8)
        .attr('y', d => (yScale(d.layer) || 0) + yScale.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('fill', d => (d.layer === selectedLayer ? '#f59e0b' : '#94a3b8'))
        .attr('font-size', '10px')
        .attr('font-weight', d => (d.layer === selectedLayer ? '700' : '500'))
        .attr('cursor', 'pointer')
        .text(d => (d.layer.length > 12 ? d.layer.substring(0, 11) + '…' : d.layer))
        .on('click', (event, d) => onSelectLayer(d.layer));

      // Bars
      const bars = g.selectAll('.bar')
        .data(topStats)
        .enter()
        .append('g')
        .attr('cursor', 'pointer')
        .on('click', (event, d) => onSelectLayer(d.layer))
        .on('mouseenter', (event, d) => setHoveredLayer(d.layer))
        .on('mouseleave', () => setHoveredLayer(null));

      bars.append('rect')
        .attr('y', d => yScale(d.layer) || 0)
        .attr('x', 0)
        .attr('height', yScale.bandwidth())
        .attr('width', d => {
          const val = metric === 'density' ? d.density : (metric === 'length' ? d.totalLength : d.totalEntities);
          return Math.max(4, xScale(val));
        })
        .attr('fill', d => d.color)
        .attr('rx', 4)
        .attr('stroke', d => (d.layer === selectedLayer ? '#ffffff' : 'none'))
        .attr('stroke-width', 1.5)
        .attr('opacity', d => (selectedLayer && d.layer !== selectedLayer ? 0.75 : 1));

      // Value labels at end of bars
      bars.append('text')
        .attr('x', d => {
          const val = metric === 'density' ? d.density : (metric === 'length' ? d.totalLength : d.totalEntities);
          return Math.max(6, xScale(val)) + 6;
        })
        .attr('y', d => (yScale(d.layer) || 0) + yScale.bandwidth() / 2 + 3.5)
        .attr('fill', '#cbd5e1')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text(d => {
          if (metric === 'density') return `${d.density}`;
          if (metric === 'length') return `${d.totalLength.toFixed(0)}m`;
          return `${d.totalEntities}`;
        });
    }

  }, [layerStats, metric, chartType, selectedLayer, hoveredLayer, onSelectLayer]);

  if (!parsedDxf || !parsedDxf.entities || parsedDxf.entities.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
      {/* Top Header & Chart Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Layers className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center space-x-2">
              <span>Layer Vector Density & Distribution (D3.js)</span>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                {dxfLayers.length} Layers
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Interactive D3 visual breakdown of lines, polylines, and entity density per CAD layer.
            </p>
          </div>
        </div>

        {/* Metric Selector & Chart Toggle */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {/* Metric Selector */}
          <div className="flex bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-[10px]">
            <button
              onClick={() => setMetric('density')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                metric === 'density'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Lines + Polylines vector count"
            >
              Density (Lines/Poly)
            </button>
            <button
              onClick={() => setMetric('total')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                metric === 'total'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="All entity types including text & arcs"
            >
              Total Entities
            </button>
            <button
              onClick={() => setMetric('length')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                metric === 'length'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Calculated linear vector length"
            >
              Linear Length
            </button>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
            <button
              onClick={() => setChartType('donut')}
              className={`p-1 rounded-md transition ${
                chartType === 'donut'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="D3 Pie / Donut Chart"
            >
              <PieChart className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1 rounded-md transition ${
                chartType === 'bar'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="D3 Horizontal Bar Chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: D3 Chart SVG + Interactive Layer Legend Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left: D3 SVG Chart Container */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 min-h-[280px]">
          <svg
            ref={svgRef}
            className="w-full max-w-[340px] h-auto drop-shadow-md select-none"
          />

          {/* Quick instructions indicator */}
          <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 mt-1">
            <Info className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Click any slice or bar to select and isolate that layer in CAD viewer.</span>
          </div>
        </div>

        {/* Right: Layer Density Breakdown Legend & Stats Table */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
          {/* Active Highlight Banner */}
          {activeStat && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: activeStat.color }}
                />
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center space-x-2">
                    <span>{activeStat.layer}</span>
                    {activeStat.layer === selectedLayer && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-sans uppercase">
                        Current Active
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Lines: <span className="text-slate-200">{activeStat.linesCount}</span> |
                    Poly: <span className="text-slate-200"> {activeStat.polylinesCount}</span> |
                    Length: <span className="text-amber-400">{activeStat.totalLength.toFixed(1)}m</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold font-mono text-amber-400">
                  {activeStat.percentage.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">of total drawing</div>
              </div>
            </div>
          )}

          {/* Scrollable Layer Breakdown Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden max-h-52 overflow-y-auto bg-slate-900/40">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                  <th className="py-2 px-3">Layer</th>
                  <th className="py-2 px-2 text-right">Lines/Poly</th>
                  <th className="py-2 px-2 text-right">Est. Length</th>
                  <th className="py-2 px-2 text-right">Share</th>
                  <th className="py-2 px-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {layerStats.map(stat => {
                  const isSelected = stat.layer === selectedLayer;
                  return (
                    <tr
                      key={stat.layer}
                      onMouseEnter={() => setHoveredLayer(stat.layer)}
                      onMouseLeave={() => setHoveredLayer(null)}
                      onClick={() => onSelectLayer(stat.layer)}
                      className={`hover:bg-slate-800/60 transition cursor-pointer ${
                        isSelected ? 'bg-amber-500/10 font-bold' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: stat.color }}
                          />
                          <span className={`truncate max-w-[130px] ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
                            {stat.layer}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-slate-300">
                        {stat.density}
                      </td>
                      <td className="py-2 px-2 text-right text-amber-400">
                        {stat.totalLength.toFixed(1)}m
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">
                        {stat.percentage.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLayer(stat.layer);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded font-sans transition flex items-center justify-center space-x-1 mx-auto ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Eye className="w-2.5 h-2.5" />
                          <span>{isSelected ? 'Active' : 'View'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Aggregate Summary */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
            <span>
              Total Layer Vector Elements: <strong className="text-slate-200 font-mono">{metricTotal.toLocaleString()}</strong>
            </span>
            <button
              onClick={() => onSelectLayer(dxfLayers[0] || '0')}
              className="text-amber-400 hover:underline text-[10px]"
            >
              Reset to Primary Layer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
