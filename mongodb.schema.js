/**
 * MongoDB schema definitions for StructEst Pro
 * Using Mongoose ODM
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

// SubDivisionLine schema
const subDivisionLineSchema = new Schema({
  id: { type: String, required: true },
  description: { type: String, required: true },
  qty: { type: Number, required: true },
  length: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true }
}, { _id: false }); // We don't need MongoDB's auto _id for embedded docs? We'll keep our own id.

// MeasurementItem schema
const measurementItemSchema = new Schema({
  id: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Site Prep', 'Earthwork', 'Substructure', 'Superstructure', 'Formwork', 'Reinforcement', 'Finishing', 'MEP Works', 'Civil Works', 'Finishes & MEP']
  },
  description: { type: String, required: true },
  unit: { 
    type: String, 
    required: true,
    enum: ['m³', 'm²', 'm', 'rft', 'pcs', 'kg', 'bags', 'tons']
  },
  length: { type: Number, required: true, default: 1 },
  width: { type: Number, required: true, default: 1 },
  height: { type: Number, required: true, default: 1 },
  qty: { type: Number, required: true, default: 0 },
  wastagePercent: { type: Number, required: true, default: 0 },
  overheadsPercent: { type: Number, required: true, default: 0 }, // overheads & profit percentage
  unitRate: { type: Number, required: true, default: 0 },
  deductionsArea: { type: Number }, // nullable
  subDivisions: { type: [subDivisionLineSchema], default: [] }
});

// Project schema
const projectSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  client: { type: String },
  location: { type: String },
  currency: { type: String },
  fiscalYear: { type: String },
  duration: { type: String },
  companyName: { type: String },
  companyAddress: { type: String },
  preparedBy: { type: String },
  checkedBy: { type: String },
  approvedBy: { type: String },
  standardWallHeight: { type: Number }, // meters
  wastageDefault: { type: Number }, // percent
  vatPercent: { type: Number }, // percent
  contingencyPercent: { type: Number }, // percent
  items: { type: [measurementItemSchema], default: [] },
  createdAt: { type: String, required: true } // ISO timestamp
});

// MaterialRate schema
const materialRateSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  unit: { type: String, required: true },
  rate: { type: Number, required: true, default: 0 }, // base material cost per unit
  laborRate: { type: Number, required: true, default: 0 }, // labor cost per unit
  plantRate: { type: Number, required: true, default: 0 }, // plant/equipment cost per unit
  subContractRate: { type: Number, required: true, default: 0 }, // sub-contractor cost per unit
  supplier: { type: String }
});

// User schema
const userSchema = new Schema({
  id: { type: String, required: true },
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  avatar: { type: String },
  role: { type: String, required: true, enum: ['admin', 'estimator', 'viewer', 'project_manager'] },
  department: { type: String },
  avatarBg: { type: String },
  permissions: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  createdAt: { type: String }
});

// Models
const Project = mongoose.model('Project', projectSchema);
const MaterialRate = mongoose.model('MaterialRate', materialRateSchema);
const User = mongoose.model('User', userSchema);
// Note: MeasurementItem and SubDivisionLine are embedded; no separate models.

export {
  Project,
  MaterialRate,
  User,
  measurementItemSchema,
  subDivisionLineSchema
};

export default {
  Project,
  MaterialRate,
  User,
  measurementItemSchema,
  subDivisionLineSchema
};