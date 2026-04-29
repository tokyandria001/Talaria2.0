import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontWeight: 800, fontSize: 32, color: 'var(--parme)', marginBottom: 8 }}>Talaria</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Bon retour 👋</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Connecte-toi à ton compte</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Email</label>
            <input
              className={`input${error ? ' error' : ''}`}
              type="email"
              placeholder="toi@exemple.fr"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Mot de passe</label>
            <input
              className={`input${error ? ' error' : ''}`}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <span className="spinner" /> : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)' }}>
          Pas encore de compte ?{' '}
          <Link to="/register" style={{ color: 'var(--parme)', fontWeight: 600, textDecoration: 'none' }}>
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: '100svh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--sable-lune)',
  padding: '20px',
};

const containerStyle = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  borderRadius: 24,
  padding: '40px 36px',
  border: '1px solid var(--border)',
  boxShadow: '0 4px 32px rgba(79,32,63,0.06)',
};
