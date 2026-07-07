import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewGame from './pages/NewGame';
import LiveScoring from './pages/LiveScoring';
import GameLog from './pages/GameLog';
import Profile from './pages/Profile';

function ProtectedRoute({ children, session }) {
  if (session === undefined) return null;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

// Detects Supabase invite tokens in the URL hash and redirects to /register
// so the user lands on the set-password form rather than the Dashboard.
function InviteRedirector() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=invite')) {
      navigate('/register' + hash, { replace: true });
    }
  }, [navigate]);
  return null;
}

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <InviteRedirector />
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute session={session}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute session={session}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/new"
          element={
            <ProtectedRoute session={session}>
              <NewGame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/:id/live"
          element={
            <ProtectedRoute session={session}>
              <LiveScoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/:id/log"
          element={
            <ProtectedRoute session={session}>
              <GameLog />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
