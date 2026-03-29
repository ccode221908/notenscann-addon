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
          startChallenge(); // auto-refresh
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
      fontFamily: 'sans-serif', background: '#f5f5f5', padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '40px 32px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.1)', maxWidth: '420px', width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px' }}>Sheet Music Web</h1>
        <p style={{ margin: '0 0 32px', color: '#666', fontSize: '14px' }}>
          Bitte mit CorePass anmelden
        </p>

        {loading && (
          <div style={{ color: '#888', padding: '32px 0' }}>Wird geladen…</div>
        )}

        {error && (
          <div style={{ color: '#c00', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
        )}

        {!loading && !error && qrDataUrl && mobileUri && (
          <>
            <p style={{ color: '#555', fontSize: '13px', marginBottom: '16px' }}>
              QR-Code mit der CorePass-App scannen:
            </p>
            <img
              src={qrDataUrl}
              alt="CorePass Login QR"
              style={{ width: '220px', height: '220px', border: '1px solid #e0e0e0', borderRadius: '8px' }}
            />
            <p style={{ color: '#aaa', fontSize: '12px', margin: '12px 0 20px' }}>
              QR-Code läuft nach 5 Minuten ab und wird automatisch erneuert.
            </p>
            <a
              href={mobileUri}
              style={{
                display: 'inline-block', background: '#1a73e8', color: '#fff',
                padding: '12px 28px', borderRadius: '8px', textDecoration: 'none',
                fontSize: '15px', fontWeight: 600,
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
