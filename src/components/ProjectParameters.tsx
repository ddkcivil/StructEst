import React from 'react';
import { Project } from '../App';

interface ProjectParametersProps {
  currentProject: Project;
  setProjects: (projects: any) => void;
  projects: Project[];
  templates: any[];
  setTemplates: (templates: any) => void;
}

export const ProjectParameters: React.FC<ProjectParametersProps> = ({ currentProject, setProjects, projects, templates, setTemplates }) => {
  const updateProject = (updates: Partial<Project>) => {
    setProjects(projects.map(p => p.id === currentProject.id ? { ...p, ...updates } : p));
  };

  const handleSaveAsTemplate = () => {
    const name = prompt('Enter name for new template:');
    if (!name) return;
    const newTmpl = {
        id: 'tmpl-' + Date.now(),
        name,
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
    alert('Template saved successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Project & Company Settings</h2>
        <button onClick={handleSaveAsTemplate} className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition shadow">Save as Template</button>
      </div>
      <p className="text-xs text-slate-400 mb-6">Configure project details and global engineering parameters.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Company / Firm Name</label>
          <input
            type="text"
            value={currentProject.companyName}
            onChange={(e) => updateProject({ companyName: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Project Location</label>
          <input
            type="text"
            value={currentProject.location}
            onChange={(e) => updateProject({ location: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Standard Wall Height (m)</label>
          <input
            type="number"
            value={currentProject.standardWallHeight}
            onChange={(e) => updateProject({ standardWallHeight: parseFloat(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
          <input
            type="text"
            value={currentProject.currency}
            onChange={(e) => updateProject({ currency: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>
    </div>
  );
};
