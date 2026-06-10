import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRoster(gameId) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    supabase
      .from('rosters')
      .select('*')
      .eq('game_id', gameId)
      .order('batting_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRoster(data || []);
        setLoading(false);
      });
  }, [gameId]);

  return { roster, loading, error };
}
