# StructEst Pro — CAD Drawing Standard for Automatic Take-Off

Follow this standard and StructEst will extract walls, columns, beams, slabs,
doors, windows and sanitary fixtures **automatically** — no manual measurement.
If you only have DWG, convert it to DXF first (AutoCAD "Save As → DXF", or a
free ODA File Converter). DWG cannot be read directly.

## 1. Units — author in METERS

- Set the drawing unit to **meters** and set the DXF header variable
  `$INSUNITS = 6`. StructEst reads this to know the drawing scale.
- If `$INSUNITS` is missing, StructEst auto-guesses the unit from the drawing
  size (mm / cm / m / ft) and flags it as "auto-guessed" — verify it in-app.
- Draw geometry at true size (e.g. a 9 m wall is 9.0 units long).
- Do **not** draw 1 unit = 1 mm or 1 unit = 1 inch — quantities will be wrong.
- If you cannot set meters, set a known scale and calibrate manually in-app.

## 2. Layer standard

Put each component type on its recommended layer. Layer names are matched
case-insensitively and also by keyword, so `A-WALL-EXT` and `walls_outer` both
work — but the exact names below extract with zero guessing.

| Layer | Purpose | How it is measured |
| --- | --- | --- |
| `A-WALL-EXT` | External brick/block walls (centerline) | Length → m (× thickness × height = m³) |
| `A-WALL-INT` | Internal partition walls (centerline) | Length → m |
| `A-DOOR` | Door leaf symbols as INSERT blocks (DOOR_*) | Count → pcs (deducts area in walls/plaster) |
| `A-WIND` | Window symbols as INSERT blocks (WIN_*) | Count → pcs (deducts area) |
| `S-COLS` | RCC columns (closed LWPOLYLINE or COL_* block) | Area → m² (× height = m³), or count |
| `S-BEAM` | Beam centerlines (LINE / LWPOLYLINE) | Length → m (× section = m³) |
| `S-SLAB` | Slab outline (closed LWPOLYLINE) | Area → m² (× thickness = m³) |
| `P-SANTRY` | Sanitary fixtures: WC, basin, sink (INSERT blocks) | Count → pcs |
| `A-ROOM` | Room name tags (TEXT / MTEXT) | Labels (drives area schedule) |
| `A-GRID` | Column grid lines | Reference only |
| `A-FURN` | Furniture & fittings | Excluded from BOQ |
| `A-ANNO-TEXT` | Notes & title block | Excluded from BOQ |
| `A-ANNO-DIMS` | Dimension entities | Excluded from BOQ |
| `DEFPOINTS` | CAD construction points | Excluded from BOQ |

## 3. Block symbol naming (doors, windows, columns, fixtures)

Doors, windows, columns and sanitary fixtures should be **INSERT block symbols**,
not loose geometry. Block names are the strongest signal StructEst reads, so name
them with a component prefix:

- DOOR_900 / DOOR_750 / DOOR_3-7   → door leaf symbol (swing arc + leaf lines)
- WIN_1200 / WIN_4X5              → window symbol (frame rectangle + mullions)
- COL_300X450 / PILLAR_1          → column symbol (footprint cross-section)
- WC / SINK / BASIN / SHOWER      → sanitary fixture symbol
- Prefix every symbol block with the component type so it extracts by name.

If a symbol is left as an anonymous block, StructEst falls back to a geometric
heuristic (an ARC + lines = door; a plain rectangle = window), but explicit
names are far more reliable.

## 4. Supported geometry — curves are measured exactly

StructEst flattens every entity to true geometry before measuring, so these
all contribute correct quantities:

- **LINE / LWPOLYLINE / POLYLINE** — including polyline **bulges**: arcs between
  vertices are measured along the curve, never the straight chord.
- **ARC / CIRCLE** — measured as radius × sweep angle (a quarter-circle wall bay
  is its true arc length; round columns use the full circumference).
- **ELLIPSE / SPLINE** — tessellated and measured along the curve.
- **INSERT blocks** — block contents are flattened with their rotation and scale,
  so nested symbols render in the preview and their geometry can be measured.
- Annotation noise (dimensions, hatches, DEFPOINTS, title-block layers) is
  hidden by default — toggle any layer back on from the layer list.

## 5. What each component becomes in the BOQ

| Component | BOQ label | Category | Measure |
| --- | --- | --- | --- |
| wall | Brick Masonry / Wall | Superstructure | length |
| column | RCC Column | Superstructure | area |
| beam | RCC Beam | Superstructure | length |
| slab | RCC Slab | Superstructure | area |
| window | Window | Finishing | count |
| door | Door | Finishing | count |
| toilet | Sanitary Fixture (WC) | MEP Works | count |
| fixture | Sanitary Fitting (basin/sink) | MEP Works | count |

- **length** measures (walls, beams) → run length in m; × thickness × height = m³.
- **area** measures (columns, slab) → footprint/surface area in m²; × height/thickness = m³.
- **count** measures (doors, windows, fixtures) → number of symbols found (pcs).

## 6. Quick checklist before exporting

- [ ] `$INSUNITS = 6` (meters) set in the header.
- [ ] Walls drawn as centerline LINE / LWPOLYLINE on a `*WALL*` layer.
- [ ] Columns as a closed outline (or a `COL_*` block) on a `*COL*` layer.
- [ ] Beams as centerlines on a `*BEAM*` layer; slab as a closed outline on a `*SLAB*` layer.
- [ ] Doors/windows as INSERT blocks named `DOOR_*` / `WIN_*`.
- [ ] Fixtures as INSERT blocks named `WC` / `SINK` / `BASIN`.
- [ ] Saved as **DXF** (not DWG).

## 7. Non-standard drawings — AI Layer Mapper

Drawings that do not follow this standard still extract. Import the DXF, open
the AutoCAD Vector tab and run the **AI Layer Mapper**: Gemini proposes layer
and block renames toward the standard from a geometry fingerprint (entity mix,
lengths, closed areas, text tags — never the drawing geometry itself). You
review every row and apply the ones you accept; annotations can be marked
"ignore". Renames rewrite names only — geometry is never changed — the app
re-extracts immediately, and the normalized DXF is available for download so
what you measured is exactly what you keep.
