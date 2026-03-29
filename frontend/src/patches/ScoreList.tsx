import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ScoreRead } from '../types';
import { renameScore, deleteScore } from '../api';

interface ScoreListProps {
  scores: ScoreRead[];
  onRefresh: () => void;
  onDeleted: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending:      'Wartend',
  preparing:    'Vorbereitung…',
  transcribing: 'Notenerkennung…',
  typesetting:  'Notensatz…',
  processing:   'Verarbeitung…',
  omr_done:     'Notensatz…',
  ready:        'Fertig',
  failed:       'Fehlgeschlagen',
  omr_failed:   'Fehlgeschlagen',
};

const IN_PROGRESS = new Set(['pending', 'preparing', 'transcribing', 'typesetting', 'processing', 'omr_done']);

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function statusColor(status: string): string {
  if (status === 'ready') return '#16a34a';
  if (status === 'failed' || status === 'omr_failed') return '#dc2626';
  return '#d97706';
}

function statusBg(status: string): string {
  if (status === 'ready') return '#dcfce7';
  if (status === 'failed' || status === 'omr_failed') return '#fee2e2';
  return '#fef3c7';
}

function statusStripe(status: string): string {
  if (status === 'ready') return '#16a34a';
  if (status === 'failed' || status === 'omr_failed') return '#dc2626';
  return '#d97706';
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}

function displayTitle(score: ScoreRead): string {
  return score.display_name ?? score.original_filename;
}

// ── Per-card component ───────────────────────────────────────────────────────

interface ScoreCardProps {
  score: ScoreRead;
  onRenamed: (updated: ScoreRead) => void;
  onDeleted: (id: string) => void;
}

function ScoreCard({ score, onRenamed, onDeleted }: ScoreCardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isInProgress = IN_PROGRESS.has(score.status);

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    setEditValue(displayTitle(score));
    setSaveError(null);
    setEditing(true);
  }

  async function confirmRename() {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await renameScore(score.id, trimmed);
      onRenamed(updated);
      setEditing(false);
    } catch {
      setSaveError('Umbenennen fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!window.confirm(`„${displayTitle(score)}" wirklich löschen?`)) return;
    try {
      await deleteScore(score.id);
      onDeleted(score.id);
    } catch {
      alert('Löschen fehlgeschlagen');
    }
  }

  const iconBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px',
    cursor: 'pointer', padding: '4px 8px', fontSize: '13px', color: '#6b7280',
  };

  return (
    <div style={{
      background: '#fff', borderRadius: '14px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      display: 'flex', overflow: 'hidden', marginBottom: '10px',
    }}>
      {/* Status stripe */}
      <div style={{ width: '5px', background: statusStripe(score.status), flexShrink: 0 }} />

      {/* Content */}
      <div style={{ flex: 1, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') setEditing(false);
                }}
                disabled={saving}
                style={{
                  border: '1px solid #93c5fd', borderRadius: '6px',
                  padding: '3px 8px', fontSize: '15px', outline: 'none',
                  fontFamily: 'inherit', width: '220px',
                }}
              />
              <button onClick={confirmRename} disabled={saving} style={{ ...iconBtn, color: '#16a34a', borderColor: '#86efac' }}>✓</button>
              <button onClick={() => setEditing(false)} disabled={saving} style={{ ...iconBtn, color: '#dc2626', borderColor: '#fca5a5' }}>✕</button>
              {saveError && <span style={{ color: '#dc2626', fontSize: '12px' }}>{saveError}</span>}
            </div>
          ) : (
            <Link
              to={`/scores/${score.id}`}
              style={{ color: '#1d4ed8', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {displayTitle(score)}
            </Link>
          )}
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>{formatDate(score.created_at)}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Spinner for in-progress */}
          {isInProgress && (
            <div style={{
              width: '16px', height: '16px', borderRadius: '50%',
              border: '2px solid #e5e7eb', borderTopColor: '#7c3aed',
              animation: 'spin 0.7s linear infinite', flexShrink: 0,
            }} />
          )}

          {/* Status badge */}
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
            fontSize: '12px', fontWeight: 600,
            color: statusColor(score.status), background: statusBg(score.status),
            cursor: score.error_message ? 'help' : 'default',
            whiteSpace: 'nowrap',
          }} title={score.error_message ?? undefined}>
            {statusLabel(score.status)}
          </span>

          {/* Actions */}
          {!editing && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={startEdit} title="Umbenennen" style={iconBtn}>✎</button>
              <button onClick={confirmDelete} title="Löschen" style={{ ...iconBtn, color: '#ef4444', borderColor: '#fca5a5' }}>🗑</button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main list ────────────────────────────────────────────────────────────────

export default function ScoreList({ scores, onRefresh, onDeleted }: ScoreListProps) {
  const hasInProgress = scores.some((s) => IN_PROGRESS.has(s.status));

  function handleRenamed(_updated: ScoreRead) {
    onRefresh();
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>Meine Partituren</h2>
        {hasInProgress && (
          <span style={{ fontSize: '13px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%',
              border: '2px solid #ddd8fe', borderTopColor: '#7c3aed',
              animation: 'spin 0.7s linear infinite',
            }} />
            Verarbeitung läuft…
          </span>
        )}
      </div>

      {scores.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: '#fff', borderRadius: '16px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.4 }}>🎼</div>
          <p style={{ color: '#9ca3af', fontSize: '16px', margin: '0 0 4px', fontWeight: 500 }}>
            Noch keine Partituren
          </p>
          <p style={{ color: '#d1d5db', fontSize: '14px', margin: 0 }}>
            Lade dein erstes Notenblatt oben hoch.
          </p>
        </div>
      ) : (
        <div>
          {scores.map((score) => (
            <ScoreCard
              key={score.id}
              score={score}
              onRenamed={handleRenamed}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
