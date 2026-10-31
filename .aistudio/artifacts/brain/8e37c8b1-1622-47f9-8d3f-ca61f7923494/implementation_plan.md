# Implementation Plan - Refactoring App.tsx & Modularizing State & Tab Orchestration

## User Review & Critical Decisions

> [!IMPORTANT]
> The app is being refactored to modularize the large monolithic App.tsx component into cleaner domain sub-components and custom hooks, improving maintainability, code readability, and state encapsulation.

- **Confirmed Decision 1**: Modularize App.tsx into dedicated domain sub-components and custom hooks.
- **Confirmed Decision 2**: Maintain 100% feature parity with existing BOQ, Take-Off, DXF Inspector, Materials Library, NBC Compliance, and User Management modules.

---

## 1. Overview & Core Concept

- **What It Does**: Refactors the monolithic `App.tsx` (which manages multiple tabs, projects, materials, BOQ items, CAD parsing, and modal states) into clean, modular domain components and state management hooks.
- **Target Audience / Persona**: Engineers, estimators, and project managers using StructEst Pro for Nepal municipal and structural estimation.
- **Key Value**: Cleaner codebase architecture, easier testability, and isolated component rendering without performance degradation.

---

## 2. User Experience & Visual Design

- **Key User Flows**: Unchanged navigation and tab switching across Dashboard, BOQ, Take-Off, Materials Library, Blueprint Inspector, AI Auditor, Reports, Settings, Users, and NBC 205 / Municipal Planning.
- **Visual Identity & Theme**: Retains existing professional dark-mode Tailwind theme (`slate-950` background with amber accents).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Extract state handlers into custom hooks (e.g. `useProjects`, `useMaterials`, `useCadTakeoff`).
- **Decision 2**: Keep all existing local storage persistence and robust fallback initializers intact.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                        App.tsx                         │
│             (Root Orchestrator & Shell)                │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐
│ Custom Hooks          │        │ Tab / View Components │
│ - useProjects         │        │ - BoqWorkspace        │
│ - useMaterials        │        │ - TakeOffWorkspace    │
│ - useCadState         │        │ - MaterialsLibrary    │
└───────────────────────┘        │ - NbcMunicipalComp    │
                                 └───────────────────────┘
```
