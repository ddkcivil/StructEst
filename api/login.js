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

// api/login.ts
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    await connectDB();
    const adminEmail = "dharmadkunwar20@gmail.com";
    const exists = await User.findOne({ email: adminEmail });
    if (!exists) {
      await new User({
        id: "admin-1",
        firstName: "Dharma",
        middleName: "",
        lastName: "Kunwar",
        name: "Dharma Kunwar",
        email: adminEmail,
        password: "ddK@152207",
        phone: "",
        address: "",
        avatar: null,
        role: "admin",
        department: "Management",
        avatarBg: "bg-red-600",
        permissions: { all: true },
        status: "approved",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }).save();
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ ok: false, error: "Invalid email or password" });
    }
    if ((user.status ?? "approved") !== "approved") {
      return res.status(403).json({ ok: false, error: "Account pending admin approval" });
    }
    res.json({ ok: true, user });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
export {
  handler as default
};
