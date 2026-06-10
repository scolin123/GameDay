import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewGame from './pages/NewGame';
import LiveScoring from './pages/LiveScoring';
import GameLog from './pages/GameLog';

function ProtectedRoute({ children, session }) {
  if (session === undefined) return null;
  if (!session) return <Navigate to="/login" replace />;
  return children;
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
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute session={session}>
              <Dashboard />
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
