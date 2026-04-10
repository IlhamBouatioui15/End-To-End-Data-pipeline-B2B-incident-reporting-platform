import React, { useState } from 'react';
import { 
  FaHome, 
  FaUser, 
  FaBox, 
  FaHeart, 
  FaCalendarAlt,
  FaCog,
  FaAddressBook,
  
  FaSignOutAlt 
} from 'react-icons/fa';
import { TbReportSearch } from "react-icons/tb";
import './Bar.css';
import { Link, useNavigate } from 'react-router-dom';
import orange from "./GIFORANGE3.gif"


const Bar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeItem, setActiveItem] = useState('Accueil');
  const navigate = useNavigate();

  const menuItems = [
    
    { name: 'Membres', icon: <FaAddressBook /> , path: '/Members'},
    { 
      name: 'Rapports', 
      icon: <TbReportSearch />,
      path:'/excels'
    },
    { name: 'Fichiers Excel', icon: <FaBox />, path: '/fichiers-excel' },

    { name: 'Autre', icon: <FaCalendarAlt /> },
  ];

  const bottomItems = [
   
    { name: 'Déconnexion', icon: <FaSignOutAlt /> }
  ];
  const handleItemClick = (itemName, path) => {
    setActiveItem(itemName);
    if (itemName === 'Déconnexion') {
    localStorage.removeItem('token'); // Supprime le token
    navigate('/'); // Redirige vers la page de login
    return;
  }
    if (path) {
      navigate(path)
    }
  };
  return (
    <div className={`sidebar-container ${isOpen ? '' : 'collapsed'}`}>
      

      <div className="sidebar">
        {isOpen && (
          <div className="sidebar-header">
            <h3>
                <span>TAM Platform</span>
                <img src={orange} alt="logo" className="logo" />
            </h3>
          </div>
        )}

        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <div key={item.name}>
              <div 
                className={`menu-item ${activeItem === item.name ? 'active' : ''}`}
                onClick={() => handleItemClick(item.name, item.path)}
              >
                <span className="icon">{item.icon}</span>
                {isOpen && <span>{item.name}</span>}
              </div>
              
              {item.subItems && isOpen && (
                <div className="submenu">
                  {item.subItems.map((subItem) => (
                    <div 
                      key={subItem} 
                      className="submenu-item"
                      onClick={() => handleItemClick(item.name, item.path)}
                    >
                      {subItem}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {bottomItems.map((item) => (
            <div 
              key={item.name} 
              className="menu-item"
              onClick={() => handleItemClick(item.name, item.path)}
            >
              <span className="icon">{item.icon}</span>
              {isOpen && <span>{item.name}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Bar;