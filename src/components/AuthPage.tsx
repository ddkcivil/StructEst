import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Lock, Mail, User, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onRegister: (data: { firstName: string; middleName: string; lastName: string; email: string; password: string; phone: string; address: string; avatar: string | null }) => Promise<{ ok: boolean; error?: string }>;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    setTimeout(async () => {
      if (mode === 'login') {
        const res = await onLogin(email, password);
        if (!res.ok) setError(res.error || 'Login failed');
      } else {
        if (password !== confirmPassword) { setError('Passwords do not match'); setLoading(false); return; }
        const res = await onRegister({ firstName, middleName, lastName, email, password, phone, address, avatar });
        if (res.ok) { setSuccess('Registration submitted. Awaiting admin approval.'); setMode('login'); setFirstName(''); setMiddleName(''); setLastName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setPhone(''); setAddress(''); setAvatar(null); }
        else setError(res.error || 'Registration failed');
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.15),transparent_50%)]" />
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-3 rounded-2xl shadow-lg"><Building2 className="w-7 h-7 text-slate-950" /></div>
            <div><h1 className="text-3xl font-black text-white">StructEst Pro</h1><p className="text-xs text-slate-400 uppercase tracking-widest">Construction Estimation Suite</p></div>
          </div>
          <h2 className="text-4xl md:text-5xl font-black leading-tight">Professional <span className="text-amber-400">BOQ</span> &amp; Take-Off<br/>for Nepal Construction.</h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-md">AI-assisted quantity surveying, DXF/CAD take-off, NBC 205 compliance, and municipal permit certification.</p>
          <ul className="space-y-2 text-sm text-slate-300">
            {['23-item standard BOQ','DXF & PDF take-off','NBC 205 compliance','Role-based access'].map(f => (
              <li key={f} className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-amber-400" /><span>{f}</span></li>
            ))}
          </ul>
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex mb-6 bg-slate-950 p-1 rounded-xl">
            <button onClick={() => { setMode('login'); setError(null); setSuccess(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mode === 'login' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>Login</button>
            <button onClick={() => { setMode('register'); setError(null); setSuccess(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mode === 'register' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>Register</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">First Name</label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm focus:outline-none" placeholder="First" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Middle</label>
                    <input value={middleName} onChange={e => setMiddleName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm focus:outline-none" placeholder="Middle" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Surname</label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm focus:outline-none" placeholder="Surname" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Phone No</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm focus:outline-none" placeholder="+977..." />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Address</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm focus:outline-none" placeholder="Street, City" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Avatar (JPG/PNG)</label>
                  <input type="file" accept="image/jpeg,image/png" onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => setAvatar(r.result as string);
                    r.readAsDataURL(f);
                  }} className="w-full text-xs text-slate-400" />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Email</label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3">
                <Mail className="w-4 h-4 text-slate-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className="w-full bg-transparent p-2.5 text-sm focus:outline-none" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Password</label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3">
                <Lock className="w-4 h-4 text-slate-500" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" className="w-full bg-transparent p-2.5 text-sm focus:outline-none" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
              </div>
            </div>
            {mode === 'register' && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Re-type Password</label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" className="w-full bg-transparent p-2.5 text-sm focus:outline-none" placeholder="••••••••" />
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{error}</p>}
            {success && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">{success}</p>}
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg disabled:opacity-60">
              <span>{loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-slate-500 mt-4 text-center">Demo: admin <span className="font-mono">dharmadkunwar20@gmail.com</span> / <span className="font-mono">password</span></p>
        </motion.div>
      </div>
    </div>
  );
};
