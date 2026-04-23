import React, { useRef, useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import Bar from '../Bar';
import FileUpload from './FileUpload';
import GraphSection from './GraphSections';
import orangeLogo from './OIP.jpg';
import coverImage from '../capture.png';

const OG = {
  orange: '#FF7A01',
  orangeDark: '#C15C00',
  black: '#000000',
  white: '#FFFFFF',
  gray1: '#F4F4F4',
  gray2: '#E8E8E8',
  gray3: '#7A7A7A',
  text: '#333333',
  blue: '#34B1E2',
  green: '#52BD84',
  pink: '#FFB4E5',
  purple: '#A482D9',
  yellow: '#FFCE00',
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
  EvResp_data: 'stackedbar',
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
  { graphNames: ['evolution_globale_data'], title: 'Analyse de l\'évolution globale', layout: 'single' },
  { graphNames: ['evolution_criticite_data', 'distribution_criticite_data'], title: 'Analyse de la criticité', layout: 'double' },
  { graphNames: ['EvResp_data', 'DistResp_data'], title: 'Répartition des responsabilités', layout: 'double' },
  { graphNames: ['ServImpact_data', 'NivTait_data'], title: 'Services et niveaux de traitement', layout: 'double' },
  { graphNames: ['TauxResGTR_data'], title: 'Indicateurs de qualité GTR', layout: 'single' },
  { graphNames: ['IncidentResGTR_data'], title: 'Liste des incidents hors GTR', layout: 'full' },
  { graphNames: ['TopSitesRec_data'], title: 'Analyse des sites récurrents', layout: 'single' },
  { graphNames: ['top_problemes_recurrents_data'], title: 'Analyse des problèmes récurrents', layout: 'single' },
];

const FALLBACK_COLORS = ['34B1E2', '52BD84', 'FFB4E5', 'A482D9', 'FFCE00', '7A7A7A'];

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
  const baseLabels = (chartData.labels || []).map((l) => String(l));
  const baseLabelsCount = baseLabels.length;

  if (chartType === 'pie') {
    const ds = chartData.datasets[0] || {};
    const values = dataToNumbers(ds.data).slice(0, baseLabelsCount);
    while (values.length < baseLabelsCount) values.push(0);
    const safeValues = values.some((v) => v > 0) ? values : values.map((_, i) => (i === 0 ? 1 : 0));
    return [{ name: ds.label || 'Donnees', labels: baseLabels, values: safeValues }];
  }

  // Détection des années (stacks) uniques
  const years = Array.from(new Set(chartData.datasets.map(ds => ds.stack).filter(Boolean))).sort();
  const numYears = years.length;

  // Si on a plusieurs années, on intercale pour avoir des colonnes empilées côte à côte
  if (numYears > 1 && chartType !== 'horizontalBar') {
    const interleavedLabels = [];
    baseLabels.forEach(label => {
      years.forEach(year => {
        // Label court ex: Jan (23) pour gagner de l'espace
        const shortYear = year.slice(-2);
        interleavedLabels.push(`${label} (${shortYear})`);
      });
    });

    const categories = Array.from(new Set(chartData.datasets.map(ds => ds.label))).filter(Boolean);

    return categories.map(cat => {
      const interleavedValues = new Array(interleavedLabels.length).fill(0);

      chartData.datasets.forEach(ds => {
        if (ds.label === cat) {
          const yearIdx = years.indexOf(ds.stack);
          if (yearIdx !== -1) {
            const vals = dataToNumbers(ds.data);
            vals.forEach((v, i) => {
              if (i < baseLabelsCount) {
                interleavedValues[i * numYears + yearIdx] = v;
              }
            });
          }
        }
      });

      return {
        name: cat,
        labels: interleavedLabels,
        values: interleavedValues
      };
    });
  }

  // Fallback pour les graphiques simples ou horizontaux
  const seenLabels = new Set();
  return chartData.datasets
    .map((ds, idx) => {
      const values = dataToNumbers(ds.data).slice(0, baseLabelsCount);
      while (values.length < baseLabelsCount) values.push(0);

      const label = ds.label || `Serie ${idx + 1}`;
      let displayName = label;
      const isYearLabel = /^\d{4}$/.test(label.trim());

      if (!isYearLabel && seenLabels.has(label)) {
        displayName = "";
      } else {
        seenLabels.add(label);
      }

      return { name: displayName, labels: baseLabels, values: values };
    })
    .filter(s => s.values.some(v => v !== 0) || s.name !== "");
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
    'Description',
    'Site Client',
    'Durée de traitement (mn) OCEANE',
    'Action de résolution',
    'Remarque',
  ];

  const chosen = preferredCols.filter((c) => sourceCols.includes(c));
  const cols = chosen.length > 0 ? chosen : sourceCols.slice(0, 6);

  const header = cols.map((col) => ({
    text: col,
    options: {
      bold: true,
      fill: 'FF7A01',
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
      fontSize: 10,
    },
  }));

  const body = incidentData.map((row) =>
    cols.map((col) => {
      // Pour la colonne Remarque, on laisse vide si elle n'existe pas dans les données
      const val = tableText(row[col] || '');
      return {
        text: val,
        options: {
          align: col === 'Description' || col === 'Action de résolution' || col === 'Remarque' ? 'left' : 'center',
          valign: 'top',
          fontSize: 9,
        },
      };
    })
  );

  return [header, ...body];
};

const addSlideChrome = (slide, title, shapeType) => {
  // MBB Style: Top thin orange line, clean white background, Action Title
  slide.addShape(shapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.05,
    fill: { color: 'FF7900' },
  });

  // Action Title
  slide.addText(title, {
    x: 0.5,
    y: 0.2,
    w: 11.5,
    fontSize: 22,
    bold: true,
    color: '1A1A1A',
    fontFace: 'Calibri',
  });

  // Gray sub-line for separation
  slide.addShape(shapeType.rect, {
    x: 0.5,
    y: 0.7,
    w: 12.33,
    h: 0.01,
    fill: { color: 'E8E8E8' },
  });
};

const addPremiumFrame = (slide, shapeType) => {
  // Orange Logo in top right
  try {
    slide.addImage({ path: orangeLogo, x: 12.3, y: 0.15, w: 0.5, h: 0.5 });
  } catch (_) {
    // optional image
  }
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
      pptx.author = 'Orange Maroc';
      pptx.company = 'Orange Group';
      pptx.subject = 'Diagnostic de Performance B2B';
      pptx.title = 'Rapport_Incidents_B2B';
      pptx.lang = 'fr-FR';

      const SHAPE = pptx.ShapeType;
      const CHART = pptx.ChartType;

      const clientDisplay = clientLabel || 'CLIENT NON DEFINI';

      // ======================================
      // 1. COVER SLIDE (MBB "Executive" Style)
      // ======================================
      const cover = pptx.addSlide();
      cover.background = { color: '1A1A1A' }; // Fond noir pur, premium

      cover.addShape(SHAPE.rect, {
        x: 0, y: 6.8, w: 13.33, h: 0.03, fill: { color: 'FF7900' } // Accent line
      });

      cover.addText('Strictly Private & Confidential', {
        x: 0.5, y: 0.3, w: 5.0, fontSize: 10, bold: true, color: '999999', fontFace: 'Calibri'
      });

      try {
        cover.addImage({ path: orangeLogo, x: 12.0, y: 0.3, w: 0.8, h: 0.8 });
      } catch (_) { }

      cover.addText('Diagnostic de Performance B2B', {
        x: 0.5, y: 2.8, w: 10.0, fontSize: 36, bold: true, color: 'FFFFFF', fontFace: 'Calibri'
      });

      cover.addText(`Analyse des incidents et audit qualite pour le compte : ${clientDisplay}`, {
        x: 0.5, y: 3.8, w: 10.0, fontSize: 18, color: '999999', fontFace: 'Calibri'
      });

      cover.addText(`Periode analysee : ${new Date().toLocaleDateString('fr-FR')} | Source : Plateforme Incidents`, {
        x: 0.5, y: 6.2, w: 8.0, fontSize: 12, color: 'FF7900', fontFace: 'Calibri', bold: true
      });

      // ======================================
      // 2. CONTENT SLIDES (MBB "Pyramid Principle" Layout)
      // ======================================
      for (const { graphNames, title, layout } of SLIDES_PLAN) {
        const slide = pptx.addSlide();
        slide.background = { color: 'FFFFFF' }; // Fond blanc pur epure

        // Dynamic Action Titles (Standard MBB approach instead of generic titles)
        let actionTitle = title;
        if (title === 'Analyse de l\'évolution globale') actionTitle = "Tendance de l'activité : Analyse de la dynamique du volume d'incidents";
        if (title === 'Analyse de la criticité') actionTitle = "Priorisation des enjeux : Analyse de la criticité";
        if (title === 'Répartition des responsabilités') actionTitle = "Gouvernance opérationnelle : Audit des responsabilités et des sources d'incidents";
        if (title === 'Services et niveaux de traitement') actionTitle = "Suivi de la disponibilité des services et performance de résolution";
        if (title === 'Indicateurs de qualité GTR') actionTitle = "Qualité de Service (SLA) : Performance du respect de la Garantie de Temps de Rétablissement";
        if (title === 'Liste des incidents hors GTR') actionTitle = "Analyse d'exception : Détail complet des incidents hors GTR et plans d'actions";
        if (title === 'Analyse des sites récurrents') actionTitle = "Focus Géographique : Identification des sites clients à forte récurrence d'incidents";
        if (title === 'Analyse des problèmes récurrents') actionTitle = "Audit Structurel : Top des typologies de problèmes impactant l'infrastructure";

        addSlideChrome(slide, actionTitle, SHAPE);
        addPremiumFrame(slide, SHAPE);

        if (layout === 'full') {
          const rows = buildIncidentTableRows(graphsData?.IncidentResGTR_data);
          if (rows?.length > 1) {
            slide.addTable(rows, {
              x: 0.4, y: 1.0, w: 12.5, h: 5.8,
              border: { type: 'solid', pt: 0.5, color: 'E8E8E8' },
              fontFace: 'Calibri',
              margin: 4,
            });
          } else {
            slide.addText('Aucun incident hors GTR majeur sur la periode analysee.', {
              x: 0.5, y: 3.4, w: 12.2, fontSize: 16, italic: true, color: '999999', fontFace: 'Calibri', align: 'center'
            });
          }
          continue;
        }

        const addChartSafely = (graphKey, slot, showLegend, isPie, isStacked, isHoriz) => {
          const graphData = graphsData[graphKey];
          const chartType = GRAPH_TYPES[graphKey];
          if (!isChartData(graphData)) return;

          const chartData = buildChartSeriesForPpt(graphData, chartType);
          const chartColors = buildChartColorsForPpt(graphData, chartType);

          // Nettoyage final des valeurs NaN dans les datasets pour éviter les bugs PPT
          chartData.forEach(s => {
            s.values = s.values.map(v => (v === null || isNaN(v)) ? 0 : v);
          });

          const baseOpts = {
            x: slot.x, y: slot.y, w: slot.w, h: slot.h,
            chartColors,
            showLegend: showLegend,
            legendPos: 'b',
            showTitle: false, // Clean chart
            valAxisHidden: !isHoriz, // Hide value axes for cleaner look unless horizontal
            catAxisLineShow: false,
            vGridLineShow: false,
            hGridLineShow: false,
            showValue: true, // Show actual data labels instead of relying on grid axes
            dataLabelFontSize: 11,
            catAxisLabelFontSize: 11,
            valAxisLabelFontSize: 10,
            dataLabelColor: '1A1A1A',
            barGap: 30, // Réduit pour élargir les barres
            barOverlap: 0,
            barScale: 85, // Augmenté pour des barres plus larges et "bien définies"
          };

          try {
            if (chartType === 'pie') {
              slide.addChart(CHART.pie, chartData, { ...baseOpts, legendPos: 'r', showPercent: true, showLabel: false });
            } else if (chartType === 'horizontalBar' || isHoriz) {
              slide.addChart(CHART.bar, chartData, { ...baseOpts, barDir: 'bar', barGrouping: 'clustered', valAxisHidden: false });
            } else if (chartType === 'stackedbar' || isStacked) {
              // On repasse en mode stacked car les labels intercalés Jan(23)/Jan(24) 
              // permettent de séparer les années en gardant les catégories empilées.
              slide.addChart(CHART.bar, chartData, { ...baseOpts, barDir: 'col', barGrouping: 'stacked' });
            } else {
              slide.addChart(CHART.bar, chartData, { ...baseOpts, barDir: 'col', barGrouping: 'clustered' });
            }
          } catch (chartErr) {
            console.error(`Erreur chart PPT (${graphKey}):`, chartErr);
          }
        };

        if (layout === 'single') {
          // Rule of thirds for maximum impact: 1/3 Executive Text, 2/3 Clean Data
          const textSlot = { x: 0.5, y: 1.2, w: 3.5, h: 5.5 };
          const chartSlot = { x: 4.2, y: 1.2, w: 8.6, h: 5.5 };

          const graphKey = graphNames[0];

          slide.addText('Executive Summary', {
            x: textSlot.x, y: textSlot.y, w: textSlot.w, fontSize: 13, bold: true, color: 'FF7900', fontFace: 'Calibri'
          });

          // Text into MBB Bullets
          const rawComments = comments[graphKey] || "Les indicateurs structurels revelent une dynamique stable sur la majeure partie du perimetre observe, appelant neanmoins quelques points d'attention precis.";
          const points = rawComments.split('\n').filter(l => l.trim().length > 0).map(t => ({ text: t.trim() }));

          if (points.length > 0) {
            slide.addText(
              points.map(p => ({ text: p.text, options: { bullet: { type: 'custom', code: '25A0', color: 'FF7900' } } })),
              { x: textSlot.x, y: textSlot.y + 0.45, w: textSlot.w, h: 4.0, fontSize: 12, color: '333333', fontFace: 'Calibri', valign: 'top', lineSpacing: 22 }
            );
          }

          // On affiche la légende pour l'évolution globale comme demandé
          const isGlobalEv = graphKey === 'evolution_globale_data';
          addChartSafely(graphKey, chartSlot, isGlobalEv, GRAPH_TYPES[graphKey] === 'pie', GRAPH_TYPES[graphKey] === 'stackedbar', GRAPH_TYPES[graphKey] === 'horizontalBar');

        } else if (layout === 'double') {
          // 50/50 Data split with overarching synthesis
          const slots = [
            { x: 0.4, y: 1.8, w: 6.0, h: 4.8 },
            { x: 6.8, y: 1.8, w: 6.0, h: 4.8 }
          ];

          const comment1 = comments[graphNames[0]] || '';
          const comment2 = comments[graphNames[1]] || '';
          const combinedComment = [comment1, comment2].filter(Boolean).join(' | ') || "L'analyse correlee ci-dessous justifie l'orientation des efforts de resolution vers les segments les plus critiques.";

          slide.addText("Observations cles : " + combinedComment, {
            x: 0.5, y: 1.0, w: 12.3, fontSize: 12, color: '333333', fontFace: 'Calibri', italic: true,
            bullet: { type: 'custom', code: '25A3', color: 'FF7900' }
          });

          graphNames.forEach((graphKey, index) => {
            addChartSafely(graphKey, slots[index], true, GRAPH_TYPES[graphKey] === 'pie', GRAPH_TYPES[graphKey] === 'stackedbar', GRAPH_TYPES[graphKey] === 'horizontalBar');
          });
        }
      }

      const safeClient = clientDisplay.replace(/[\\/:*?"<>|]/g, '_');
      await pptx.writeFile({ fileName: `Rapport_Incidents_B2B_${safeClient}.pptx` });
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
            <div style={{ color: OG.black, fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>Aucune donnée filtrée</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>Filtrez les données pour afficher les graphiques et générer le rapport.</div>
          </div>
        )}
      </main>
    </div>
  );
}
