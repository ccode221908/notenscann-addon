import { useState } from 'react';
import { updateProfile } from '../api';

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const steps = [
    { icon: '📷', label: 'Hochladen' },
    { icon: '🔍', label: 'Erkennen' },
    { icon: '🎵', label: 'Spielen & Drucken' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Bitte gib mindestens 2 Zeichen ein.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(trimmed);
      onDone();
    } catch {
      setError('Speichern fehlgeschlagen. Bitte versuche es erneut.');
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', padding: '48px 40px',
        maxWidth: '520px', width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ fontSize: '60px', lineHeight: 1, marginBottom: '12px' }}>🎼</div>
        <h1 style={{
          margin: '0 0 6px', fontSize: '30px', fontWeight: 800,
          background: 'linear-gradient(135deg, #1a73e8, #7c3aed)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Sheet Music Web
        </h1>
        <p style={{ color: '#777', fontSize: '15px', margin: '0 0 36px', lineHeight: 1.5 }}>
          Fotografiere oder scanne deine Notenblätter —<br />
          wir wandeln sie in spielbare, druckbare Partituren um.
        </p>

        {/* 3-Step Visualization */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100px' }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e8f0fe 0%, #ede7ff 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px', flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(124,58,237,0.15)',
                }}>
                  {step.icon}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#555', lineHeight: 1.3 }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ color: '#c4b5fd', fontSize: '22px', marginTop: '19px', flexShrink: 0 }}>→</div>
              )}
            </div>
          ))}
        </div>

        {/* Name Input */}
        <p style={{ color: '#444', fontSize: '16px', fontWeight: 600, margin: '0 0 14px' }}>
          Wie sollen wir dich nennen?
        </p>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Dein Name"
            disabled={saving}
            style={{
              width: '100%', padding: '12px 16px', fontSize: '16px',
              border: error ? '2px solid #ef4444' : '2px solid #e0e0e0',
              borderRadius: '10px', outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => { if (!error) e.target.style.borderColor = '#1a73e8'; }}
            onBlur={(e) => { if (!error) e.target.style.borderColor = '#e0e0e0'; }}
          />
          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', margin: '6px 0 0', textAlign: 'left' }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: '20px', width: '100%', padding: '14px',
              background: saving ? '#a5b4fc' : 'linear-gradient(135deg, #1a73e8, #7c3aed)',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '16px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Speichern…' : 'Loslegen 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}
