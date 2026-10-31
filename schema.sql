-- Database schema for StructEst Pro
-- SQLite compatible

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client TEXT,
    location TEXT,
    currency TEXT,
    fiscalYear TEXT,
    duration TEXT,
    companyName TEXT,
    companyAddress TEXT,
    preparedBy TEXT,
    checkedBy TEXT,
    approvedBy TEXT,
    standardWallHeight REAL, -- meters
    wastageDefault REAL, -- percent
    vatPercent REAL, -- percent
    contingencyPercent REAL, -- percent
    createdAt TEXT NOT NULL -- ISO timestamp
);

-- Measurement items table
CREATE TABLE IF NOT EXISTS measurement_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    category TEXT NOT NULL, -- MeasurementCategory enum as text
    description TEXT NOT NULL,
    unit TEXT NOT NULL, -- e.g., 'm³', 'm²', 'm', 'rft', 'pcs', 'kg', 'bags', 'tons'
    length REAL NOT NULL DEFAULT 1,
    width REAL NOT NULL DEFAULT 1,
    height REAL NOT NULL DEFAULT 1,
    qty REAL NOT NULL DEFAULT 0,
    wastagePercent REAL NOT NULL DEFAULT 0, -- percent
    unitRate REAL NOT NULL DEFAULT 0,
    deductionsArea REAL, -- nullable, for openings
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Subdivision lines table (detail for measurement items)
CREATE TABLE IF NOT EXISTS subdivision_lines (
    id TEXT PRIMARY KEY,
    measurement_item_id TEXT NOT NULL,
    description TEXT NOT NULL,
    qty REAL NOT NULL,
    length REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    FOREIGN KEY (measurement_item_id) REFERENCES measurement_items(id) ON DELETE CASCADE
);

-- Material rates table
CREATE TABLE IF NOT EXISTS material_rates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    rate REAL NOT NULL DEFAULT 0,
    supplier TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_measurement_items_project_id ON measurement_items(project_id);
CREATE INDEX IF NOT EXISTS idx_subdivision_lines_measurement_item_id ON subdivision_lines(measurement_item_id);