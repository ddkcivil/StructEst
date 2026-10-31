# PARTIMA Proposed Estimate — extracted structure

Source: `C:\Users\LENOVO\Downloads\PARTIMA  PURPOSED ESTIMATE  22.pdf` (13 pages)

## The two layers (this is the key insight)

The document has TWO distinct sections, and they are NOT the same thing:

### 1. BOQ / Cost Estimate  (pages 2-4)  — 23 FIXED items
Each item = one line with: description, unit, quantity, RATE, amount (= qty × rate).
Section "A Civil Works" → summary → Net Payable.

### 2. Measurement Sheet / Quantity Take-off (मापनको आयाम)  (pages 5-13)
The SAME 23 items, but each is broken into SUB-LINES of dimensions
(लंबाई Length × चौडाई Width / ब्रेड्थ × उँचाई Height, with deductions shown as negative).
Sub-line dimensions SUM to the item's total quantity.
This is where extracted/drawn quantities land FIRST.

## The 23 standard BOQ items (S.N. | unit | description)
 1. Site Management & Site Clearance            — Ls
 2. Earth Work in Excavation                    — CuM
 3. Earth Work in Filling                       — CuM
 4. Stone/Boulder Soling                        — CuM
 5. Plain Cement Concrete (P.C.C.) work         — CuM
 6. P.C.C. for R.C.C (M20)                      — CuM
 7. Steel Reinforcement (Fe 500)                — Kg
 8. Formwork (centering/shuttering)             — SqM
 9. Brick Work (1:4 CM, foundation+superstruct) — CuM
10. Cement Sand Plaster (20mm, 1:5)             — SqM
11. Distemper Painting (double coat)            — SqM
12. M.S. Grill                                  — SqM
13. Sal Chaukhat (Sal wood frame)               — CuM
14. Ready-made single-panel doors               — SqM
15. UPVC windows/louvre                         — SqM
16. Electrical Works (NS standard)              — Ls
17. Sanitary Works (NS standard)                — Ls
18. Granite Works                               — SqM
19. Ceramic vitrified tiles                     — SqM
20. Staircase railing (SS 202)                  — RM (running metre)
21. Metal Gate                                  — Ls
22. Grills / wood door paints                   — Ls
23. Compound Wall Railing                       — Ls

## Mapping to the app (current reality — restructured)

All quantity entry points now go through the MEASUREMENT SHEET first
(sub-lines L×W×H, deductions as negative lines), then aggregate into the 23 items:

- **DXF extraction** → `buildStandardBoqFromExtraction` emits standard items that
  carry their detail as `subDivisions`; pushing merges the lines into the existing
  S.N. row and re-syncs the summary qty (`applySubdivisionSync`).
- **Canvas — "Standard schedule" mode (default)** → `handleSaveStandardLinesToBOQ`
  groups measurements by S.N., creates the standard item on first use, appends
  measurement-sheet lines and syncs the quantity.
- **Canvas — "Existing item" mode** → `handleSaveSubdivisionToBOQ` attaches lines
  as subdivision rows under the chosen item.
- **Canvas — "New BOQ item" mode (escape hatch)** → sheet-backed: each saved
  measurement becomes the gross L×W×H line plus a negative opening-deduction line,
  and the App-side save handlers run `applySubdivisionSync`, so the summary qty
  always equals the subdivision sum.
- The old direct-push builders (`buildBoqItems` in dxfTakeoff, `toBOQItems` in
  takeoffGeometry) were **removed** — nothing pushes a bare row anymore.

Formula: item quantity = Σ subdivision lines (+ wastage); amount = qty × rate.

## Units used: Ls, CuM, SqM, Kg, RM (running metre)
