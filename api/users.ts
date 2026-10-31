type VercelRequest = { method?: string; body: any };
type VercelResponse = {
  json(body: any): VercelResponse;
  status(code: number): VercelResponse;
};
import { connectDB } from './_lib/db';
import { User } from './_lib/User';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  if (req.method === 'GET') {
    try {
      const users = await User.find({});
      return res.json(users);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'POST') {
    try {
      const u = new User(req.body);
      await u.save();
      return res.status(201).json(u);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
