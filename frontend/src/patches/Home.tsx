import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listScores, logout, getProfile, updateProfile } from '../api';
import type { ScoreRead } from '../types';
import UploadZone from '../components/UploadZone';
import ScoreList from '../components/ScoreList';

const IN_PROGRESS = new Set(['pending', 'preparing', 'transcribing', 'typesetting', 'processing', 'omr_done']);
const POLL_INTERVAL = 3000;

function shortCoreId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

export default function Home() {
  const [scores, setScores] = useState<ScoreRead[]>([]);
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();
  const coreId = localStorage.getItem('auth_core_id') ?? '';
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScores = useCallback(() => {
    listScores()
      .then(setScores)
      .catch((err) => console.error('Failed to fetch scores:', err));
  }, []);

  useEffect(() => {
    fetchScores();
    getProfile()
      .then((p) => setUserName(p.user_name ?? ''))
      .catch(() => {});
  }, [fetchScores]);

  // Auto-poll while any score is in progress
  useEffect(() => {
    const hasInProgress = scores.some((s) => IN_PROGRESS.has(s.status));
    if (hasInProgress) {
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchScores, POLL_INTERVAL);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [scores, fetchScores]);

  const handleUploaded = useCallback((score: ScoreRead) => {
    setScores((prev) => [score, ...prev]);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(0);
  };

  const handleNameBlur = () => {
    updateProfile(userName).catch(() => {});
  };

  return (
    <div style={{ padding: '32px 16px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 16px' }}>Sheet Music Web</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '15px', color: '#666', fontFamily: 'monospace' }}>
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
          <input
            type="text"
            placeholder="Dein Name (optional)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onBlur={handleNameBlur}
            style={{
              border: '1px solid #ddd', borderRadius: '6px',
              padding: '5px 12px', fontSize: '14px', color: '#333',
              width: '260px', textAlign: 'center',
              outline: 'none',
            }}
          />
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
