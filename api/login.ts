import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from './_lib/db';
import { User } from './_lib/User';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    // seed admin if missing
    const adminEmail = 'dharmadkunwar20@gmail.com';
    const exists = await User.findOne({ email: adminEmail });
    if (!exists) {
      await new User({
        id: 'admin-1',
        firstName: 'Dharma',
        middleName: '',
        lastName: 'Kunwar',
        name: 'Dharma Kunwar',
        email: adminEmail,
        password: 'ddK@152207',
        phone: '',
        address: '',
        avatar: null,
        role: 'admin',
        department: 'Management',
        avatarBg: 'bg-red-600',
        permissions: { all: true },
        status: 'approved',
        createdAt: new Date().toISOString(),
      }).save();
    }
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
}
