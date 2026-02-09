async function fetchJSON(path) { const res = await fetch(path); return res.json(); }

let valuationChart, metricsChart;

function ensureCharts() {
  const vCtx = document.getElementById('valuationChart').getContext('2d');
  const mCtx = document.getElementById('metricsChart').getContext('2d');
  if (!valuationChart) {
    valuationChart = new Chart(vCtx, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
  if (!metricsChart) {
    metricsChart = new Chart(mCtx, {
      type: 'bar',
      data: { labels: ['Total Return', 'Annualized Return', 'Cap Rate', 'Occupancy'], datasets: [] },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { position: 'bottom' } } }
    });
  }
}

function renderMetricsUI(metrics) {
  const container = document.getElementById('metrics');
  container.innerHTML = '';
  metrics.forEach(m => {
    const el = document.createElement('div');
    el.className = 'metric';
    el.innerHTML = `
      <div class="metric-label">Portfolio ${m.portfolioId}</div>
      <div class="metric-value">$${m.totalValue.toLocaleString()}</div>
      <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
        <div style="margin: 4px 0;"><strong>Return:</strong> ${m.totalReturn}%</div>
        <div style="margin: 4px 0;"><strong>Ann. Return:</strong> ${m.annualizedReturn}%</div>
        <div style="margin: 4px 0;"><strong>Cap Rate:</strong> ${m.capRate}%</div>
        <div style="margin: 4px 0;"><strong>Occupancy:</strong> ${m.occupancy}%</div>
      </div>
    `;
    container.appendChild(el);
  });
}

async function compare(p1, p2) {
  ensureCharts();
  const [hist1, hist2, metrics] = await Promise.all([
    fetchJSON(`/api/portfolios/${p1}/history`),
    fetchJSON(`/api/portfolios/${p2}/history`),
    fetchJSON(`/api/metrics/comparison?ids=${p1},${p2}`)
  ]);

  const labels = hist1.map(h => h.date);
  valuationChart.data.labels = labels;
  valuationChart.data.datasets = [
    { label: `Portfolio ${p1}`, data: hist1.map(h => h.value), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, tension: 0.4 },
    { label: `Portfolio ${p2}`, data: hist2.map(h => h.value), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, tension: 0.4 }
  ];
  valuationChart.update();

  renderMetricsUI(metrics);

  // prepare metrics for bar chart
  const metricLabels = ['totalReturn', 'annualizedReturn', 'capRate', 'occupancy'];
  metricsChart.data.datasets = metrics.map((m, i) => ({ label: `Portfolio ${m.portfolioId}`, data: metricLabels.map(k => m[k]), backgroundColor: i === 0 ? '#3b82f6' : '#10b981' }));
  metricsChart.update();
}

async function init() {
  const portfolios = await fetchJSON('/api/portfolios');
  const p1 = document.getElementById('p1');
  const p2 = document.getElementById('p2');
  portfolios.forEach(p => {
    const o1 = document.createElement('option'); o1.value = p.id; o1.text = `${p.name} (#${p.id})`; p1.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = p.id; o2.text = `${p.name} (#${p.id})`; p2.appendChild(o2);
  });
  p1.value = portfolios[0]?.id || '';
  p2.value = portfolios[1]?.id || portfolios[0]?.id || '';
  ensureCharts();
  document.getElementById('compare').addEventListener('click', () => compare(p1.value, p2.value));
  // initial compare
  if (p1.value && p2.value) compare(p1.value, p2.value);
}

init();
