/* ── State ── */
const AppState = {
  data: null,
  currentView: 'landing',
  selectedEvent: null,
  sort: { by: 'rank', order: 'asc' },
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
    const canViewDetail = evt && (evt.status === 'completed' || evt.status === 'rsvp_only' || evt.status === 'in_progress');
    if (!canViewDetail) return;
    AppState.currentView = 'detail';
    AppState.selectedEvent = evt;
    const cityLabel = evt.location ? `${evt.city}, ${evt.location}` : evt.city;
    $('#mainTitle').textContent = `${cityLabel} – ${evt.date} (${evt.time})`;
    const subtitles = { rsvp_only: 'RSVP data only – more data pending', in_progress: 'Event data in progress – evaluations pending' };
    $('#mainSubtitle').textContent = subtitles[evt.status] || 'Event Detail View';
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
    const isRsvpOnly = evt.status === 'rsvp_only';
    const isInProgress = evt.status === 'in_progress';
    const isClickable = isCompleted || isRsvpOnly || isInProgress;
    const statusLabels = { completed: 'Completed', rsvp_only: 'RSVP Only', in_progress: 'In Progress', upcoming: 'Upcoming' };
    const statusLabel = statusLabels[evt.status] || 'Upcoming';
    const tileContent = isClickable
      ? renderTileMetrics(evt.metrics || { rsvp: 0, attended: 0, highPotential: 0, podReady: 0, strongRate: 0 }, evt)
      : '<div class="event-tile-pending">Data Pending</div>';
    html += `
      <div class="event-tile ${isClickable ? 'clickable' : 'muted'} ${isRsvpOnly ? 'rsvp-only' : ''}"
           ${isClickable ? `onclick="showView('detail','${evt.id}')"` : ''}>
        <span class="event-tile-status ${evt.status}">${statusLabel}</span>
        ${isClickable ? '<span class="event-tile-arrow">&#8594;</span>' : ''}
        <div class="event-tile-city">${evt.city}${evt.location ? ', ' + evt.location : ''}</div>
        <div class="event-tile-date">${evt.date} &middot; ${evt.time}</div>
        ${tileContent}
      </div>`;
  });

  html += '</div>';
  $('#contentBody').innerHTML = html;
}

function renderTileMetrics(m, evt) {
  const showRsvpFirst = evt && evt.status === 'rsvp_only';
  const firstLabel = showRsvpFirst ? 'RSVP' : 'Attendees';
  const firstValue = showRsvpFirst ? (m.rsvp || 0) : (m.attended || 0);
  return `
    <div class="event-tile-metrics">
      <div class="tile-metric"><div class="tile-metric-value">${firstValue}</div><div class="tile-metric-label">${firstLabel}</div></div>
      <div class="tile-metric"><div class="tile-metric-value">${m.highPotential || 0}</div><div class="tile-metric-label">Strong Candidates</div></div>
      <div class="tile-metric"><div class="tile-metric-value">${m.podReady || 0}</div><div class="tile-metric-label">POD Ready</div></div>
      <div class="tile-metric"><div class="tile-metric-value">${m.strongRate || 0}%</div><div class="tile-metric-label">Strong Rate</div></div>
    </div>`;
}

/* ── Detail View ── */
function renderDetail(evt) {
  const html = [
    renderExecutiveOverview(evt),
    renderDemographics(evt),
    renderCandidateTable(evt),
    renderLeaderSentiment(evt),
    renderEventFeedback(evt),
    renderFunnel(evt)
  ].join('');

  $('#contentBody').innerHTML = html;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => animateBars());
  });
}

/* ── Section 1: Executive Overview ── */
function renderExecutiveOverview(evt) {
  const m = evt.metrics || {};
  const isRsvpOnly = evt.status === 'rsvp_only';
  const hasScores = (m.highPotential ?? 0) > 0 || (m.podReady ?? 0) > 0;
  let cards;
  if (isRsvpOnly) {
    cards = `<div class="metric-card"><div class="metric-value">${m.rsvp ?? 0}</div><div class="metric-label">RSVP</div></div>
        <div class="metric-card"><div class="metric-value">${m.attended ?? 0}</div><div class="metric-label">Attended</div></div>
        <div class="metric-card"><div class="metric-value">${m.resumes ?? 0}</div><div class="metric-label">Resumes</div></div>
        <div class="metric-card"><div class="metric-value highlight">${m.highPotential ?? 0}</div><div class="metric-label">High-Potential</div></div>
        <div class="metric-card"><div class="metric-value">${m.strongRate ?? 0}%</div><div class="metric-label">Strong Rate</div></div>`;
  } else {
    cards = `<div class="metric-card"><div class="metric-value">${m.attended ?? '—'}</div><div class="metric-label">Attendees</div></div>
        <div class="metric-card"><div class="metric-value">${m.resumes ?? '—'}</div><div class="metric-label">Resumes Scored</div></div>
        <div class="metric-card"><div class="metric-value highlight">${m.highPotential ?? '—'}</div><div class="metric-label">High-Potential</div></div>
        <div class="metric-card"><div class="metric-value highlight">${m.podReady ?? '—'}</div><div class="metric-label">POD Ready</div></div>
        <div class="metric-card"><div class="metric-value">${m.strongRate != null ? m.strongRate + '%' : '—'}</div><div class="metric-label">Strong Rate</div></div>`;
  }
  return `
    <div class="section-card" id="section-executive">
      <div class="section-title"><span class="icon">&#9670;</span> Executive Overview</div>
      <div class="metrics-grid">${cards}</div>
      <div class="summary-box">${evt.summary || 'No summary yet.'}</div>
    </div>`;
}

/* ── Section 2: Demographics ── */
function renderDemographics(evt) {
  const d = evt.demographics;
  if (!d || !d.education || !d.experience || !d.relocation) {
    return `
    <div class="section-card" id="section-demographics">
      <div class="section-title"><span class="icon">&#9673;</span> Demographics</div>
      <div class="empty-state">Demographics data pending. Will appear after event attendance and surveys are collected.</div>
    </div>`;
  }
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
    `<div class="legend-item"><div class="legend-dot" style="background:${donutColors[i]}"></div>${seg.label} – ${seg.value}%${seg.count != null ? ` <span class="legend-count">(${seg.count})</span>` : ''}</div>`
  ).join('');

  const expBarColors = ['#0ea5e9', '#6366f1', '#1e40af'];
  const expBars = d.experience.map((seg, i) =>
    `<div class="bar-row">
      <div class="bar-label">${seg.label}</div>
      <div class="bar-track"><div class="bar-fill" data-width="${seg.value}" style="background:${expBarColors[i % expBarColors.length]}"></div></div>
      <div class="bar-value">${seg.value}%${seg.count != null ? ` <span class="bar-count">${seg.count}</span>` : ''}</div>
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
              <span>${d.relocation.open}% Open to Relocate${d.relocation.openCount != null ? ` (${d.relocation.openCount})` : ''}</span>
              <span>${d.relocation.localOnly}% Local Only${d.relocation.localCount != null ? ` (${d.relocation.localCount})` : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Section 3: Candidate Evaluation ── */
function renderCandidateTable(evt) {
  const hasAlgoData = evt.candidates.some(c => c.resumeDimensions);
  if (hasAlgoData) return renderCandidateCards(evt);
  return renderCandidateLegacyTable(evt);
}

function renderCandidateLegacyTable(evt) {
  if (AppState.sort.by === 'rank') { AppState.sort.by = 'final'; AppState.sort.order = 'desc'; }
  const sorted = getSortedCandidates(evt.candidates);
  const sortIcon = (col) => {
    const active = AppState.sort.by === col;
    const arrow = active ? (AppState.sort.order === 'asc' ? '&#9650;' : '&#9660;') : '&#8693;';
    return `<span class="sort-icon">${arrow}</span>`;
  };
  const thClass = (col) => AppState.sort.by === col ? 'sorted' : '';
  let rows = '';
  sorted.forEach(c => {
    const statusMap = { POD: 'pod', Interview: 'interview', Hold: 'hold', Pending: 'pending' };
    const statusClass = statusMap[c.status] || 'hold';
    const statusText = c.status === 'Interview' ? 'Interview Consider' : c.status;
    const expanded = AppState.expandedRows.has(c.name);
    const fmtScore = (v) => v != null && v > 0 ? v.toFixed(1) : '—';
    rows += `
      <tr class="${expanded ? 'expanded' : ''}" onclick="toggleCandidate('${c.name.replace(/'/g, "\\'")}')">
        <td class="candidate-name">${c.name}</td>
        <td class="score-cell">${fmtScore(c.resume)}</td>
        <td class="score-cell">${fmtScore(c.fit)}</td>
        <td class="score-cell">${c.leaderFlags ?? '—'}</td>
        <td class="score-cell">${fmtScore(c.final)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      </tr>`;
    if (c.detail) {
      rows += `
        <tr class="candidate-detail ${expanded ? 'visible' : ''}" id="detail-${c.name.replace(/\s/g, '-')}">
          <td colspan="6">
            <div style="padding:20px 16px 20px 32px;">
              <div class="detail-grid">
                <div><div class="detail-item-label">Education</div><div class="detail-item-value">${c.detail.education || '—'}</div></div>
                <div><div class="detail-item-label">Ops Exposure</div><div class="detail-item-value">${c.detail.opsExposure || '—'}</div></div>
                <div><div class="detail-item-label">Leadership Depth</div><div class="detail-item-value">${c.detail.leadershipDepth || '—'}</div></div>
                <div><div class="detail-item-label">Relocation</div><div class="detail-item-value">${c.detail.relocation || '—'}</div></div>
                <div><div class="detail-item-label">Leader Notes</div><div class="detail-item-value">${c.detail.leaderNotes || '—'}</div></div>
                <div><div class="detail-item-label">Resume Summary</div><div class="detail-item-value">${c.detail.resumeSummary || '—'}</div></div>
              </div>
            </div>
          </td>
        </tr>`;
    }
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

/* ── New Card-based Candidate Ranking ── */
function renderOneCard(c, fmtScore, roleLabels, fitSourceLabels, statusMap) {
  if (c.final === 0 && c.resume === 0) return '';
  const expanded = AppState.expandedRows.has(c.name);
  const statusClass = statusMap[c.status] || 'hold';
  const statusText = c.status === 'Interview' ? 'Interview Consider' : c.status;
  const rankClass = c.rank <= 3 ? `rank-${c.rank}` : (c.rank === 0 ? 'rank-0' : '');
  let badges = '';
  if (c.mitBadge === 'TRUE MIT') badges += `<span class="mit-badge true-mit">True MIT</span>`;
  else if (c.mitBadge === 'SENIOR MIT') badges += `<span class="mit-badge senior-mit">Senior MIT</span>`;
  if (c.role && roleLabels[c.role]) badges += `<span class="role-tag">${roleLabels[c.role]}</span>`;
  if (c.mismatchFlag === 'MAJOR_MISMATCH') badges += `<span class="mismatch-dot major" title="Major mismatch"></span>`;
  else if (c.mismatchFlag === 'MODERATE_MISMATCH') badges += `<span class="mismatch-dot moderate" title="Moderate mismatch"></span>`;
  const fitLabel = c.fit > 0 ? `<span class="label">Fit</span> <span class="val">${fmtScore(c.fit)}</span> <span class="fit-source">(${fitSourceLabels[c.fitSource] || ''})</span>` : `<span class="label">Fit</span> <span class="val">—</span>`;
  const relocWarn = (c.relocPenalty > 0 || c.relocPenalty < 0) ? `<span class="reloc-warn">&#9888; Reloc</span>` : '';
  const flagsStr = c.leaderFlags > 0 ? `<span class="label">Flags</span> <span class="val">${c.leaderFlags}</span>` : '';
  return `
      <div class="candidate-card ${expanded ? 'expanded' : ''}" onclick="toggleCandidate('${c.name.replace(/'/g, "\\'")}')">
        <div class="card-summary">
          <div class="rank-badge ${rankClass}">${c.rank || '—'}</div>
          <div class="card-main">
            <div class="card-top-row">
              <span class="card-name">${c.name}</span>
              ${badges}
            </div>
            <div class="card-meta-row">
              <span><span class="label">Resume</span> <span class="val">${fmtScore(c.resume)}</span></span>
              <span>${fitLabel}</span>
              ${flagsStr ? `<span>${flagsStr}</span>` : ''}
              ${relocWarn ? `<span>${relocWarn}</span>` : ''}
            </div>
          </div>
          <div class="card-score">
            <div class="card-score-val">${fmtScore(c.final)}</div>
            <div class="card-score-label">Final</div>
          </div>
          <div class="card-status">
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
        </div>
        ${renderCardExpandPanel(c)}
      </div>`;
}

function renderCandidateCards(evt) {
  const sorted = getSortedCandidates(evt.candidates);
  const activeSortBtn = (col) => AppState.sort.by === col ? 'active' : '';
  const fmtScore = (v) => (v != null && v > 0) ? v.toFixed(1) : '—';
  const roleLabels = { 'MIT': 'MIT', 'ops manager': 'Ops Manager', 'site manager': 'Site Manager', 'ops_manager': 'Ops Manager', 'site_manager': 'Site Manager' };
  const fitSourceLabels = { 'leader+team': 'leader + team', 'team_only': 'team only', 'trait_estimate': 'resume only', 'none': '' };
  const statusMap = { POD: 'pod', Interview: 'interview', Hold: 'hold', Pending: 'pending' };

  const hasTrack = evt.candidates.some(c => c.track === 'MIT' || c.track === 'EXPERIENCED');
  let cardsHtml = '';

  if (hasTrack) {
    const mitList = sorted.filter(c => c.track === 'MIT');
    const expList = sorted.filter(c => c.track === 'EXPERIENCED');
    const otherList = sorted.filter(c => c.track !== 'MIT' && c.track !== 'EXPERIENCED');
    if (mitList.length) {
      cardsHtml += `<div class="track-section">
        <div class="track-section-title">MIT Track <span class="track-subtitle">(trainee-eligible)</span></div>
        <div class="candidate-cards">${mitList.map(c => renderOneCard(c, fmtScore, roleLabels, fitSourceLabels, statusMap)).join('')}</div>
      </div>`;
    }
    if (expList.length) {
      cardsHtml += `<div class="track-section">
        <div class="track-section-title">Experienced Track <span class="track-subtitle">(Ops / Site Manager)</span></div>
        <div class="candidate-cards">${expList.map(c => renderOneCard(c, fmtScore, roleLabels, fitSourceLabels, statusMap)).join('')}</div>
      </div>`;
    }
    if (otherList.length) {
      cardsHtml += `<div class="track-section">
        <div class="candidate-cards">${otherList.map(c => renderOneCard(c, fmtScore, roleLabels, fitSourceLabels, statusMap)).join('')}</div>
      </div>`;
    }
  } else {
    cardsHtml = `<div class="candidate-cards">${sorted.map(c => renderOneCard(c, fmtScore, roleLabels, fitSourceLabels, statusMap)).join('')}</div>`;
  }

  return `
    <div class="section-card" id="section-candidates">
      <div class="section-title"><span class="icon">&#9733;</span> Candidate Evaluation</div>
      <div class="card-sort-bar">
        <span>Sort by:</span>
        <button class="card-sort-btn ${activeSortBtn('rank')}" onclick="event.stopPropagation(); sortCandidates('rank')">Rank</button>
        <button class="card-sort-btn ${activeSortBtn('resume')}" onclick="event.stopPropagation(); sortCandidates('resume')">Resume</button>
        <button class="card-sort-btn ${activeSortBtn('fit')}" onclick="event.stopPropagation(); sortCandidates('fit')">Fit</button>
        <button class="card-sort-btn ${activeSortBtn('final')}" onclick="event.stopPropagation(); sortCandidates('final')">Final</button>
        <button class="card-sort-btn ${activeSortBtn('name')}" onclick="event.stopPropagation(); sortCandidates('name')">Name</button>
      </div>
      ${cardsHtml}
    </div>`;
}

function renderCardExpandPanel(c) {
  const dimLabels = {
    leadership: 'Leadership', initiative: 'Initiative', reliability: 'Reliability',
    communication: 'Communication', problemSolving: 'Problem-Solving',
    operations: 'Operations', customerService: 'Customer Svc', education: 'Education'
  };
  const sentLabels = {
    leaderConviction: 'Leader Conviction', impressionStrength: 'Impression',
    effortInitiative: 'Effort / Initiative', roleAlignment: 'Role Alignment',
    concernSeverity: 'Concern Severity'
  };
  const barColor = (v) => v >= 7 ? 'high' : (v >= 4 ? 'mid' : 'low');

  let resumeCol = '';
  if (c.resumeDimensions) {
    let bars = '';
    for (const [key, label] of Object.entries(dimLabels)) {
      const v = c.resumeDimensions[key] ?? 0;
      const pct = (v / 10) * 100;
      bars += `<div class="dim-bar-row">
        <div class="dim-bar-label">${label}</div>
        <div class="dim-bar-track"><div class="dim-bar-fill ${barColor(v)}" data-width="${pct}" style="width:0%"></div></div>
        <div class="dim-bar-score">${v.toFixed(1)}</div>
      </div>`;
    }
    let strengthPills = (c.resumeStrengths || []).map(s => `<span class="strength-pill">${s}</span>`).join('');
    let gapPills = (c.resumeGaps || []).map(g => `<span class="gap-pill">${g}</span>`).join('');

    resumeCol = `
      <div>
        <div class="expand-col-title">Resume Breakdown</div>
        ${bars}
        ${strengthPills || gapPills ? `<div class="pill-row">${strengthPills}${gapPills}</div>` : ''}
        ${c.careerStage ? `<div class="benchmark-line"><strong>Career Stage:</strong> ${c.careerStage}</div>` : ''}
        ${c.benchmarkMatch ? `<div class="benchmark-line">Most similar to: ${c.benchmarkMatch}</div>` : ''}
      </div>`;
  }

  let sentCol = '';
  if (c.sentimentDimensions) {
    let bars = '';
    for (const [key, label] of Object.entries(sentLabels)) {
      const v = c.sentimentDimensions[key] ?? 0;
      const pct = (v / 10) * 100;
      const color = key === 'concernSeverity' ? (v >= 7 ? 'high' : (v >= 4 ? 'mid' : 'low')) : barColor(v);
      bars += `<div class="dim-bar-row">
        <div class="dim-bar-label">${label}</div>
        <div class="dim-bar-track"><div class="dim-bar-fill ${color}" data-width="${pct}" style="width:0%"></div></div>
        <div class="dim-bar-score">${v.toFixed(1)}</div>
      </div>`;
    }
    sentCol = `
      <div>
        <div class="expand-col-title">Fit / Sentiment</div>
        ${bars}
        ${c.fitSource ? `<div class="benchmark-line"><strong>Source:</strong> ${c.fitSource === 'leader+team' ? 'Leader review + team notes' : c.fitSource === 'team_only' ? 'Team notes only' : c.fitSource}</div>` : ''}
        ${c.mismatchFlag === 'MAJOR_MISMATCH' ? `<div class="mismatch-callout major">${(c.mismatchDetails || []).join(' ')}</div>` : ''}
        ${c.mismatchFlag === 'MODERATE_MISMATCH' ? `<div class="mismatch-callout">${(c.mismatchDetails || []).join(' ')}</div>` : ''}
        ${c.detail && c.detail.leaderNotes ? `<div class="leader-notes-block">${c.detail.leaderNotes}</div>` : ''}
      </div>`;
  } else if (!c.sentimentDimensions && (c.mismatchFlag === 'NO_SENTIMENT' || c.fitSource === 'trait_estimate')) {
    sentCol = `
      <div>
        <div class="expand-col-title">Fit / Sentiment</div>
        <div class="no-sentiment-box">&#128337; Awaiting leader check-in<br><small>Resume scored — no leader feedback collected yet</small></div>
        ${c.detail && c.detail.leaderNotes ? `<div class="leader-notes-block" style="margin-top:12px;">${c.detail.leaderNotes}</div>` : ''}
      </div>`;
  }

  const edu = c.detail && c.detail.education ? c.detail.education : '';
  const reloc = c.detail && c.detail.relocation ? c.detail.relocation : '';
  const loc = c.location || '';

  return `
    <div class="card-expand-panel" onclick="event.stopPropagation()">
      <div class="expand-two-col">${resumeCol}${sentCol}</div>
      <div class="expand-bottom-row">
        ${edu ? `<div><span class="label">Education: </span>${edu}</div>` : ''}
        ${reloc ? `<div><span class="label">Relocation: </span>${reloc}</div>` : ''}
        ${loc ? `<div><span class="label">Location: </span>${loc}</div>` : ''}
      </div>
    </div>`;
}

function getSortedCandidates(candidates) {
  const { by, order } = AppState.sort;
  return [...candidates].sort((a, b) => {
    let va = a[by], vb = b[by];
    if (va == null) va = typeof vb === 'string' ? '' : 0;
    if (vb == null) vb = typeof va === 'string' ? '' : 0;
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
    requestAnimationFrame(() => animateBars());
  }
}

function toggleCandidate(name) {
  if (AppState.expandedRows.has(name)) {
    AppState.expandedRows.delete(name);
  } else {
    AppState.expandedRows.add(name);
  }
  const cards = document.querySelectorAll('.candidate-card');
  cards.forEach(card => {
    const nameEl = card.querySelector('.card-name');
    if (nameEl && nameEl.textContent === name) {
      card.classList.toggle('expanded');
      requestAnimationFrame(() => {
        card.querySelectorAll('.dim-bar-fill[data-width]').forEach(bar => {
          bar.style.width = bar.getAttribute('data-width') + '%';
        });
      });
      return;
    }
  });
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
  if (!s || !s.breakdown) {
    return `
    <div class="section-card" id="section-sentiment">
      <div class="section-title"><span class="icon">&#9829;</span> Leader Sentiment</div>
      <div class="empty-state">Leader check-ins pending. Data will appear as evaluations are submitted.</div>
    </div>`;
  }
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

/* ── Section 5: Event Feedback ── */
function renderEventFeedback(evt) {
  const fb = evt.eventFeedback;
  if (!fb) {
    return `
    <div class="section-card" id="section-feedback">
      <div class="section-title"><span class="icon">&#9733;</span> Event Feedback</div>
      <div class="empty-state">No event feedback collected yet.</div>
    </div>`;
  }

  const responseRate = fb.attendeeCount > 0 ? Math.round((fb.totalResponses / fb.attendeeCount) * 100) : 0;
  const pctVeryInterested = Math.round((fb.interestLevel.veryInterested / fb.totalResponses) * 100);
  const pctHelpful = Math.round((fb.helpedUnderstand.yes / fb.totalResponses) * 100);

  const roleItems = fb.rolesOfInterest.map(r => {
    const pct = Math.round((r.count / fb.totalResponses) * 100);
    return `<div class="feedback-stat-item">
      <span class="feedback-stat-item-label">${r.label}</span>
      <div class="feedback-stat-item-right">
        <span class="feedback-stat-item-pct">${pct}%</span>
        <span class="feedback-stat-item-count">${r.count}</span>
      </div>
    </div>`;
  }).join('');

  const stageItems = fb.careerStage.map(s => {
    const pct = Math.round((s.count / fb.totalResponses) * 100);
    return `<div class="feedback-stat-item">
      <span class="feedback-stat-item-label">${s.label}</span>
      <div class="feedback-stat-item-right">
        <span class="feedback-stat-item-pct">${pct}%</span>
        <span class="feedback-stat-item-count">${s.count}</span>
      </div>
    </div>`;
  }).join('');

  const improvementTags = fb.improvements.map(imp => {
    const isPositive = imp.label.toLowerCase().includes('great');
    return `<span class="improvement-tag ${isPositive ? 'positive' : ''}">
      ${imp.label}<span class="tag-count">${imp.count}</span>
    </span>`;
  }).join('');

  const quotes = (fb.highlights || []).map(q =>
    `<div class="quote-card">"${q}"</div>`
  ).join('');

  return `
    <div class="section-card" id="section-feedback">
      <div class="section-title"><span class="icon">&#9733;</span> Event Feedback</div>

      <div class="feedback-headline">
        <div class="feedback-headline-card">
          <div class="feedback-headline-value perfect">${fb.avgRating.toFixed(1)}/${fb.maxRating}</div>
          <div class="feedback-headline-label">Avg Rating</div>
        </div>
        <div class="feedback-headline-card">
          <div class="feedback-headline-value strong">${pctHelpful}%</div>
          <div class="feedback-headline-label">Found Event Helpful</div>
        </div>
        <div class="feedback-headline-card">
          <div class="feedback-headline-value strong">${pctVeryInterested}%</div>
          <div class="feedback-headline-label">Very Interested in SBM</div>
        </div>
        <div class="feedback-headline-card">
          <div class="feedback-headline-value">${fb.totalResponses}/${fb.attendeeCount}</div>
          <div class="feedback-headline-label">Response Rate (${responseRate}%)</div>
          </div>
      </div>

      <div class="feedback-two-col">
        <div>
          <div class="feedback-sub-title">Roles of Interest</div>
          <div class="feedback-stat-list">${roleItems}</div>
        </div>
        <div>
          <div class="feedback-sub-title">Career Stage</div>
          <div class="feedback-stat-list">${stageItems}</div>
        </div>
      </div>

      <div class="feedback-sub-title">What Could Be Improved</div>
      <div class="improvement-tags">${improvementTags}</div>

      ${quotes.length > 0 ? `<div class="quote-label">Attendee Highlights</div>${quotes}` : ''}
    </div>`;
}

/* ── Leader insights (derived from event data for exec/TA audience) ── */
function buildLeaderInsights(evt) {
  const candidates = evt.candidates || [];
  const pod = candidates.filter(c => c.status === 'POD');
  const pending = candidates.filter(c => c.status === 'Pending');
  const relocConstraint = candidates.find(c => (c.relocPenalty > 0 || c.relocPenalty < 0) && c.status === 'POD');
  const strongRate = evt.metrics?.strongRate ?? evt.conversionRates?.attendanceToHighPotential;
  const hasLeaderFeedback = (evt.leaderSentiment?.submissions ?? 0) > 0;

  const podNames = pod.map(c => c.name).join(', ');
  const pendingNames = pending.map(c => c.name).join(', ');

  let bottomLine = '';
  if (pod.length) {
    bottomLine = `${pod.length} candidate${pod.length > 1 ? 's' : ''} ready for POD: ${podNames}.`;
    if (pending.length) bottomLine += ` ${pending.length} need your input before advancing.`;
  } else if (pending.length) {
    bottomLine = `${pending.length} candidate${pending.length > 1 ? 's' : ''} in pipeline; no POD recommendations yet. Schedule leader check-ins to move forward.`;
  } else {
    bottomLine = 'Pipeline evaluated. Use the Candidate Evaluation section above for status and next steps.';
  }
  if (strongRate != null && strongRate > 0) {
    bottomLine += ` Event quality: ${strongRate}% strong-candidate rate${strongRate >= 50 ? ' — strong pool.' : '.'}`;
  }

  let nextSteps = '';
  if (pending.length) {
    nextSteps = `Schedule 15-min check-ins for: ${pendingNames}. Resume and fit scores are in; leader signal will determine advance/hold.`;
  } else if (pod.length) {
    nextSteps = 'Proceed with POD scheduling for the candidates above. No pending evaluations.';
  } else {
    nextSteps = 'Review Candidate Evaluation and Leader Sentiment to decide next steps.';
  }

  let note = '';
  if (relocConstraint) {
    note = `${relocConstraint.name}: relocation constraint (cannot relocate for ~1 year). Factor into placement.`;
  }
  if (hasLeaderFeedback && !note) {
    note = 'Leader feedback received; use Leader Sentiment section for who recommended whom.';
  }

  return { bottomLine, nextSteps, note };
}

/* ── Section 6: Event Funnel & Health ── */
function renderFunnel(evt) {
  const f = evt.funnel || {};
  const c = evt.conversionRates || {};
  const maxVal = Math.max(f.rsvp || 0, 1);

  const steps = [
    { label: 'RSVP', value: f.rsvp ?? 0, color: '#1e3a5f' },
    { label: 'Attended', value: f.attended ?? 0, color: '#1e40af' },
    { label: 'Resumes', value: f.resumes ?? 0, color: '#2563eb' },
    { label: 'High-Potential', value: f.highPotential ?? 0, color: '#3b82f6' },
    { label: 'POD Ready', value: f.pod ?? 0, color: '#60a5fa' }
  ];

  let funnelHtml = '';
  steps.forEach((step, i) => {
    const widthPct = maxVal > 0 ? Math.max(((step.value / maxVal) * 100), 12) : 12;
    funnelHtml += `<div class="funnel-step" style="width:${widthPct}%;background:${step.color};">
      <span class="funnel-count">${step.value}</span>
      <span class="funnel-label">${step.label}</span>
    </div>`;
    if (i < steps.length - 1) {
      funnelHtml += '<div class="funnel-arrow">&#9660;</div>';
    }
  });

  const hasCandidates = evt.candidates && evt.candidates.length > 0;
  const insights = hasCandidates ? buildLeaderInsights(evt) : null;
  let summaryBlock = '';
  if (insights && (insights.bottomLine || insights.nextSteps || insights.note)) {
    summaryBlock = `
      <div class="leader-insights-box">
        <div class="leader-insights-title">In 60 seconds</div>
        <div class="leader-insight-row"><span class="leader-insight-label">Bottom line</span> ${insights.bottomLine}</div>
        <div class="leader-insight-row"><span class="leader-insight-label">Next steps</span> ${insights.nextSteps}</div>
        ${insights.note ? `<div class="leader-insight-row"><span class="leader-insight-label">Note</span> ${insights.note}</div>` : ''}
      </div>`;
  } else {
    summaryBlock = `<div class="summary-box">${evt.healthSummary || '—'}</div>`;
  }

  return `
    <div class="section-card" id="section-funnel">
      <div class="section-title"><span class="icon">&#9660;</span> Event Funnel & Health</div>
      <div class="funnel-visual">${funnelHtml}</div>
      <div class="conversion-grid">
        <div class="conversion-card"><div class="conversion-value">${c.rsvpToAttendance ?? 0}%</div><div class="conversion-label">RSVP &rarr; Attendance</div></div>
        <div class="conversion-card"><div class="conversion-value">${c.attendanceToHighPotential ?? 0}%</div><div class="conversion-label">Attendance &rarr; High-Potential</div></div>
        <div class="conversion-card"><div class="conversion-value">${c.highPotentialToPod ?? 0}%</div><div class="conversion-label">High-Potential &rarr; POD</div></div>
      </div>
      ${summaryBlock}
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
  $$('.dim-bar-fill[data-width]').forEach(el => {
    if (el.closest('.candidate-card.expanded') || !el.closest('.card-expand-panel')) {
      el.style.width = el.dataset.width + '%';
    }
  });
}
