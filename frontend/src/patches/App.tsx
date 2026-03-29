import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Score from './pages/Score';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import { getSession, getProfile } from './api';

type AppState = 'loading' | 'login' | 'onboarding' | 'app';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');

  useEffect(() => {
    getSession().then(async ({ authenticated: ok, coreId }) => {
      if (!ok || !coreId) {
        setAppState('login');
        return;
      }
      localStorage.setItem('auth_core_id', coreId);
      const profile = await getProfile().catch(() => ({ user_name: '' }));
      setAppState(profile.user_name ? 'app' : 'onboarding');
    });
  }, []);

  if (appState === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#888',
        background: 'linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%)',
      }}>
        <div style={{ color: '#fff', fontSize: '18px', opacity: 0.8 }}>Laden…</div>
      </div>
    );
  }

  if (appState === 'login') {
    return (
      <Login
        onAuthenticated={async (token, coreId) => {
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_core_id', coreId);
          const profile = await getProfile().catch(() => ({ user_name: '' }));
          setAppState(profile.user_name ? 'app' : 'onboarding');
        }}
      />
    );
  }

  if (appState === 'onboarding') {
    return <Onboarding onDone={() => setAppState('app')} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scores/:id" element={<Score />} />
      </Routes>
    </BrowserRouter>
  );
}
