import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import './FileUpload.css';

const ANALYSIS_ENDPOINTS = [
  'evolution_globale_data',
  'evolution_criticite_data',
  'distribution_criticite_data',
  'EvResp_data',
  'DistResp_data',
  'ServImpact_data',
  'NivTait_data',
  'TauxResGTR_data',
  'IncidentResGTR_data',
  'TopSitesRec_data',
  'top_problemes_recurrents_data',
];

const PERIOD_OPTIONS = [
  { value: 'T1', label: 'T1' },
  { value: 'T2', label: 'T2' },
  { value: 'T3', label: 'T3' },
  { value: 'T4', label: 'T4' },
  { value: 'S1', label: 'S1' },
  { value: 'S2', label: 'S2' },
];

const isChartPayload = (payload) =>
  Boolean(
    payload &&
    Array.isArray(payload.labels) &&
    payload.labels.length > 0 &&
    Array.isArray(payload.datasets) &&
    payload.datasets.length > 0
  );

const normalizeMonthToken = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const MONTH_INDEX = {
  jan: 1, janvier: 1, january: 1,
  fev: 2, fevr: 2, fevrier: 2, feb: 2, february: 2,
  mar: 3, mars: 3, march: 3,
  avr: 4, avril: 4, apr: 4, april: 4,
  mai: 5, may: 5,
  jun: 6, juin: 6, june: 6,
  jul: 7, juil: 7, juillet: 7, july: 7,
  aou: 8, aout: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septembre: 9, september: 9,
  oct: 10, octobre: 10, october: 10,
  nov: 11, novembre: 11, november: 11,
  dec: 12, decembre: 12, december: 12,
};

const parseMonthKey = (label) => {
  const raw = String(label || '').trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) return year * 100 + month;
  }

  const rev = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (rev) {
    const month = Number(rev[1]);
    const year = Number(rev[2]);
    if (month >= 1 && month <= 12) return year * 100 + month;
  }

  const normalized = normalizeMonthToken(raw).replace(/[._-]/g, ' ');
  const yearMatch = normalized.match(/\b(\d{2,4})\b/);
  const monthWord = normalized.split(/\s+/).find((token) => MONTH_INDEX[token]);
  if (!monthWord) return null;

  let year = yearMatch ? Number(yearMatch[1]) : 0;
  if (year > 0 && year < 100) year += 2000;
  if (year <= 0) year = 2100;

  return year * 100 + MONTH_INDEX[monthWord];
};

const sortChartByMonth = (chartData) => {
  if (!isChartPayload(chartData)) return chartData;

  const withKeys = chartData.labels.map((label, index) => ({
    index,
    label,
    key: parseMonthKey(label),
  }));

  if (withKeys.every((item) => item.key === null)) {
    return chartData;
  }

  const sorted = [...withKeys].sort((a, b) => {
    const ka = a.key ?? Number.MAX_SAFE_INTEGER;
    const kb = b.key ?? Number.MAX_SAFE_INTEGER;
    if (ka !== kb) return ka - kb;
    return a.index - b.index;
  });

  const labels = sorted.map((item) => item.label);
  const order = sorted.map((item) => item.index);

  return {
    ...chartData,
    labels,
    datasets: chartData.datasets.map((dataset) => {
      const next = { ...dataset };
      next.data = order.map((oldIndex) => dataset.data?.[oldIndex]);
      if (Array.isArray(dataset.backgroundColor)) {
        next.backgroundColor = order.map((oldIndex) => dataset.backgroundColor[oldIndex]);
      }
      return next;
    }),
  };
};

const FileUpload = ({
  setGraphsData,
  setRawData = () => { },
  setSelectedClient = () => { },
  onLoadStart = () => { },
  onError = () => { },
}) => {
  const [columns, setColumns] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [availableClients, setAvailableClients] = useState([]);
  const [selectedClientOption, setSelectedClientOption] = useState(null);
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const [editableData, setEditableData] = useState([]);

  const selectStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: '42px',
        borderColor: state.isFocused ? '#FF7900' : '#D8D8D8',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(255,121,0,0.15)' : 'none',
        '&:hover': { borderColor: '#FF7900' },
      }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? '#FF7900' : state.isFocused ? '#FFF2E6' : '#FFFFFF',
        color: state.isSelected ? '#FFFFFF' : '#1A1A1A',
      }),
      multiValue: (base) => ({ ...base, backgroundColor: '#FFF2E6' }),
      multiValueLabel: (base) => ({ ...base, color: '#CC5C00', fontWeight: 600 }),
      multiValueRemove: (base) => ({
        ...base,
        color: '#CC5C00',
        ':hover': { backgroundColor: '#FF7900', color: '#FFFFFF' },
      }),
    }),
    []
  );

  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const [yearsResponse, clientsResponse] = await Promise.all([
          axios.get('http://10.139.118.172:8000/get-years'),
          axios.get('http://10.139.118.172:8000/get-clients'),
        ]);

        setAvailableYears(yearsResponse?.data?.years || []);
        setAvailableClients(clientsResponse?.data || []);
      } catch (err) {
        console.error('Erreur options:', err);
        onError('Impossible de charger la liste des clients/annees.');
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [onError]);

  const buildParamsObject = () => ({
    client: selectedClientOption?.value,
    annees: selectedYears.map((y) => y.value),
    trimestre: selectedPeriods,
  });

  const buildParamsQuery = () => {
    const query = new URLSearchParams();
    if (selectedClientOption?.value) query.append('client', selectedClientOption.value);
    selectedYears.forEach((y) => query.append('annees[]', y.value));
    selectedPeriods.forEach((p) => query.append('trimestre[]', p));
    return query;
  };

  const fetchRawData = async () => {
    if (!selectedClientOption || selectedYears.length === 0) {
      alert('Veuillez selectionner un client et au moins une annee.');
      return;
    }

    setIsLoading(true);
    try {
      const params = buildParamsQuery();
      const response = await fetch(`http://10.139.118.172:8000/raw-data?${params.toString()}`);
      const result = await response.json();

      setRawData(result?.data || []);
      setColumns(result?.columns || []);
      setEditableData(result?.data || []);
      setShowDataTable(true);
    } catch (error) {
      console.error('Erreur raw-data:', error);
      alert('Erreur lors du chargement des donnees brutes.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellChange = (rowIndex, columnName, newValue) => {
    const next = [...editableData];
    if (!next[rowIndex].__original) {
      next[rowIndex].__original = { ...next[rowIndex] };
    }
    next[rowIndex][columnName] = newValue;
    next[rowIndex].__isModified = true;
    setEditableData(next);
  };

  const saveDataChanges = async () => {
    try {
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username') || 'utilisateur';

      if (!token) {
        alert('Session expiree. Veuillez vous reconnecter.');
        return;
      }

      const modifiedRows = editableData
        .filter((row) => row.__isModified)
        .map((row) => {
          const { __original, __isModified, ...cleanNewRow } = row;
          return {
            utilisateur: username,
            old_row: __original,
            new_row: cleanNewRow,
          };
        });

      if (modifiedRows.length === 0) {
        alert('Aucune modification detectee.');
        return;
      }

      const response = await axios.post(
        'http://10.139.118.172:8000/enregistrer-modification',
        { modifications: modifiedRows },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert(response?.data?.message || 'Modifications enregistrees.');

      setEditableData(
        editableData.map((row) => {
          if (!row.__isModified) return row;
          const { __original, __isModified, ...cleanRow } = row;
          return cleanRow;
        })
      );
    } catch (err) {
      console.error('Erreur save:', err?.response?.data || err.message);
      const errorDetail = err?.response?.data?.detail || 'Echec de lenregistrement.';
      alert(`Erreur: ${errorDetail}`);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const params = buildParamsQuery();
      const response = await fetch(`http://10.139.118.172:8000/export-excel?${params.toString()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'donnees_filtrees.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Erreur lors de la generation du fichier Excel.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClientOption || selectedYears.length === 0) {
      onError('Veuillez choisir un client et au moins une annee.');
      return;
    }

    onLoadStart();
    setIsLoading(true);

    try {
      const params = buildParamsObject();
      const results = await Promise.all(
        ANALYSIS_ENDPOINTS.map((endpoint) =>
          axios
            .get(`http://10.139.118.172:8000/graph/${endpoint}`, { params })
            .then((res) => ({ endpoint, ok: true, data: res.data }))
            .catch((err) => ({
              endpoint,
              ok: false,
              error: err?.response?.data?.detail || err.message,
            }))
        )
      );

      const nextGraphs = {};
      const failed = [];

      results.forEach(({ endpoint, ok, data, error }) => {
        if (!ok) {
          failed.push(`${endpoint}: ${error}`);
          return;
        }

        if (endpoint === 'IncidentResGTR_data') {
          nextGraphs[endpoint] = data;
          return;
        }

        if (isChartPayload(data)) {
          if (endpoint === 'evolution_globale_data' || endpoint === 'evolution_criticite_data' || endpoint === 'EvResp_data') {
            nextGraphs[endpoint] = sortChartByMonth(data);
          } else {
            nextGraphs[endpoint] = data;
          }
        } else {
          failed.push(`${endpoint}: format invalide`);
        }
      });

      setSelectedClient(selectedClientOption.value);
      setGraphsData(nextGraphs);

      if (Object.keys(nextGraphs).length === 0) {
        onError('Aucun graphique valide retourne par lAPI.');
      } else if (failed.length > 0) {
        onError(`Certaines sections ne sont pas disponibles (${failed.length}).`);
      }
    } catch (error) {
      onError(error?.response?.data?.detail || 'Erreur lors de la generation des graphiques.');
      alert('Erreur lors de la generation des graphiques.');
    } finally {
      setIsLoading(false);
    }
  };

  const yearOptions = availableYears.map((y) => ({ value: y, label: y }));
  const clientOptions = availableClients.map((c) => ({ value: c, label: c }));

  return (
    <div>
      <form onSubmit={handleSubmit} className="file-upload-form">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Client</label>
            <Select
              options={clientOptions}
              value={selectedClientOption}
              onChange={setSelectedClientOption}
              isClearable
              isSearchable
              isDisabled={loadingOptions || isLoading}
              styles={selectStyles}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Annee(s)</label>
            <Select
              isMulti
              options={yearOptions}
              value={selectedYears}
              onChange={(vals) => setSelectedYears(vals || [])}
              isDisabled={loadingOptions || isLoading}
              styles={selectStyles}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Periode</label>
            <Select
              isMulti
              options={PERIOD_OPTIONS}
              value={PERIOD_OPTIONS.filter((opt) => selectedPeriods.includes(opt.value))}
              onChange={(vals) => setSelectedPeriods((vals || []).map((opt) => opt.value))}
              isDisabled={loadingOptions || isLoading}
              styles={selectStyles}
            />
          </div>
        </div>

        <button type="submit" disabled={isLoading || loadingOptions} className="submit-btn">
          {isLoading ? 'Analyse...' : 'Generer les graphiques'}
        </button>
      </form>

      <div className="mt-3">
        <button onClick={fetchRawData} disabled={isLoading || loadingOptions} className="load-data-btn">
          Charger les donnees
        </button>
      </div>

      {showDataTable && (
        <div className="data-table">
          <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto' }}>
            <h3>Donnees brutes</h3>
            <table>
              <thead>
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} style={{ minWidth: '150px', padding: '8px' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editableData.map((row, rowIndex) => (
                  <tr key={row.numero_ticket || rowIndex}>
                    {columns.map((col, colIndex) => (
                      <td key={colIndex}>
                        <input
                          type="text"
                          value={row[col] ?? ''}
                          onChange={(event) => handleCellChange(rowIndex, col, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-actions" style={{ marginTop: '10px' }}>
              <button onClick={saveDataChanges} className="save-btn" style={{ marginRight: '30px' }}>
                Enregistrer
              </button>
              <button onClick={handleDownloadExcel} className="save-btn">
                Exporter Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
