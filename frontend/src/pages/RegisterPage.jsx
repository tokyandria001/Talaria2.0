import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.email) errs.email = 'Email requis.';
    if (form.password.length < 8) errs.password = 'Minimum 8 caractères.';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Les mots de passe ne correspondent pas.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await register({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName });
      navigate('/map');
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) setErrors(data.errors);
      else setErrors({ global: data?.message || 'Une erreur est survenue.' });
    } finally {
      setLoading(false);
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm(f => ({ ...f, [key]: e.target.value })),
    className: `input${errors[key] ? ' error' : ''}`,
  });

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo-dark.svg" alt="Talaria" style={{ height: 36, marginBottom: 8 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Crée ton compte ✈️</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Voyager mieux, pour moins cher, ensemble.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Prénom</label>
              <input type="text" placeholder="Prénom" {...field('firstName')} />
            </div>
            <div>
              <label className="label">Nom</label>
              <input type="text" placeholder="Nom" {...field('lastName')} />
            </div>
          </div>

          <div>
            <label className="label">Email *</label>
            <input type="email" placeholder="toi@exemple.fr" {...field('email')} required />
            {errors.email && <p className="error-msg">{errors.email}</p>}
          </div>

          <div>
            <label className="label">Mot de passe *</label>
            <input type="password" placeholder="••••••••" {...field('password')} required />
            {errors.password && <p className="error-msg">{errors.password}</p>}
          </div>

          <div>
            <label className="label">Confirmer le mot de passe *</label>
            <input type="password" placeholder="••••••••" {...field('confirmPassword')} required />
            {errors.confirmPassword && <p className="error-msg">{errors.confirmPassword}</p>}
          </div>

          {errors.global && <p className="error-msg">{errors.global}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <span className="spinner" /> : 'Créer mon compte'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)' }}>
          Déjà un compte ?{' '}
          <Link to="/login" style={{ color: 'var(--parme)', fontWeight: 600, textDecoration: 'none' }}>
            Se connecter
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
  maxWidth: 460,
  background: '#fff',
  borderRadius: 24,
  padding: '36px',
  border: '1px solid var(--border)',
  boxShadow: '0 4px 32px rgba(79,32,63,0.06)',
};
