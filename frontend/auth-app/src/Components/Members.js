
import React, {useState, useEffect} from 'react'
import api from './api'
import Bar from "./Bar"

const Membres = () => {
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    First_name :'',
    Last_name :'',
    Role :'',
    Username:'',
    password:''
  });
  const [editingId, setEditingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Check if user is admin before loading members
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
    const response = await api.get('/Members/');
    setMembers(response.data)
  };

  useEffect(() => {
    if (isAdmin) {
      fetchMembers();
    }
  }, [isAdmin]);


  const handleInputChange = (event) => {
    const { name, value, type, selectedOptions } = event.target;
    // Cas spécial pour les selects multiples
    if (type === 'select-multiple') {
      const selectedValues = Array.from(selectedOptions).map(option => option.value);
      setFormData({
        ...formData,
        [name]: selectedValues
      });
    } 
    // Cas standard pour tous les autres inputs (text, number, select simple, etc.)
    else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    try {
      if (editingId) {
        // Envoie TOUS les champs nécessaires
        await api.put(`/Members/${editingId}/`, {
          ...formData,
          id: editingId  // Inclut l'ID pour être sûr
        });
        
      } else {
        await api.post('/Members/', formData);
      }
      fetchMembers(); // Rafraîchit la liste
      setFormData({ First_name: '', Last_name: '', Role: '', Username: '', password: '' });
      setEditingId(null);
    } catch (error) {
      const message = error.response?.data?.detail || error.message || 'Une erreur est survenue';
      setErrorMessage(message);
      window.alert(message);
      console.error("Erreur:", message);
    }
  };
  const handleEdit = (member) => {
    setFormData({
      First_name: member.First_name,
      Last_name: member.Last_name,
      Role: member.Role,
      Username: member.Username,
      // nous ne récupérons jamais le mot de passe en clair depuis l'API
      password: ''
    });
    setEditingId(member.id);
  };
  const handleDelete = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce membre ?")) {
      try {
        await api.delete(`/Members/${id}/`);
        // Mise à jour optimiste de l'état local
        setMembers(prevMembers => prevMembers.filter(member => member.id !== id));
      } catch (error) {
        console.error("Erreur lors de la suppression :", error);
        // Recharger les données si erreur
        fetchMembers();
      }
    }
  
  };

  return (
    <div className="page-container">
    
    <header><Bar></Bar></header>
    <div  className="content-container"  style={{ marginLeft: '0', paddingLeft: '5px' }}>
      
  
    <div className='container main-content'>
    <h3>Gestion des membres de l'Equipe TAM</h3>
    {errorMessage && (
      <div className="alert alert-danger alert-dismissible fade show" role="alert">
        <strong>Erreur:</strong> {errorMessage}
        <button type="button" className="btn-close" onClick={() => setErrorMessage('')}></button>
      </div>
    )}
      <form onSubmit={handleFormSubmit}>
        <div className='mb-3 mt-3'>
          <label htmlFor='First_name' className='form-label'>
            First Name
          </label>
          <input type='text' className="form-control w-50" id='amount' name='First_name' onChange={handleInputChange} value={formData.First_name}/>
        </div>

        <div className='mb-3 mt-3'>
          <label htmlFor='Last_name' className='form-label'>
            Last Name
          </label>
          <input type='text' className="form-control w-50" id='Last_name' name='Last_name' onChange={handleInputChange} value={formData.Last_name}/>
        </div>

        <div className='mb-3 mt-3'>
          <label htmlFor='Username' className='form-label'>
            Username
          </label>
          <input type='text' className="form-control w-50" id='description' name='Username' onChange={handleInputChange} value={formData.Username}/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='password' className='form-label'>
            Password
          </label>
          <input type='password' className="form-control w-50" id='description' name='password' onChange={handleInputChange} value={formData.password}/>
        </div>

        <div className='mb-3 mt-3'>
  <label htmlFor='Role' className='form-label'>
    Role
  </label>
  <select 
    id='role'
    name='Role' 
    className='form-select w-50'
    value={formData.Role}
    onChange={handleInputChange}
  >
    <option value=''>Sélectionnez un rôle</option>
    <option value='admin'>Admin</option>
    <option value='membre'>Membre</option>
  </select>
</div>
        <button type='submit' className='btn btn-primary'  style={{ marginLeft: '0', paddingLeft: '5px' }}>
              {editingId ? 'Mettre à jour' : ' Ajouter '}
            </button>

      </form>
      <br></br>

      <table className='table table-striped table-bordered table-hover'>
        <thead>
          <tr>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Role</th>
            <th>Username</th>
            <th >Password</th>
            <th >Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) =>(
            <tr key={member.id}>
              <td>{member.First_name}</td>
              <td>{member.Last_name}</td>
              <td>{member.Role}</td>
              <td>{member.Username}</td>
              <td>••••••••••••</td>
              <td>
                    <button className="btn btn-warning btn-sm mx-1" onClick={() => handleEdit(member)} style={{marginTop:'5px'}}>
                      Modifier
                    </button>
                    <button className="btn btn-danger btn-sm mx-1" onClick={() => handleDelete(member.id)} style={{marginTop:'5px'}}>
                      Supprimer
                    </button>
                  </td>
            </tr>
          ))}
        </tbody>

      </table>


</div>
    </div>


    </div>
  )

}

export default Membres;
