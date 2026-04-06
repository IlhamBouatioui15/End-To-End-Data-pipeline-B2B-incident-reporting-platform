import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import GIFORANGE from "./GIFORANGE3.gif"

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const validateForm = () => {
    if (!username || !password) {
      setError('Username and password are required');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    const formDetails = new URLSearchParams();
    formDetails.append('username', username);
    formDetails.append('password', password);

    try {
      const response = await fetch('http://localhost:8000/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formDetails.toString()

      });

      setLoading(false);

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        navigate('/excels');
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Authentication failed!');
      }
    } catch (error) {
      setLoading(false);
      setError('An error occurred. Please try again later.');
    }
  };

  return (
    <div className="login-root">

      {/* Left Panel */}
      <div className="login-left-panel">
        <div className="left-logo-container">
          <div className="crown-icon">
            {/* Using the user's logo precisely placed like the crown in the image */}
            <img src={GIFORANGE} alt="Orange Maroc logo" />
          </div>
        </div>

        <div className="left-text-content">
          <h2 className="greeting-text">Bienvenue !</h2>
          <h1 className="main-platform-text">
            PLATEFORME<br />
            B2B INCIDENTS
          </h1>
        </div>

        {/* Decorative Mountain/Wave Bottom */}
        <div className="left-waves">
          <svg viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg">
            {/* The SVG replicates the dark mountain peaks at the bottom, tinted in Orange / Dark Orange matching exact prompt */}
            <path fill="#FF7900" fillOpacity="0.4" d="M0,160L80,170.7C160,181,320,203,480,181.3C640,160,800,96,960,96C1120,96,1280,160,1360,192L1440,224L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
            <path fill="#FF7900" fillOpacity="0.8" d="M0,256L80,245.3C160,235,320,213,480,218.7C640,224,800,256,960,245.3C1120,235,1280,181,1360,154.7L1440,128L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
          </svg>
        </div>
      </div>

      {/* Right Panel */}
      <div className="login-right-panel">
        <div className="top-right-decoration">
          <div className="arc-circle"></div>
        </div>

        <div className="form-container">
          <h2 className="form-title">Connexion</h2>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-field-group">
              <label htmlFor="username">Nom d'utilisateur</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="input-field-group">
              <label htmlFor="password">Mot de passe</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="error-message">
                <span>{error}</span>
              </div>
            )}

            <div className="btn-container">
              <button
                type="submit"
                className={`login-btn ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </div>
          </form>


        </div>
      </div>

    </div>
  );
}

export default Login;
