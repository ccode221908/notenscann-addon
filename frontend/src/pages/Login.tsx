import { useEffect, useRef, useState } from 'react';
import { createChallenge, pollChallenge } from '../api';

interface LoginProps {
  onAuthenticated: (token: string, coreId: string) => void;
}

export default function Login({ onAuthenticated }: LoginProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [mobileUri, setMobileUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const challengeIdRef = useRef<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startChallenge = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await createChallenge();
      challengeIdRef.current = data.challengeId;
      setQrDataUrl(data.qrDataUrl);
      setMobileUri(data.mobileUri);
      setLoading(false);
      startPolling(data.challengeId);
    } catch {
      setError('Login konnte nicht gestartet werden. Bitte Seite neu laden.');
      setLoading(false);
    }
  };

  const startPolling = (challengeId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const result = await pollChallenge(challengeId);
        if (result.status === 'authenticated' && result.token && result.coreId) {
          clearInterval(pollingRef.current!);
          onAuthenticated(result.token, result.coreId);
        } else if (result.status === 'expired') {
          clearInterval(pollingRef.current!);
          startChallenge();
        }
      } catch {
        // ignore transient errors
      }
    }, 2000);
  };

  useEffect(() => {
    startChallenge();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%)',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', padding: '44px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)', maxWidth: '400px', width: '100%',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ fontSize: '52px', lineHeight: 1, marginBottom: '10px' }}>🎼</div>
        <h1 style={{
          margin: '0 0 4px', fontSize: '26px', fontWeight: 800,
          background: 'linear-gradient(135deg, #1a73e8, #7c3aed)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Sheet Music Web
        </h1>
        <p style={{ margin: '0 0 32px', color: '#888', fontSize: '14px' }}>
          Bitte mit CorePass anmelden
        </p>

        {loading && (
          <div style={{ color: '#aaa', padding: '32px 0', fontSize: '15px' }}>Wird geladen…</div>
        )}

        {error && (
          <div style={{
            background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '10px',
            padding: '12px 16px', color: '#dc2626', fontSize: '14px', marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && qrDataUrl && mobileUri && (
          <>
            <p style={{ color: '#555', fontSize: '13px', marginBottom: '16px' }}>
              QR-Code mit der CorePass-App scannen:
            </p>
            <div style={{
              display: 'inline-block', padding: '10px', borderRadius: '16px',
              border: '2px solid #e8f0fe',
              boxShadow: '0 0 0 4px rgba(26,115,232,0.07)',
            }}>
              <img
                src={qrDataUrl}
                alt="CorePass Login QR"
                style={{ display: 'block', width: '200px', height: '200px', borderRadius: '8px' }}
              />
            </div>
            <p style={{ color: '#bbb', fontSize: '12px', margin: '12px 0 20px' }}>
              Läuft nach 5 Minuten ab und wird automatisch erneuert.
            </p>
            <a
              href={mobileUri}
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #1a73e8, #7c3aed)',
                color: '#fff', padding: '12px 28px', borderRadius: '10px',
                textDecoration: 'none', fontSize: '15px', fontWeight: 700,
                boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
              }}
            >
              Mit CorePass anmelden
            </a>
          </>
        )}
      </div>
    </div>
  );
}
