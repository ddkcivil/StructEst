import React, { useState, useEffect } from 'react';
import type { MaterialRate } from '../App';

const STORAGE_KEY = 'structest:materialRates';
const DEFAULT_MATERIALS: MaterialRate[] = [
  { id: '1', name: 'Cement', category: 'Finishing', unit: 'bag', rate: 1200, spec: 'OPC 43 Grade' },
  { id: '2', name: 'Steel TMT', category: 'Reinforcement', unit: 'kg', rate: 85, spec: 'Fe 500' },
  { id: '3', name: 'Bricks', category: 'Superstructure', unit: '1000', rate: 8500, spec: 'First Class' },
  { id: '4', name: 'Sand', category: 'Earthwork', unit: 'm³', rate: 2500, spec: 'Fine Sand' },
  { id: '5', name: 'Aggregate', category: 'Earthwork', unit: 'm³', rate: 3000, spec: '20mm' },
  { id: '6', name: 'Plywood', category: 'Formwork', unit: 'sheet', rate: 800, spec: '12mm BWP' },
  { id: '7', name: 'Paint', category: 'Finishing', unit: 'ltr', rate: 600, spec: 'Emulsion' },
  { id: '8', name: 'Tiles', category: 'Finishing', unit: 'm²', rate: 1200, spec: 'Ceramic' },
];

export const useMaterials = () => {
  const [materials, setMaterials] = useState<MaterialRate[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.length > 0 ? parsed : DEFAULT_MATERIALS;
      }
    } catch (e) {
      console.warn('Could not load materials from localStorage');
    }
    return DEFAULT_MATERIALS;
  });

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
    } catch (e) {
      console.warn('Could not save materials to localStorage');
    }
  }, [materials]);

  const handleAddMaterial = (material: MaterialRate) => {
    setMaterials(prev => {
      const exists = prev.some(m => m.id === material.id);
      if (exists) {
        return prev.map(m => m.id === material.id ? material : m);
      }
      return [...prev, material];
    });
  };

  const handleUpdateMaterial = (material: MaterialRate) => {
    setMaterials(prev => prev.map(m => m.id === material.id ? material : m));
  };

  const handleDeleteMaterial = (materialId: string) => {
    setMaterials(prev => prev.filter(m => m.id !== materialId));
  };

  const findMaterial = (id: string) => {
    return materials.find(m => m.id === id);
  };

  return {
    materials,
    setMaterials,
    handleAddMaterial,
    handleUpdateMaterial,
    handleDeleteMaterial,
    findMaterial,
  };
};