import React, { useState, useEffect, useMemo } from 'react';
import Bar from './Bar';
import '../fichiers-excels.css';

const ExcelPage = () => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    // Appel API pour récupérer les données brutes
    fetch('http://127.0.0.1:8000/raw-data')
      .then(response => {
        if (!response.ok) throw new Error("Réponse réseau non OK");
        return response.json();
      })
      .then(res => {
        // Sécurisation des données reçues
        setData(res.data || []);
        setColumns(res.columns || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur lors de la récupération des données:", err);
        setLoading(false);
      });
  }, []);

  // Gestion du changement de filtre pour une colonne spécifique
  const handleFilterChange = (col, value) => {
    setFilters(prev => ({
      ...prev,
      [col]: value
    }));
  };

  // Filtrage des données mémorisé pour optimiser les performances
  const filteredData = useMemo(() => {
    if (!data.length) return [];

    return data.filter(row => {
      return columns.every(col => {
        const filterValue = filters[col];
        if (!filterValue) return true;

        const cellValue = row[col] !== null && row[col] !== undefined
          ? String(row[col]).toLowerCase()
          : "";

        return cellValue.includes(filterValue.toLowerCase());
      });
    });
  }, [data, columns, filters]);

  return (
    <div className="excel-page">
      <Bar />

      <main className="excel-main main-content">
        <header className="excel-header-section">
          <h2>Brise</h2>
        </header>

        <div className="table-container">
          {loading ? (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Chargement des données en cours...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="empty-state">
              <p>Aucune donnée n'a pu être chargée. Vérifiez votre connexion au serveur.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="premium-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>
                        <div className="header-label">{col}</div>
                        <div className="filter-wrapper">
                          <input
                            type="text"
                            className="filter-input"
                            placeholder={`Filtrer...`}
                            value={filters[col] || ''}
                            onChange={(e) => handleFilterChange(col, e.target.value)}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length > 0 ? (
                    filteredData.map((row, index) => (
                      <tr key={index}>
                        {columns.map((col) => (
                          <td key={col}>
                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : ""}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length} className="empty-state">
                        Aucun résultat ne correspond à vos filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ExcelPage;