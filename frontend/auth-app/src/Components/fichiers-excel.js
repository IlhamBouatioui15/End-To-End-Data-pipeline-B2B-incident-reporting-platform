import React, { useState, useEffect } from 'react';
import Bar from './Bar';

const ExcelPage = () => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/raw-data')
      .then(response => response.json())
      .then(res => {
        setData(res.data);
        setColumns(res.columns);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur:", err);
        setLoading(false);
      });
  }, []);

  // --- STYLES POUR REMPLIR TOUTE LA PAGE ---
  const pageContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh', // Toute la hauteur de l'écran
    overflow: 'hidden', // Empêche le scroll sur la page entière
  };

  const mainAreaStyle = {
    marginLeft: '250px', // Espace pour votre barre latérale
    flex: 1, // Prend tout l'espace restant verticalement
    display: 'flex',
    flexDirection: 'column',
    padding: '0 20px 20px 20px',
    backgroundColor: '#f8f9fa'
  };

  const tableWrapperStyle = {
    flex: 1, // Fait descendre le conteneur jusqu'en bas
    overflow: 'auto', // Active le scroll interne (horizontal et vertical)
    backgroundColor: 'white',
    border: '1px solid #ccc',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  };

  const tableStyle = {
    width: 'max-content',
    minWidth: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
    fontFamily: 'Segoe UI, Tahoma, sans-serif',
  };

  const headerStyle = {
    backgroundColor: '#e2e2e2',
    position: 'sticky',
    top: 0, // L'en-tête reste en haut lors du scroll
    zIndex: 10,
    padding: '6px 8px',
    border: '1px solid #ccc',
    whiteSpace: 'nowrap',
    textAlign: 'left'
  };

  const cellStyle = {
    padding: '4px 8px',
    border: '1px solid #eee',
    whiteSpace: 'nowrap',
    lineHeight: '1.2'
  };

  return (
    <div style={pageContainerStyle}>
      <header><Bar /></header>
      
      <main style={mainAreaStyle}>
        <h2 style={{ margin: '15px 0', fontSize: '20px', color: '#333' }}>
          Fichier Excel Collaboratif
        </h2>
        
        {loading ? (
          <div style={{ padding: '20px' }}>Chargement des données...</div>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col} style={headerStyle}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr 
                    key={index} 
                    style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#fcfcfc' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f7ff'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fff' : '#fcfcfc'}
                  >
                    {columns.map((col) => (
                      <td key={col} style={cellStyle}>
                        {row[col] !== null ? String(row[col]) : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExcelPage;