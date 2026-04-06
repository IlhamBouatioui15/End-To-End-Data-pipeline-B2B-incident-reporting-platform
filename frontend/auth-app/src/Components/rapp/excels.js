import React, { useRef, useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import Bar from '../Bar';
import FileUpload from './FileUpload';
import GraphSection from './GraphSections';
import orangeLogo from './OIP.jpg';
import coverImage from '../capture.png';

const OG = {
  orange: '#FF7900',
  orangeDark: '#CC5C00',
  black: '#1A1A1A',
  white: '#FFFFFF',
  gray1: '#F4F4F4',
  gray2: '#E8E8E8',
  gray3: '#999999',
  text: '#333333',
};

const GRAPH_TITLES = {
  evolution_globale_data: 'Evolution globale des incidents',
  evolution_criticite_data: 'Evolution par criticite',
  distribution_criticite_data: 'Distribution par criticite',
  EvResp_data: 'Evolution par responsabilite',
  DistResp_data: 'Distribution par responsabilite',
  ServImpact_data: 'Services impactes',
  NivTait_data: 'Niveaux de traitement',
  TauxResGTR_data: 'Taux de respect GTR',
  IncidentResGTR_data: 'Details des incidents hors GTR',
  TopSitesRec_data: 'Top des sites recurrents',
  top_problemes_recurrents_data: 'Top des problemes recurrents',
};

const GRAPH_TYPES = {
  evolution_globale_data: 'bar',
  evolution_criticite_data: 'stackedbar',
  distribution_criticite_data: 'pie',
  EvResp_data: 'bar',
  DistResp_data: 'pie',
  ServImpact_data: 'pie',
  NivTait_data: 'pie',
  TauxResGTR_data: 'pie',
  TopSitesRec_data: 'horizontalBar',
  top_problemes_recurrents_data: 'horizontalBar',
};

const NAV_ITEMS = [
  { key: 'evolution_globale_data', label: 'Evolution globale' },
  { key: 'evolution_criticite_data', label: 'Evolution criticite' },
  { key: 'distribution_criticite_data', label: 'Distribution criticite' },
  { key: 'EvResp_data', label: 'Evolution responsabilite' },
  { key: 'DistResp_data', label: 'Distribution responsabilite' },
  { key: 'ServImpact_data', label: 'Services impactes' },
  { key: 'NivTait_data', label: 'Niveaux traitement' },
  { key: 'TauxResGTR_data', label: 'Taux GTR' },
  { key: 'TopSitesRec_data', label: 'Sites recurrents' },
  { key: 'top_problemes_recurrents_data', label: 'Problemes recurrents' },
  { key: 'IncidentResGTR_data', label: 'Incidents hors GTR' },
];

const SLIDES_PLAN = [
  { graphNames: ['evolution_globale_data'], title: 'Analyse de levolution globale', layout: 'single' },
  { graphNames: ['evolution_criticite_data', 'distribution_criticite_data'], title: 'Analyse de la criticite', layout: 'double' },
  { graphNames: ['EvResp_data', 'DistResp_data'], title: 'Repartition des responsabilites', layout: 'double' },
  { graphNames: ['ServImpact_data', 'NivTait_data'], title: 'Services et traitement', layout: 'double' },
  { graphNames: ['TauxResGTR_data'], title: 'Indicateurs de qualite GTR', layout: 'single' },
  { graphNames: ['IncidentResGTR_data'], title: 'Liste des incidents hors GTR', layout: 'full' },
  { graphNames: ['TopSitesRec_data'], title: 'Analyse des sites recurrents', layout: 'single' },
  { graphNames: ['top_problemes_recurrents_data'], title: 'Analyse des problemes recurrents', layout: 'single' },
];

const FALLBACK_COLORS = ['FF7900', 'CC5C00', 'F16E00', 'FF9E44', 'FFCC88', 'E65C00'];

const isChartData = (payload) =>
  Boolean(
    payload &&
      Array.isArray(payload.labels) &&
      payload.labels.length > 0 &&
      Array.isArray(payload.datasets) &&
      payload.datasets.length > 0
  );

const tableText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const toHex2 = (n) => Number(n).toString(16).padStart(2, '0').toUpperCase();

const colorToPpt = (color) => {
  const raw = String(color || '').trim();
  if (!raw) return '';

  const hex = raw.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return hex.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return hex
      .split('')
      .map((c) => `${c}${c}`)
      .join('')
      .toUpperCase();
  }

  const rgb = raw.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return `${toHex2(rgb[1])}${toHex2(rgb[2])}${toHex2(rgb[3])}`;
  }

  return '';
};

const dataToNumbers = (arr) => (Array.isArray(arr) ? arr.map((v) => Number(v) || 0) : []);

const hasValidSeries = (series) =>
  Array.isArray(series) &&
  series.length > 0 &&
  series.every(
    (s) =>
      Array.isArray(s.labels) &&
      s.labels.length > 0 &&
      Array.isArray(s.values) &&
      s.values.length === s.labels.length
  );

const buildChartSeriesForPpt = (chartData, chartType) => {
  const labels = (chartData.labels || []).map((l) => String(l));
  const labelsCount = labels.length;

  if (chartType === 'pie') {
    const ds = chartData.datasets[0] || {};
    const values = dataToNumbers(ds.data).slice(0, labelsCount);
    while (values.length < labelsCount) values.push(0);

    const safeValues = values.some((v) => v > 0) ? values : values.map((_, i) => (i === 0 ? 1 : 0));

    return [
      {
        name: ds.label || 'Donnees',
        labels,
        values: safeValues,
      },
    ];
  }

  return chartData.datasets
    .map((ds, idx) => {
      const values = dataToNumbers(ds.data).slice(0, labelsCount);
      while (values.length < labelsCount) values.push(0);

      return {
        name: ds.label || `Serie ${idx + 1}`,
        labels,
        values,
      };
    })
    .filter((s) => s.values.some((v) => Number.isFinite(v)));
};

const buildChartColorsForPpt = (chartData, chartType) => {
  if (!isChartData(chartData)) return FALLBACK_COLORS;

  if (chartType === 'pie') {
    const ds = chartData.datasets[0] || {};
    if (Array.isArray(ds.backgroundColor) && ds.backgroundColor.length > 0) {
      const pieColors = ds.backgroundColor.map((c) => colorToPpt(c)).filter(Boolean);
      return pieColors.length > 0 ? pieColors : FALLBACK_COLORS;
    }
    return FALLBACK_COLORS;
  }

  const colors = chartData.datasets
    .map((ds, idx) => {
      const bg = ds.backgroundColor;
      if (Array.isArray(bg)) return colorToPpt(bg[0]) || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
      return colorToPpt(bg) || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
    })
    .filter(Boolean);

  return colors.length > 0 ? colors : FALLBACK_COLORS;
};

const buildIncidentTableRows = (incidentData) => {
  if (!incidentData) return null;

  if (Array.isArray(incidentData?.tableRows) && incidentData.tableRows.length > 0) {
    return incidentData.tableRows;
  }

  if (!Array.isArray(incidentData) || incidentData.length === 0) {
    return null;
  }

  const sourceCols = Object.keys(incidentData[0] || {});
  const preferredCols = [
    'N ticket',
    'N° ticket',
    'numero_ticket',
    'Description',
    'Site Client',
    'Duree de traitement (mn) OCEANE',
    'Action de resolution',
  ];

  const chosen = preferredCols.filter((c) => sourceCols.includes(c));
  const cols = chosen.length > 0 ? chosen : sourceCols.slice(0, 6);

  const header = cols.map((col) => ({
    text: col,
    options: {
      bold: true,
      fill: 'FF7900',
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
      fontSize: 10,
    },
  }));

  const body = incidentData.map((row) =>
    cols.map((col) => ({
      text: tableText(row[col]),
      options: {
        align: col === 'Description' || col === 'Action de resolution' ? 'left' : 'center',
        valign: 'top',
        fontSize: 9,
      },
    }))
  );

  return [header, ...body];
};

const addSlideChrome = (slide, title, shapeType) => {
  slide.addShape(shapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.58,
    fill: { color: '1A1A1A' },
    line: { color: '1A1A1A' },
  });

  try {
    slide.addImage({ path: orangeLogo, x: 0.2, y: 0.07, w: 0.4, h: 0.4 });
  } catch (_) {
    // optional image
  }

  slide.addText(title, {
    x: 0.75,
    y: 0.14,
    w: 12.2,
    fontSize: 15,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Calibri',
  });
};

const addPremiumFrame = (slide, shapeType) => {
  slide.addShape(shapeType.rect, {
    x: 0,
    y: 0.58,
    w: 13.33,
    h: 0.04,
    fill: { color: 'FF7900' },
    line: { color: 'FF7900' },
  });

  slide.addShape(shapeType.rect, {
    x: 12.15,
    y: 0.08,
    w: 1.0,
    h: 0.32,
    fill: { color: 'FF7900', transparency: 15 },
    line: { color: 'FF7900', transparency: 15 },
  });
};

export default function Excel() {
  const [selectedClient, setSelectedClient] = useState(null);
  const [graphsData, setGraphsData] = useState({});
  const [comments, setComments] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  const sectionRefs = useRef({});

  const handleSetGraphsData = (data) => {
    setLoadError(null);
    setIsLoading(false);
    setGraphsData(data || {});
    const first = NAV_ITEMS.find((n) => data?.[n.key])?.key;
    if (first) setActiveSection(first);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setLoadError(null);
    setGraphsData({});
    setSelectedClient(null);
  };

  const handleLoadError = (msg) => {
    if (msg) setLoadError(msg);
    setIsLoading(false);
  };

  const handleCommentChange = (graphId, comment) => {
    setComments((prev) => ({ ...prev, [graphId]: comment }));
  };

  const scrollTo = (key) => {
    setActiveSection(key);
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const loadedChartKeys = NAV_ITEMS.map((n) => n.key).filter((key) => key !== 'IncidentResGTR_data' && isChartData(graphsData[key]));
  const incidentRows = buildIncidentTableRows(graphsData?.IncidentResGTR_data);
  const hasIncident = Array.isArray(incidentRows) && incidentRows.length > 1;
  const hasContent = loadedChartKeys.length > 0 || hasIncident;
  const navLoadedKeys = NAV_ITEMS.map((n) => n.key).filter((key) => {
    if (key === 'IncidentResGTR_data') return hasIncident;
    return loadedChartKeys.includes(key);
  });

  const clientLabel = selectedClient ? String(selectedClient).toUpperCase() : null;

  const generatePPT = async () => {
    setIsGenerating(true);
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.author = 'Orange Business';
      pptx.company = 'Orange Group';
      pptx.subject = 'Rapport incidents ticketing';
      pptx.title = 'Rapport incidents';
      pptx.lang = 'fr-FR';

      const SHAPE = pptx.ShapeType;
      const CHART = pptx.ChartType;

      const clientDisplay = clientLabel || 'CLIENT NON DEFINI';

      const cover = pptx.addSlide();
      cover.background = { color: 'F4F4F4' };
      addSlideChrome(cover, 'Orange Maroc - Rapport Incident ', SHAPE);
      addPremiumFrame(cover, SHAPE);

      cover.addShape(SHAPE.rect, {
        x: 0,
        y: 2.15,
        w: 10.3,
        h: 2.95,
        fill: { color: 'FF7900' },
        line: { color: 'FF7900' },
      });

      cover.addText('RAPPORT DES INCIDENTS ', {
        x: 0.75,
        y: 3.15,
        w: 8.5,
        fontSize: 34,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Calibri',
      });

      cover.addText(`Client : ${clientDisplay}`, {
        x: 0.75,
        y: 4.2,
        w: 8.5,
        fontSize: 20,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Calibri',
      });

      try {
        cover.addImage({ path: coverImage, x: 9.45, y: 2.1, w: 3.55, h: 3.05 });
      } catch (_) {
        // optional image
      }

      cover.addText(new Date().toLocaleDateString('fr-FR'), {
        x: 11.1,
        y: 7.05,
        w: 2.0,
        fontSize: 10,
        color: '666666',
        align: 'right',
        fontFace: 'Calibri',
      });

      for (const { graphNames, title, layout } of SLIDES_PLAN) {
        const slide = pptx.addSlide();
        slide.background = { color: 'F4F4F4' };
        addSlideChrome(slide, title, SHAPE);
        addPremiumFrame(slide, SHAPE);

        if (layout === 'full') {
          const rows = buildIncidentTableRows(graphsData?.IncidentResGTR_data);
          if (rows?.length > 1) {
            slide.addTable(rows, {
              x: 0.3,
              y: 0.85,
              w: 12.75,
              h: 6.45,
              border: { type: 'solid', pt: 0.6, color: 'E0E0E0' },
              fontFace: 'Calibri',
              margin: 4,
            });
          } else {
            slide.addText('Aucun incident hors GTR sur la periode.', {
              x: 0.5,
              y: 3.4,
              w: 12.2,
              fontSize: 16,
              italic: true,
              color: '333333',
              fontFace: 'Calibri',
              align: 'center',
            });
          }
          continue;
        }

        const slots =
          layout === 'double'
            ? [
                { x: 0.4, y: 1.0, w: 6.0, h: 3.8, cx: 0.4, cy: 5.0, cw: 6.0 },
                { x: 6.8, y: 1.0, w: 6.0, h: 3.8, cx: 6.8, cy: 5.0, cw: 6.0 },
              ]
            : [{ x: 0.4, y: 1.0, w: 12.4, h: 4.3, cx: 0.4, cy: 5.5, cw: 12.4 }];

        graphNames.forEach((graphKey, index) => {
          const slot = slots[index];
          const graphData = graphsData[graphKey];
          const chartType = GRAPH_TYPES[graphKey];

          if (slot && isChartData(graphData)) {
            const chartData = buildChartSeriesForPpt(graphData, chartType);
            const chartColors = buildChartColorsForPpt(graphData, chartType);
            const baseOpts = {
              x: slot.x,
              y: slot.y,
              w: slot.w,
              h: slot.h,
              chartColors,
              showLegend: true,
              legendPos: 'b',
              catAxisLabelFontSize: 10,
              valAxisLabelFontSize: 10,
              dataLabelFontSize: 9,
            };

            try {
              if (!hasValidSeries(chartData)) {
                throw new Error('Series invalides pour export');
              }

              if (chartType === 'pie') {
                slide.addChart(CHART.pie, chartData, {
                  ...baseOpts,
                  legendPos: 'r',
                  showPercent: true,
                  showLabel: true,
                });
              } else if (chartType === 'horizontalBar') {
                slide.addChart(CHART.bar, chartData, {
                  ...baseOpts,
                  barDir: 'bar',
                  barGrouping: 'clustered',
                });
              } else if (chartType === 'stackedbar') {
                slide.addChart(CHART.bar, chartData, {
                  ...baseOpts,
                  barDir: 'col',
                  barGrouping: 'stacked',
                });
              } else {
                slide.addChart(CHART.bar, chartData, {
                  ...baseOpts,
                  barDir: 'col',
                  barGrouping: 'clustered',
                });
              }
            } catch (chartErr) {
              console.error(`Erreur chart PPT (${graphKey}):`, chartErr);
              slide.addShape(SHAPE.rect, {
                x: slot.x,
                y: slot.y,
                w: slot.w,
                h: slot.h,
                fill: { color: 'FFFFFF' },
                line: { color: 'E1E1E1' },
              });
              slide.addText('Graphique indisponible pour export', {
                x: slot.x + 0.2,
                y: slot.y + slot.h / 2 - 0.2,
                w: slot.w - 0.4,
                fontSize: 11,
                color: '999999',
                align: 'center',
              });
            }
          }

          if (slot) {
            slide.addText('Analyse :', {
              x: slot.cx,
              y: slot.cy,
              w: slot.cw,
              fontSize: 12,
              bold: true,
              color: 'FF7900',
              fontFace: 'Calibri',
            });

            slide.addText(comments[graphKey] || 'Aucune analyse saisie.', {
              x: slot.cx,
              y: slot.cy + 0.2,
              w: slot.cw,
              h: 1.0,
              fontSize: 11,
              italic: true,
              color: '333333',
              fontFace: 'Calibri',
              valign: 'top',
              wrap: true,
            });
          }
        });
      }

      const safeClient = clientDisplay.replace(/[\\/:*?"<>|]/g, '_');
      await pptx.writeFile({ fileName: `Rapport_Incidents_${safeClient}.pptx` });
    } catch (err) {
      console.error('Erreur PPT:', err);
      alert(`Erreur lors de la generation du PPT: ${err?.message || 'inconnue'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: OG.gray1 }}>
      <header>
        <Bar />
      </header>

      <main style={{ marginLeft: 250, padding: '22px 26px' }}>
        <div
          style={{
            background: OG.black,
            borderRadius: '10px',
            padding: '12px 18px',
            marginBottom: '18px',
            borderBottom: `3px solid ${OG.orange}`,
            color: OG.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ color: OG.orange, fontWeight: 800, fontSize: '18px' }}>TABLEAU DE BORD INCIDENTS TICKETING</div>
            <div style={{ color: OG.gray3, fontSize: '12px' }}>Orange Maroc Services | Rapport exploitation B2B</div>
          </div>
          {clientLabel && (
            <div style={{ background: OG.orange, color: OG.white, borderRadius: '7px', padding: '6px 12px', fontWeight: 800, fontSize: '13px' }}>{clientLabel}</div>
          )}
        </div>

        <div
          style={{
            background: OG.white,
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '18px',
            boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
            border: `1px solid ${OG.gray2}`,
            borderTop: `3px solid ${OG.orange}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', color: OG.black }}>Chargement des donnees</h2>
            {hasContent && (
              <button
                onClick={generatePPT}
                disabled={isGenerating}
                style={{
                  background: isGenerating ? '#666666' : `linear-gradient(135deg, ${OG.orange} 0%, ${OG.orangeDark} 100%)`,
                  color: OG.white,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontWeight: 700,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                }}
              >
                {isGenerating ? 'Generation...' : 'Exporter Rapport PPT '}
              </button>
            )}
          </div>

          <div style={{ marginTop: '10px' }}>
            <FileUpload setGraphsData={handleSetGraphsData} setSelectedClient={setSelectedClient} onLoadStart={handleLoadStart} onError={handleLoadError} />
          </div>
        </div>

        {navLoadedKeys.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {NAV_ITEMS.filter((n) => navLoadedKeys.includes(n.key)).map((item) => (
              <button
                key={item.key}
                onClick={() => scrollTo(item.key)}
                style={{
                  border: '1px solid #F0C9A6',
                  background: activeSection === item.key ? OG.orange : '#FFF2E6',
                  color: activeSection === item.key ? OG.white : OG.orangeDark,
                  borderRadius: '20px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div style={{ padding: '12px 14px', background: '#FFF8F0', border: `1px solid ${OG.orange}`, borderRadius: '8px', marginBottom: '16px' }}>
            Chargement des graphiques...
          </div>
        )}

        {loadError && (
          <div style={{ padding: '12px 14px', background: '#FFF3CD', border: '1px solid #FFC107', borderLeft: `4px solid ${OG.orange}`, borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 700, color: OG.orange }}>Erreur de chargement</div>
            <div style={{ color: OG.text, fontSize: '13px' }}>{loadError}</div>
          </div>
        )}

        {loadedChartKeys.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(540px, 1fr))', gap: '18px' }}>
            {loadedChartKeys.map((key) => (
              <div
                key={key}
                ref={(el) => {
                  sectionRefs.current[key] = el;
                }}
              >
                <GraphSection graphId={key} graphData={graphsData[key]} title={GRAPH_TITLES[key]} chartType={GRAPH_TYPES[key]} onCommentChange={handleCommentChange} />
              </div>
            ))}
          </div>
        )}

        {hasIncident && (
          <div
            ref={(el) => {
              sectionRefs.current.IncidentResGTR_data = el;
            }}
            style={{
              marginTop: '18px',
              background: OG.white,
              borderRadius: '10px',
              borderTop: `3px solid ${OG.orange}`,
              boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <div style={{ background: OG.black, padding: '12px 18px' }}>
              <h3 style={{ margin: 0, color: OG.white, fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{GRAPH_TITLES.IncidentResGTR_data}</h3>
            </div>
            <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {incidentRows[0].map((head, index) => (
                      <th key={index} style={{ background: '#FFF2E6', color: '#CC5C00', border: '1px solid #F0D6BF', padding: '8px', fontSize: '12px', textAlign: 'left' }}>
                        {head.text}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidentRows.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} style={{ border: '1px solid #ECECEC', padding: '8px', fontSize: '12px', color: OG.text }}>
                          {cell.text}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!hasContent && !isLoading && !loadError && (
          <div style={{ textAlign: 'center', color: OG.gray3, padding: '48px 20px' }}>
            <div style={{ color: OG.orange, fontSize: '34px', fontWeight: 800 }}>PPT</div>
            <div style={{ color: OG.black, fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>Aucune donnee chargee</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>Importez un fichier Excel pour afficher les graphiques et generer le rapport.</div>
          </div>
        )}
      </main>
    </div>
  );
}
