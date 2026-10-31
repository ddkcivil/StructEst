import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../App';

const AUTH_KEY = 'structest_auth';

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user) return { isAuthenticated: true, user: parsed.user };
      }
    } catch {}
    return { isAuthenticated: false, user: null };
  });

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  }, [state]);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Login failed' };
      setState({ isAuthenticated: true, user: data.user });
      return { ok: true };
    } catch (e: any) {
      // Fallback to localStorage if server unavailable
      const usersRaw = localStorage.getItem('structest_users');
      let users: any[] = [];
      try { users = usersRaw ? JSON.parse(usersRaw) : []; } catch {}
      const match = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!match) return { ok: false, error: 'No account found with that email.' };
      const storedPw = (match as any).password || 'password';
      if (password !== storedPw) return { ok: false, error: 'Incorrect password.' };
      if ((match.status ?? 'approved') !== 'approved') return { ok: false, error: 'Account pending admin approval.' };
      setState({ isAuthenticated: true, user: match });
      return { ok: true };
    }
  }, []);

  const register = useCallback(async (data: { firstName: string; middleName: string; lastName: string; email: string; password: string; phone: string; address: string; avatar: string | null }): Promise<{ ok: boolean; error?: string }> => {
    const usersRaw = localStorage.getItem('structest_users');
    let users: any[] = [];
    try { users = usersRaw ? JSON.parse(usersRaw) : []; } catch {}
    if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { ok: false, error: 'An account with that email already exists.' };
    }
    const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');
    const newUser: any = {
      id: `user-${Date.now()}`,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      name: fullName,
      email: data.email,
      password: data.password,
      phone: data.phone,
      address: data.address,
      avatar: data.avatar,
      role: 'estimator',
      department: 'General',
      avatarBg: 'bg-blue-600 text-white',
      permissions: {
        canEditBoq: true,
        canRunAiTakeoff: true,
        canEditRates: true,
        canManageUsers: false,
        canApproveReport: false,
        canExportData: true,
      },
      status: 'pending',
    };
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Registration failed' };
      // also cache locally
      users.push(newUser);
      localStorage.setItem('structest_users', JSON.stringify(users));
      return { ok: true };
    } catch (e: any) {
      // Fallback to localStorage only
      users.push(newUser);
      localStorage.setItem('structest_users', JSON.stringify(users));
      return { ok: true };
    }
  }, []);

  const logout = useCallback(() => {
    setState({ isAuthenticated: false, user: null });
    localStorage.removeItem(AUTH_KEY);
  }, []);

  return { ...state, login, register, logout };
}
