import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Score from './pages/Score';
import Login from './pages/Login';
import { getSession } from './api';

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    getSession().then(({ authenticated: ok, coreId }) => {
      if (ok && coreId) {
        localStorage.setItem('auth_core_id', coreId);
        setAuthenticated(true);
      }
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        Laden…
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Login
        onAuthenticated={(token, coreId) => {
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_core_id', coreId);
          setAuthenticated(true);
        }}
      />
    );
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
