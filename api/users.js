// api/_lib/db.ts
import mongoose from "mongoose";
var cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };
async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    cached.promise = mongoose.connect(uri).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// api/_lib/User.ts
import mongoose2 from "mongoose";
var { Schema } = mongoose2;
var userSchema = new Schema({
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
  role: { type: String, required: true, enum: ["admin", "estimator", "viewer", "project_manager"] },
  department: { type: String },
  avatarBg: { type: String },
  permissions: { type: Schema.Types.Mixed },
  status: { type: String, enum: ["pending", "approved"], default: "pending" },
  createdAt: { type: String }
});
var User = mongoose2.models.User || mongoose2.model("User", userSchema);

// api/users.ts
async function handler(req, res) {
  await connectDB();
  if (req.method === "GET") {
    try {
      const users = await User.find({});
      return res.json(users);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === "POST") {
    try {
      const u = new User(req.body);
      await u.save();
      return res.status(201).json(u);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  return res.status(405).json({ error: "Method not allowed" });
}
export {
  handler as default
};
