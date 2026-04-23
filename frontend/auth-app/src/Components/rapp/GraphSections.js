import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(...registerables, ChartDataLabels);

const ORANGE_PALETTE = [
  '#34B1E2', // Bleu
  '#52BD84', // Vert
  '#FFB4E5', // Rose
  '#A482D9', // Violet
  '#FFCE00', // Jaune
  '#7A7A7A', // Gris
];

const WHITE_BG_PLUGIN = {
  id: 'white_bg',
  beforeDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

const YEAR_LABELS_PLUGIN = {
  id: 'year_labels',
  afterDatasetsDraw(chart) {
    const { ctx, data, scales: { x } } = chart;
    const isClustered = chart.config.options.scales.x.stacked === false;
    if (chart.config.type !== 'bar' || !isClustered) return;

    ctx.save();
    
    // Position labels under each column
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 10px Calibri, Arial, sans-serif';
    ctx.fillStyle = '#444444'; // Darker for better visibility

    const uniqueStacksPerIndex = []; 
    data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      const stack = dataset.stack;
      if (!stack) return;

      meta.data.forEach((element, index) => {
        if (!uniqueStacksPerIndex[index]) uniqueStacksPerIndex[index] = new Set();
        if (!uniqueStacksPerIndex[index].has(stack)) {
          uniqueStacksPerIndex[index].add(stack);
          // Drawing years just above the month labels
          ctx.fillText(stack, element.x, x.bottom + 5);
        }
      });
    });
    ctx.restore();
  }
};

const isChartPayload = (payload) =>
  Boolean(
    payload &&
    Array.isArray(payload.labels) &&
    payload.labels.length > 0 &&
    Array.isArray(payload.datasets) &&
    payload.datasets.length > 0
  );

function applyPalette(graphData, chartType) {
  if (!isChartPayload(graphData)) return graphData;

  const datasets = graphData.datasets || [];
  const isStacked = chartType === 'stackedbar' || chartType === 'bar';

  // Identification de l'année maximale pour les nuances
  const years = datasets.map(d => parseInt(d.stack)).filter(y => !isNaN(y));
  const maxYear = years.length > 0 ? Math.max(...years) : 0;

  return {
    ...graphData,
    datasets: datasets.map((dataset, index) => {
      const next = { ...dataset };

      if (chartType === 'pie') {
        if (!Array.isArray(next.backgroundColor) || next.backgroundColor.length === 0) {
          next.backgroundColor = (next.data || []).map((_, i) => ORANGE_PALETTE[i % ORANGE_PALETTE.length]);
        }
        next.borderColor = '#FFFFFF';
        next.borderWidth = 2;
        next.hoverOffset = 6;
      } else {
        // Palette par criticité ou responsabilité si disponible
        const CRIT_COLORS = { 'Bloquant': '#52BD84', 'Majeur': '#FFB4E5', 'Mineur': '#A482D9' };
        const RESP_COLORS = { 'Orange': '#A482D9', 'Client': '#52BD84', 'Autres': '#FFB4E5' };

        if (next.label && (CRIT_COLORS[next.label] || RESP_COLORS[next.label])) {
          next.backgroundColor = CRIT_COLORS[next.label] || RESP_COLORS[next.label];
          next.borderColor = next.backgroundColor;
        } else if (!next.backgroundColor) {
          next.backgroundColor = ORANGE_PALETTE[index % ORANGE_PALETTE.length];
          next.borderColor = next.backgroundColor;
        }

        // Application d'une nuance (opacité) pour les années précédentes
        const currentYear = parseInt(next.stack);
        if (currentYear && maxYear && currentYear < maxYear) {
          if (next.backgroundColor && next.backgroundColor.startsWith('#')) {
            next.backgroundColor = next.backgroundColor + 'AA'; // Ajout d'alpha (environ 66%)
          }
        }

        next.borderRadius = 0;
        next.borderWidth = 0;
        // Espacement équilibré pour le clustering par année
        next.barPercentage = 0.95; 
        next.categoryPercentage = 0.7; // Plus d'espace entre les mois
      }

      return next;
    }),
  };
}

const GraphSection = forwardRef(function GraphSection({ graphData, title, graphId, onCommentChange, chartType }, ref) {
  const [comment, setComment] = useState('');
  const chartRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getChartImage: () => chartRef.current?.toBase64Image?.() || null,
  }));

  const handleChange = (event) => {
    const value = event.target.value;
    setComment(value);
    onCommentChange(graphId, value);
  };

  if (!isChartPayload(graphData)) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          borderTop: '3px solid #FFC107',
          padding: '18px 20px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
        }}
      >
        <div style={{ fontWeight: 700, color: '#CC5500', fontSize: '13px' }}>Donnees invalides: {title}</div>
        <div style={{ color: '#888888', fontSize: '12px', marginTop: '4px' }}>Verifiez le format de la reponse API pour ce graphique.</div>
      </div>
    );
  }

  const isPie = chartType === 'pie';
  const isHorizontal = chartType === 'horizontalBar';
  const isStacked = chartType === 'stackedbar';
  const enrichedData = applyPalette(graphData, chartType);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: isHorizontal ? 'y' : 'x',
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 14,
          padding: 14,
          font: { size: 11, family: 'Calibri, Arial, sans-serif' },
          color: '#333333',
          generateLabels: (chart) => {
            const datasets = chart.data.datasets || [];
            if (isPie) {
              const data = chart.data;
              if (data.labels.length && datasets.length) {
                return data.labels.map((label, i) => ({
                  text: label,
                  fillStyle: datasets[0].backgroundColor[i],
                  strokeStyle: datasets[0].borderColor[i],
                  lineWidth: 0,
                  hidden: !chart.getDataVisibility(i),
                  index: i // Custom index for Pie
                }));
              }
              return [];
            }

            const labels = [];
            const seen = new Set();
            datasets.forEach((ds, i) => {
              if (ds.label && !seen.has(ds.label)) {
                seen.add(ds.label);
                labels.push({
                  text: ds.label,
                  fillStyle: ds.backgroundColor,
                  strokeStyle: ds.borderColor,
                  lineWidth: 0,
                  hidden: !chart.isDatasetVisible(i),
                  datasetIndex: i 
                });
              }
            });
            return labels;
          }
        },
        onClick: (e, legendItem, legend) => {
          const chart = legend.chart;
          if (isPie) {
            chart.toggleDataVisibility(legendItem.index);
          } else {
            const label = legendItem.text;
            const datasets = chart.data.datasets;
            const isHidden = !chart.isDatasetVisible(legendItem.datasetIndex);
            datasets.forEach((ds, i) => {
              if (ds.label === label) {
                chart.setDatasetVisibility(i, isHidden);
              }
            });
          }
          chart.update();
        },
      },
      datalabels: {
        display: (ctx) => Number(ctx?.dataset?.data?.[ctx.dataIndex] || 0) > 0,
        anchor: isPie ? 'center' : 'end',
        align: isPie ? 'center' : 'top',
        color: isPie ? '#FFFFFF' : '#444444',
        font: { weight: 'bold', size: isPie ? 11 : 10, family: 'Calibri, Arial, sans-serif' },
        formatter: (value, ctx) => {
          if (isPie) {
            const values = Array.isArray(ctx?.dataset?.data) ? ctx.dataset.data : [];
            const total = values.reduce((acc, n) => acc + Number(n || 0), 0);
            if (!total) return '0%';
            return `${((Number(value || 0) * 100) / total).toFixed(1)}%`;
          }
          return value;
        },
      },
    },
    scales: isPie
      ? {}
      : {
        y: {
          beginAtZero: true,
          stacked: isStacked,
          grid: { color: '#F0F0F0', drawBorder: false },
          ticks: { font: { size: 11, family: 'Calibri, Arial, sans-serif' }, color: '#555555' },
        },
        x: {
          stacked: false, // Désactivé pour permettre le clustering par année (via stack ID)
          grid: { display: false },
          ticks: { 
            font: { size: 11, family: 'Calibri, Arial, sans-serif' }, 
            color: '#333333',
            padding: 25 // Plus d'espace pour nos labels d'années personnalisés
          },
        },
      },
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '10px',
        borderTop: '4px solid #FF7A01',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ background: '#000000', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '4px', height: '18px', background: '#FF7A01', borderRadius: '2px', flexShrink: 0 }} />
        <h3
          style={{
            margin: 0,
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            fontFamily: 'Outfit, Calibri, Arial, sans-serif',
          }}
        >
          {title}
        </h3>
      </div>

      <div style={{ padding: '18px 18px 10px', height: '400px', position: 'relative' }}>
        {isPie ? (
          <Pie ref={chartRef} data={enrichedData} options={chartOptions} plugins={[WHITE_BG_PLUGIN]} />
        ) : (
          <Bar ref={chartRef} data={enrichedData} options={chartOptions} plugins={[WHITE_BG_PLUGIN, YEAR_LABELS_PLUGIN]} />
        )}
      </div>

      <div style={{ padding: '10px 18px 16px', background: '#FAFAFA', borderTop: '1px solid #F0F0F0' }}>
        <label
          style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 800,
            color: '#FF7A01',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: '8px',
            fontFamily: 'Outfit, Calibri, Arial, sans-serif',
          }}
        >
          Analyse et commentaire stratégique
        </label>
        <textarea
          value={comment}
          onChange={handleChange}
          rows={2}
          placeholder='Saisissez votre analyse ici...'
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 12px',
            border: '1px solid #E0E0E0',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'Calibri, Arial, sans-serif',
            color: '#333333',
            background: '#FFFFFF',
            resize: 'vertical',
            outline: 'none',
          }}
          onFocus={(event) => {
            event.target.style.borderColor = '#FF7900';
            event.target.style.boxShadow = '0 0 0 2px rgba(255,121,0,0.12)';
          }}
          onBlur={(event) => {
            event.target.style.borderColor = '#E0E0E0';
            event.target.style.boxShadow = 'none';
          }}
        />
      </div>
    </div>
  );
});

export default GraphSection;
