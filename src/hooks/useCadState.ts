import React, { useState, useEffect, useCallback } from 'react';
import type { MeasurementItem, SubDivisionLine } from '../App';

export const useCadState = () => {
  // Background image
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [backgroundImageSrc, setBackgroundImageSrc] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string>('No drawing loaded');
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);

  // Measurements
  const [measurements, setMeasurements] = useState<MeasurementItem[]>([]);
  const [calibratedScale, setCalibratedScale] = useState<number>(1.0);
  const [isGridVisible, setIsGridVisible] = useState<boolean>(true);
  const [isSnapping, setIsSnapping] = useState<boolean>(true);

  // Selection
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [selectedLayer, setSelectedLayer] = useState<string>('default');

  // History
  const [history, setHistory] = useState<MeasurementItem[]>([]);
  const [undoRedoIndex, setUndoRedoIndex] = useState(-1);

  // Load image from source
  const loadImageFromSrc = useCallback((src: string) => {
    setIsPdfLoading(true);
    const img = new Image();
    img.onload = () => {
      setBackgroundImage(img);
      setBackgroundImageSrc(src);
      setActiveFileName(img.src.split('/').pop() || 'Drawing');
      setPdfPageCount(1);
      setIsPdfLoading(false);
    };
    img.onerror = () => {
      console.error('Failed to load image');
      setIsPdfLoading(false);
    };
    img.src = src;
  }, []);

  // Clear background
  const clearBackground = useCallback(() => {
    setBackgroundImage(null);
    setBackgroundImageSrc(null);
    setActiveFileName('No drawing loaded');
    setIsPdfLoading(false);
  }, []);

  // Add measurement item
  const addMeasurement = useCallback((item: MeasurementItem) => {
    setMeasurements(prev => [...prev, item]);
  }, []);

  // Clear all measurements
  const clearAllMeasurements = useCallback(() => {
    setMeasurements([]);
    setHistory([]);
    setUndoRedoIndex(-1);
  }, []);

  // Undo
  const undoLast = useCallback(() => {
    setUndoRedoIndex(prev => prev + 1);
    if (measurements.length > 0) {
      const last = measurements[measurements.length - 1];
      setMeasurements(prev => prev.slice(0, -1));
      setHistory(prev => {
        const copy = [...prev];
        copy.push(last);
        return copy.length > 10 ? copy.slice(-10) : copy;
      });
    }
  }, [measurements]);

  // Redo
  const redoLast = useCallback(() => {
    setUndoRedoIndex(prev => Math.max(prev - 1, -1));
    if (undoRedoIndex >= 0 && history.length > 0) {
      const undone = history[history.length - 1 - undoRedoIndex];
      if (undone) {
        setMeasurements(prev => [...prev, undone]);
        setHistory(prev => prev.slice(0, -1));
      }
    }
  }, [history, undoRedoIndex]);

  return {
    backgroundImage, setBackgroundImage,
    backgroundImageSrc, activeFileName,
    isPdfLoading, pdfPageCount,
    measurements, setMeasurements,
    calibratedScale, setCalibratedScale,
    isGridVisible, setIsGridVisible,
    isSnapping, setIsSnapping,
    selectedElement, setSelectedElement,
    zoomLevel, setZoomLevel,
    selectedLayer, setSelectedLayer,
    history, setHistory,
    undoRedoIndex, setUndoRedoIndex,
    loadImageFromSrc, clearBackground,
    addMeasurement, clearAllMeasurements,
    undoLast, redoLast,
  };
};
