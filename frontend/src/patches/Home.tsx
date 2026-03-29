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
  const [editingName, setEditingName] = useState(false);
  const [editValue, setEditValue] = useState('');
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

  const startEditName = () => {
    setEditValue(userName);
    setEditingName(true);
  };

  const saveEditName = async () => {
    const trimmed = editValue.trim();
    setEditingName(false);
    if (trimmed && trimmed !== userName) {
      setUserName(trimmed);
      updateProfile(trimmed).catch(() => {});
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Gradient Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%)',
        color: '#fff', padding: '20px 32px',
        boxShadow: '0 4px 20px rgba(124,58,237,0.2)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px', lineHeight: 1 }}>🎼</span>
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px' }}>Sheet Music Web</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {editingName ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEditName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)',
                  borderRadius: '8px', color: '#fff', padding: '4px 10px', fontSize: '14px',
                  outline: 'none', fontFamily: 'inherit', width: '160px',
                }}
              />
            ) : (
              <button
                onClick={startEditName}
                title="Namen bearbeiten"
                style={{
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px', color: '#fff', padding: '4px 12px', fontSize: '14px',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }}
              >
                {userName || '+ Name hinzufügen'}
              </button>
            )}
            <span style={{ fontSize: '12px', fontFamily: 'monospace', opacity: 0.65 }}>
              {shortCoreId(coreId)}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '8px', color: '#fff', padding: '4px 12px', fontSize: '13px',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '36px 16px' }}>
        <UploadZone onUploaded={handleUploaded} />
        <ScoreList
          scores={scores}
          onRefresh={fetchScores}
          onDeleted={(id) => setScores((prev) => prev.filter((s) => s.id !== id))}
        />
      </main>
    </div>
  );
}
