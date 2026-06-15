const state = {
  data: null,
  telemetryIndex: 0,
  scenarioTimer: null,
  scenarioStep: 0,
  scenarioStarted: false,
  activeDefect: null,
  workOrders: []
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function formatNumber(v, suffix = '') {
  if (typeof v !== 'number') return `${v}${suffix}`;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}${suffix}`;
}

async function loadData() {
  try {
    const res = await fetch('data/demo-data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
    state.workOrders = JSON.parse(JSON.stringify(state.data.workOrders));
    initApp();
  } catch (err) {
    document.body.innerHTML = `<main class="load-error"><h1>Could not load demo-data.json</h1><p>This static demo uses fetch() to load JSON. Open it through GitHub Pages, VS Code Live Server, or any static server instead of double-clicking the HTML file.</p><pre>${err.message}</pre></main>`;
  }
}

function initApp() {
  renderScenarioSteps();
  renderKPIs();
  renderRobotGrid();
  renderDefectEvents();
  renderTelemetryFocus();
  renderMaintenance();
  renderCopilot();
  renderWorkOrders();
  renderEvidence();
  wireInteractions();
  setupVideoOverlay();
  drawTelemetryChart();
  drawHistoryChart();
  setInterval(tickTelemetry, 1100);
}

function wireInteractions() {
  $$('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  $('#startScenarioBtn').addEventListener('click', startScenario);
  $('#resetScenarioBtn').addEventListener('click', resetScenario);
  $('#exportJsonBtn').addEventListener('click', exportCurrentJson);
  $('#importJsonInput').addEventListener('change', importJson);
  $('#createWorkOrderBtn').addEventListener('click', createAIWorkOrder);
  $('#copilotForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#copilotInput').value.trim();
    if (!q) return;
    askCopilot(q);
    $('#copilotInput').value = '';
  });
}

function renderScenarioSteps() {
  const steps = state.data.scenario.script;
  $('#scenarioSteps').innerHTML = steps.map((text, i) => `
    <div class="step-card" data-step="${i}">
      <div class="step-index">${i + 1}</div>
      <strong>${text.split('.')[0]}</strong>
      <p>${text.includes('.') ? text.substring(text.indexOf('.') + 1).trim() : ''}</p>
    </div>`).join('');
}

function renderKPIs() {
  const k = state.data.scenario.kpis;
  const cards = [
    ['OEE', k.oee, '%', '+1.8% if issue avoided'],
    ['Quality Yield', k.qualityYield, '%', 'defect risk rising', true],
    ['Robots Active', k.robotsActive, '', '32 / 34 connected'],
    ['Open AI Alerts', k.openAlerts, '', '2 high priority', true],
    ['Downtime Risk', k.predictedDowntimeHours, 'h', 'next 48 hours', true],
    ['Scrap Exposure', `₹${k.scrapExposureLakhs}`, 'L', 'preventable exposure', true]
  ];
  $('#kpiGrid').innerHTML = cards.map(([label, value, suffix, trend, bad]) => `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${typeof value === 'number' ? formatNumber(value, suffix) : `${value}${suffix}`}</div>
      <div class="kpi-trend ${bad ? 'bad' : ''}">${trend}</div>
    </div>`).join('');
}

function renderRobotGrid() {
  const html = state.data.robots.map(r => {
    const cls = r.healthScore < 70 ? 'danger' : r.status === 'Warning' ? 'warning' : '';
    return `<article class="robot-card ${cls}">
      <div class="robot-top"><span class="robot-id">${r.id}</span><span class="status-chip ${cls === 'danger' ? 'danger' : cls === 'warning' ? 'warn' : ''}">${r.status}</span></div>
      <p class="muted small">${r.name} · ${r.process}</p>
      <div class="bar"><div style="width:${r.healthScore}%"></div></div>
      <div class="robot-meta">
        <span>Health <b>${r.healthScore}%</b></span><span>Util. <b>${r.utilization}%</b></span>
        <span>Cycle <b>${r.cycleTimeSec}s</b></span><span>RUL <b>${r.rulHours}h</b></span>
      </div>
    </article>`;
  }).join('');
  $('#robotGrid').innerHTML = html;
}

function renderDefectEvents() {
  $('#defectEventStrip').innerHTML = state.data.defectEvents.map(e => `
    <div class="event-card" data-defect="${e.id}">
      <strong>${e.label}</strong>
      <span class="muted small">${e.partId} · ${e.robotId} · ${(e.confidence * 100).toFixed(0)}% confidence</span>
      <p class="muted small">${e.action}</p>
    </div>`).join('');
}

function renderTelemetryFocus() {
  const r = state.data.robots.find(x => x.id === 'R-07');
  $('#telemetryFocus').innerHTML = [
    ['Torque', r.torqueNm, 'Nm'], ['Vibration', r.vibrationMms, 'mm/s'], ['Temp', r.temperatureC, '°C'], ['Cycle Time', r.cycleTimeSec, 's']
  ].map(([label, v, unit]) => `<div class="metric-tile"><span class="muted small">${label}</span><b>${v}${unit}</b></div>`).join('');
}

function renderMaintenance() {
  const r = state.data.robots.find(x => x.id === 'R-07');
  const risk = Math.min(94, Math.max(5, Math.round(100 - r.healthScore + r.alarmCount24h * 4 + (r.vibrationMms > 5 ? 18 : 0))));
  $('#riskScore').textContent = risk;
  const offset = 252 - (252 * risk / 100);
  $('#riskArc').style.strokeDashoffset = offset;
  const insights = [
    ['Primary risk', `${r.id} has ${r.vibrationMms} mm/s vibration and ${r.torqueNm} Nm torque; both are above the simulated warning baseline.`],
    ['Remaining useful life', `Estimated RUL: ${r.rulHours} hours before recommended service intervention.`],
    ['Recommended action', r.nextAction],
    ['Business impact', state.data.scenario.kpis.predictedDowntimeHours + 'h downtime risk and ₹' + state.data.scenario.kpis.scrapExposureLakhs + 'L scrap exposure if unresolved.']
  ];
  $('#maintenanceInsights').innerHTML = insights.map(([h,p]) => `<div class="insight"><strong>${h}</strong><span class="muted">${p}</span></div>`).join('');
}

function renderCopilot() {
  $('#quickPrompts').innerHTML = state.data.knowledgeQuestions.map(k => `<button class="prompt-btn" data-q="${k.q}">${k.q}</button>`).join('');
  $$('.prompt-btn').forEach(btn => btn.addEventListener('click', () => askCopilot(btn.dataset.q)));
  addBotMessage('I am the SOP Copilot. Ask me about Robot R-07 defects, gripper calibration, downtime impact, or creating a work order.');
}

function askCopilot(question) {
  addUserMessage(question);
  const lower = question.toLowerCase();
  let match = state.data.knowledgeQuestions.find(k => lower.includes(k.intent) || lower.includes(k.q.toLowerCase().slice(0, 14)));
  if (!match) {
    if (lower.includes('sop') || lower.includes('calibration') || lower.includes('gripper')) match = state.data.knowledgeQuestions[1];
    else if (lower.includes('impact') || lower.includes('downtime') || lower.includes('business')) match = state.data.knowledgeQuestions[2];
    else if (lower.includes('work') || lower.includes('order')) match = state.data.knowledgeQuestions[3];
    else match = state.data.knowledgeQuestions[0];
  }
  const sop = state.data.sops.find(s => match.answer.includes(s.id)) || state.data.sops[0];
  const enriched = `${match.answer}<br><br><strong>Relevant SOP:</strong> ${sop.title}<br><strong>Key steps:</strong><ol>${sop.steps.slice(0,4).map(s => `<li>${s}</li>`).join('')}</ol><div class="source">Source: ${sop.id} · synthetic JSON SOP library</div>`;
  setTimeout(() => addBotMessage(enriched), 250);
}

function addUserMessage(text) { addMessage(text, 'user'); }
function addBotMessage(html) { addMessage(html, 'bot'); }
function addMessage(content, cls) {
  const node = document.createElement('div');
  node.className = `msg ${cls}`;
  node.innerHTML = content;
  $('#chatWindow').appendChild(node);
  $('#chatWindow').scrollTop = $('#chatWindow').scrollHeight;
}

function renderWorkOrders() {
  const rows = state.workOrders.map(w => `<tr>
    <td><strong>${w.id}</strong><br><span class="muted small">${w.created.replace('T',' ')}</span></td>
    <td><strong>${w.title}</strong><br><span class="muted small">${w.asset} · ${w.businessImpact}</span></td>
    <td><span class="pill ${w.priority.toLowerCase()}">${w.priority}</span></td>
    <td>${w.status}</td>
    <td>${w.owner}</td>
    <td>${w.recommendedSop}</td>
  </tr>`).join('');
  $('#workOrderTable').innerHTML = `<thead><tr><th>Work Order</th><th>AI Recommendation</th><th>Priority</th><th>Status</th><th>Owner</th><th>SOP</th></tr></thead><tbody>${rows}</tbody>`;
}

function createAIWorkOrder() {
  if (state.workOrders.some(w => w.id === 'WO-260615-AI')) {
    flashAgent('Work order already created', 'WO-260615-AI is already linked to the active defect scenario.');
    return;
  }
  state.workOrders.unshift({
    id: 'WO-260615-AI',
    title: 'AI-created micro-stop inspection for Robot R-07',
    asset: 'Robot R-07',
    priority: 'High',
    status: 'Open',
    created: new Date().toISOString().slice(0,19),
    owner: 'AI Supervisor Agent',
    estimatedTimeMin: 18,
    linkedEvents: ['D-1001','D-1002'],
    recommendedSop: 'SOP-R07-GRIPPER-ALIGN-001',
    businessImpact: 'Prevents projected 2.4h downtime and ₹4.8L scrap exposure'
  });
  renderWorkOrders();
  flashAgent('AI work order created', 'The Supervisor Agent created WO-260615-AI and linked it to the defect, telemetry drift, SOP and business impact.');
}

function renderEvidence() {
  $('#contractList').innerHTML = state.data.contracts.map(c => `<div class="doc-card"><strong>${c.name}</strong><span class="muted small">${c.id} · ${c.type}</span><p class="muted small">${c.summary}</p></div>`).join('');
  $('#sopList').innerHTML = state.data.sops.map(s => `<div class="doc-card"><strong>${s.title}</strong><span class="muted small">${s.id} · ${s.estimatedTimeMin} min · ${s.category}</span><p class="muted small">Trigger: ${s.trigger}</p></div>`).join('');
}

function setupVideoOverlay() {
  const video = $('#demoVideo');
  const canvas = $('#visionOverlay');
  const playButton = $('#videoPlayBtn');
  const errorMessage = $('#videoError');
  const ctx = canvas.getContext('2d');
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  video.addEventListener('timeupdate', drawVisionOverlay);
  video.addEventListener('play', () => {
    playButton.hidden = true;
    errorMessage.hidden = true;
    requestAnimationFrame(visionLoop);
  });
  video.addEventListener('canplay', attemptVideoPlayback, { once: true });
  video.addEventListener('error', () => {
    playButton.hidden = true;
    errorMessage.hidden = false;
  });
  playButton.addEventListener('click', attemptVideoPlayback);
  attemptVideoPlayback();

  function attemptVideoPlayback() {
    video.play().catch(() => {
      if (video.error) errorMessage.hidden = false;
      else playButton.hidden = false;
    });
  }

  function visionLoop(){ drawVisionOverlay(); if(!video.paused) requestAnimationFrame(visionLoop); }
}

function drawVisionOverlay() {
  const video = $('#demoVideo');
  const canvas = $('#visionOverlay');
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  const t = video.currentTime || 0;
  const active = state.data.defectEvents.find(e => t >= e.timeStart && t <= e.timeEnd);
  state.activeDefect = active || null;
  $$('.event-card').forEach(card => card.classList.toggle('active', active && card.dataset.defect === active.id));
  if (active) {
    const b = active.bbox;
    const x = b.x * w, y = b.y * h, bw = b.w * w, bh = b.h * h;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff4d6d';
    ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 18;
    ctx.strokeRect(x,y,bw,bh);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,77,109,.92)';
    ctx.fillRect(x, Math.max(0, y-34), Math.min(330,bw+185), 30);
    ctx.fillStyle = '#fff';
    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillText(`${active.label} · ${(active.confidence*100).toFixed(0)}%`, x+10, Math.max(20, y-14));
    $('#visionStatus').textContent = 'Defect detected';
    $('#visionStatus').className = 'status-chip danger';
    $('#visionHud').innerHTML = `<strong>${active.label}</strong><br>${active.partId} · ${active.robotId}<br>${active.action}`;
    if (state.scenarioStarted && state.scenarioStep < 2) updateScenarioStep(1);
  } else {
    $('#visionStatus').textContent = 'Monitoring';
    $('#visionStatus').className = 'status-chip';
    $('#visionHud').textContent = 'No defect active';
  }
}

function tickTelemetry() {
  if (!state.data) return;
  state.telemetryIndex = (state.telemetryIndex + 1) % state.data.telemetry.length;
  const current = state.data.telemetry[state.telemetryIndex]['R-07'];
  const robot = state.data.robots.find(r => r.id === 'R-07');
  robot.torqueNm = current.torqueNm;
  robot.vibrationMms = current.vibrationMms;
  robot.temperatureC = current.temperatureC;
  robot.cycleTimeSec = current.cycleTimeSec;
  robot.healthScore = Math.max(42, Math.round(83 - (current.vibrationMms * 3.2) - Math.max(0, current.torqueNm - 58) * .7));
  if (current.vibrationMms > 5.5 && state.scenarioStarted && state.scenarioStep < 3) updateScenarioStep(2);
  renderTelemetryFocus();
  renderRobotGrid();
  renderMaintenance();
  drawTelemetryChart();
}

function drawTelemetryChart() {
  const canvas = $('#telemetryChart'); if (!canvas || !state.data) return;
  drawLineChart(canvas, getTelemetryWindow(), [
    { key:'torqueNm', label:'Torque', color:'#36e4ff', min:35, max:90 },
    { key:'vibrationMms', label:'Vibration', color:'#ff4d6d', min:1, max:8 },
    { key:'temperatureC', label:'Temperature', color:'#ffd166', min:38, max:72 }
  ], 'R-07');
}

function getTelemetryWindow() {
  const arr = state.data.telemetry;
  const windowSize = 70;
  const start = Math.max(0, state.telemetryIndex - windowSize);
  return arr.slice(start, state.telemetryIndex + 1);
}

function drawLineChart(canvas, points, series, robotId) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  const w = rect.width, h = rect.height, pad = 26;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = 'rgba(141,162,181,.18)'; ctx.lineWidth = 1;
  for (let i=0;i<5;i++){ const y=pad+(h-pad*2)*i/4; ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke(); }
  series.forEach(s => {
    ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = 2.2;
    points.forEach((p, i) => {
      const v = p[robotId][s.key];
      const x = pad + (w-pad*2) * (points.length <= 1 ? 0 : i/(points.length-1));
      const y = h - pad - ((v-s.min)/(s.max-s.min)) * (h-pad*2);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  });
  ctx.fillStyle = 'rgba(232,241,248,.8)'; ctx.font = '12px Inter, sans-serif';
  ctx.fillText('Streaming robot telemetry · synthetic R-07 data', pad, 18);
}

function drawHistoryChart() {
  const canvas = $('#historyChart'); if (!canvas || !state.data) return;
  const sheets = state.data.pastDataSheets;
  const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=rect.width,h=rect.height,pad=30; ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(141,162,181,.18)'; for(let i=0;i<5;i++){let y=pad+(h-pad*2)*i/4; ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke();}
  const maxDef = Math.max(...sheets.map(s=>s.defectRatePct))*1.2;
  const barW = (w-pad*2)/sheets.length*0.58;
  sheets.forEach((s,i)=>{
    const x=pad+(w-pad*2)*i/sheets.length+barW*.35;
    const bh=(s.defectRatePct/maxDef)*(h-pad*2);
    ctx.fillStyle=s.defectRatePct>3.2?'rgba(255,77,109,.75)':'rgba(54,228,255,.55)';
    ctx.fillRect(x,h-pad-bh,barW,bh);
  });
  ctx.fillStyle='rgba(232,241,248,.8)'; ctx.font='12px Inter, sans-serif'; ctx.fillText('Defect rate % by day · JSON past data sheet', pad, 18);
}

function startScenario() {
  state.scenarioStarted = true;
  updateScenarioStep(0);
  $('#demoVideo').currentTime = 0;
  $('#demoVideo').play().catch(()=>{});
  clearInterval(state.scenarioTimer);
  state.scenarioTimer = setInterval(() => {
    if (!state.scenarioStarted) return;
    const next = Math.min(state.scenarioStep + 1, state.data.scenario.script.length - 1);
    updateScenarioStep(next);
    if (next === 3) askCopilot('Show SOP for gripper calibration');
    if (next === 5) createAIWorkOrder();
    if (next === state.data.scenario.script.length - 1) clearInterval(state.scenarioTimer);
  }, 4200);
}

function resetScenario() {
  clearInterval(state.scenarioTimer);
  state.scenarioStarted = false; state.scenarioStep = 0;
  state.workOrders = JSON.parse(JSON.stringify(state.data.workOrders));
  $('#agentHeadline').textContent = 'Awaiting shopfloor signal';
  $('#agentSummary').textContent = 'Press “Start live scenario” to trigger a full chain across Vision AI, Robot Health, Predictive Maintenance, SOP Copilot and Work Orders.';
  $('#agentMeterFill').style.width = '5%';
  $('#agentTags').innerHTML = '';
  $$('.step-card').forEach(c => c.classList.remove('active','done'));
  renderWorkOrders();
}

function updateScenarioStep(step) {
  state.scenarioStep = step;
  $$('.step-card').forEach((card, i) => {
    card.classList.toggle('active', i === step);
    card.classList.toggle('done', i < step);
  });
  const headlines = [
    ['Scenario started', 'Agents are watching robot telemetry, vision feed, quality trends and SOP knowledge in one synchronized workflow.', ['Vision Agent','Robot Health Agent']],
    ['Defect detected', 'Vision Agent found a surface anomaly on part BX-2041 and linked it to Cell 3 inspection data.', ['Defect AI','Quality Gate']],
    ['Telemetry correlation found', 'Robot Health Agent correlated defects with torque, vibration and cycle-time drift on Robot R-07.', ['R-07','Anomaly AI']],
    ['Maintenance risk predicted', 'Predictive Maintenance Agent estimates elevated service risk and recommends micro-stop intervention.', ['RUL 38h','High priority']],
    ['SOP retrieved', 'Knowledge Agent found the gripper alignment procedure and validation criteria from the SOP library.', ['SOP-R07','RAG Copilot']],
    ['Work order ready', 'Supervisor Agent generated a high-priority work order with event links, SOP and impact estimate.', ['WO created','₹4.8L exposure']]
  ];
  const [h,p,tags] = headlines[step] || headlines[0];
  $('#agentHeadline').textContent = h;
  $('#agentSummary').textContent = p;
  $('#agentMeterFill').style.width = `${8 + ((step+1)/headlines.length)*92}%`;
  $('#agentTags').innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');
}

function flashAgent(headline, summary) {
  $('#agentHeadline').textContent = headline;
  $('#agentSummary').textContent = summary;
  $('#agentMeterFill').style.width = '100%';
}

function exportCurrentJson() {
  const payload = JSON.parse(JSON.stringify(state.data));
  payload.workOrders = state.workOrders;
  payload.exportedFrom = 'FANUC Industrial AI Command Center static demo';
  payload.exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'fanuc-ai-demo-export.json';
  a.click(); URL.revokeObjectURL(a.href);
}

function importJson(evt) {
  const file = evt.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state.data = JSON.parse(reader.result);
      state.workOrders = state.data.workOrders || [];
      state.telemetryIndex = 0;
      initApp();
      flashAgent('JSON scenario imported', 'The demo has been reproduced from the uploaded JSON file.');
    } catch (e) { alert('Invalid JSON file: ' + e.message); }
  };
  reader.readAsText(file);
}

loadData();
