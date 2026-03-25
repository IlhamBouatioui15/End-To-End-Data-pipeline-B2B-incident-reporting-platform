import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(...registerables, ChartDataLabels);

const ORANGE_PALETTE = ['#FF7900', '#F16E00', '#FF9E44', '#FFCC88', '#CC5C00', '#FFB347', '#E65C00', '#FF8C33', '#993D00', '#FFDDB3'];

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

  return {
    ...graphData,
    datasets: graphData.datasets.map((dataset, index) => {
      const next = { ...dataset };

      if (chartType === 'pie') {
        if (!Array.isArray(next.backgroundColor) || next.backgroundColor.length === 0) {
          next.backgroundColor = (next.data || []).map((_, i) => ORANGE_PALETTE[i % ORANGE_PALETTE.length]);
        }
        next.borderColor = '#FFFFFF';
        next.borderWidth = 2;
        next.hoverOffset = 6;
      } else {
        if (!next.backgroundColor) next.backgroundColor = ORANGE_PALETTE[index % ORANGE_PALETTE.length];
        if (!next.borderColor) next.borderColor = ORANGE_PALETTE[index % ORANGE_PALETTE.length];
        next.borderRadius = 4;
        next.borderWidth = 0;
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
        position: 'bottom',
        labels: {
          boxWidth: 14,
          padding: 14,
          font: { size: 11, family: 'Calibri, Arial, sans-serif' },
          color: '#333333',
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
            stacked: isStacked,
            grid: { display: false },
            ticks: { font: { size: 11, family: 'Calibri, Arial, sans-serif' }, color: '#555555' },
          },
        },
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '10px',
        borderTop: '3px solid #FF7900',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ background: '#1A1A1A', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '3px', height: '18px', background: '#FF7900', borderRadius: '2px', flexShrink: 0 }} />
        <h3
          style={{
            margin: 0,
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            fontFamily: 'Calibri, Arial, sans-serif',
          }}
        >
          {title}
        </h3>
      </div>

      <div style={{ padding: '18px 18px 10px', height: isPie ? '400px' : '360px', position: 'relative' }}>
        {isPie ? (
          <Pie ref={chartRef} data={enrichedData} options={chartOptions} plugins={[WHITE_BG_PLUGIN]} />
        ) : (
          <Bar ref={chartRef} data={enrichedData} options={chartOptions} plugins={[WHITE_BG_PLUGIN]} />
        )}
      </div>

      <div style={{ padding: '10px 18px 16px', background: '#FAFAFA', borderTop: '1px solid #F0F0F0' }}>
        <label
          style={{
            display: 'block',
            fontSize: '10px',
            fontWeight: 700,
            color: '#FF7900',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
            fontFamily: 'Calibri, Arial, sans-serif',
          }}
        >
          Analyse et commentaire
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
