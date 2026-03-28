import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listScores, logout } from '../api';
import type { ScoreRead } from '../types';
import UploadZone from '../components/UploadZone';
import ScoreList from '../components/ScoreList';

function shortCoreId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

export default function Home() {
  const [scores, setScores] = useState<ScoreRead[]>([]);
  const navigate = useNavigate();
  const coreId = localStorage.getItem('auth_core_id') ?? '';

  const fetchScores = useCallback(() => {
    listScores()
      .then(setScores)
      .catch((err) => console.error('Failed to fetch scores:', err));
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const handleUploaded = useCallback((score: ScoreRead) => {
    setScores((prev) => [score, ...prev]);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(0); // full page reload to show login screen
  };

  return (
    <div style={{ padding: '32px 16px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 6px' }}>Sheet Music Web</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#999', fontFamily: 'monospace' }}>
            {shortCoreId(coreId)}
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: '1px solid #ddd', borderRadius: '4px',
              padding: '2px 10px', fontSize: '12px', color: '#888', cursor: 'pointer',
            }}
          >
            Abmelden
          </button>
        </div>
      </div>
      <UploadZone onUploaded={handleUploaded} />
      <ScoreList
        scores={scores}
        onRefresh={fetchScores}
        onDeleted={(id) => setScores((prev) => prev.filter((s) => s.id !== id))}
      />
    </div>
  );
}
