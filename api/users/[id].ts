import { connectDB } from '../_lib/db';
import { User } from '../_lib/User';

interface ApiRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body: any;
}

interface ApiResponse {
  status(code: number): this;
  json(body: unknown): this;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  await connectDB();
  const { id } = req.query;
  if (req.method === 'PUT') {
    try {
      const u = await User.findOneAndUpdate({ id }, req.body, { new: true });
      if (!u) return res.status(404).json({ error: 'User not found' });
      return res.json(u);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }
  if (req.method === 'DELETE') {
    try {
      const u = await User.findOneAndDelete({ id });
      if (!u) return res.status(404).json({ error: 'User not found' });
      return res.json({ message: 'User deleted' });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
