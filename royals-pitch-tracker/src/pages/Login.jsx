import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
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
        <form onSubmit={handleSubmit} className={styles.form}>
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
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <Link to="/register" className={styles.createAccountBtn}>
              Create Account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
