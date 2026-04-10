
import React, { useState, useEffect } from 'react'
import api from './api'
import Bar from "./Bar"
import './Members.css'
import { FaUserPlus, FaUsers, FaTrash, FaEdit, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa'

const Membres = () => {
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    First_name: '',
    Last_name: '',
    Role: '',
    Username: '',
    password: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        await api.get('/Members/');
        setIsAdmin(true);
        setLoading(false);
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          setIsAdmin(false);
          setErrorMessage("Session invalide ou expirée. Veuillez vous reconnecter.");
        }
        setLoading(false);
      }
    };
    checkAdminAccess();
  }, []);

  const fetchMembers = async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get('/Members/');
      setMembers(response.data)
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchMembers();
    }
  }, [isAdmin]);


  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    try {
      if (editingId) {
        await api.put(`/Members/${editingId}/`, {
          ...formData,
          id: editingId
        });
      } else {
        await api.post('/Members/', formData);
      }
      fetchMembers();
      setFormData({ First_name: '', Last_name: '', Role: '', Username: '', password: '' });
      setEditingId(null);
    } catch (error) {
      const message = error.response?.data?.detail || error.message || 'Une erreur est survenue';
      setErrorMessage(message);
    }
  };

  const handleEdit = (member) => {
    setFormData({
      First_name: member.First_name,
      Last_name: member.Last_name,
      Role: member.Role,
      Username: member.Username,
      password: ''
    });
    setEditingId(member.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce membre ?")) {
      try {
        await api.delete(`/Members/${id}/`);
        setMembers(prevMembers => prevMembers.filter(member => member.id !== id));
      } catch (error) {
        console.error("Erreur lors de la suppression :", error);
        fetchMembers();
      }
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Bar />
        <div className="content-container">
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Bar />
      <div className="content-container">
        <main className="main-content">
          <h1 className="page-title">Gestion de l'Équipe TAM</h1>

          {errorMessage && (
            <div className="custom-alert alert-error">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FaExclamationCircle />
                <span>{errorMessage}</span>
              </div>
              <button className="action-btn" onClick={() => setErrorMessage('')} style={{ background: 'transparent', color: 'inherit', border: 'none' }}>✕</button>
            </div>
          )}

          {/* Form Card */}
          <section className="custom-card">
            <h2 className="card-title">
              {editingId ? "Modifier l'utilisateur" : "Ajouter un membre"}
            </h2>
            <form onSubmit={handleFormSubmit} className="modern-form">
              <div className="form-group">
                <label>Prénom</label>
                <input
                  type="text"
                  name="First_name"
                  className="form-input"
                  placeholder="Ex: Younes"
                  onChange={handleInputChange}
                  value={formData.First_name}
                  required
                />
              </div>

              <div className="form-group">
                <label>Nom</label>
                <input
                  type="text"
                  name="Last_name"
                  className="form-input"
                  placeholder="Ex: El Moden"
                  onChange={handleInputChange}
                  value={formData.Last_name}
                  required
                />
              </div>

              <div className="form-group">
                <label>Nom d'utilisateur</label>
                <input
                  type="text"
                  name="Username"
                  className="form-input"
                  placeholder="Ex: yelmoden"
                  onChange={handleInputChange}
                  value={formData.Username}
                  required
                />
              </div>

              <div className="form-group">
                <label>Mot de passe {editingId && "(Optionnel)"}</label>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  placeholder="••••••••"
                  onChange={handleInputChange}
                  value={formData.password}
                  required={!editingId}
                />
              </div>

              <div className="form-group">
                <label>Rôle</label>
                <select
                  name="Role"
                  className="form-input form-select"
                  value={formData.Role}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Choisir un rôle</option>
                  <option value="admin">Administrateur</option>
                  <option value="membre">Membre TAM</option>
                </select>
              </div>

              <div className="form-group" style={{ justifyContent: 'flex-end', display: 'flex' }}>
                <button type="submit" className="primary-btn">
                  {editingId ? <><FaEdit /> Mettre à jour</> : <><FaUserPlus /> Ajouter le membre</>}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="action-btn"
                    style={{ marginLeft: '10px', marginTop: '10px' }}
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ First_name: '', Last_name: '', Role: '', Username: '', password: '' });
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Table Card */}
          <section className="custom-card">
            <h2 className="card-title">Liste des membres</h2>
            <div className="table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th>Nom d'utilisateur</th>
                    <th>Rôle</th>
                    <th>Mot de passe</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1a202c' }}>
                          {member.First_name} {member.Last_name}
                        </div>
                      </td>
                      <td>{member.Username}</td>
                      <td>
                        <span className={`role-badge ${member.Role}`}>
                          {member.Role}
                        </span>
                      </td>
                      <td style={{ letterSpacing: '2px', opacity: 0.5 }}>••••••••</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="action-btn edit-btn"
                            title="Modifier"
                            onClick={() => handleEdit(member)}
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="action-btn delete-btn"
                            title="Supprimer"
                            onClick={() => handleDelete(member.id)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        Aucun membre trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default Membres;
