import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useGame(gameId) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setGame(data);
        setLoading(false);
      });
  }, [gameId]);

  return { game, loading, error };
}
