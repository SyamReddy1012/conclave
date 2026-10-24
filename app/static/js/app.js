/**
 * TechHunters Smart Hospital Optimization & Emergency Response System
 * Comprehensive Frontend Application Engine
 * Implements 4 Modules, Authentication/Login, Cream/Green/White & Dark Themes,
 * RBAC, 4-Stage Allocation Algorithm, OpenStreetMap Leaflet, Chart.js, and Section 9 Demo.
 */

// ==========================================
// APPLICATION STATE
// ==========================================
const AppState = {
  currentUser: null,
  currentRole: 'admin',
  selectedCity: 'ALL',
  hospitals: [],
  medicines: [],
  hotspots: [],
  ambulances: [],
  dispatches: [],
  bloodBank: [],
  overviewMap: null,
  hotspotsMap: null,
  overviewMarkers: [],
  hotspotsMarkers: [],
  routePolyline: null,
  charts: {
    bedWards: null,
    pharmaStatus: null,
    hotspotsCity: null,
    ambStatus: null
  },
  demoStep: 0,
  demoData: null
};

// Role permissions mapping
const ROLE_PERMISSIONS = {
  admin: {
    name: 'Dr. N.K. Syam Sundar Reddy (Director)',
    desc: 'Full System Access: Director controls all modules, overrides dispatches, and manages hospital resources.',
    canReserveBed: true,
    canDischarge: true,
    canRestock: true,
    canDispose: true,
    canDispatch: true,
    canStage: true
  },
  pharmacy: {
    name: 'K. Vishal, R.Ph. (Chief Pharmacist)',
    desc: 'Pharmacy & Blood Bank: Manages pharmaceutical batches, inspects expiry alerts, safe quarantine/disposal, and restocks critical supplies.',
    canReserveBed: false,
    canDischarge: false,
    canRestock: true,
    canDispose: true,
    canDispatch: false,
    canStage: false
  },
  reception: {
    name: 'S. Nikhil (Emergency Triage Officer)',
    desc: 'Reception & Triage: Monitors ward beds, verifies ICU/emergency capacity, checks on-duty doctors, and manages patient admissions/discharges.',
    canReserveBed: true,
    canDischarge: true,
    canRestock: false,
    canDispose: false,
    canDispatch: false,
    canStage: false
  },
  manager: {
    name: 'K. Ramesh (108 Fleet Dispatch Manager)',
    desc: 'Fleet Operations: Controls ambulance deployment, executes 4-stage allocation, routes emergency calls, and stages vehicles at high-risk hotspots.',
    canReserveBed: false,
    canDischarge: false,
    canRestock: false,
    canDispose: false,
    canDispatch: true,
    canStage: true
  }
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuthSession();
  initClock();
  initNavigation();
  initRoleSelector();
  initCityFilter();
  initMaps();
  initDemoButtons();

  // Load all initial data in the background
  loadOverviewData();
  loadBedTable();
  loadPharmaTable();
  loadBloodBank();
  loadHotspots();
  loadFleetTable();
  loadAuditLog();

  // Periodic telemetry refresh every 20 seconds
  setInterval(() => {
    if (AppState.currentUser) {
      loadOverviewData(false);
    }
  }, 20000);
});

// ==========================================
// THEME SWITCHING (CREAM / GREEN / WHITE & DARK)
// ==========================================
function initTheme() {
  const saved = localStorage.getItem('techhunters_theme') || 'theme-cream';
  setTheme(saved);
}

function toggleTheme() {
  const current = document.body.classList.contains('theme-cream') ? 'theme-cream' : 'theme-dark';
  const newTheme = current === 'theme-cream' ? 'theme-dark' : 'theme-cream';
  setTheme(newTheme);
}

function setTheme(theme) {
  document.body.classList.remove('theme-cream', 'theme-dark');
  document.body.classList.add(theme);
  localStorage.setItem('techhunters_theme', theme);

  const isCream = theme === 'theme-cream';
  document.querySelectorAll('.theme-label-text').forEach(el => {
    el.innerText = isCream ? 'Dark Mode' : 'Cream & Green';
  });
  document.querySelectorAll('.btn-theme-toggle i').forEach(el => {
    el.className = isCream ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  });

  // Re-render charts with theme colors if charts tab is loaded
  if (AppState.charts.bedWards) {
    loadPowerBiCharts();
  }
}

// ==========================================
// AUTHENTICATION & LOGIN FLOW
// ==========================================
function checkAuthSession() {
  const savedUser = localStorage.getItem('techhunters_user') || sessionStorage.getItem('techhunters_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      showAppView(user);
      return;
    } catch (e) {
      console.warn('Session parsing error:', e);
    }
  }
  showLoginView();
}

function showLoginView() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('app-view').classList.add('hidden');
}

function showAppView(user) {
  AppState.currentUser = user;
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');

  // Set role from user object
  if (user && user.role) {
    document.getElementById('role-select').value = user.role;
    setRole(user.role);
  }

  // Adjust Leaflet maps now that app-view is visible
  setTimeout(() => {
    if (AppState.overviewMap) AppState.overviewMap.invalidateSize();
    if (AppState.hotspotsMap) AppState.hotspotsMap.invalidateSize();
  }, 200);
}

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const remember = document.getElementById('login-remember').checked;
  const errorAlert = document.getElementById('login-error-alert');
  const errorText = document.getElementById('login-error-text');

  errorAlert.classList.add('hidden');
  const btn = document.getElementById('btn-submit-login');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Sign In to Command Center`;

    if (!data.success) {
      errorText.innerText = data.error || 'Authentication failed. Please verify credentials.';
      errorAlert.classList.remove('hidden');
      return;
    }

    if (remember) {
      localStorage.setItem('techhunters_user', JSON.stringify(data.user));
    } else {
      sessionStorage.setItem('techhunters_user', JSON.stringify(data.user));
    }

    showToast(`Authenticated as ${data.user.full_name} (${data.user.role.toUpperCase()})`, 'success');
    showAppView(data.user);

  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Sign In to Command Center`;
    errorText.innerText = 'Network error connecting to authentication server.';
    errorAlert.classList.remove('hidden');
  }
}

function quickLogin(role) {
  document.getElementById('login-username').value = role;
  document.getElementById('login-password').value = `${role}123`;
  handleLoginSubmit();
}

function logoutUser() {
  localStorage.removeItem('techhunters_user');
  sessionStorage.removeItem('techhunters_user');
  AppState.currentUser = null;
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  showToast('Logged out of Smart Hospital Command Center', 'info');
  showLoginView();
}

function togglePasswordVisibility() {
  const pwInput = document.getElementById('login-password');
  const eyeIcon = document.getElementById('pw-eye-icon');
  if (pwInput.type === 'password') {
    pwInput.type = 'text';
    eyeIcon.className = 'fa-solid fa-eye-slash';
  } else {
    pwInput.type = 'password';
    eyeIcon.className = 'fa-solid fa-eye';
  }
}

// Live Header Clock
function initClock() {
  const clockEl = document.getElementById('clock-display');
  function update() {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString() + ' IST';
  }
  update();
  setInterval(update, 1000);
}

// Navigation between tabs
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Re-adjust maps when tab becomes visible
  if (tabId === 'overview' && AppState.overviewMap) {
    setTimeout(() => AppState.overviewMap.invalidateSize(), 200);
  }
  if (tabId === 'hotspots' && AppState.hotspotsMap) {
    setTimeout(() => AppState.hotspotsMap.invalidateSize(), 200);
  }
  if (tabId === 'powerbi') {
    loadPowerBiCharts();
  }
}

// Role Selector
function initRoleSelector() {
  const roleSelect = document.getElementById('role-select');
  roleSelect.addEventListener('change', (e) => {
    setRole(e.target.value);
  });
  setRole('admin');
}

function setRole(role) {
  AppState.currentRole = role;
  const p = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin;
  document.getElementById('current-user-name').innerText = p.name;
  document.getElementById('role-description').innerText = p.desc;

  showToast(`Switched active role: ${p.name}`, 'info');

  // Re-render tables to enable/disable authorized action buttons
  renderBedRows(AppState.hospitals);
  renderFleetRows(AppState.ambulances);
  renderPharmaRows(AppState.medicines);
}

// Metro City Filter
function initCityFilter() {
  const filter = document.getElementById('city-filter');
  filter.addEventListener('change', (e) => {
    AppState.selectedCity = e.target.value;
    showToast(`Filtering region: ${e.target.options[e.target.selectedIndex].text}`, 'info');
    loadOverviewData();
    loadBedTable();
    loadHotspots();
    loadFleetTable();
    loadBloodBank();
  });
}

// ==========================================
// OPENSTREETMAP LEAFLET INITIALIZATION
// ==========================================
function initMaps() {
  // 1. Overview Geospatial Radar Map
  AppState.overviewMap = L.map('overview-map', {
    zoomControl: true,
    attributionControl: false
  }).setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(AppState.overviewMap);

  // 2. Hotspots Analysis Map
  AppState.hotspotsMap = L.map('hotspots-map', {
    zoomControl: true,
    attributionControl: false
  }).setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(AppState.hotspotsMap);
}

// ==========================================
// MODULE 1: LIVE COMMAND OVERVIEW DATA
// ==========================================
async function loadOverviewData(showToastNotice = true) {
  try {
    const res = await fetch('/api/overview');
    const data = await res.json();

    // Populate KPIs
    const h = data.hospitals;
    document.getElementById('kpi-total-beds').innerText = (h.total_beds || 0).toLocaleString();
    document.getElementById('kpi-occ-beds').innerText = (h.total_occupied || 0).toLocaleString();
    document.getElementById('kpi-free-beds').innerText = (h.total_free || 0).toLocaleString();

    const bedRate = Math.round(((h.total_occupied || 0) / (h.total_beds || 1)) * 100);
    document.getElementById('kpi-bed-progress').style.width = `${bedRate}%`;

    // ICU beds
    document.getElementById('kpi-free-icu').innerText = (h.free_icu || 0).toLocaleString();
    document.getElementById('kpi-avail-vent').innerText = (h.free_ventilators || 0).toLocaleString();
    document.getElementById('kpi-crit-hosp').innerText = `${data.critical_shortage_hospitals} shortage alerts`;
    document.getElementById('bed-alert-count').innerText = data.critical_shortage_hospitals;

    // Ambulances
    const a = data.ambulances;
    document.getElementById('kpi-free-amb').innerText = `${a.free || 0} Ready`;
    document.getElementById('kpi-busy-amb').innerText = a.busy || 0;
    document.getElementById('kpi-total-amb').innerText = a.total || 0;
    document.getElementById('amb-free-count').innerText = a.free || 0;

    // Pharma
    const m = data.medicines;
    const totalAlerts = (m.expired || 0) + (m.near_expiry || 0) + (m.low_stock || 0);
    document.getElementById('kpi-pharma-alerts').innerText = `${totalAlerts} Alert Items`;
    document.getElementById('kpi-expired-batches').innerText = m.expired || 0;
    document.getElementById('kpi-near-expiry-batches').innerText = m.near_expiry || 0;
    document.getElementById('pharma-alert-count').innerText = m.expired || 0;

    // Check system alert banner
    const alertBanner = document.getElementById('system-alert-banner');
    if (data.critical_shortage_hospitals > 0) {
      document.getElementById('alert-banner-text').innerText = 
        `CRITICAL ALERT: ${data.critical_shortage_hospitals} partner hospitals have < 4 ICU beds remaining. Immediate ambulance dispatch coordination recommended.`;
      alertBanner.classList.remove('hidden');
    }

    // Refresh Overview Map Pins
    plotOverviewMapPins();
    // Refresh Dispatches feed
    loadRecentDispatchesFeed();

  } catch (err) {
    console.error('Error loading overview data:', err);
  }
}

async function plotOverviewMapPins() {
  if (!AppState.overviewMap) return;

  // Clear existing markers
  AppState.overviewMarkers.forEach(m => AppState.overviewMap.removeLayer(m));
  AppState.overviewMarkers = [];

  // Fetch Hospitals
  const hospRes = await fetch(`/api/hospitals?city=${AppState.selectedCity}&limit=40`);
  const hospitals = await hospRes.json();

  // Fetch Ambulances
  const ambRes = await fetch(`/api/ambulances?city=${AppState.selectedCity}`);
  const ambulances = await ambRes.json();

  // Fetch Hotspots
  const hotRes = await fetch(`/api/hotspots?city=${AppState.selectedCity}`);
  const hotspots = await hotRes.json();

  const bounds = [];

  // 1. Hotspots Markers (Red pulsing circles)
  hotspots.forEach(spot => {
    const icon = L.divIcon({
      className: 'pulse-marker',
      html: `<div style="background:#dc2626; width:16px; height:16px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px #dc2626;"></div><div class="pulse-ring"></div>`,
      iconSize: [20, 20]
    });
    const marker = L.marker([spot.latitude, spot.longitude], { icon })
      .bindPopup(`
        <div style="font-family:sans-serif; min-width:180px;">
          <strong style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> ${spot.name}</strong><br>
          <small>${spot.corridor} · ${spot.city}</small><hr style="margin:4px 0; border:0; border-top:1px solid #ddd;">
          <b>Risk:</b> ${spot.risk_level}<br>
          <b>Annual Accidents:</b> ${spot.annual_accidents} (${spot.fatalities} Fatalities)<br>
          <b>Staging:</b> ${spot.recommended_staging_point}<br>
          <button style="margin-top:6px; background:#dc2626; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="dispatchAtHotspot('${spot.hotspot_id}')">Dispatch Emergency 108</button>
        </div>
      `)
      .addTo(AppState.overviewMap);
    AppState.overviewMarkers.push(marker);
    bounds.push([spot.latitude, spot.longitude]);
  });

  // 2. Hospital Markers (Green / Rose badges)
  hospitals.forEach(h => {
    const isCrit = h.status === 'Critical Alert';
    const color = isCrit ? '#dc2626' : '#198754';
    const icon = L.divIcon({
      className: 'hosp-marker',
      html: `<div style="background:${color}; width:14px; height:14px; border-radius:3px; border:2px solid #fff; box-shadow:0 0 6px ${color};"></div>`,
      iconSize: [14, 14]
    });
    const marker = L.marker([h.latitude, h.longitude], { icon })
      .bindPopup(`
        <div style="font-family:sans-serif;">
          <strong style="color:${color};"><i class="fa-solid fa-hospital"></i> ${h.hospital_name}</strong><br>
          <small>${h.city}, ${h.state} (${h.type})</small><hr style="margin:4px 0; border:0; border-top:1px solid #ddd;">
          <b>Free ICU Beds:</b> ${h.icu_beds_free} / ${h.icu_beds_total}<br>
          <b>Emergency Beds:</b> ${h.emergency_beds_free} / ${h.emergency_beds_total}<br>
          <b>Ventilators Avail:</b> ${h.ventilators_available} / ${h.ventilators_total}<br>
          <button style="margin-top:6px; background:#198754; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="showHospitalDetails('${h.hospital_id}')">View Doctors & Blood</button>
        </div>
      `)
      .addTo(AppState.overviewMap);
    AppState.overviewMarkers.push(marker);
    bounds.push([h.latitude, h.longitude]);
  });

  // 3. Ambulance Markers (Emerald = free, Amber = busy)
  ambulances.forEach(a => {
    const isFree = a.status === 'free';
    const color = isFree ? '#10b981' : '#d97706';
    const icon = L.divIcon({
      className: 'amb-marker',
      html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 6px ${color};"></div>`,
      iconSize: [12, 12]
    });
    const marker = L.marker([a.latitude, a.longitude], { icon })
      .bindPopup(`
        <div style="font-family:sans-serif;">
          <strong style="color:${color};"><i class="fa-solid fa-truck-medical"></i> ${a.ambulance_code}</strong><br>
          <small>${a.vehicle_number} (${a.type})</small><br>
          <b>Status:</b> ${a.status.toUpperCase()}<br>
          <b>Pilot:</b> ${a.driver_name} (${a.driver_phone})<br>
          <b>Base:</b> ${a.staged_hotspot_name || a.hospital_name}
        </div>
      `)
      .addTo(AppState.overviewMap);
    AppState.overviewMarkers.push(marker);
  });

  if (bounds.length > 0 && AppState.selectedCity !== 'ALL') {
    AppState.overviewMap.fitBounds(bounds, { padding: [40, 40] });
  } else if (bounds.length > 0) {
    AppState.overviewMap.setView([20.5937, 78.9629], 5);
  }
}

async function loadRecentDispatchesFeed() {
  try {
    const res = await fetch('/api/dispatches');
    const list = await res.json();
    AppState.dispatches = list;
    const feedEl = document.getElementById('recent-dispatch-feed');

    if (!list || list.length === 0) {
      feedEl.innerHTML = `<div class="feed-empty">No active dispatches yet. Run the demo scenario to simulate a highway incident.</div>`;
      return;
    }

    feedEl.innerHTML = list.slice(0, 10).map(d => `
      <div class="feed-item ${d.fallback_triggered ? 'style="border-left-color: #d97706;"' : ''}">
        <div class="feed-item-header">
          <span class="feed-id">${d.dispatch_id}</span>
          <span class="feed-time">${d.timestamp ? d.timestamp.split(' ')[1] : ''}</span>
        </div>
        <div class="feed-title">${d.location_name}</div>
        <div class="feed-sub">
          Ambulance <strong>${d.ambulance_code}</strong> (ETA: ${d.eta_minutes}m) &rarr; <strong>${d.hospital_name}</strong>
          ${d.fallback_triggered ? '<span class="badge badge-warning" style="margin-left:6px;">Expanded Radius</span>' : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading dispatches feed:', err);
  }
}

// ==========================================
// MODULE 2: BED MANAGEMENT
// ==========================================
async function loadBedTable() {
  try {
    const statusFilter = document.getElementById('bed-status-filter').value;
    const url = `/api/hospitals?city=${AppState.selectedCity}&status=${statusFilter}`;
    const res = await fetch(url);
    const hospitals = await res.json();
    AppState.hospitals = hospitals;

    // Mini counters
    let genFree = 0, icuFree = 0, emergFree = 0, ventFree = 0;
    hospitals.forEach(h => {
      genFree += h.general_beds_free;
      icuFree += h.icu_beds_free;
      emergFree += h.emergency_beds_free;
      ventFree += h.ventilators_available;
    });

    document.getElementById('gen-bed-stat').innerText = `${genFree.toLocaleString()} Free`;
    document.getElementById('icu-bed-stat').innerText = `${icuFree.toLocaleString()} Free`;
    document.getElementById('emerg-bed-stat').innerText = `${emergFree.toLocaleString()} Free`;
    document.getElementById('vent-stat').innerText = `${ventFree.toLocaleString()} Ready`;

    renderBedRows(hospitals);
  } catch (err) {
    console.error('Error loading bed table:', err);
  }
}

function renderBedRows(hospitals) {
  const tbody = document.getElementById('beds-tbody');
  if (!hospitals || hospitals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center">No hospitals match current criteria</td></tr>`;
    return;
  }

  const role = ROLE_PERMISSIONS[AppState.currentRole] || ROLE_PERMISSIONS.admin;

  tbody.innerHTML = hospitals.map(h => {
    const isCrit = h.status === 'Critical Alert';
    const freePct = h.free_beds_percentage;
    const canManageBeds = role.canReserveBed;

    return `
      <tr>
        <td>
          <strong>${h.hospital_name}</strong><br>
          <small class="text-green">${h.hospital_id}</small>
        </td>
        <td>${h.city}, ${h.state}</td>
        <td><span class="badge ${h.type === 'Government' ? 'badge-info' : 'badge-success'}">${h.type}</span></td>
        <td>
          ${h.general_beds_free} <small class="text-muted">/ ${h.general_beds_total}</small>
        </td>
        <td>
          <strong class="${h.icu_beds_free <= 4 ? 'text-rose' : 'text-emerald'}">${h.icu_beds_free}</strong> 
          <small class="text-muted">/ ${h.icu_beds_total}</small>
        </td>
        <td>
          <strong class="${h.emergency_beds_free <= 3 ? 'text-amber' : ''}">${h.emergency_beds_free}</strong>
          <small class="text-muted">/ ${h.emergency_beds_total}</small>
        </td>
        <td>
          <span class="text-green">${h.ventilators_available}</span> <small class="text-muted">/ ${h.ventilators_total}</small>
        </td>
        <td>
          <strong>${freePct}%</strong>
        </td>
        <td>
          <span class="badge ${isCrit ? 'badge-alert' : 'badge-success'}">
            ${isCrit ? '<i class="fa-solid fa-triangle-exclamation"></i> Low Bed Alert' : 'Normal'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-xs btn-outline-green" onclick="showHospitalDetails('${h.hospital_id}')" title="Details">
              <i class="fa-solid fa-circle-info"></i>
            </button>
            ${canManageBeds ? `
              <button class="btn btn-xs btn-primary" onclick="reserveBedQuick('${h.hospital_id}', 'ICU')" title="Reserve 1 ICU Bed">
                + ICU Bed
              </button>
              <button class="btn btn-xs btn-secondary" onclick="dischargePatientQuick('${h.hospital_id}', 'ICU')" title="Discharge ICU Patient">
                - Discharge
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterBedTable() {
  const query = document.getElementById('bed-search-input').value.toLowerCase();
  const filtered = AppState.hospitals.filter(h => 
    h.hospital_name.toLowerCase().includes(query) ||
    h.hospital_id.toLowerCase().includes(query) ||
    h.city.toLowerCase().includes(query)
  );
  renderBedRows(filtered);
}

async function reserveBedQuick(hospitalId, wardType) {
  try {
    const res = await fetch('/api/hospital/reserve-bed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hospital_id: hospitalId, ward_type: wardType })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadBedTable();
      loadOverviewData(false);
    } else {
      showToast(data.error || 'Failed to reserve bed', 'error');
    }
  } catch (err) {
    showToast('Network error reserving bed', 'error');
  }
}

async function dischargePatientQuick(hospitalId, wardType) {
  try {
    const res = await fetch('/api/hospital/discharge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hospital_id: hospitalId, ward_type: wardType })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'info');
      loadBedTable();
      loadOverviewData(false);
    } else {
      showToast(data.error || 'Failed to discharge patient', 'error');
    }
  } catch (err) {
    showToast('Network error discharging patient', 'error');
  }
}

async function showHospitalDetails(hospitalId) {
  try {
    const res = await fetch(`/api/hospital/${hospitalId}`);
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    const h = data.hospital;
    document.getElementById('hosp-modal-title').innerHTML = `
      <i class="fa-solid fa-hospital text-green"></i> ${h.hospital_name} (${h.hospital_id})
    `;

    const body = document.getElementById('hosp-modal-body');
    body.innerHTML = `
      <div style="margin-bottom:16px;">
        <strong>Location:</strong> ${h.city}, ${h.state} | <strong>Type:</strong> ${h.type} | <strong>Status:</strong> ${h.status}<br>
        <strong>Bed Availability:</strong> General: ${h.general_beds_free}/${h.general_beds_total} · ICU: ${h.icu_beds_free}/${h.icu_beds_total} · Emergency: ${h.emergency_beds_free}/${h.emergency_beds_total} · Ventilators: ${h.ventilators_available}/${h.ventilators_total}
      </div>

      <h4 style="color:var(--text-primary); margin-bottom:8px; font-size:14px;"><i class="fa-solid fa-user-doctor text-green"></i> On-Duty Medical Specialists (${data.doctors.length})</h4>
      <div style="max-height:160px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:16px;">
        <table class="data-table" style="font-size:12px;">
          <thead>
            <tr><th>Doctor ID</th><th>Name</th><th>Specialization</th><th>Experience</th><th>Duty Status</th></tr>
          </thead>
          <tbody>
            ${data.doctors.map(d => `
              <tr>
                <td>${d.doctor_id}</td>
                <td><strong>${d.doctor_name}</strong></td>
                <td>${d.specialization}</td>
                <td>${d.experience_years} yrs</td>
                <td><span class="badge ${d.on_duty ? 'badge-success' : 'badge-warning'}">${d.on_duty ? 'On-Duty' : 'Off-Duty'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <h4 style="color:var(--text-primary); margin-bottom:8px; font-size:14px;"><i class="fa-solid fa-droplet text-rose"></i> Blood Bank Units</h4>
      <div class="blood-grid">
        ${data.blood_bank.map(b => `
          <div class="blood-card">
            <div class="blood-group">${b.blood_group}</div>
            <div class="blood-units">${b.units_available} Units</div>
            <small class="${b.status === 'CRITICAL_LOW' ? 'text-rose' : 'text-emerald'}">${b.status}</small>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('hospital-modal').classList.remove('hidden');
  } catch (err) {
    showToast('Failed to load hospital details', 'error');
  }
}

function closeHospitalModal() {
  document.getElementById('hospital-modal').classList.add('hidden');
}

// ==========================================
// MODULE 3: MEDICINE INVENTORY (2000 ROWS)
// ==========================================
async function loadPharmaTable() {
  try {
    const status = document.getElementById('pharma-filter-status').value;
    const category = document.getElementById('pharma-filter-category').value;
    const search = document.getElementById('pharma-search').value;

    const url = `/api/medicines?status=${status}&category=${category}&search=${encodeURIComponent(search)}&limit=100`;
    const res = await fetch(url);
    const meds = await res.json();
    AppState.medicines = meds;

    renderPharmaRows(meds);
  } catch (err) {
    console.error('Error loading pharma records:', err);
  }
}

function renderPharmaRows(meds) {
  const tbody = document.getElementById('pharma-tbody');
  if (!meds || meds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center">No medicines match current criteria</td></tr>`;
    return;
  }

  const role = ROLE_PERMISSIONS[AppState.currentRole] || ROLE_PERMISSIONS.admin;

  tbody.innerHTML = meds.map(m => {
    let statusBadge = '<span class="badge badge-success">Adequate</span>';
    if (m.status === 'EXPIRED') {
      statusBadge = '<span class="badge badge-alert"><i class="fa-solid fa-ban"></i> EXPIRED</span>';
    } else if (m.status === 'NEAR_EXPIRY') {
      statusBadge = '<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Near Expiry (&le;30d)</span>';
    } else if (m.status === 'LOW_STOCK') {
      statusBadge = '<span class="badge badge-alert"><i class="fa-solid fa-arrow-down"></i> Low Stock (&lt;50)</span>';
    }

    return `
      <tr>
        <td><strong>#${m.id}</strong></td>
        <td>
          <strong>${m.name}</strong><br>
          <small class="text-green">Hospital: ${m.hospital_id}</small>
        </td>
        <td><span class="badge badge-info">${m.category}</span></td>
        <td>${m.distributor}</td>
        <td>
          <strong class="${m.quantity < 50 ? 'text-rose' : ''}">${m.quantity}</strong> units
        </td>
        <td>
          <span class="${m.expiry_days_left <= 0 ? 'text-rose' : (m.expiry_days_left <= 30 ? 'text-amber' : '')}">
            ${m.expiry_days_left <= 0 ? 'Expired (' + m.expiry_days_left + 'd)' : m.expiry_days_left + ' days'}
          </span>
        </td>
        <td>${m.expiry_date}</td>
        <td>₹${m.unit_price}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap:6px;">
            ${role.canRestock ? `
              <button class="btn btn-xs btn-primary" onclick="restockMedicineQuick(${m.id})" title="Restock +100 units">
                <i class="fa-solid fa-plus"></i> Restock
              </button>
            ` : ''}
            ${(role.canDispose && (m.status === 'EXPIRED' || m.expiry_days_left <= 0)) ? `
              <button class="btn btn-xs btn-demo" onclick="disposeMedicineQuick(${m.id})" title="Quarantine and safely dispose">
                <i class="fa-solid fa-trash"></i> Quarantine
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function restockMedicineQuick(medId) {
  try {
    const res = await fetch('/api/medicines/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicine_id: medId, quantity: 150 })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadPharmaTable();
      loadOverviewData(false);
    }
  } catch (err) {
    showToast('Failed to restock item', 'error');
  }
}

async function disposeMedicineQuick(medId) {
  if (!confirm('Quarantine and dispose of this expired pharmaceutical batch?')) return;
  try {
    const res = await fetch('/api/medicines/dispose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicine_id: medId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'warning');
      loadPharmaTable();
      loadOverviewData(false);
    }
  } catch (err) {
    showToast('Failed to quarantine item', 'error');
  }
}

async function loadBloodBank() {
  try {
    const res = await fetch(`/api/blood-bank?city=${AppState.selectedCity}`);
    const bloodList = await res.json();
    AppState.bloodBank = bloodList;

    const grid = document.getElementById('blood-bank-grid');
    const groups = {};
    bloodList.forEach(b => {
      groups[b.blood_group] = (groups[b.blood_group] || 0) + b.units_available;
    });

    grid.innerHTML = Object.entries(groups).map(([grp, units]) => {
      const isLow = units < 30;
      return `
        <div class="blood-card">
          <div class="blood-group">${grp}</div>
          <div class="blood-units">${units} Units</div>
          <small class="${isLow ? 'text-rose' : 'text-emerald'}">${isLow ? 'CRITICAL LOW' : 'ADEQUATE'}</small>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading blood bank:', err);
  }
}

// ==========================================
// MODULE 4: ACCIDENT HOTSPOTS
// ==========================================
async function loadHotspots() {
  try {
    const res = await fetch(`/api/hotspots?city=${AppState.selectedCity}`);
    const hotspots = await res.json();
    AppState.hotspots = hotspots;
    document.getElementById('hotspot-count').innerText = hotspots.length;

    // Populate dropdown in dispatch tab
    const dispSelect = document.getElementById('disp-hotspot');
    dispSelect.innerHTML = hotspots.map(h => `
      <option value="${h.hotspot_id}">${h.name} (${h.corridor} · ${h.city})</option>
    `).join('');

    // Populate Hotspots List Cards
    const listEl = document.getElementById('hotspots-list-cards');
    listEl.innerHTML = hotspots.map(h => `
      <div class="feed-item" style="border-left-color: ${h.risk_level === 'Critical' ? '#dc2626' : '#d97706'};">
        <div class="feed-item-header">
          <span class="feed-id">${h.hotspot_id}</span>
          <span class="badge ${h.risk_level === 'Critical' ? 'badge-alert' : 'badge-warning'}">${h.risk_level} Risk</span>
        </div>
        <div class="feed-title">${h.name}</div>
        <div class="feed-sub">
          <strong>Corridor:</strong> ${h.corridor} · <strong>City:</strong> ${h.city}<br>
          <strong>Primary Hazard:</strong> ${h.primary_hazard}<br>
          <strong>Annual Toll:</strong> ${h.annual_accidents} accidents (${h.fatalities} fatalities)<br>
          <strong>108 Staging Post:</strong> ${h.recommended_staging_point}
        </div>
        <div style="margin-top:8px;">
          <button class="btn btn-xs btn-primary" onclick="dispatchAtHotspot('${h.hotspot_id}')">
            <i class="fa-solid fa-bolt"></i> Test Dispatch Here
          </button>
        </div>
      </div>
    `).join('');

    // Plot markers on Hotspots Map
    if (AppState.hotspotsMap) {
      AppState.hotspotsMarkers.forEach(m => AppState.hotspotsMap.removeLayer(m));
      AppState.hotspotsMarkers = [];

      const bounds = [];
      hotspots.forEach(h => {
        const icon = L.divIcon({
          className: 'pulse-marker',
          html: `<div style="background:#dc2626; width:18px; height:18px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px #dc2626;"></div><div class="pulse-ring"></div>`,
          iconSize: [22, 22]
        });
        const marker = L.marker([h.latitude, h.longitude], { icon })
          .bindPopup(`
            <div style="font-family:sans-serif; min-width:180px;">
              <strong style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> ${h.name}</strong><br>
              <small>${h.corridor} · ${h.city}</small><hr style="margin:4px 0; border:0; border-top:1px solid #ddd;">
              <b>Risk:</b> ${h.risk_level}<br>
              <b>Hazard:</b> ${h.primary_hazard}<br>
              <b>Fatalities:</b> ${h.fatalities} per year<br>
              <b>Staging:</b> ${h.recommended_staging_point}<br>
              <button style="margin-top:6px; background:#dc2626; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="dispatchAtHotspot('${h.hotspot_id}')">Simulate Incident</button>
            </div>
          `)
          .addTo(AppState.hotspotsMap);
        AppState.hotspotsMarkers.push(marker);
        bounds.push([h.latitude, h.longitude]);
      });

      if (bounds.length > 0 && AppState.selectedCity !== 'ALL') {
        AppState.hotspotsMap.fitBounds(bounds, { padding: [40, 40] });
      } else {
        AppState.hotspotsMap.setView([20.5937, 78.9629], 5);
      }
    }
  } catch (err) {
    console.error('Error loading hotspots:', err);
  }
}

function onHotspotSelectChange() {
  const spotId = document.getElementById('disp-hotspot').value;
  const spot = AppState.hotspots.find(h => h.hotspot_id === spotId);
  if (spot) {
    document.getElementById('disp-lat').value = spot.latitude;
    document.getElementById('disp-lon').value = spot.longitude;
    document.getElementById('disp-loc-name').value = `${spot.name} (${spot.corridor})`;
  }
}

function dispatchAtHotspot(hotspotId) {
  switchTab('ambulances');
  if (hotspotId) {
    document.getElementById('disp-hotspot').value = hotspotId;
    onHotspotSelectChange();
  }
}

// ==========================================
// MODULE 5: 4-STAGE SMART AMBULANCE ALLOCATION
// ==========================================
async function executeAllocationForm(event) {
  if (event) event.preventDefault();

  const lat = parseFloat(document.getElementById('disp-lat').value);
  const lon = parseFloat(document.getElementById('disp-lon').value);
  const locName = document.getElementById('disp-loc-name').value;
  const reqWard = document.getElementById('disp-ward').value;
  const severity = document.getElementById('disp-severity').value;
  const radius = parseFloat(document.getElementById('disp-radius').value);
  const simulateFallback = document.getElementById('disp-simulate-fallback').checked;

  const payload = {
    latitude: lat,
    longitude: lon,
    location_name: locName,
    city: AppState.selectedCity === 'ALL' ? 'Mumbai' : AppState.selectedCity,
    required_ward: reqWard,
    patient_severity: severity,
    search_radius_km: radius,
    simulate_no_bed: simulateFallback
  };

  const stepsContainer = document.getElementById('allocation-steps-container');
  const stepCards = stepsContainer.querySelectorAll('.step-card');
  const badge = document.getElementById('allocation-status-badge');
  const resultBox = document.getElementById('allocation-result-box');

  badge.className = 'badge badge-warning';
  badge.innerText = 'Executing 4-Stage Allocation...';
  resultBox.classList.add('hidden');

  // Step 1: Filter
  stepCards[0].className = 'step-card active-step';
  await sleep(400);

  // Step 2: Rank
  stepCards[0].className = 'step-card completed-step';
  stepCards[1].className = 'step-card active-step';
  await sleep(500);

  // Execute Backend API
  try {
    const res = await fetch('/api/dispatch/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      badge.className = 'badge badge-alert';
      badge.innerText = 'Allocation Failed';
      showToast(data.error || 'Allocation failed', 'error');
      stepCards.forEach(s => s.className = 'step-card standby');
      return;
    }

    // Step 3: Match
    stepCards[1].className = 'step-card completed-step';
    stepCards[2].className = 'step-card active-step';
    await sleep(400);

    // Step 4: State Update
    stepCards[2].className = 'step-card completed-step';
    stepCards[3].className = 'step-card completed-step';

    badge.className = data.fallback_triggered ? 'badge badge-warning' : 'badge badge-success';
    badge.innerText = data.fallback_triggered ? 'Fallback Resolved' : 'Dispatched & Reserved';

    // Populate Result Box
    const amb = data.matched_ambulance;
    const hosp = data.matched_hospital;

    resultBox.className = `result-box ${data.fallback_triggered ? 'fallback-alert' : ''}`;
    resultBox.innerHTML = `
      <div class="result-title">
        <i class="fa-solid fa-circle-check ${data.fallback_triggered ? 'text-amber' : 'text-emerald'}"></i>
        ${data.fallback_triggered ? 'FALLBACK ALLOCATION (Radius Expanded)' : 'Optimal Ambulance & Hospital Match Confirmed'}
      </div>
      <div class="result-details-grid">
        <div>
          <strong>Dispatched Ambulance:</strong><br>
          <span class="text-green">${amb.ambulance_code}</span> (${amb.type})<br>
          Pilot: ${amb.driver_name} (${amb.driver_phone})<br>
          <strong>Distance:</strong> ${amb.distance_km} km | <strong>ETA:</strong> ${amb.eta_minutes} mins
        </div>
        <div>
          <strong>Matched Hospital:</strong><br>
          <span class="text-rose">${hosp.hospital_name}</span><br>
          Bed Reserved: <strong>1 ${data.allocation_steps[2].details.includes('General') ? 'General' : reqWard} Bed</strong><br>
          <strong>Hospital Distance:</strong> ${hosp.distance_km || 12} km | <strong>ETA:</strong> ${hosp.eta_minutes || 18} mins
        </div>
      </div>
      ${data.admin_alert ? `
        <div style="margin-top:10px; padding:8px; background:rgba(220,38,38,0.12); border:1px solid #dc2626; border-radius:4px; font-size:11px;">
          <i class="fa-solid fa-bell"></i> <strong>Admin Escalation:</strong> ${data.admin_alert}
        </div>
      ` : ''}
    `;
    resultBox.classList.remove('hidden');

    showToast(`Dispatched ${amb.ambulance_code} & Reserved Bed at ${hosp.hospital_name}!`, 'success');

    // Refresh Fleet and Overview
    loadFleetTable();
    loadBedTable();
    loadOverviewData(false);

    // Switch overview map and draw route polyline
    drawEmergencyRoute([amb.latitude, amb.longitude], [lat, lon], [hosp.latitude, hosp.longitude]);

  } catch (err) {
    console.error('Error during dispatch:', err);
    showToast('Network error during ambulance allocation', 'error');
  }
}

function drawEmergencyRoute(ambCoords, accCoords, hospCoords) {
  if (!AppState.overviewMap) return;

  if (AppState.routePolyline) {
    AppState.overviewMap.removeLayer(AppState.routePolyline);
  }

  // Draw two-leg polyline: Ambulance -> Accident Scene -> Hospital
  const routePoints = [ambCoords, accCoords, hospCoords];
  AppState.routePolyline = L.polyline(routePoints, {
    color: '#198754',
    weight: 4,
    opacity: 0.85,
    dashArray: '8, 8',
    lineCap: 'round'
  }).addTo(AppState.overviewMap);

  AppState.overviewMap.fitBounds(AppState.routePolyline.getBounds(), { padding: [50, 50] });
}

async function loadFleetTable() {
  try {
    const res = await fetch(`/api/ambulances?city=${AppState.selectedCity}`);
    const fleet = await res.json();
    AppState.ambulances = fleet;
    renderFleetRows(fleet);
  } catch (err) {
    console.error('Error loading fleet:', err);
  }
}

function renderFleetRows(fleet) {
  const tbody = document.getElementById('fleet-tbody');
  if (!fleet || fleet.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">No ambulances in current region</td></tr>`;
    return;
  }

  const role = ROLE_PERMISSIONS[AppState.currentRole] || ROLE_PERMISSIONS.admin;

  tbody.innerHTML = fleet.map(a => {
    let statusBadge = '<span class="badge badge-success">READY (FREE)</span>';
    if (a.status === 'busy') statusBadge = '<span class="badge badge-warning">BUSY (DISPATCHED)</span>';
    else if (a.status === 'maintenance') statusBadge = '<span class="badge badge-alert">MAINTENANCE</span>';

    return `
      <tr>
        <td><strong class="text-green">${a.ambulance_code}</strong></td>
        <td>${a.vehicle_number}</td>
        <td>${a.type}</td>
        <td>
          <strong>${a.staged_hotspot_name || a.hospital_name}</strong><br>
          <small class="text-muted">${a.city}, ${a.state}</small>
        </td>
        <td>${a.driver_name}<br><small class="text-muted">${a.driver_phone}</small></td>
        <td><small>${a.equipment}</small></td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap:6px;">
            ${role.canStage ? `
              <button class="btn btn-xs ${a.status === 'free' ? 'btn-outline-warning' : 'btn-secondary'}" 
                      onclick="toggleFleetStatus('${a.ambulance_code}', '${a.status === 'free' ? 'busy' : 'free'}')">
                ${a.status === 'free' ? 'Mark Busy' : 'Mark Free'}
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleFleetStatus(ambulanceCode, newStatus) {
  try {
    const res = await fetch('/api/ambulances/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ambulance_code: ambulanceCode, status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'info');
      loadFleetTable();
      loadOverviewData(false);
    }
  } catch (err) {
    showToast('Failed to toggle ambulance status', 'error');
  }
}

// ==========================================
// MODULE 6: POWER BI ANALYTICS (CHART.JS)
// ==========================================
async function loadPowerBiCharts() {
  try {
    const res = await fetch('/api/powerbi-metrics');
    const data = await res.json();

    const isCream = document.body.classList.contains('theme-cream');
    const textColor = isCream ? '#405245' : '#94a3b8';
    const gridColor = isCream ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    const colorPrimary = isCream ? '#0f5132' : '#06b6d4';
    const colorSecondary = isCream ? '#198754' : '#10b981';

    // Chart 1: Bed Capacity & Occupancy by Ward (DAX model)
    const ctx1 = document.getElementById('chart-bed-wards').getContext('2d');
    if (AppState.charts.bedWards) AppState.charts.bedWards.destroy();

    const wardLabels = data.bed_by_ward.map(w => `${w.ward_type} Ward`);
    const wardOccupied = data.bed_by_ward.map(w => w.occupied);
    const wardFree = data.bed_by_ward.map(w => w.free);

    AppState.charts.bedWards = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: wardLabels,
        datasets: [
          {
            label: 'Occupied Beds',
            data: wardOccupied,
            backgroundColor: colorPrimary,
            borderRadius: 4
          },
          {
            label: 'Free Beds',
            data: wardFree,
            backgroundColor: colorSecondary,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor } }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    });

    // Chart 2: Pharma Status Donut
    const ctx2 = document.getElementById('chart-pharma-status').getContext('2d');
    if (AppState.charts.pharmaStatus) AppState.charts.pharmaStatus.destroy();

    AppState.charts.pharmaStatus = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: data.pharma_status.map(s => s.status),
        datasets: [{
          data: data.pharma_status.map(s => s.count),
          backgroundColor: ['#198754', '#dc2626', '#d97706', '#7c3aed']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor } }
        }
      }
    });

    // Chart 3: Accidents by Metro Hub
    const ctx3 = document.getElementById('chart-hotspots-city').getContext('2d');
    if (AppState.charts.hotspotsCity) AppState.charts.hotspotsCity.destroy();

    AppState.charts.hotspotsCity = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: data.hotspots_by_city.map(c => c.city),
        datasets: [
          {
            label: 'Annual Accidents',
            data: data.hotspots_by_city.map(c => c.accidents),
            backgroundColor: '#d97706',
            borderRadius: 4
          },
          {
            label: 'Fatalities',
            data: data.hotspots_by_city.map(c => c.fatalities),
            backgroundColor: '#dc2626',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor } }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    });

    // Chart 4: Fleet Utilization
    const ctx4 = document.getElementById('chart-amb-status').getContext('2d');
    if (AppState.charts.ambStatus) AppState.charts.ambStatus.destroy();

    AppState.charts.ambStatus = new Chart(ctx4, {
      type: 'pie',
      data: {
        labels: data.amb_by_status.map(a => `${a.status.toUpperCase()}`),
        datasets: [{
          data: data.amb_by_status.map(a => a.count),
          backgroundColor: ['#198754', '#d97706', '#dc2626']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor } }
        }
      }
    });

  } catch (err) {
    console.error('Error loading Power BI charts:', err);
  }
}

// ==========================================
// MODULE 7: AUDIT LOG
// ==========================================
async function loadAuditLog() {
  try {
    const res = await fetch('/api/dispatches');
    const list = await res.json();
    const tbody = document.getElementById('audit-tbody');

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center">No dispatch events recorded in this session.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(d => `
      <tr>
        <td><strong class="text-green">${d.dispatch_id}</strong></td>
        <td>${d.timestamp}</td>
        <td>${d.location_name}</td>
        <td><span class="badge badge-info">${d.required_ward || 'ICU'}</span></td>
        <td><strong class="text-emerald">${d.ambulance_code}</strong></td>
        <td><strong>${d.eta_minutes} mins</strong></td>
        <td>${d.hospital_name}</td>
        <td>
          <span class="badge ${d.fallback_triggered ? 'badge-warning' : 'badge-success'}">
            ${d.fallback_triggered ? 'Yes (Expanded)' : 'No'}
          </span>
        </td>
        <td><span class="badge badge-success">${d.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading audit log:', err);
  }
}

// ==========================================
// SECTION 9 DEMO SCENARIO: HIGHWAY ACCIDENT
// ==========================================
function initDemoButtons() {
  document.getElementById('btn-run-demo').addEventListener('click', () => {
    startDemoScenario(false);
  });
  document.getElementById('btn-run-fallback-demo').addEventListener('click', () => {
    startDemoScenario(true);
  });
}

function startDemoScenario(isFallback = false) {
  AppState.demoStep = 1;
  AppState.isFallbackDemo = isFallback;
  document.getElementById('demo-modal').classList.remove('hidden');
  renderDemoStep();
}

function closeDemoModal() {
  document.getElementById('demo-modal').classList.add('hidden');
}

async function renderDemoStep() {
  const timeline = document.getElementById('demo-timeline');
  const btnNext = document.getElementById('btn-next-demo-step');

  if (AppState.demoStep === 1) {
    btnNext.innerText = 'Phase 2: Open Allocation View &rarr;';
    timeline.innerHTML = `
      <div class="demo-step-card active">
        <div class="demo-step-header">
          <i class="fa-solid fa-triangle-exclamation text-rose"></i>
          Phase 1: Highway Accident Reported Near Hotspot
        </div>
        <p>108 Emergency Call received: Multi-vehicle high-speed collision on <strong>Western Express Highway (Goregaon Flyover)</strong>.</p>
        <p>Geospatial radar flags site as <strong>MoRTH Critical Hotspot HOT-MUM-01</strong> with 142 historical accidents and active risk level.</p>
      </div>
    `;
    if (AppState.overviewMap) {
      AppState.overviewMap.setView([19.1663, 72.8526], 12);
    }
  } else if (AppState.demoStep === 2) {
    btnNext.innerText = 'Phase 3: Confirm Ambulance & Match Hospital &rarr;';
    timeline.innerHTML += `
      <div class="demo-step-card active">
        <div class="demo-step-header">
          <i class="fa-solid fa-route text-green"></i>
          Phase 2: Dispatcher Evaluates Ranked Free Ambulances
        </div>
        <p>Candidate fleet filtered for free & in-service units. Candidates sorted by travel time to accident site.</p>
        <p class="text-green"><strong>Top Recommendation:</strong> AMB-101 (ALS Unit with Defibrillator & Ventilator) · ETA 6.2 mins.</p>
      </div>
    `;
  } else if (AppState.demoStep === 3) {
    btnNext.innerText = 'Phase 4: Pharmacy Supplies Check &rarr;';
    btnNext.disabled = true;

    const res = await fetch('/api/demo/highway-accident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotspot_id: 'HOT-MUM-01',
        simulate_fallback: AppState.isFallbackDemo
      })
    });
    const result = await res.json();
    AppState.demoResult = result;
    btnNext.disabled = false;

    timeline.innerHTML += `
      <div class="demo-step-card active">
        <div class="demo-step-header">
          <i class="fa-solid fa-hospital text-emerald"></i>
          Phase 3: Hospital Matched & Bed Reserved
        </div>
        <p>Matched Nearest Hospital with Verified ICU Bed: <strong>${result.matched_hospital.hospital_name}</strong>.</p>
        <p>${result.fallback_triggered ? '<strong class="text-amber">Fallback Executed:</strong> Radius expanded to 60 km. Director notified.' : 'Capacity confirmed: 1 ICU Bed locked in reserve.'}</p>
        <p>Ambulance <strong>${result.matched_ambulance.ambulance_code}</strong> flagged <strong>BUSY (DISPATCHED)</strong>.</p>
      </div>
    `;
    drawEmergencyRoute(
      [result.matched_ambulance.latitude, result.matched_ambulance.longitude],
      [19.1663, 72.8526],
      [result.matched_hospital.latitude, result.matched_hospital.longitude]
    );
  } else if (AppState.demoStep === 4) {
    btnNext.innerText = 'Phase 5: Director Dashboard Review & Finish &rarr;';
    timeline.innerHTML += `
      <div class="demo-step-card active">
        <div class="demo-step-header">
          <i class="fa-solid fa-prescription-bottle-medical text-amber"></i>
          Phase 4: Pharmacy Checks Critical Emergency Supplies
        </div>
        <p>Hospital pharmacy alerts trauma team: O-Negative blood units verified in e-RaktKosh sync.</p>
        <p>Emergency trauma kits, adrenaline, and iv saline reserved for inbound patient.</p>
      </div>
    `;
  } else if (AppState.demoStep === 5) {
    btnNext.innerText = 'Complete Walkthrough ✓';
    timeline.innerHTML += `
      <div class="demo-step-card done">
        <div class="demo-step-header">
          <i class="fa-solid fa-circle-check text-emerald"></i>
          Phase 5: Real-Time Telemetry & Dashboard Updated Instantly
        </div>
        <p><strong>Expected Result Achieved:</strong></p>
        <ul style="padding-left:18px; margin-top:4px;">
          <li>Hospital free bed count decremented & locked.</li>
          <li>Ambulance marked BUSY in active fleet tracking.</li>
          <li>Emergency dispatch event permanently recorded in Audit Log.</li>
          <li>Power BI telemetry refreshed.</li>
        </ul>
      </div>
    `;
    loadOverviewData(false);
    loadBedTable();
    loadFleetTable();
    loadAuditLog();
  }
}

function proceedDemoStep() {
  if (AppState.demoStep >= 5) {
    closeDemoModal();
    showToast('Highway Emergency Demo Scenario Completed Successfully!', 'success');
    switchTab('overview');
  } else {
    AppState.demoStep++;
    renderDemoStep();
  }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  else if (type === 'error') icon = 'fa-circle-exclamation';
  else if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
