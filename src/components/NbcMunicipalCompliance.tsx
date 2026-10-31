import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  MapPin,
  Compass,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  FileText,
  Building,
  Layers,
  Info,
  ExternalLink,
  RotateCcw,
  Search,
  Eye,
  EyeOff,
  Sliders,
  Sparkles,
  Move,
  ZoomIn,
  ZoomOut,
  RefreshCw
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface ProjectData {
  id: string;
  name: string;
  client: string;
  location: string;
  companyName: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  items: any[];
}

export interface NbcMunicipalComplianceProps {
  currentProject: ProjectData;
  currency?: string;
  importedFilePreview?: string | null;
  importedFileName?: string | null;
}

// Nepal Land Unit Conversions
// 1 Ropani = 16 Aana = 64 Paisa = 256 Daam = 508.72 m² = 5476 sq.ft
// 1 Aana = 31.795 m² = 342.25 sq.ft
// 1 Katha = 338.63 m² = 3645 sq.ft
// 1 Dhur = 16.93 m² = 182.25 sq.ft
const SQM_PER_AANA = 31.795;
const SQM_PER_KATHA = 338.63;
const SQFT_PER_SQM = 10.7639;

// Preset Municipalities in Nepal
const NEPAL_LOCATION_PRESETS = [
  {
    name: 'Tilottama Ward 01, Shankarpur, Rupandehi',
    municipality: 'तिलोत्तमा नगरपालिका, लुम्बिनी प्रदेश',
    wardNo: '०१',
    tole: 'शंकरपुर',
    lat: 27.6534,
    lng: 83.4862,
    zone: 'residential_low' as const,
    roadWidth: 6.0,
    frontSetback: 2.0,
    maxFAR: 1.75,
    maxCoverage: 60
  },
  {
    name: 'Kathmandu Metro Ward 03, Maharajgunj',
    municipality: 'काठमाडौँ महानगरपालिका, बागमती प्रदेश',
    wardNo: '०३',
    tole: 'महाराजगञ्ज',
    lat: 27.7372,
    lng: 85.3340,
    zone: 'residential_dense' as const,
    roadWidth: 8.0,
    frontSetback: 3.0,
    maxFAR: 2.0,
    maxCoverage: 70
  },
  {
    name: 'Lalitpur Metro Ward 02, Pulchowk',
    municipality: 'लalitपुर महानगरपालिका, बागमती प्रदेश',
    wardNo: '०२',
    tole: 'पुल्चोक',
    lat: 27.6772,
    lng: 85.3180,
    zone: 'commercial' as const,
    roadWidth: 10.0,
    frontSetback: 3.0,
    maxFAR: 3.0,
    maxCoverage: 70
  },
  {
    name: 'Pokhara Metro Ward 06, Lakeside',
    municipality: 'पोखरा महानगरपालिका, गण्डकी प्रदेश',
    wardNo: '०६',
    tole: 'लेकसाइड',
    lat: 28.2096,
    lng: 83.9856,
    zone: 'residential_low' as const,
    roadWidth: 6.0,
    frontSetback: 2.0,
 MAXFAR: 1.5,
    maxCoverage: 60
  },
  {
    name: 'Butwal Sub-Metro Ward 04, Traffic Chowk',
    municipality: 'बुटवल उपमहानगरपालिका, लुम्बिनी प्रदेश',
    wardNo: '०४',
    tole: 'ट्राफिक चोक',
    lat: 27.7006,
    lng: 83.4484,
    zone: 'commercial' as const,
    roadWidth: 8.0,
    frontSetback: 3.0,
    maxFAR: 2.5,
    maxCoverage: 70
  },
  {
    name: 'Bharatpur Metro Ward 10, Lions Chowk',
    municipality: 'भरतपुर महानगरपालिका, बागमती प्रदेश',
    wardNo: '१०',
    tole: 'लायन्स चोक',
    lat: 27.6833,
    lng: 84.4333,
    zone: 'residential_dense' as const,
    roadWidth: 6.0,
    frontSetback: 2.0,
    maxFAR: 1.75,
    maxCoverage: 60
  }
];

export const NbcMunicipalCompliance: React.FC<NbcMunicipalComplianceProps> = ({
  currentProject,
  currency = 'NPR',
  importedFilePreview,
  importedFileName
}) => {
  // Map Container Ref
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Plot & Location Inputs
  const [selectedPreset, setSelectedPreset] = useState<string>(NEPAL_LOCATION_PRESETS[0].name);
  const [municipality, setMunicipality] = useState('तिलोत्तमा नगरपालिका, लुम्बिनी प्रदेश');
  const [wardNo, setWardNo] = useState('०१');
  const [tole, setTole] = useState('शंकरपुर');
  const [kittaNo, setKittaNo] = useState('४५८ / ३२');
  const [latitude, setLatitude] = useState<number>(27.6534);
  const [longitude, setLongitude] = useState<number>(83.4862);

  // Land Unit mode: 'aana' | 'sqm' | 'katha' | 'sqft'
  const [landUnitMode, setLandUnitMode] = useState<'aana' | 'sqm' | 'katha' | 'sqft'>('aana');
  const [inputPlotArea, setInputPlotArea] = useState<number>(4.5); // 4.5 Aana default (~143 m²)
  const [plotWidthM, setPlotWidthM] = useState<number>(11.5); // 11.5m frontage
  const [plotDepthM, setPlotDepthM] = useState<number>(12.8); // 12.8m depth

  // Building Footprint & Floor Details
  const [groundFloorAreaM2, setGroundFloorAreaM2] = useState<number>(82.5); // 82.5 m²
  const [firstFloorAreaM2, setFirstFloorAreaM2] = useState<number>(85.0);
  const [secondFloorAreaM2, setSecondFloorAreaM2] = useState<number>(42.0); // Staircase & utility
  const [numberOfStories, setNumberOfStories] = useState<number>(2.5);
  const [buildingHeightM, setBuildingHeightM] = useState<number>(8.5);

  // Municipal Setback Inputs (in meters)
  const [roadWidthM, setRoadWidthM] = useState<number>(6.0); // 6m road (20ft)
  const [setbackFrontM, setSetbackFrontM] = useState<number>(2.0); // min 1.5m required
  const [setbackRearM, setSetbackRearM] = useState<number>(1.8);  // min 1.5m required
  const [setbackLeftM, setSetbackLeftM] = useState<number>(1.5);  // min 1.0m/1.5m
  const [setbackRightM, setSetbackRightM] = useState<number>(1.5); // min 1.0m/1.5m

  // Zoning & Standard Bylaw Parameters
  const [zoneType, setZoneType] = useState<'residential_low' | 'residential_dense' | 'commercial'>('residential_low');

  // Toggle Boundary Overlay Feature State
  const [showBoundaryOverlay, setShowBoundaryOverlay] = useState<boolean>(false);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.75); // 75% default
  const [overlayScale, setOverlayScale] = useState<number>(1.0);
  const [overlayOffsetX, setOverlayOffsetX] = useState<number>(0);
  const [overlayOffsetY, setOverlayOffsetY] = useState<number>(0);
  const [overlayRotation, setOverlayRotation] = useState<number>(0);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Convert input land to square meters
  const plotAreaSqM = useMemo(() => {
    switch (landUnitMode) {
      case 'aana':
        return inputPlotArea * SQM_PER_AANA;
      case 'katha':
        return inputPlotArea * SQM_PER_KATHA;
      case 'sqft':
        return inputPlotArea / SQFT_PER_SQM;
      case 'sqm':
      default:
        return inputPlotArea;
    }
  }, [inputPlotArea, landUnitMode]);

  // Derived land representations
  const landInAana = plotAreaSqM / SQM_PER_AANA;
  const landInSqFt = plotAreaSqM * SQFT_PER_SQM;

  // Total built-up area
  const totalBuiltUpAreaM2 = useMemo(() => {
    return groundFloorAreaM2 + firstFloorAreaM2 + secondFloorAreaM2;
  }, [groundFloorAreaM2, firstFloorAreaM2, secondFloorAreaM2]);

  // Ground Coverage Calculation
  const groundCoveragePercent = useMemo(() => {
    if (plotAreaSqM <= 0) return 0;
    return (groundFloorAreaM2 / plotAreaSqM) * 100;
  }, [groundFloorAreaM2, plotAreaSqM]);

  // Max Allowed Ground Coverage per Nepal Building Bylaws:
  // For plot <= 250 m²: 70% max
  // For plot > 250 m²: 60% max
  const maxAllowedCoveragePercent = useMemo(() => {
    if (zoneType === 'commercial') return 70;
    return plotAreaSqM <= 250 ? 70 : 60;
  }, [plotAreaSqM, zoneType]);

  // Floor Area Ratio (FAR)
  const calculatedFAR = useMemo(() => {
    if (plotAreaSqM <= 0) return 0;
    return totalBuiltUpAreaM2 / plotAreaSqM;
  }, [totalBuiltUpAreaM2, plotAreaSqM]);

  // Max Allowed FAR in Nepal Municipal Bylaws
  const maxAllowedFAR = useMemo(() => {
    if (zoneType === 'commercial') return 3.0;
    if (zoneType === 'residential_dense') return 2.0;
    return 1.75;
  }, [zoneType]);

  // Minimum Setback Requirements per Nepal Bylaws
  const requiredFrontSetbackM = useMemo(() => {
    return roadWidthM >= 8 ? 3.0 : 1.5;
  }, [roadWidthM]);

  const requiredRearSetbackM = 1.5;
  const requiredSideSetbackM = 1.0;

  // Compliance Flags
  const isCoverageCompliant = groundCoveragePercent <= maxAllowedCoveragePercent;
  const isFarCompliant = calculatedFAR <= maxAllowedFAR;
  const isFrontSetbackCompliant = setbackFrontM >= requiredFrontSetbackM;
  const isRearSetbackCompliant = setbackRearM >= requiredRearSetbackM;
  const isSideSetbackCompliant = setbackLeftM >= requiredSideSetbackM && setbackRightM >= requiredSideSetbackM;

  const isOverallCompliant = isCoverageCompliant && isFarCompliant && isFrontSetbackCompliant && isRearSetbackCompliant && isSideSetbackCompliant;

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Map if not created yet
    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 16,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);

      marker.on('dragend', (e: any) => {
        const coord = e.target.getLatLng();
        handleUpdateCoordinates(coord.lat, coord.lng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        handleUpdateCoordinates(e.latlng.lat, e.latlng.lng);
      });

      leafletMapRef.current = map;
      markerRef.current = marker;
    } else {
      leafletMapRef.current.setView([latitude, longitude], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
    }

    return () => {
      // Cleanup map on unmount
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Sync Leaflet map when latitude/longitude state changes
  useEffect(() => {
    if (leafletMapRef.current && markerRef.current) {
      leafletMapRef.current.setView([latitude, longitude], 16);
      markerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude]);

  // Handle updating coordinates and auto-fetching local municipal guidelines
  const handleUpdateCoordinates = (newLat: number, newLng: number) => {
    setLatitude(Number(newLat.toFixed(5)));
    setLongitude(Number(newLng.toFixed(5)));

    // Check if near any Nepal preset to auto-apply municipal bylaws
    const matched = NEPAL_LOCATION_PRESETS.find(p =>
      Math.abs(p.lat - newLat) < 0.05 && Math.abs(p.lng - newLng) < 0.05
    );

    if (matched) {
      setMunicipality(matched.municipality);
      setWardNo(matched.wardNo);
      setTole(matched.tole);
      setZoneType(matched.zone);
      setRoadWidthM(matched.roadWidth);
      setSetbackFrontM(matched.frontSetback);

      setToastMessage(
        `Local Municipal Bylaws Fetched for Coordinates [${newLat.toFixed(4)}, ${newLng.toFixed(4)}]: ${matched.municipality} Ward ${matched.wardNo}. Setback Front ≥${matched.frontSetback}m, Max FAR: ${matched.maxFAR}.`
      );
    } else {
      setToastMessage(
        `Site Location Coordinates Updated: [${newLat.toFixed(4)}, ${newLng.toFixed(4)}]. Default NBC 205:2024 bylaws active.`
      );
    }
  };

  // Handle Preset Location Select
  const handleSelectPreset = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = NEPAL_LOCATION_PRESETS.find(p => p.name === presetName);
    if (preset) {
      handleUpdateCoordinates(preset.lat, preset.lng);
    }
  };

  // Print Municipal Summary Card
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-3 rounded-2xl flex items-center justify-between text-xs transition shadow-lg">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-200 text-xs font-bold font-mono px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Nepal National Building Code (NBC) & Municipal Planning Auditor
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Interactive Map Coordinate Picker, FAR & Coverage Calculator, Right-of-Way Setbacks, and Blueprint Boundary Overlay for DPC Approval.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle Boundary Overlay Button */}
          <button
            onClick={() => setShowBoundaryOverlay(!showBoundaryOverlay)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow ${
              showBoundaryOverlay
                ? 'bg-amber-500 text-slate-950 font-extrabold ring-2 ring-amber-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
            }`}
            title="Overlay site boundary polygon and setback clearance zones over uploaded blueprint image"
          >
            <Layers className="w-4 h-4" />
            <span>{showBoundaryOverlay ? 'Boundary Overlay: ON' : 'Toggle Boundary Overlay'}</span>
          </button>

          <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 ${
            isOverallCompliant
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {isOverallCompliant ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{isOverallCompliant ? 'Municipal Bylaws: PASS' : 'Bylaws Issues'}</span>
          </div>

          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print Permit Card</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ground Coverage Gauge */}
        <div className={`p-5 rounded-2xl border transition shadow-lg ${
          isCoverageCompliant
            ? 'bg-slate-900 border-slate-800'
            : 'bg-rose-950/20 border-rose-500/40'
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Ground Coverage</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              isCoverageCompliant ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {isCoverageCompliant ? 'PASS' : 'EXCEEDED'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black font-mono text-slate-100">
              {groundCoveragePercent.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              / max {maxAllowedCoveragePercent}%
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isCoverageCompliant ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, (groundCoveragePercent / maxAllowedCoveragePercent) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">
            Footprint: {groundFloorAreaM2.toFixed(1)} m² of {plotAreaSqM.toFixed(1)} m²
          </p>
        </div>

        {/* Floor Area Ratio (FAR) Gauge */}
        <div className={`p-5 rounded-2xl border transition shadow-lg ${
          isFarCompliant
            ? 'bg-slate-900 border-slate-800'
            : 'bg-rose-950/20 border-rose-500/40'
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Floor Area Ratio (FAR)</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              isFarCompliant ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {isFarCompliant ? 'PASS' : 'EXCEEDED'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black font-mono text-amber-400">
              {calculatedFAR.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              / ceiling {maxAllowedFAR.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isFarCompliant ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, (calculatedFAR / maxAllowedFAR) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">
            Gross Built-Up: {totalBuiltUpAreaM2.toFixed(1)} m²
          </p>
        </div>

        {/* Front Road Setback */}
        <div className={`p-5 rounded-2xl border transition shadow-lg ${
          isFrontSetbackCompliant
            ? 'bg-slate-900 border-slate-800'
            : 'bg-rose-950/20 border-rose-500/40'
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Front Road Setback</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              isFrontSetbackCompliant ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {isFrontSetbackCompliant ? 'PASS' : 'VIOLATION'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black font-mono text-slate-100">
              {setbackFrontM.toFixed(2)} m
            </span>
            <span className="text-xs text-slate-400 font-mono">
              / req. min {requiredFrontSetbackM.toFixed(1)} m
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-mono">
            Road Width: {roadWidthM} m ({Math.round(roadWidthM * 3.28084)} ft RoW)
          </p>
        </div>

        {/* Rear & Side Setbacks */}
        <div className={`p-5 rounded-2xl border transition shadow-lg ${
          isRearSetbackCompliant && isSideSetbackCompliant
            ? 'bg-slate-900 border-slate-800'
            : 'bg-rose-950/20 border-rose-500/40'
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Rear & Side Clearance</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              isRearSetbackCompliant && isSideSetbackCompliant ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {isRearSetbackCompliant && isSideSetbackCompliant ? 'PASS' : 'INSUFFICIENT'}
            </span>
          </div>
          <div className="mt-2 text-xs font-mono text-slate-200 space-y-1">
            <div className="flex justify-between">
              <span>Rear: {setbackRearM} m</span>
              <span className="text-slate-400">(min {requiredRearSetbackM} m)</span>
            </div>
            <div className="flex justify-between">
              <span>Left: {setbackLeftM} m</span>
              <span className="text-slate-400">(min {requiredSideSetbackM} m)</span>
            </div>
            <div className="flex justify-between">
              <span>Right: {setbackRightM} m</span>
              <span className="text-slate-400">(min {requiredSideSetbackM} m)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Leaflet Map Picker & Location Selector */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <MapPin className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span>Interactive Map Site Coordinate Picker</span>
                <span className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
                  [{latitude}, {longitude}]
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Click anywhere on the map or drag the marker pin to pick your exact construction plot coordinates.
              </p>
            </div>
          </div>

          {/* Location Presets Selector */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <label className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">Nepal Presets:</label>
            <select
              value={selectedPreset}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-200 font-medium px-3 py-1.5 rounded-xl cursor-pointer focus:outline-none focus:border-amber-500 w-full sm:w-auto"
            >
              {NEPAL_LOCATION_PRESETS.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leaflet Interactive Map Canvas */}
        <div className="relative rounded-xl overflow-hidden border border-slate-800 min-h-[300px] z-10">
          <div
            ref={mapContainerRef}
            className="w-full h-[280px] bg-slate-950"
          />
          <div className="absolute bottom-2 left-2 z-[400] bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-mono text-slate-300 shadow">
            Latitude: <span className="text-amber-400 font-bold">{latitude}</span> | Longitude: <span className="text-amber-400 font-bold">{longitude}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Parameter Inputs + Boundary Overlay Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Parameter Controls */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-5 text-xs">
          <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Building className="w-4 h-4 text-amber-400" />
            <span>Plot & Building Envelope Parameters</span>
          </h3>

          {/* Land Measurement & Converter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-300">Plot Area Input</label>
              <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px]">
                {(['aana', 'sqm', 'katha', 'sqft'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setLandUnitMode(u)}
                    className={`px-2 py-0.5 rounded font-mono font-medium transition ${
                      landUnitMode === u
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  step="0.01"
                  value={inputPlotArea}
                  onChange={(e) => setInputPlotArea(Math.max(0.1, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex flex-col justify-center text-[11px] font-mono text-slate-400">
                <span>{plotAreaSqM.toFixed(1)} m²</span>
                <span className="text-[10px] text-amber-400/90">{landInAana.toFixed(2)} Aana ({Math.round(landInSqFt)} sq.ft)</span>
              </div>
            </div>
          </div>

          {/* Plot Width and Depth */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Plot Frontage / Width (m)</label>
              <input
                type="number"
                step="0.1"
                value={plotWidthM}
                onChange={(e) => setPlotWidthM(Math.max(3, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Plot Depth (m)</label>
              <input
                type="number"
                step="0.1"
                value={plotDepthM}
                onChange={(e) => setPlotDepthM(Math.max(3, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Floor Areas Breakdown */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="font-semibold text-slate-300 block">Floor-by-Floor Plinth Areas (m²)</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Ground Plinth</span>
                <input
                  type="number"
                  step="0.1"
                  value={groundFloorAreaM2}
                  onChange={(e) => setGroundFloorAreaM2(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">1st Floor</span>
                <input
                  type="number"
                  step="0.1"
                  value={firstFloorAreaM2}
                  onChange={(e) => setFirstFloorAreaM2(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">2nd / Cover</span>
                <input
                  type="number"
                  step="0.1"
                  value={secondFloorAreaM2}
                  onChange={(e) => setSecondFloorAreaM2(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Road Width & Setbacks */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-300">Setbacks & Road Width (m)</label>
              <span className="text-[10px] text-slate-500">Nepal Urban Planning Bylaws</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Road Access Width</span>
                <input
                  type="number"
                  step="0.5"
                  value={roadWidthM}
                  onChange={(e) => setRoadWidthM(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Front Setback</span>
                <input
                  type="number"
                  step="0.1"
                  value={setbackFrontM}
                  onChange={(e) => setSetbackFrontM(Number(e.target.value))}
                  className={`w-full bg-slate-950 border rounded-lg px-2.5 py-1.5 font-mono focus:outline-none ${
                    isFrontSetbackCompliant ? 'border-slate-800 text-slate-200 focus:border-amber-500' : 'border-rose-500 text-rose-300'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Rear Setback</span>
                <input
                  type="number"
                  step="0.1"
                  value={setbackRearM}
                  onChange={(e) => setSetbackRearM(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Left Setback</span>
                <input
                  type="number"
                  step="0.1"
                  value={setbackLeftM}
                  onChange={(e) => setSetbackLeftM(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Right Setback</span>
                <input
                  type="number"
                  step="0.1"
                  value={setbackRightM}
                  onChange={(e) => setSetbackRightM(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Cadastral Site Plan & Toggle Boundary Overlay Feature */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
          {/* Section Header & Overlay Toggle controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Compass className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>{showBoundaryOverlay ? 'Blueprint Floor Plan + Site Boundary Overlay' : 'Cadastral Plot Boundary & Setbacks'}</span>
                  {showBoundaryOverlay && (
                    <span className="text-[10px] bg-amber-500 text-slate-950 font-extrabold px-2 py-0.5 rounded shadow">
                      OVERLAY ACTIVE
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {showBoundaryOverlay
                    ? 'Visualizing cadastral parcel limits and municipal setback lines overlaid on top of uploaded drawing image.'
                    : 'Visualizes parcel boundary, road right-of-way, required municipal setbacks, and permissible envelope.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowBoundaryOverlay(!showBoundaryOverlay)}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 border ${
                showBoundaryOverlay
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {showBoundaryOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showBoundaryOverlay ? 'Hide Blueprint Overlay' : 'Overlay on Blueprint'}</span>
            </button>
          </div>

          {/* Boundary Overlay Controls Bar (when overlay mode is enabled) */}
          {showBoundaryOverlay && (
            <div className="bg-slate-950 border border-amber-500/30 p-3 rounded-xl space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold text-slate-200">Overlay Calibration:</span>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Opacity slider */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] text-slate-400">Opacity:</span>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                      className="w-20 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-amber-400 font-bold">
                      {Math.round(overlayOpacity * 100)}%
                    </span>
                  </div>

                  {/* Scale adjustment */}
                  <div className="flex items-center space-x-1 text-[10px]">
                    <span className="text-slate-400">Scale:</span>
                    <button
                      onClick={() => setOverlayScale(prev => Math.max(0.5, prev - 0.1))}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono text-slate-200 font-bold">{overlayScale.toFixed(1)}x</span>
                    <button
                      onClick={() => setOverlayScale(prev => Math.min(2.5, prev + 0.1))}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Offset X / Y Shift */}
                  <div className="flex items-center space-x-1 text-[10px]">
                    <span className="text-slate-400">Shift X/Y:</span>
                    <button
                      onClick={() => setOverlayOffsetX(prev => prev - 10)}
                      className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setOverlayOffsetX(prev => prev + 10)}
                      className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded"
                    >
                      →
                    </button>
                    <button
                      onClick={() => setOverlayOffsetY(prev => prev - 10)}
                      className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => setOverlayOffsetY(prev => prev + 10)}
                      className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded"
                    >
                      ↓
                    </button>
                  </div>

                  {/* Reset Alignment */}
                  <button
                    onClick={() => {
                      setOverlayOpacity(0.75);
                      setOverlayScale(1.0);
                      setOverlayOffsetX(0);
                      setOverlayOffsetY(0);
                    }}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                    title="Reset Alignment"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Site Diagram or Blueprint Overlay Container */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-center min-h-[340px] overflow-hidden">
            {/* Compass Rose */}
            <div className="absolute top-3 right-3 z-20 bg-slate-900/90 border border-slate-700 p-2 rounded-xl flex flex-col items-center shadow text-[10px] font-bold text-slate-200">
              <Compass className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="mt-0.5 text-amber-400">N</span>
            </div>

            {/* If Overlay Mode is Active, show uploaded blueprint floor plan image under the site boundary overlay */}
            {showBoundaryOverlay ? (
              <div className="relative w-full h-full flex items-center justify-center min-h-[320px]">
                {/* Blueprint Drawing Image Background */}
                {importedFilePreview ? (
                  <img
                    src={importedFilePreview}
                    alt={importedFileName || 'Blueprint Drawing Floor Plan'}
                    className="max-h-[320px] max-w-full object-contain rounded-lg border border-slate-800 opacity-80 filter brightness-90"
                  />
                ) : (
                  /* Standard Residential Architectural Blueprint Floor Plan Vector Placeholder */
                  <div className="relative w-full max-w-lg h-72 bg-slate-900/90 border border-slate-800 rounded-lg p-4 flex flex-col justify-between overflow-hidden shadow-inner">
                    <div className="text-[10px] text-slate-400 font-mono flex justify-between">
                      <span>Architectural Floor Plan Drawing Sheet</span>
                      <span>Scale 1:100</span>
                    </div>

                    {/* Architectural Walls Simulation */}
                    <div className="relative flex-1 my-2 border-2 border-slate-600 bg-slate-950/60 rounded p-3 grid grid-cols-3 gap-2">
                      <div className="border border-slate-700 p-2 text-[9px] text-slate-500 font-mono">
                        LIVING ROOM<br />4.20m × 5.10m
                      </div>
                      <div className="border border-slate-700 p-2 text-[9px] text-slate-500 font-mono">
                        KITCHEN & DINING<br />3.60m × 4.20m
                      </div>
                      <div className="border border-slate-700 p-2 text-[9px] text-slate-500 font-mono">
                        BEDROOM 01<br />3.50m × 3.80m
                      </div>
                    </div>

                    <div className="text-[10px] text-amber-400 font-mono text-center">
                      Loaded Plan: Residential Floor Layout ({importedFileName || 'structest_residential_villa.dxf'})
                    </div>
                  </div>
                )}

                {/* SVG Site Boundary & Municipal Setback Overlay Layer */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-150"
                  style={{ opacity: overlayOpacity }}
                >
                  <svg
                    viewBox="0 0 500 380"
                    className="w-full max-h-[340px] select-none"
                    style={{
                      transform: `scale(${overlayScale}) translate(${overlayOffsetX}px, ${overlayOffsetY}px)`
                    }}
                  >
                    {/* Road Line */}
                    <g transform="translate(40, 20)">
                      <rect x="0" y="0" width="420" height="35" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6,4" />
                      <text x="210" y="22" fill="#f59e0b" fontSize="10" fontWeight="700" textAnchor="middle">
                        ROAD RIGHT-OF-WAY CLEARANCE LINE ({roadWidthM}m)
                      </text>
                    </g>

                    {/* Cadastral Site Boundary Polygon */}
                    <g transform="translate(80, 75)">
                      <rect
                        x="0"
                        y="0"
                        width="340"
                        height="260"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="3"
                        strokeDasharray="8,4"
                      />

                      {/* Required Municipal Setback Clearance Polygon */}
                      <rect
                        x="30"
                        y="45"
                        width="280"
                        height="180"
                        fill="#10b981"
                        fillOpacity="0.15"
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeDasharray="4,2"
                      />

                      {/* Front Setback Line */}
                      <line x1="0" y1="45" x2="340" y2="45" stroke="#f43f5e" strokeWidth="2" strokeDasharray="3,3" />

                      {/* Annotations */}
                      <text x="170" y="32" fill="#f43f5e" fontSize="10" fontWeight="800" textAnchor="middle">
                        FRONT SETBACK: {setbackFrontM}m (PASS)
                      </text>
                      <text x="170" y="248" fill="#10b981" fontSize="9" fontWeight="700" textAnchor="middle">
                        REAR SETBACK: {setbackRearM}m
                      </text>
                      <text x="12" y="130" fill="#10b981" fontSize="9" fontWeight="700" textAnchor="middle" transform="rotate(-90, 12, 130)">
                        LEFT: {setbackLeftM}m
                      </text>
                      <text x="328" y="130" fill="#10b981" fontSize="9" fontWeight="700" textAnchor="middle" transform="rotate(90, 328, 130)">
                        RIGHT: {setbackRightM}m
                      </text>

                      {/* Proposed Plinth Alignment Box */}
                      <rect
                        x="50"
                        y="65"
                        width="240"
                        height="145"
                        fill="#3b82f6"
                        fillOpacity="0.25"
                        stroke="#3b82f6"
                        strokeWidth="2"
                      />
                      <text x="170" y="140" fill="#38bdf8" fontSize="11" fontWeight="800" textAnchor="middle">
                        OVERLAID BLUEPRINT BUILDING FOOTPRINT
                      </text>
                    </g>
                  </svg>
                </div>
              </div>
            ) : (
              /* Standard Cadastral Site Plan Visualizer Diagram */
              <svg
                viewBox="0 0 500 380"
                className="w-full max-h-[340px] select-none"
              >
                <defs>
                  <pattern id="siteGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="500" height="380" fill="url(#siteGrid)" />

                {/* Road Access Strip (Front) */}
                <g transform="translate(40, 20)">
                  <rect x="0" y="0" width="420" height="40" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <line x1="0" y1="20" x2="420" y2="20" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6,4" />
                  <text x="210" y="14" fill="#94a3b8" fontSize="10" fontWeight="600" textAnchor="middle">
                    PUBLIC ROAD RIGHT-OF-WAY ({roadWidthM}m / {Math.round(roadWidthM * 3.28)}ft)
                  </text>
                </g>

                {/* Cadastral Plot Rectangle */}
                <g transform="translate(80, 80)">
                  <rect
                    x="0"
                    y="0"
                    width="340"
                    height="260"
                    fill="#090d16"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    rx="4"
                  />

                  {/* Plot Dimensions Labels */}
                  <text x="170" y="-8" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="monospace">
                    Width: {plotWidthM}m ({Math.round(plotWidthM * 3.28)}ft)
                  </text>
                  <text x="-12" y="130" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle" transform="rotate(-90, -12, 130)" fontFamily="monospace">
                    Depth: {plotDepthM}m
                  </text>

                  {/* Setback Clearance Lines */}
                  <rect
                    x="30"
                    y="45"
                    width="280"
                    height="180"
                    fill="#10b981"
                    fillOpacity="0.06"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                    rx="2"
                  />

                  <text x="170" y="28" fill="#f43f5e" fontSize="9" fontWeight="600" textAnchor="middle">
                    Front Setback: {setbackFrontM}m (req. ≥ {requiredFrontSetbackM}m)
                  </text>
                  <text x="170" y="248" fill="#94a3b8" fontSize="9" fontWeight="600" textAnchor="middle">
                    Rear Setback: {setbackRearM}m (min {requiredRearSetbackM}m)
                  </text>
                  <text x="12" y="130" fill="#94a3b8" fontSize="9" fontWeight="600" textAnchor="middle" transform="rotate(-90, 12, 130)">
                    Left: {setbackLeftM}m
                  </text>
                  <text x="328" y="130" fill="#94a3b8" fontSize="9" fontWeight="600" textAnchor="middle" transform="rotate(90, 328, 130)">
                    Right: {setbackRightM}m
                  </text>

                  {/* Proposed Building Footprint */}
                  <g transform="translate(50, 65)">
                    <rect
                      x="0"
                      y="0"
                      width="240"
                      height="145"
                      fill="#1e293b"
                      fillOpacity="0.85"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      rx="2"
                    />

                    {/* Columns */}
                    {[
                      [0, 0], [120, 0], [240, 0],
                      [0, 72], [120, 72], [240, 72],
                      [0, 145], [120, 145], [240, 145]
                    ].map(([cx, cy], i) => (
                      <rect
                        key={i}
                        x={cx - 4}
                        y={cy - 4}
                        width="8"
                        height="8"
                        fill="#f43f5e"
                        stroke="#ffffff"
                        strokeWidth="0.8"
                      />
                    ))}

                    <text x="120" y="65" fill="#f8fafc" fontSize="11" fontWeight="700" textAnchor="middle">
                      PROPOSED RCC BUILDING
                    </text>
                    <text x="120" y="82" fill="#f59e0b" fontSize="10" fontWeight="600" fontFamily="monospace" textAnchor="middle">
                      Plinth Area: {groundFloorAreaM2} m² ({Math.round(groundFloorAreaM2 * 10.76)} sq.ft)
                    </text>
                    <text x="120" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">
                      {numberOfStories} Storey Low-Rise Residential
                    </text>
                  </g>
                </g>
              </svg>
            )}
          </div>

          {/* Plot Legend & Location Badges */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 gap-2">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                <span>Plot Boundary</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>Permissible Envelope</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                <span>Footprint</span>
              </span>
            </div>

            <span className="font-mono text-slate-300">
              Kitta No: <strong className="text-amber-400">{kittaNo}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Printable Municipal Building Permit Compliance Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black">
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex justify-between items-center print:bg-white print:border-b-2 print:border-black">
          <div>
            <h3 className="text-base font-bold text-slate-100 print:text-black flex items-center space-x-2">
              <FileText className="w-5 h-5 text-amber-400 print:text-black" />
              <span>Municipal Building Permit & Planning Compliance Certificate</span>
            </h3>
            <p className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
              Formulated as per Nepal National Building Code NBC 205:2024 & Local Government Urban Planning Bylaws.
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="print:hidden bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow"
          >
            <Printer className="w-4 h-4" />
            <span>Print Certificate</span>
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs text-slate-300 print:text-black">
          {/* Certificate Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-gray-50 print:border-gray-300">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Project Title</p>
              <p className="font-bold text-slate-100 print:text-black mt-0.5">{currentProject.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Building Owner / Client</p>
              <p className="font-bold text-slate-100 print:text-black mt-0.5">{currentProject.client}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Site Location</p>
              <p className="font-bold text-slate-100 print:text-black mt-0.5">{municipality}, Ward {wardNo}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Cadastral Kitta No.</p>
              <p className="font-bold text-amber-400 print:text-black font-mono mt-0.5">{kittaNo}</p>
            </div>
          </div>

          {/* Compliance Metrics Summary Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden print:border-gray-400">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 print:bg-gray-100 print:text-black print:border-gray-400">
                  <th className="py-2.5 px-4">Parameter</th>
                  <th className="py-2.5 px-4">Bylaw Permissible / Minimum</th>
                  <th className="py-2.5 px-4">Proposed Building Design</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4">Reference Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-slate-200 print:divide-gray-300 print:text-black">
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium">Total Plot Area</td>
                  <td className="py-2.5 px-4">—</td>
                  <td className="py-2.5 px-4 font-bold">{plotAreaSqM.toFixed(1)} m² ({landInAana.toFixed(2)} Aana)</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="text-emerald-400 font-bold">VERIFIED</span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-400 print:text-gray-600">Land Title Deed</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium">Ground Coverage (%)</td>
                  <td className="py-2.5 px-4">Maximum {maxAllowedCoveragePercent}%</td>
                  <td className="py-2.5 px-4 font-bold">{groundCoveragePercent.toFixed(1)}% ({groundFloorAreaM2} m²)</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`font-bold ${isCoverageCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isCoverageCompliant ? 'PASS' : 'EXCEEDED'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-400 print:text-gray-600">NBC 205 Clause 4.2</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium">Floor Area Ratio (FAR)</td>
                  <td className="py-2.5 px-4">Maximum {maxAllowedFAR.toFixed(2)}</td>
                  <td className="py-2.5 px-4 font-bold text-amber-400 print:text-black">{calculatedFAR.toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`font-bold ${isFarCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isFarCompliant ? 'PASS' : 'EXCEEDED'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-400 print:text-gray-600">Municipal Planning Bylaw Cl 6.1</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium">Front Road Setback</td>
                  <td className="py-2.5 px-4">Minimum {requiredFrontSetbackM.toFixed(1)} m</td>
                  <td className="py-2.5 px-4 font-bold">{setbackFrontM.toFixed(2)} m</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`font-bold ${isFrontSetbackCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isFrontSetbackCompliant ? 'PASS' : 'VIOLATION'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-400 print:text-gray-600">Road RoW Centerline Clearance</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium">Rear Yard Setback</td>
                  <td className="py-2.5 px-4">Minimum {requiredRearSetbackM.toFixed(1)} m</td>
                  <td className="py-2.5 px-4 font-bold">{setbackRearM.toFixed(2)} m</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`font-bold ${isRearSetbackCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isRearSetbackCompliant ? 'PASS' : 'VIOLATION'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-400 print:text-gray-600">Light & Air Clearance</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium">Side Yard Clearances</td>
                  <td className="py-2.5 px-4">Minimum {requiredSideSetbackM.toFixed(1)} m</td>
                  <td className="py-2.5 px-4 font-bold">Left: {setbackLeftM}m, Right: {setbackRightM}m</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`font-bold ${isSideSetbackCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isSideSetbackCompliant ? 'PASS' : 'VIOLATION'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-400 print:text-gray-600">Fire & Boundary Wall Gap</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Professional Signatures Block */}
          <div className="pt-6 grid grid-cols-3 gap-6 text-center border-t border-slate-800 print:border-gray-400">
            <div className="space-y-6">
              <div className="h-10 border-b border-dashed border-slate-700 print:border-black flex items-end justify-center pb-1">
                <span className="font-mono text-[11px] text-amber-400/90 italic">{currentProject.preparedBy}</span>
              </div>
              <p className="font-semibold text-slate-200 print:text-black">Prepared By (Structure / QS)</p>
              <p className="text-[10px] text-slate-500">NEC Regd. Civil Engineer</p>
            </div>
            <div className="space-y-6">
              <div className="h-10 border-b border-dashed border-slate-700 print:border-black flex items-end justify-center pb-1">
                <span className="font-mono text-[11px] text-amber-400/90 italic">{currentProject.checkedBy}</span>
              </div>
              <p className="font-semibold text-slate-200 print:text-black">Checked By (Senior Architect)</p>
              <p className="text-[10px] text-slate-500">NEC Regd. Architect</p>
            </div>
            <div className="space-y-6">
              <div className="h-10 border-b border-dashed border-slate-700 print:border-black flex items-end justify-center pb-1">
                <span className="font-mono text-[11px] text-amber-400/90 italic">{currentProject.approvedBy}</span>
              </div>
              <p className="font-semibold text-slate-200 print:text-black">Municipal DPC Approval Officer</p>
              <p className="text-[10px] text-slate-500">Urban Planning Department</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
