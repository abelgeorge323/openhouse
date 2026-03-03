/* ── State ── */
const AppState = {
  data: null,
  currentView: 'landing',
  selectedEvent: null,
  sort: { by: 'final', order: 'desc' },
  expandedRows: new Set()
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ── Init ── */
document.addEventListener('DOMContentLoaded', loadData);

async function loadData() {
  try {
    const res = await fetch('data.json');
    AppState.data = await res.json();
    $('#loadingSpinner').style.display = 'none';
    renderLanding();
  } catch (e) {
    $('#loadingSpinner').innerHTML =
      '<div style="color:#ef4444;font-size:0.9rem;">Failed to load data. Make sure data.json exists and you\'re serving via HTTP.</div>';
  }
}

/* ── Navigation ── */
function showView(viewName, eventId) {
  AppState.expandedRows.clear();

  if (viewName === 'landing') {
    AppState.currentView = 'landing';
    AppState.selectedEvent = null;
    $('#mainTitle').textContent = 'Event Overview';
    $('#mainSubtitle').textContent = 'MIT Open House 2026 – All Events';
    $('#backBtn').classList.remove('visible');
    $('#detailNav').classList.remove('visible');
    $$('.view-btn[data-view]').forEach(b => b.classList.remove('active'));
    $('[data-view="landing"]').classList.add('active');
    renderLanding();
  } else if (viewName === 'detail') {
    const evt = AppState.data.events.find(e => e.id === eventId);
    if (!evt || evt.status !== 'completed') return;
    AppState.currentView = 'detail';
    AppState.selectedEvent = evt;
    $('#mainTitle').textContent = `${evt.city} – ${evt.date} (${evt.time})`;
    $('#mainSubtitle').textContent = 'Event Detail View';
    $('#backBtn').classList.add('visible');
    $('#detailNav').classList.add('visible');
    $$('.view-btn[data-view]').forEach(b => b.classList.remove('active'));
    renderDetail(evt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (window.innerWidth < 1024) closeSidebar();
}

function scrollToSection(id) {
  const el = document.getElementById('section-' + id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (window.innerWidth < 1024) closeSidebar();
}

function toggleSidebar() {
  $('#sidebar').classList.toggle('open');
  $('#sidebarOverlay').classList.toggle('visible');
}
function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebarOverlay').classList.remove('visible');
}

/* ── Landing View ── */
function renderLanding() {
  const events = AppState.data.events;
  let html = '<div class="events-grid">';

  events.forEach(evt => {
    const isCompleted = evt.status === 'completed';
    html += `
      <div class="event-tile ${isCompleted ? 'clickable' : 'muted'}"
           ${isCompleted ? `onclick="showView('detail','${evt.id}')"` : ''}>
        <span class="event-tile-status ${evt.status}">${isCompleted ? 'Completed' : 'Upcoming'}</span>
        ${isCompleted ? '<span class="event-tile-arrow">&#8594;</span>' : ''}
        <div class="event-tile-city">${evt.city}</div>
        <div class="event-tile-date">${evt.date} &middot; ${evt.time}</div>
        ${isCompleted ? renderTileMetrics(evt.metrics) : '<div class="event-tile-pending">Data Pending</div>'}
      </div>`;
  });

  html += '</div>';
  $('#contentBody').innerHTML = html;
}

function renderTileMetrics(m) {
  return `
    <div class="event-tile-metrics">
      <div class="tile-metric"><div class="tile-metric-value">${m.attended}</div><div class="tile-metric-label">Attendees</div></div>
      <div class="tile-metric"><div class="tile-metric-value">${m.highPotential}</div><div class="tile-metric-label">Strong Candidates</div></div>
      <div class="tile-metric"><div class="tile-metric-value">${m.podReady}</div><div class="tile-metric-label">POD Ready</div></div>
      <div class="tile-metric"><div class="tile-metric-value">${m.strongRate}%</div><div class="tile-metric-label">Strong Rate</div></div>
    </div>`;
}

/* ── Detail View ── */
function renderDetail(evt) {
  const html = [
    renderExecutiveOverview(evt),
    renderDemographics(evt),
    renderCandidateTable(evt),
    renderLeaderSentiment(evt),
    renderFunnel(evt)
  ].join('');

  $('#contentBody').innerHTML = html;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => animateBars());
  });
}

/* ── Section 1: Executive Overview ── */
function renderExecutiveOverview(evt) {
  const m = evt.metrics;
  return `
    <div class="section-card" id="section-executive">
      <div class="section-title"><span class="icon">&#9670;</span> Executive Overview</div>
      <div class="metrics-grid">
        <div class="metric-card"><div class="metric-value">${m.attended}</div><div class="metric-label">Attendees</div></div>
        <div class="metric-card"><div class="metric-value">${m.resumes}</div><div class="metric-label">Resumes Submitted</div></div>
        <div class="metric-card"><div class="metric-value highlight">${m.highPotential}</div><div class="metric-label">High-Potential</div></div>
        <div class="metric-card"><div class="metric-value highlight">${m.podReady}</div><div class="metric-label">POD Ready</div></div>
        <div class="metric-card"><div class="metric-value">${m.strongRate}%</div><div class="metric-label">Strong Rate</div></div>
      </div>
      <div class="summary-box">${evt.summary}</div>
    </div>`;
}

/* ── Section 2: Demographics ── */
function renderDemographics(evt) {
  const d = evt.demographics;
  const donutColors = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'];

  let donutSegments = '';
  const circumference = 2 * Math.PI * 54;
  let offset = 0;
  d.education.forEach((seg, i) => {
    const len = (seg.value / 100) * circumference;
    donutSegments += `<circle cx="70" cy="70" r="54" fill="none" stroke="${donutColors[i]}"
      stroke-width="22" stroke-dasharray="${len} ${circumference - len}"
      stroke-dashoffset="${-offset}" />`;
    offset += len;
  });

  const legendHtml = d.education.map((seg, i) =>
    `<div class="legend-item"><div class="legend-dot" style="background:${donutColors[i]}"></div>${seg.label} – ${seg.value}%</div>`
  ).join('');

  const expBars = d.experience.map(seg =>
    `<div class="bar-row">
      <div class="bar-label">${seg.label}</div>
      <div class="bar-track"><div class="bar-fill" data-width="${seg.value}"></div></div>
      <div class="bar-value">${seg.value}%</div>
    </div>`
  ).join('');

  return `
    <div class="section-card" id="section-demographics">
      <div class="section-title"><span class="icon">&#9673;</span> Demographics</div>
      <div class="demo-grid three-col">
        <div>
          <div class="demo-block-title">Education Breakdown</div>
          <div class="donut-container">
            <svg class="donut-svg" viewBox="0 0 140 140">${donutSegments}</svg>
            <div class="donut-legend">${legendHtml}</div>
          </div>
        </div>
        <div>
          <div class="demo-block-title">Experience Level</div>
          <div class="bar-chart">${expBars}</div>
        </div>
        <div>
          <div class="demo-block-title">Relocation Willingness</div>
          <div class="relocation-bar-container">
            <div class="relocation-bar">
              <div class="open" data-width="${d.relocation.open}" style="width:0%"></div>
              <div class="local"></div>
            </div>
            <div class="relocation-labels">
              <span>${d.relocation.open}% Open to Relocate</span>
              <span>${d.relocation.localOnly}% Local Only</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Section 3: Candidate Evaluation ── */
function renderCandidateTable(evt) {
  const sorted = getSortedCandidates(evt.candidates);
  const sortIcon = (col) => {
    const active = AppState.sort.by === col;
    const arrow = active ? (AppState.sort.order === 'asc' ? '&#9650;' : '&#9660;') : '&#8693;';
    return `<span class="sort-icon">${arrow}</span>`;
  };
  const thClass = (col) => AppState.sort.by === col ? 'sorted' : '';

  let rows = '';
  sorted.forEach(c => {
    const statusClass = c.status === 'POD' ? 'pod' : c.status === 'Interview' ? 'interview' : 'hold';
    const expanded = AppState.expandedRows.has(c.name);
    rows += `
      <tr class="${expanded ? 'expanded' : ''}" onclick="toggleCandidate('${c.name}')">
        <td class="candidate-name">${c.name}</td>
        <td class="score-cell">${c.resume.toFixed(1)}</td>
        <td class="score-cell">${c.fit.toFixed(1)}</td>
        <td class="score-cell">${c.leaderFlags}</td>
        <td class="score-cell">${c.final.toFixed(1)}</td>
        <td><span class="status-badge ${statusClass}">${c.status === 'Interview' ? 'Interview Consider' : c.status}</span></td>
      </tr>`;

    rows += `
      <tr class="candidate-detail ${expanded ? 'visible' : ''}" id="detail-${c.name.replace(/\s/g, '-')}">
        <td colspan="6">
          <div style="padding:20px 16px 20px 32px;">
            <div class="detail-grid">
              <div><div class="detail-item-label">Education</div><div class="detail-item-value">${c.detail.education}</div></div>
              <div><div class="detail-item-label">Ops Exposure</div><div class="detail-item-value">${c.detail.opsExposure}</div></div>
              <div><div class="detail-item-label">Leadership Depth</div><div class="detail-item-value">${c.detail.leadershipDepth}</div></div>
              <div><div class="detail-item-label">Relocation</div><div class="detail-item-value">${c.detail.relocation}</div></div>
              <div><div class="detail-item-label">Leader Notes</div><div class="detail-item-value">${c.detail.leaderNotes}</div></div>
              <div><div class="detail-item-label">Resume Summary</div><div class="detail-item-value">${c.detail.resumeSummary}</div></div>
            </div>
          </div>
        </td>
      </tr>`;
  });

  return `
    <div class="section-card" id="section-candidates">
      <div class="section-title"><span class="icon">&#9733;</span> Candidate Evaluation</div>
      <div class="table-wrapper">
        <table class="candidate-table">
          <thead>
            <tr>
              <th onclick="sortCandidates('name')" class="${thClass('name')}">Name ${sortIcon('name')}</th>
              <th onclick="sortCandidates('resume')" class="${thClass('resume')}">Resume ${sortIcon('resume')}</th>
              <th onclick="sortCandidates('fit')" class="${thClass('fit')}">Fit ${sortIcon('fit')}</th>
              <th onclick="sortCandidates('leaderFlags')" class="${thClass('leaderFlags')}">Leader Flags ${sortIcon('leaderFlags')}</th>
              <th onclick="sortCandidates('final')" class="${thClass('final')}">Final ${sortIcon('final')}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function getSortedCandidates(candidates) {
  const { by, order } = AppState.sort;
  return [...candidates].sort((a, b) => {
    let va = a[by], vb = b[by];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return order === 'asc' ? -1 : 1;
    if (va > vb) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

function sortCandidates(col) {
  if (AppState.sort.by === col) {
    AppState.sort.order = AppState.sort.order === 'asc' ? 'desc' : 'asc';
  } else {
    AppState.sort.by = col;
    AppState.sort.order = col === 'name' ? 'asc' : 'desc';
  }
  if (AppState.selectedEvent) {
    const section = document.getElementById('section-candidates');
    const parent = section.parentNode;
    const temp = document.createElement('div');
    temp.innerHTML = renderCandidateTable(AppState.selectedEvent);
    parent.replaceChild(temp.firstElementChild, section);
  }
}

function toggleCandidate(name) {
  if (AppState.expandedRows.has(name)) {
    AppState.expandedRows.delete(name);
  } else {
    AppState.expandedRows.add(name);
  }
  const id = 'detail-' + name.replace(/\s/g, '-');
  const detailRow = document.getElementById(id);
  if (detailRow) {
    detailRow.classList.toggle('visible');
    detailRow.previousElementSibling.classList.toggle('expanded');
  }
}

/* ── Section 4: Leader Sentiment ── */
function renderLeaderSentiment(evt) {
  const s = evt.leaderSentiment;
  const total = s.breakdown.yes + s.breakdown.maybe + s.breakdown.no;
  const yPct = ((s.breakdown.yes / total) * 100).toFixed(0);
  const mPct = ((s.breakdown.maybe / total) * 100).toFixed(0);
  const nPct = (100 - yPct - mPct);

  const endorsed = s.topEndorsed.map(e =>
    `<div class="endorsed-item">
      <span class="endorsed-name">${e.name}</span>
      <span class="endorsed-count">${e.endorsements} endorsements</span>
    </div>`
  ).join('');

  return `
    <div class="section-card" id="section-sentiment">
      <div class="section-title"><span class="icon">&#9829;</span> Leader Sentiment</div>
      <div class="sentiment-metrics">
        <div class="metric-card"><div class="metric-value">${s.submissions}</div><div class="metric-label">Leader Submissions</div></div>
        <div class="metric-card"><div class="metric-value highlight">${s.recommendedForInterview}</div><div class="metric-label">Recommended for Interview</div></div>
        <div class="metric-card"><div class="metric-value">${s.avgRecommendationScore}</div><div class="metric-label">Avg Rec. Score</div></div>
      </div>
      <div class="demo-block-title">Recommendation Breakdown</div>
      <div class="breakdown-bar">
        <div class="seg-yes" data-width="${yPct}" style="width:0%"></div>
        <div class="seg-maybe" data-width="${mPct}" style="width:0%"></div>
        <div class="seg-no" data-width="${nPct}" style="width:0%"></div>
      </div>
      <div class="breakdown-legend">
        <div class="breakdown-legend-item"><div class="breakdown-legend-dot" style="background:var(--success)"></div>Yes – ${s.breakdown.yes}</div>
        <div class="breakdown-legend-item"><div class="breakdown-legend-dot" style="background:var(--warning)"></div>Maybe – ${s.breakdown.maybe}</div>
        <div class="breakdown-legend-item"><div class="breakdown-legend-dot" style="background:#ef4444"></div>No – ${s.breakdown.no}</div>
      </div>
      <div class="demo-block-title">Top Endorsed Candidates</div>
      <div class="endorsed-list">${endorsed}</div>
    </div>`;
}

/* ── Section 5: Event Funnel & Health ── */
function renderFunnel(evt) {
  const f = evt.funnel;
  const c = evt.conversionRates;
  const maxVal = f.rsvp;

  const steps = [
    { label: 'RSVP', value: f.rsvp, color: '#1e3a5f' },
    { label: 'Attended', value: f.attended, color: '#1e40af' },
    { label: 'Resumes', value: f.resumes, color: '#2563eb' },
    { label: 'High-Potential', value: f.highPotential, color: '#3b82f6' },
    { label: 'POD Ready', value: f.pod, color: '#60a5fa' }
  ];

  let funnelHtml = '';
  steps.forEach((step, i) => {
    const widthPct = Math.max(((step.value / maxVal) * 100), 18);
    funnelHtml += `<div class="funnel-step" style="width:${widthPct}%;background:${step.color};">
      <span class="funnel-count">${step.value}</span>
      <span class="funnel-label">${step.label}</span>
    </div>`;
    if (i < steps.length - 1) {
      funnelHtml += '<div class="funnel-arrow">&#9660;</div>';
    }
  });

  return `
    <div class="section-card" id="section-funnel">
      <div class="section-title"><span class="icon">&#9660;</span> Event Funnel & Health</div>
      <div class="funnel-visual">${funnelHtml}</div>
      <div class="conversion-grid">
        <div class="conversion-card"><div class="conversion-value">${c.rsvpToAttendance}%</div><div class="conversion-label">RSVP &rarr; Attendance</div></div>
        <div class="conversion-card"><div class="conversion-value">${c.attendanceToHighPotential}%</div><div class="conversion-label">Attendance &rarr; High-Potential</div></div>
        <div class="conversion-card"><div class="conversion-value">${c.highPotentialToPod}%</div><div class="conversion-label">High-Potential &rarr; POD</div></div>
      </div>
      <div class="summary-box">${evt.healthSummary}</div>
    </div>`;
}

/* ── Animate bars on render ── */
function animateBars() {
  $$('.bar-fill[data-width]').forEach(el => {
    el.style.width = el.dataset.width + '%';
  });
  $$('.relocation-bar .open[data-width]').forEach(el => {
    el.style.width = el.dataset.width + '%';
  });
  $$('.breakdown-bar [data-width]').forEach(el => {
    el.style.width = el.dataset.width + '%';
  });
}
