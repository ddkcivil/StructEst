import mongoose from 'mongoose';
const { Schema } = mongoose;

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
  createdAt: { type: String },
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
