import { useState, FormEvent } from 'react';

interface Props {
  onLogin: (token: string) => void;
}

/**
 * Editorial sign-in — the back door to the newsroom. Cream paper background,
 * black ink form, saffron accents. Demo credentials are hinted at the bottom.
 */
export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onLogin(data.data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--paper)' }}>
      <div className="w-full max-w-md">
        {/* Masthead */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block h-px w-8 bg-saffron" />
            <span className="eyebrow text-saffron">Kitchen Control</span>
            <span className="block h-px w-8 bg-saffron" />
          </div>
          <h1 className="font-display text-5xl text-ink leading-none">Eat Inka</h1>
          <p className="font-mono-tabular text-[10px] tracking-eyebrow uppercase text-ink-mute mt-3">
            Newsroom · Schwenningen · Staff Only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="border border-ink bg-paper-50 p-8 space-y-5">
          <h2 className="font-display text-2xl text-ink leading-tight">Sign in</h2>

          {error && (
            <div className="border border-saffron text-saffron-deep font-ui text-sm p-3">
              {error}
            </div>
          )}

          <div>
            <label className="block eyebrow mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm"
            />
          </div>

          <div>
            <label className="block eyebrow mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group w-full bg-ink text-paper py-3 font-ui text-xs uppercase tracking-eyebrow hover:bg-saffron transition-colors disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {loading ? 'Signing in…' : 'Sign In'}
              {!loading && <span className="transition-transform group-hover:translate-x-0.5">→</span>}
            </span>
          </button>

          <p className="font-editorial italic text-xs text-ink-mute text-center pt-2 border-t border-tobacco/30">
            Demo · <span className="font-mono-tabular not-italic text-ink">admin@kitchenasty.com</span> / <span className="font-mono-tabular not-italic text-ink">admin123</span>
          </p>
        </form>
      </div>
    </div>
  );
}
