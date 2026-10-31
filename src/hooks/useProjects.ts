import React, { useState, useEffect } from 'react';
import type { Project, MeasurementItem } from '../App';

const INITIAL_PROJECT_ID_KEY = 'structest:initialProjectId';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(INITIAL_PROJECT_ID_KEY);
      if (savedId) {
        setCurrentProjectId(savedId);
      }
    } catch (e) {
      console.warn('Could not load project ID from localStorage');
    }
  }, []);

  // Save current project ID to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(INITIAL_PROJECT_ID_KEY, currentProjectId);
    } catch (e) {
      console.warn('Could not save project ID to localStorage');
    }
  }, [currentProjectId]);

  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0] || { id: 'new', name: 'New Project', items: [], standardWallHeight: 3, wastageDefault: 10, vatPercent: 13, contingencyPercent: 5 };

  const handleUpdateCurrentProjectItems = (items: MeasurementItem[]) => {
    setProjects(projects.map(p => p.id === currentProjectId ? { ...p, items } : p));
  };

  const handleCreateNewProject = (name: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      items: [],
      standardWallHeight: 3,
      wastageDefault: 10,
      vatPercent: 13,
      contingencyPercent: 5,
      client: '',
      location: '',
      currency: 'NPR',
      fiscalYear: new Date().getFullYear().toString(),
      duration: '',
      createdAt: new Date().toISOString(),
      companyName: '',
      companyAddress: '',
      preparedBy: '',
      checkedBy: '',
      approvedBy: '',
    };
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (currentProjectId === projectId) {
      setCurrentProjectId(prev => (prev !== projectId ? prev : projects.find(p => p.id !== projectId)?.id ?? ''));
    }
  };

  const handleUpdateProject = (updates: Partial<Project>) => {
    setProjects(projects.map(p => p.id === currentProjectId ? { ...p, ...updates } : p));
  };

  return {
    projects,
    currentProject,
    currentProjectId,
    setCurrentProjectId,
    handleUpdateCurrentProjectItems,
    handleCreateNewProject,
    handleDeleteProject,
    handleUpdateProject,
  };
};