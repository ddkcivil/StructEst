import express from 'express';
import { fileURLToPath } from 'url';
import http from 'http';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { connectDB, Project, MaterialRate, User } from './db.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
   dotenv.config({ path: path.join(__dirname, '.env') });
   // Connect to MongoDB
   await connectDB();
   // Seed admin user if not exists
   try {
     const existing = await User.findOne({ email: 'dharmadkunwar20@gmail.com' });
     if (!existing) {
       await new User({
         id: 'user-1',
         firstName: 'Dharma',
         middleName: '',
         lastName: 'Kunwar',
         name: 'Dharma Kunwar',
         email: 'dharmadkunwar20@gmail.com',
         password: 'ddK@152207',
         role: 'admin',
         department: 'Engineering & Project Leadership',
         avatarBg: 'bg-amber-500 text-slate-950',
         status: 'approved',
         permissions: { canEditBoq: true, canRunAiTakeoff: true, canEditRates: true, canManageUsers: true, canApproveReport: true, canExportData: true },
         createdAt: new Date().toISOString(),
       }).save();
       console.log('Seeded admin user');
     }
   } catch (e) { console.error('Seed error', e); }
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json());

  // Gemini API helper endpoint
  app.post('/api/gemini-estimate', async (req, res) => {
    try {
      const { prompt, projectData } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const modelName = 'gemini-2.5-flash';

      const systemInstruction = `You are a Senior Construction Estimator and Quantity Surveyor with 20+ years of expertise in architectural, structural, and MEP takeoff, Bill of Quantities (BOQ), material rate analysis, wastage factors (5% brick/steel, 3% concrete), and local building standards. Provide professional, accurate, and structured advice, BOQ cross-checks, formula audits, and executive summaries.`;

      const chatSession = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction,
          temperature: 0.2,
        }
      });

      const fullPrompt = `Project Context: ${JSON.stringify(projectData || {})} \n\nUser Question / Task: ${prompt}`;
      const response = await chatSession.sendMessage({ message: fullPrompt });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate AI estimation insight.' });
    }
  });

  // AI layer mapper: proposes layer/block → standard-name mapping for messy DXF
  // files. Purely advisory — the client validates every suggestion against the
  // live standards (normalizeSuggestion in dxfTakeoff.ts) and the user approves
  // each row before anything is applied. Geometry is never involved.
  app.post('/api/gemini-layer-map', async (req, res) => {
    try {
      const { fingerprint } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }
      if (!fingerprint || !Array.isArray(fingerprint.layers)) {
        return res.status(400).json({ error: 'Missing drawing fingerprint.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const modelName = 'gemini-2.5-flash';

      // Mirror of DXF_STANDARD_LAYERS in src/components/takeoff/dxfTakeoff.ts.
      // Kept as literals here so the server never imports the client module
      // graph; authoritative validation happens client-side in normalizeSuggestion().
      const standardLayers = [
        'A-WALL-EXT: external brick/block wall centerlines (length)',
        'A-WALL-INT: internal partition wall centerlines (length)',
        'A-DOOR: door symbols (count)',
        'A-WIND: window symbols (count)',
        'S-COLS: RCC columns, closed outline (area)',
        'S-BEAM: beam centerlines (length)',
        'S-SLAB: slab outline, closed (area)',
        'P-SANTRY: sanitary fixtures WC/basin/sink (count)',
        'A-ROOM: room name tags (labels only)',
        'A-GRID: grid lines (reference only)',
        'A-FURN: furniture (excluded from BOQ)',
        'A-ANNO-TEXT: notes/title block (excluded)',
        'A-ANNO-DIMS: dimensions (excluded)',
        'DEFPOINTS: CAD construction points (excluded)'
      ].join('\n- ');

      const systemInstruction = `You are a CAD standards specialist preparing a drawing for automated quantity take-off.
For every layer and every INSERT block in the drawing fingerprint, propose a mapping to the app's component standard.
Component kinds: wall, column, beam, slab, door, window, toilet, fixture, ignore.
Layer targets (use exactly, prefixed with "- " below): \n- ${standardLayers}
Block targets (use exactly): DOOR_SYM, WIN_SYM, COL_SYM, WC, SINK — only for door/window/column/toilet/fixture symbols; use kind "ignore" for any other block.
Return ONLY JSON of shape: {"suggestions":[{"sourceType":"layer"|"block","sourceName":"<exact name from fingerprint>","targetKind":"<kind>","targetStandard":"<standard layer or block name>","confidence":0.0,"reason":"<short rationale>"}]}.
Rules:
- Use kind "ignore" (targetStandard "") for annotation, dimensions, hatching, furniture, title blocks, grids, and anything unrecognizable.
- Judge from the entity mix, geometry stats (lengthM vs closed areaM2 vs counts), text tags and names.
- Emit one suggestion per fingerprint entry; never invent names not present in the fingerprint.
- confidence is a 0..1 probability that the mapping is correct.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Drawing fingerprint:\n${JSON.stringify(fingerprint)}`,
        config: { systemInstruction, temperature: 0.1, responseMimeType: 'application/json' }
      });
      const text = (response.text || '').trim();
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const parsed = JSON.parse(jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : '{}');
      res.json({ suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [] });
    } catch (error: any) {
      console.error('Gemini Layer Map Error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate layer mapping suggestions.' });
    }
  });

  // AI CAD Take-Off Extraction Endpoint
  // Analyzes CAD vector geometry aggregates (layers, line lengths, closed polyline areas, blocks)
  // and produces a comprehensive Bill of Quantities (BOQ) Take-Off list with sub-divisions.
  app.post('/api/ai-cad-takeoff', async (req, res) => {
    try {
      const { fileName, cadSummary, projectContext, assumptions } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const modelName = 'gemini-2.5-flash';

      const systemInstruction = `You are an expert Senior Chartered Quantity Surveyor (FRICS) specializing in automated CAD/BIM Take-Off, standard method of measurement (IS:1200 / NRM2 / SMM7), and structural estimation.

Your job is to analyze CAD vector geometry aggregates (layers, line lengths, closed polyline areas, blocks for doors/windows/columns, and dimension annotations) extracted from a CAD DXF drawing, and produce a comprehensive, professional Bill of Quantities (BOQ) Take-Off list.

CRITICAL ESTIMATION & SUB-DIVISION SPECIFICATIONS:
1. Every generated BOQ item MUST include granular measurement sub-divisions in 'subDivisions'.
2. Classify items into standard engineering categories:
   - 'Earthwork' (Excavation, backfilling, foundation trenches)
   - 'Substructure' (Boulder soling, PCC in foundation, DPC)
   - 'Superstructure' (Brickwork in 1:4 / 1:6 CM, RCC in columns/beams/slabs)
   - 'Reinforcement' (Fe 500 TMT rebars estimated by standard density ~80-100 kg/m³ of concrete)
   - 'Formwork' (centering/shuttering for beams, columns, slabs)
   - 'Finishing' (plastering, painting, distemper, polishing)
   - 'MEP Works' (electrical, sanitary, plumbing)
   - 'Civil Works' (roads, drainage, landscaping)
3. Each BOQ item must have: category, description, unit, length, width, height, qty, wastagePercent, unitRate, cadSourceLayer, confidenceScore, subDivisions, deductionNotes
4. Sub-divisions must include: id, description, qty (positive for gross, negative for deductions), length, width, height
5. Apply standard wastage: 5% for brick/steel, 3% for concrete
6. Include deductions for openings (windows, doors, voids) as negative sub-lines
7. Total item quantity = sum of all sub-division quantities (+ wastage)
8. Amount = item quantity × unit rate
9. Group by standard BOQ item numbers (1-23 as per Partima standard)
10. Return structured JSON with 'summary' and 'items' at top level`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Project Context: ${JSON.stringify(projectContext || {})} \\n\\nCAD Summary: ${JSON.stringify(cadSummary || {})} \\n\\nUser Question / Task: Generate BOQ Take-Off from CAD data ${fileName ? `(${fileName})` : ''}`,
        config: {
          systemInstruction,
          temperature: 0.1,
        },
      });

      const parsedData = JSON.parse(response.text || '{}');
      res.json(parsedData);
    } catch (error: any) {
      console.error('AI CAD Takeoff Error:', error);
      res.status(500).json({ error: error.message || 'Failed to extract BOQ takeoff from CAD data.' });
    }
  }); // end ai-cad-takeoff

// ========== AI IMAGE TAKE-OFF ENDPOINT ==========
app.post('/api/ai-image-takeoff', async (req, res) => {
  const { imageDataUrl, fileName, projectContext, assumptions, instructions } = req.body;

  if (!imageDataUrl) {
    return res.status(400).json({ error: 'No image data provided.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' });
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash';

  const systemInstruction = `You are a Senior Construction Estimator and Quantity Surveyor. Analyze the uploaded blueprint image (PNG/JPG floor plan) and extract measurable construction elements. Return a JSON array of items with fields: id, value, unit, type ('length'|'area'|'count'), description, cadSourceLayer, confidenceScore, subDivisions. Focus on: wall lengths, room areas, door/window counts, slab areas, column counts. If uncertain, estimate based on standard drawing scales and note assumptions.`;

  const chatSession = ai.chats.create({
    model: modelName,
    config: { systemInstruction, temperature: 0.2 },
  });

  const response = await chatSession.sendMessage({
    message: [
      { text: `Blueprint image: ${fileName}. Project context: ${JSON.stringify(projectContext)}. Instructions: ${instructions || 'Extract all measurable elements.'}` },
      { inlineData: { mimeType: 'image/png', data: imageDataUrl.split(',')[1] } }
    ]
  });

  const text = response.text || '';
  let result;
  try { result = JSON.parse(text); }
  catch {
    const js = text.indexOf('[');
    const je = text.lastIndexOf(']');
    if (js >= 0 && je > js) {
      try { result = JSON.parse(text.substring(js, je + 1)); }
      catch { result = { error: 'Failed to parse AI response as JSON', raw: text }; }
    } else { result = { error: 'AI response did not contain a JSON array', raw: text }; }
  }

  res.json(result);
});

// ========== PROJECT CRUD ENDPOINTS ==========

  // PDF take-off verification: cross-check mined dimensions against the
  // estimator's expectations. Purely advisory — returns a JSON list of
  // {check, status: 'pass'|'warn'|'fail', detail}. No geometry is involved.
  app.post('/api/gemini-verify-takeoff', async (req, res) => {
    try {
      const { dims, summary } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }
      if (!dims || !Array.isArray(dims)) {
        return res.status(400).json({ error: 'Missing mined dimensions.' });
      }
      const ai = new GoogleGenAI({ apiKey });
      const modelName = 'gemini-2.5-flash';
      const systemInstruction = `You are a Senior Quantity Surveyor auditing an automated take-off from a Nepal residential drawing (Mrs. Jalsa Kunwar residence, Tilottama-06).
Known facts: plot 0-0-10 (~169 m²), footprint 35'-0" x 28'-6" (10.67x8.68m), ground plinth 903 sq.ft (83.88 m²), footings F1 2.0x2.0 / F2 1.8x1.8 / F3 1.5x1.5 (D350/d200, 12Ø@130), beams 230x300/350x600/230x350/250x400, columns 300x300, slabs 125/150mm, M20/TMT500.
Audit the mined dimensions JSON for: (1) room areas vs stated plinth, (2) footing sizes vs schedule, (3) opening codes vs schedule counts, (4) member sections vs known list, (5) any duplicated or missing codes.
Return ONLY JSON: {"checks":[{"check":"<name>","status":"pass|warn|fail","detail":"<one line>"}]}.`;
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Mined dimensions:\n${JSON.stringify(dims)}\nSummary:\n${JSON.stringify(summary || {})}`,
        config: { systemInstruction, temperature: 0.1, responseMimeType: 'application/json' }
      });
      const text = (response.text || '').trim();
      const js = text.indexOf('{');
      const je = text.lastIndexOf('}');
      const parsed = JSON.parse(js >= 0 && je > js ? text.slice(js, je + 1) : '{}');
      res.json({ checks: Array.isArray(parsed.checks) ? parsed.checks : [] });
    } catch (error: any) {
      console.error('Gemini Verify Error:', error);
      res.status(500).json({ error: error.message || 'Failed to verify take-off.' });
    }
  });
  const dwgUpload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (/\.dwg$/i.test(file.originalname)) cb(null, true);
      else cb(new Error('Only .dwg files are accepted here.'));
    }
  });

  const mineDwgStrings = (tmpPath: string): string[] => {
    try {
      const raw = fs.readFileSync(tmpPath);
      const runs = raw.toString('latin1').match(/[ -~]{6,}/g) || [];
      const seen = new Set<string>();
      const picks: string[] = [];
      const dimRe = /(\d+\s*[x×]\s*\d+|\d+\s*[Øø]\s*@|M\s?20|TMT|C\/C|mm\b|F\s?\d|D\s?\d|W\s?\d|@\s?\d+)/i;
      for (const r of runs) {
        const t = r.trim();
        if (t.length < 6 || t.length > 220 || seen.has(t)) continue;
        seen.add(t);
        if (/ProductInformation|prop_set|Trusted DWG|Autodesk/i.test(t)) continue;
        if (dimRe.test(t)) picks.push(t.slice(0, 200));
        if (picks.length >= 120) break;
      }
      return picks;
    } catch { return []; }
  };

  const tryOdaConvert = async (tmpPath: string): Promise<{ ok: boolean; layers: string[]; ents: number; err?: string }> => {
    let odaBin = process.env.ODA_CONVERTER_PATH || 'ODAFileConverter';
    try { await execFileAsync(odaBin, ['--help']); }
    catch { return { ok: false, layers: [], ents: 0 }; }
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'structest-dxf-'));
    const inDir = fs.mkdtempSync(path.join(os.tmpdir(), 'structest-dwg-'));
    try {
      fs.copyFileSync(tmpPath, path.join(inDir, 'in.dwg'));
      await execFileAsync(odaBin, [inDir, outDir, 'ACAD2013', 'DXF', '0', '1']);
      const dxfFile = fs.readdirSync(outDir).find((f) => /\.dxf$/i.test(f));
      if (!dxfFile) return { ok: false, layers: [], ents: 0 };
      const dxfText = fs.readFileSync(path.join(outDir, dxfFile), 'utf8');
      const layerSet = new Set<string>();
      const layerRe = /\n\s*8\s*\n([^\n\r]+)/g;
      let lm: RegExpExecArray | null;
      let guard = 0;
      while ((lm = layerRe.exec(dxfText)) !== null && guard++ < 5000) {
        const nm = lm[1].trim();
        if (nm && nm !== '0') layerSet.add(nm.slice(0, 64));
      }
      const ents = (dxfText.match(/\n\s*0\s*\n(LINE|LWPOLYLINE|POLYLINE|ARC|CIRCLE|INSERT|TEXT|MTEXT|DIMENSION)\s*\n/g) || []).length;
      return { ok: true, layers: [...layerSet].slice(0, 60), ents };
    } catch (e: any) {
      return { ok: false, layers: [], ents: 0, err: String(e?.message || e).slice(0, 200) };
    } finally {
      try { fs.rmSync(inDir, { recursive: true, force: true }); } catch { /* noop */ }
      try { fs.rmSync(outDir, { recursive: true, force: true }); } catch { /* noop */ }
    }
  };
  // ---- AI DWG extraction: upload .dwg, mine text strings server-side,
  // optionally convert via ODA when installed, then Gemini reconciles the
  // evidence into typed take-off dims (MinedDimension shape, page=1).
  app.post('/api/dwg-extract', dwgUpload.single('dwgFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No DWG file uploaded.' });
      }
      const tmpPath = req.file.path;
      const textStrings = mineDwgStrings(req.file.path);
      const textBlob = textStrings.join('\n');
      // Now we need to call the Gemini AI to extract dimensions from this text.
      // We can reuse the same logic as in /api/gemini-estimate but with a specific prompt.
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }
      const ai = new GoogleGenAI({ apiKey });
      const modelName = 'gemini-2.5-flash';
      const systemInstruction = `You are a Senior Construction Estimator and Quantity Surveyor with 20+ years of expertise in architectural, structural, and MEP takeoff, Bill of Quantities (BOQ), material rate analysis, wastage factors (5% brick/steel, 3% concrete), and local building standards. Extract all dimensions (length, area, count) from the following text snippets from a DWG drawing. Return a JSON array of objects with the following fields: id (string), value (number), unit (string), type ('length'|'area'|'count'), description (string). If a snippet does not contain a dimension, skip it.`;
      const fullPrompt = `Text snippets from DWG:\n\n${textBlob}`;
      const chatSession = ai.chats.create({
        model: modelName,
        config: { systemInstruction, temperature: 0.2 },
      });
      const response = await chatSession.sendMessage({ message: fullPrompt });
      const text = response.text;
      // We expect the AI to return a JSON array. We'll try to parse it.
      let result;
      if (text === undefined) {
        result = { error: 'AI response text is undefined' };
      } else {
        try {
          result = JSON.parse(text);
        } catch (e) {
          // If the AI didn't return valid JSON, we can try to extract JSON from the text.
          const js = text.indexOf('[');
          const je = text.lastIndexOf(']');
          if (js >= 0 && je > js) {
            try {
              result = JSON.parse(text.substring(js, je + 1));
            } catch (e2) {
              result = { error: 'Failed to parse AI response as JSON', raw: text };
            }
          } else {
            result = { error: 'AI response did not contain a JSON array', raw: text };
          }
        }
      }
      // Clean up the temporary file
      try { fs.unlinkSync(tmpPath); } catch {}
      res.json(result);
    } catch (error: any) {
      console.error('DWG extraction error:', error);
      try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
      res.status(500).json({ error: error.message || 'Failed to extract from DWG.' });
    }
  });

// ========== PROJECT CRUD ENDPOINTS ==========

// GET all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find({});
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET a single project by ID
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new project
app.post('/api/projects', async (req, res) => {
  try {
    const project = new Project(req.body);
    await project.save();
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// UPDATE a project by ID
app.put('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE a project by ID
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ id: req.params.id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== MATERIAL RATE CRUD ENDPOINTS ==========

// GET all material rates
app.get('/api/material-rates', async (req, res) => {
  try {
    const rates = await MaterialRate.find({});
    res.json(rates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET a single material rate by ID
app.get('/api/material-rates/:id', async (req, res) => {
  try {
    const rate = await MaterialRate.findOne({ id: req.params.id });
    if (!rate) {
      return res.status(404).json({ error: 'Material rate not found' });
    }
    res.json(rate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new material rate
app.post('/api/material-rates', async (req, res) => {
  try {
    const rate = new MaterialRate(req.body);
    await rate.save();
    res.status(201).json(rate);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// UPDATE a material rate by ID
app.put('/api/material-rates/:id', async (req, res) => {
  try {
    const rate = await MaterialRate.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
     );
     if (!rate) {
       return res.status(404).json({ error: "Material rate not found" });
     }
     res.json(rate);
   } catch (error: any) {
     res.status(400).json({ error: error.message });
   }
 });
  // ========== AUTH ENDPOINTS ==========
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || user.password !== password) {
        return res.status(401).json({ ok: false, error: 'Invalid email or password' });
      }
      if ((user.status ?? 'approved') !== 'approved') {
        return res.status(403).json({ ok: false, error: 'Account pending admin approval' });
      }
      res.json({ ok: true, user });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });



// DELETE a material rate by ID
app.delete('/api/material-rates/:id', async (req, res) => {
  try {
    const rate = await MaterialRate.findOneAndDelete({ id: req.params.id });
    if (!rate) {
      return res.status(404).json({ error: 'Material rate not found' });
    }
    res.json({ message: 'Material rate deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
  // ========== USER CRUD ENDPOINTS ==========
  app.get('/api/users', async (_req, res) => {
    try { res.json(await User.find({})); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/users', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.status(201).json(u); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.put('/api/users/:id', async (req, res) => {
    try {
      const u = await User.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
      if (!u) return res.status(404).json({ error: 'User not found' });
      res.json(u);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete('/api/users/:id', async (req, res) => {
    try {
      const u = await User.findOneAndDelete({ id: req.params.id });
      if (!u) return res.status(404).json({ error: 'User not found' });
      res.json({ message: 'User deleted' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });


  // Vite middleware setup for development (HMR shares the same HTTP server,
  // so the client connects back on the app port — no separate :24678 socket).
  const httpServer = http.createServer(app);
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(Number(port), '0.0.0.0', () => {
    console.log(`StructEst Pro server running at http://localhost:${port}`);
  });
}

startServer();




