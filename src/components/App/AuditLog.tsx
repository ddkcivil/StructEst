import React from 'react';
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

// Audit Log Component - Extracted from App.tsx ai-auditor tab
// Handles AI estimation and quantity survey functionality

export interface AuditLogProps {
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  aiResponse: string | null;
  setAiResponse: (response: string | null) => void;
  isAiLoading: boolean;
  setIsAiLoading: (loading: boolean) => void;
  handleRunAiAudit: (prompt: string) => void;
  PREDEFINED_CATEGORIES: any[];
}

export const AuditLog: React.FC<AuditLogProps> = ({
  aiPrompt,
  setAiPrompt,
  aiResponse,
  setAiResponse,
  isAiLoading,
  setIsAiLoading,
  handleRunAiAudit,
  PREDEFINED_CATEGORIES,
}) => {
  return (
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
            placeholder="Ask AI anything about this project estimate (e.g. 'Are we missing damp proof course or lintel calculations?)'"
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
  );
};