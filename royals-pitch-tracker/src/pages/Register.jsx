import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import styles from './Login.module.css';

export default function Register() {
  const navigate = useNavigate();

  // 'signup' = fresh account creation, 'set-password' = invited user setting their password
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Detect if this is an invite link (Supabase appends #access_token=...&type=invite)
    const hash = window.location.hash;
    if (hash.includes('type=invite')) {
      setMode('set-password');
    }

    // Listen for Supabase to process the invite token from the URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && window.location.hash.includes('type=invite')) {
        setMode('set-password');
        if (session?.user?.email) setEmail(session.user.email);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignUp(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
    } else {
      setSuccess('Account created! Check your email to confirm before signing in.');
    }
    setLoading(false);
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.appTitle}>Guelph Royals Pitch Tracker</h1>

        {mode === 'set-password' ? (
          <>
            <p className={styles.registerSubtitle}>You've been invited. Set a password to activate your account.</p>
            <form onSubmit={handleSetPassword} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">New Password</label>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={6}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.formActions}>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Setting password...' : 'Set Password & Sign In'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <form onSubmit={handleSignUp} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              {success && <p className={styles.successMsg}>{success}</p>}
              <div className={styles.formActions}>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
                <Link to="/login" className={styles.switchLink}>Already have an account? Sign in</Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
