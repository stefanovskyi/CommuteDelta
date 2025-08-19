(() => {
  const USE_MOCKS = window.USE_MOCKS ?? true;

  const ORIGIN_COLORS = [
    { key: 'A', color: getCssVar('--origin-a') },
    { key: 'B', color: getCssVar('--origin-b') },
    { key: 'C', color: getCssVar('--origin-c') },
  ];

  const CATEGORIES = ['Work', 'School', 'Shop', 'Rest', 'Other'];

  const state = {
    origins: [],
    destinations: [],
    settings: {
      mode: 'DRIVING',
      departureTime: '08:30',
      traffic: 'RANGE',
      timeWindow: { start: '08:00', end: '10:00', step: 15 },
    },
    results: {
      matrix: {},
      visitAll: {},
    },
  };

  const els = {
    originsList: document.getElementById('originsList'),
    addOriginBtn: document.getElementById('addOriginBtn'),
    modeSelect: document.getElementById('modeSelect'),
    departureTime: document.getElementById('departureTime'),
    trafficSelect: document.getElementById('trafficSelect'),
    windowStart: document.getElementById('windowStart'),
    windowEnd: document.getElementById('windowEnd'),
    windowStep: document.getElementById('windowStep'),

    addDestBtn: document.getElementById('addDestBtn'),
    bulkAddBtn: document.getElementById('bulkAddBtn'),
    importCsvBtn: document.getElementById('importCsvBtn'),
    importCsvInput: document.getElementById('importCsvInput'),
    clearDestBtn: document.getElementById('clearDestBtn'),
    destinationsList: document.getElementById('destinationsList'),

    computeBtn: document.getElementById('computeBtn'),
    elementsCounter: document.getElementById('elementsCounter'),
    tabTable: document.getElementById('tabTable'),
    tabVisitAll: document.getElementById('tabVisitAll'),
    resultsTable: document.getElementById('resultsTable'),
    visitAllContainer: document.getElementById('visitAllContainer'),
    summaryTile: document.getElementById('summaryTile'),

    filterCategory: document.getElementById('filterCategory'),
    filterWinner: document.getElementById('filterWinner'),
    filterDelta: document.getElementById('filterDelta'),
    filterDeltaValue: document.getElementById('filterDeltaValue'),

    bulkDialog: document.getElementById('bulkDialog'),
    bulkTextarea: document.getElementById('bulkTextarea'),
    bulkSubmit: document.getElementById('bulkSubmit'),

    mapEl: document.getElementById('map'),
    mapLegend: document.getElementById('mapLegend'),
  };

  let map, googleMarkers = { origins: {}, destinations: {} }, googlePolylines = [];

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

  function init() {
    // Default origins (2)
    addOriginRow({ label: 'Current home', key: 'A' });
    addOriginRow({ label: 'New home', key: 'B' });

    // Default destinations (3 empty)
    for (let i = 0; i < 3; i++) addDestinationRow();

    bindEvents();
    updateElementsCounter();
    renderLegend();
    initMap();
  }

  function bindEvents() {
    els.addOriginBtn.addEventListener('click', () => addOriginRow());
    document.querySelectorAll('.chip[data-time]').forEach(chip => {
      chip.addEventListener('click', () => {
        els.departureTime.value = chip.dataset.time;
        state.settings.departureTime = els.departureTime.value;
      });
    });
    els.modeSelect.addEventListener('change', () => state.settings.mode = els.modeSelect.value);
    els.departureTime.addEventListener('change', () => state.settings.departureTime = els.departureTime.value);
    els.trafficSelect.addEventListener('change', () => state.settings.traffic = els.trafficSelect.value);
    els.windowStart.addEventListener('change', () => state.settings.timeWindow.start = els.windowStart.value);
    els.windowEnd.addEventListener('change', () => state.settings.timeWindow.end = els.windowEnd.value);
    els.windowStep.addEventListener('change', () => state.settings.timeWindow.step = Number(els.windowStep.value));

    els.addDestBtn.addEventListener('click', () => addDestinationRow());
    els.bulkAddBtn.addEventListener('click', () => els.bulkDialog.showModal());
    els.bulkSubmit.addEventListener('click', onBulkSubmit);
    els.importCsvBtn.addEventListener('click', () => els.importCsvInput.click());
    els.importCsvInput.addEventListener('change', onImportCsv);
    els.clearDestBtn.addEventListener('click', () => { state.destinations = []; renderDestinations(); updateElementsCounter(); });

    els.computeBtn.addEventListener('click', onCompute);
    els.tabTable.addEventListener('click', () => switchTab('table'));
    els.tabVisitAll.addEventListener('click', () => switchTab('visit'));

    els.filterCategory.addEventListener('change', renderResultsTable);
    els.filterWinner.addEventListener('change', renderResultsTable);
    els.filterDelta.addEventListener('input', () => {
      els.filterDeltaValue.textContent = els.filterDelta.value;
      renderResultsTable();
    });
  }

  function addOriginRow(opts = {}) {
    if (state.origins.length >= 3) return;
    const id = uid('origin');
    const index = state.origins.length;
    const { key, color } = ORIGIN_COLORS[index] || ORIGIN_COLORS[ORIGIN_COLORS.length - 1];
    const label = opts.label || `Origin ${index + 1}`;
    const origin = { id, placeId: null, lat: null, lng: null, address: '', nickname: label, include: true, show: true, color, key };
    state.origins.push(origin);
    renderOrigins();
    updateElementsCounter();
  }

  function renderOrigins() {
    els.originsList.innerHTML = '';
    state.origins.forEach((o, idx) => {
      const row = document.createElement('div');
      row.className = 'origin-row';
      row.dataset.originId = o.id;
      row.innerHTML = `
        <div class="origin-color" style="background:${o.color}" aria-hidden="true"></div>
        <div class="form-field origin-address">
          <label for="origin_address_${o.id}">${idx === 0 ? 'Current home' : idx === 1 ? 'New home' : 'Starting point'}</label>
          <input id="origin_address_${o.id}" class="origin-address" type="text" placeholder="Enter address" value="${o.address ?? ''}">
          <div class="error" data-error="address" hidden>Address is required</div>
        </div>
        <div class="origin-meta">
          <div class="form-field">
            <label for="origin_nick_${o.id}">Nickname</label>
            <input id="origin_nick_${o.id}" class="origin-nickname" type="text" placeholder="e.g., Old home" value="${o.nickname ?? ''}">
          </div>
          <label class="row"><input type="checkbox" class="origin-show" ${o.show ? 'checked' : ''}> Show on map</label>
          <label class="row"><input type="checkbox" class="origin-include" ${o.include ? 'checked' : ''}> Include in comparison</label>
        </div>`;

      const addressInput = row.querySelector('input.origin-address');
      const nickInput = row.querySelector('input.origin-nickname');
      const includeCb = row.querySelector('input.origin-include');
      const showCb = row.querySelector('input.origin-show');

      addressInput.addEventListener('input', () => { o.address = addressInput.value; validateOrigins(); updateElementsCounter(); });
      nickInput.addEventListener('input', () => { o.nickname = nickInput.value; renderLegend(); renderResultsTable(); });
      includeCb.addEventListener('change', () => { o.include = includeCb.checked; updateElementsCounter(); renderLegend(); renderResultsTable(); drawDefaultLines(); });
      showCb.addEventListener('change', () => { o.show = showCb.checked; renderLegend(); drawMarkers(); drawDefaultLines(); });

      // TODO: Integrate Google Places Autocomplete to fill placeId/lat/lng when USE_MOCKS === false

      els.originsList.appendChild(row);
    });
  }

  function validateOrigins() {
    const rows = els.originsList.querySelectorAll('.origin-row');
    rows.forEach(row => {
      const input = row.querySelector('input.origin-address');
      const error = row.querySelector('[data-error="address"]');
      const has = input.value.trim().length > 0;
      error.hidden = has;
    });
  }

  function addDestinationRow(values) {
    const id = uid('dest');
    const dest = { id, placeId: null, lat: null, lng: null, address: '', category: 'Other', nickname: '' };
    if (values) Object.assign(dest, values);
    state.destinations.push(dest);
    renderDestinations();
    updateElementsCounter();
  }

  function renderDestinations() {
    els.destinationsList.innerHTML = '';
    state.destinations.forEach(d => {
      const row = document.createElement('div');
      row.className = 'destination-row';
      row.dataset.destId = d.id;
      row.innerHTML = `
        <div class="form-field">
          <label for="dest_address_${d.id}">Address</label>
          <input id="dest_address_${d.id}" class="dest-address" type="text" placeholder="Enter address" value="${d.address || ''}">
        </div>
        <div class="form-field">
          <label for="dest_category_${d.id}">Category</label>
          <select id="dest_category_${d.id}" class="dest-category">
            ${CATEGORIES.map(c => `<option value="${c}" ${d.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="dest_nick_${d.id}">Nickname</label>
          <input id="dest_nick_${d.id}" class="dest-nickname" type="text" placeholder="e.g., Office" value="${d.nickname || ''}">
        </div>
        <button class="btn btn-icon" title="Remove" aria-label="Remove destination">✕</button>
      `;

      const addr = row.querySelector('input.dest-address');
      const cat = row.querySelector('select.dest-category');
      const nick = row.querySelector('input.dest-nickname');
      const removeBtn = row.querySelector('button');

      addr.addEventListener('input', () => { d.address = addr.value; updateElementsCounter(); });
      cat.addEventListener('change', () => { d.category = cat.value; renderLegend(); renderResultsTable(); drawMarkers(); });
      nick.addEventListener('input', () => { d.nickname = nick.value; renderResultsTable(); drawMarkers(); });
      removeBtn.addEventListener('click', () => { state.destinations = state.destinations.filter(x => x.id !== d.id); renderDestinations(); updateElementsCounter(); drawMarkers(); drawDefaultLines(); });

      // TODO: Integrate Google Places Autocomplete to fill placeId/lat/lng when USE_MOCKS === false

      els.destinationsList.appendChild(row);
    });
  }

  function updateElementsCounter() {
    const originsIncluded = state.origins.filter(o => o.include).length;
    const destValid = state.destinations.filter(d => (d.address || '').trim().length > 0).length;
    els.elementsCounter.textContent = `Elements: ${originsIncluded} × ${destValid}`;
    els.computeBtn.disabled = !(originsIncluded >= 1 && destValid >= 1);
  }

  function onBulkSubmit() {
    const lines = els.bulkTextarea.value.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const appended = [];
    for (const line of lines) {
      const [address = '', categoryRaw = 'Other', nickname = ''] = line.split(',').map(s => s?.trim() ?? '');
      const category = CATEGORIES.includes(categoryRaw) ? categoryRaw : 'Other';
      if (address) appended.push({ address, category, nickname });
    }
    appended.forEach(v => addDestinationRow(v));
    els.bulkTextarea.value = '';
    els.bulkDialog.close();
  }

  function onImportCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const rows = csvParse(text);
      rows.forEach(r => {
        const category = CATEGORIES.includes(r.category) ? r.category : 'Other';
        addDestinationRow({ address: r.address || '', category, nickname: r.nickname || '' });
      });
      e.target.value = '';
    }
    reader.readAsText(file);
  }

  function csvParse(text) {
    // simple CSV with headers address,category,nickname
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => row[h] = cols[idx] ?? '');
      out.push({ address: row.address || '', category: row.category || 'Other', nickname: row.nickname || '' });
    }
    return out;
  }

  function splitCsvLine(line) {
    const result = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    result.push(cur.trim());
    return result;
  }

  function switchTab(which) {
    const isTable = which === 'table';
    els.tabTable.classList.toggle('active', isTable);
    els.tabVisitAll.classList.toggle('active', !isTable);
    els.tabTable.setAttribute('aria-selected', String(isTable));
    els.tabVisitAll.setAttribute('aria-selected', String(!isTable));
    els.resultsTable.hidden = !isTable;
    els.visitAllContainer.hidden = isTable;
  }

  function onCompute() {
    validateOrigins();
    // Basic validation
    const anyInvalid = Array.from(els.originsList.querySelectorAll('.origin-row')).some(row => {
      const input = row.querySelector('input.origin-address');
      return input.value.trim().length === 0;
    });
    if (anyInvalid) return;

    if (USE_MOCKS) computeMocks();
    else {
      // TODO: Integrate Places and Routes API matrix + waypoint optimization
      alert('TODO: Integrate live data sources. Running mock instead.');
      computeMocks();
    }
  }

  function computeMocks() {
    const includedOrigins = state.origins.filter(o => o.include);
    const validDest = state.destinations.filter(d => (d.address || '').trim().length > 0);
    state.results.matrix = {};
    includedOrigins.forEach(o => {
      state.results.matrix[o.id] = {};
      validDest.forEach((d, i) => {
        const seed = (o.key.charCodeAt(0) * 31 + i * 17) % 97;
        const bestGuess = 10 + (seed % 40);
        const optimistic = Math.max(5, bestGuess - 5 - (seed % 5));
        const pessimistic = bestGuess + 5 + (seed % 10);
        const distance = 1000 * (seed % 25 + 2);
        state.results.matrix[o.id][d.id] = {
          bestGuessMin: bestGuess,
          optimisticMin: optimistic,
          pessimisticMax: pessimistic,
          distanceMeters: distance,
          path: mockPolyline(o, d, i)
        };
      });
    });

    state.results.visitAll = {};
    includedOrigins.forEach(o => {
      const order = validDest.map(d => d.id);
      const total = order.reduce((acc, id) => acc + (state.results.matrix[o.id][id]?.bestGuessMin ?? 0), 0);
      const dist = order.reduce((acc, id) => acc + (state.results.matrix[o.id][id]?.distanceMeters ?? 0), 0);
      state.results.visitAll[o.id] = { order, totalMinutes: total, totalDistanceMeters: dist };
    });

    renderSummary();
    renderResultsTable();
    renderVisitAll();
    drawMarkers();
    drawDefaultLines();
  }

  function renderSummary() {
    const included = state.origins.filter(o => o.include);
    const dest = state.destinations.filter(d => (d.address || '').trim().length > 0);
    if (!included.length || !dest.length) { els.summaryTile.textContent = ''; return; }
    const totals = included.map(o => ({ o, total: (state.results.visitAll[o.id]?.totalMinutes) ?? Infinity }));
    totals.sort((a, b) => a.total - b.total);
    const best = totals[0];
    if (!isFinite(best.total)) { els.summaryTile.textContent = ''; return; }
    els.summaryTile.textContent = `At ${state.settings.departureTime} ${state.settings.mode.toLowerCase()}, best candidate: ${best.o.nickname || best.o.key} by ${Math.round(Math.max(0, totals[1]?.total - best.total || 0))} minutes total.`;
  }

  function renderResultsTable() {
    const wrapper = els.resultsTable.querySelector('.table-wrapper');
    wrapper.innerHTML = '';

    const includedOrigins = state.origins.filter(o => o.include);
    const validDest = state.destinations.filter(d => (d.address || '').trim().length > 0);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const headerRow = document.createElement('tr');

    const ths = [
      'Category', 'Place',
      ...includedOrigins.map(o => `From: ${o.nickname || o.key}`),
      'Δ minutes', 'Δ %', 'Winner'
    ];
    ths.forEach((h, i) => {
      const th = document.createElement('th');
      th.textContent = h;
      th.classList.add('sortable');
      th.dataset.colIndex = String(i);
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => onSortClick(i));
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const activeCategories = new Set(Array.from(els.filterCategory.selectedOptions || []).map(o => o.value));
    const winnerFilter = els.filterWinner.value;
    const deltaMin = Number(els.filterDelta.value || 0);

    const rowsData = [];
    validDest.forEach(d => {
      const row = document.createElement('tr');
      row.tabIndex = 0;
      // Category
      const tdCat = document.createElement('td');
      tdCat.appendChild(categoryIcon(d.category));
      row.appendChild(tdCat);
      // Place
      const tdPlace = document.createElement('td');
      tdPlace.textContent = d.nickname || d.address || 'Destination';
      row.appendChild(tdPlace);

      const times = includedOrigins.map(o => state.results.matrix[o.id]?.[d.id]);
      const bestGuessList = times.map(t => t?.bestGuessMin ?? Infinity);
      const minTime = Math.min(...bestGuessList);
      const maxTime = Math.max(...bestGuessList);
      const winnerIdx = bestGuessList.indexOf(minTime);
      const winnerKey = includedOrigins[winnerIdx]?.key ?? '';
      const delta = (includedOrigins[1] && isFinite(bestGuessList[0]) && isFinite(bestGuessList[1])) ? (bestGuessList[1] - bestGuessList[0]) : 0;
      const deltaPct = (includedOrigins[1] && isFinite(bestGuessList[0]) && bestGuessList[0] > 0) ? (delta / bestGuessList[0] * 100) : 0;

      // Filters
      if (activeCategories.size && !activeCategories.has(d.category)) return;
      if (winnerFilter && winnerFilter !== winnerKey) return;
      if (Math.abs(delta) < deltaMin) return;

      // Origin columns
      includedOrigins.forEach((o, idx) => {
        const td = document.createElement('td');
        const t = times[idx];
        if (!t) td.textContent = '-';
        else {
          if (state.settings.traffic === 'RANGE') td.textContent = `${t.optimisticMin}–${t.pessimisticMax} min`;
          else td.textContent = `${t.bestGuessMin} min`;
        }
        td.style.color = o.color;
        row.appendChild(td);
      });

      // Delta columns (use first two origins for Now vs New comparison)
      const tdDelta = document.createElement('td');
      tdDelta.textContent = isFinite(delta) ? `${delta > 0 ? '+' : ''}${Math.round(delta)} min` : '-';
      row.appendChild(tdDelta);
      const tdPct = document.createElement('td');
      tdPct.textContent = isFinite(deltaPct) ? `${deltaPct > 0 ? '+' : ''}${Math.round(deltaPct)} %` : '-';
      row.appendChild(tdPct);

      const tdWin = document.createElement('td');
      const badge = document.createElement('span');
      const badgeClass = winnerKey === 'A' ? 'badge-a' : winnerKey === 'B' ? 'badge-b' : 'badge-c';
      badge.className = `badge ${badgeClass}`;
      badge.textContent = winnerKey || '-';
      tdWin.appendChild(badge);
      row.appendChild(tdWin);

      row.addEventListener('mouseenter', () => highlightRoutesFor(d.id));
      row.addEventListener('mouseleave', () => drawDefaultLines());
      row.addEventListener('click', () => focusDestination(d.id));

      rowsData.push({ d, row, bestGuessList, delta, deltaPct, winnerKey, placeText: tdPlace.textContent });
    });

    // Sorting
    const sort = state.tableSort || { col: 1, dir: 'asc' };
    rowsData.sort((a, b) => compareRows(a, b, sort, includedOrigins.length));
    rowsData.forEach(r => tbody.appendChild(r.row));

    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    els.resultsTable.hidden = false;
  }

  function onSortClick(colIndex) {
    const sort = state.tableSort || { col: 1, dir: 'asc' };
    if (sort.col === colIndex) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    else { sort.col = colIndex; sort.dir = 'asc'; }
    state.tableSort = sort;
    renderResultsTable();
  }

  function compareRows(a, b, sort, originCols) {
    const col = sort.col;
    const dir = sort.dir === 'asc' ? 1 : -1;
    if (col === 0) return dir * a.d.category.localeCompare(b.d.category);
    if (col === 1) return dir * a.placeText.localeCompare(b.placeText);
    if (col >= 2 && col < 2 + originCols) {
      const i = col - 2;
      const av = a.bestGuessList[i] ?? Infinity;
      const bv = b.bestGuessList[i] ?? Infinity;
      return dir * ((av === bv) ? 0 : (av < bv ? -1 : 1));
    }
    if (col === 2 + originCols) return dir * ((a.delta === b.delta) ? 0 : (a.delta < b.delta ? -1 : 1));
    if (col === 3 + originCols) return dir * ((a.deltaPct === b.deltaPct) ? 0 : (a.deltaPct < b.deltaPct ? -1 : 1));
    if (col === 4 + originCols) return dir * a.winnerKey.localeCompare(b.winnerKey);
    return 0;
  }

  function renderVisitAll() {
    const container = els.visitAllContainer;
    container.innerHTML = '';
    const included = state.origins.filter(o => o.include);
    included.forEach(o => {
      const r = state.results.visitAll[o.id];
      if (!r) return;
      const card = document.createElement('div');
      card.className = 'visit-card';
      card.innerHTML = `
        <div class="visit-header">
          <div class="row">
            <div class="legend-swatch" style="background:${o.color}"></div>
            <strong>${o.nickname || o.key}</strong>
          </div>
          <div class="muted">Total: ${Math.round(r.totalMinutes)} min, ${(r.totalDistanceMeters/1000).toFixed(1)} km</div>
        </div>
        <ol class="visit-stops">${r.order.map((id, i) => `<li>${state.destinations.find(d => d.id===id)?.nickname || 'Stop ' + (i+1)}</li>`).join('')}</ol>
        <div class="row">
          <a class="btn btn-secondary" target="_blank" rel="noopener" href="${buildGoogleLink(o, r.order)}">Open in Google Maps</a>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function buildGoogleLink(origin, order) {
    // Placeholder deep link with waypoints
    const base = 'https://www.google.com/maps/dir/';
    const parts = ['Origin'].concat(order.map((id, i) => encodeURIComponent(state.destinations.find(d => d.id===id)?.nickname || `Stop ${i+1}`)));
    return `${base}${parts.join('/')}`;
  }

  // Map
  function initMap() {
    if (!window.google || !google.maps) {
      // Fallback mock map box
      els.mapEl.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#6b7280">Load Google Maps JS API to see the map</div>';
      return;
    }
    map = new google.maps.Map(els.mapEl, { center: { lat: 37.7749, lng: -122.4194 }, zoom: 11, mapId: 'DEMO_MAP' });
    drawMarkers();
    drawDefaultLines();
  }

  function drawMarkers() {
    // Clear
    if (!window.google || !google.maps) return;
    Object.values(googleMarkers.origins).forEach(m => m.setMap(null));
    Object.values(googleMarkers.destinations).forEach(m => m.setMap(null));
    googleMarkers = { origins: {}, destinations: {} };

    const basePos = { lat: 37.7749, lng: -122.4194 };
    const spread = 0.02;

    state.origins.forEach((o, idx) => {
      if (!o.show) return;
      const pos = { lat: basePos.lat + (idx - 1) * spread, lng: basePos.lng + (idx - 1) * spread };
      const marker = new google.maps.Marker({
        map, position: pos, label: { text: o.key, color: '#0b1020', fontWeight: '700' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10, fillColor: o.color, fillOpacity: 1, strokeWeight: 2, strokeColor: '#0b1020'
        },
        title: o.nickname || o.key,
      });
      marker.addListener('click', () => { o.show = !o.show; renderLegend(); drawMarkers(); drawDefaultLines(); });
      googleMarkers.origins[o.id] = marker;
    });

    state.destinations.forEach((d, i) => {
      const hasLabel = ((d.address || '').trim().length > 0) || ((d.nickname || '').trim().length > 0);
      if (!hasLabel) return;
      const pos = { lat: basePos.lat + Math.sin(i) * spread * 2, lng: basePos.lng + Math.cos(i) * spread * 2 };
      const marker = new google.maps.Marker({ map, position: pos, icon: categoryMarkerIcon(d.category), title: d.nickname || d.address || 'Destination' });
      googleMarkers.destinations[d.id] = marker;
    });

    fitBounds();
  }

  function categoryMarkerIcon(category) {
    const svg = encodeURIComponent(svgForCategory(category));
    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new google.maps.Size(26, 26),
      anchor: new google.maps.Point(13, 13)
    };
  }

  function svgForCategory(category) {
    const color = '#e7eaf0';
    const bg = '#0b1020AA';
    const icon = category === 'Work' ? ' ' : '';
    // Simple monochrome set
    const path = {
      Work: '<path d="M8 10h10v8H8z"/><path d="M10 8h6v2h-6z"/>',
      School: '<path d="M4 10l9-5 9 5-9 5z"/><path d="M7 12v5l6 3 6-3v-5"/>',
      Shop: '<path d="M6 10h14l-2 10H8z"/><path d="M7 10l2-4h10l2 4"/>',
      Rest: '<circle cx="12" cy="12" r="8"/>',
      Other: '<circle cx="12" cy="12" r="6"/>',
    }[category] || '<circle cx="12" cy="12" r="6"/>';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
  <rect x="1" y="1" width="22" height="22" rx="6" ry="6" fill="${bg}" stroke="#2a3142"/>
  ${path}
</svg>`;
  }

  function categoryIcon(category) {
    const span = document.createElement('span');
    span.innerHTML = svgForCategory(category);
    const svg = span.firstChild;
    if (svg && svg.setAttribute) {
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
    }
    return span.firstChild || document.createTextNode(category);
  }

  function renderLegend() {
    els.mapLegend.innerHTML = '';
    const wrap = document.createElement('div');
    // Origins
    ORIGIN_COLORS.forEach((o, idx) => {
      const row = document.createElement('div');
      row.className = 'legend-row';
      const label = state.origins[idx]?.nickname || o.key;
      row.innerHTML = `<span class="legend-swatch" style="background:${o.color}"></span> <span>${o.key}: ${label || ''}</span>`;
      wrap.appendChild(row);
    });
    const cg = document.createElement('div');
    cg.className = 'legend-group legend-icons';
    cg.innerHTML = `
      <div class="muted">Categories</div><div></div>
      ${CATEGORIES.map(c => `<span>${inlineSvg(svgForCategory(c))}</span><span>${c}</span>`).join('')}
    `;
    wrap.appendChild(cg);

    const routesGroup = document.createElement('div');
    routesGroup.className = 'legend-group';
    routesGroup.innerHTML = `
      <label class="row"><input type="checkbox" checked> Routes from A</label>
      <label class="row"><input type="checkbox" checked> Routes from B</label>
      <label class="row"><input type="checkbox" checked> Routes from C</label>
      <label class="row"><input type="checkbox"> Visit-all A</label>
      <label class="row"><input type="checkbox"> Visit-all B</label>
      <label class="row"><input type="checkbox"> Visit-all C</label>
    `;
    wrap.appendChild(routesGroup);
    els.mapLegend.appendChild(wrap);
  }

  function inlineSvg(svgText) {
    const span = document.createElement('span');
    span.innerHTML = svgText;
    return span.innerHTML;
  }

  function fitBounds() {
    if (!window.google || !google.maps) return;
    const bounds = new google.maps.LatLngBounds();
    const markers = [...Object.values(googleMarkers.origins), ...Object.values(googleMarkers.destinations)];
    if (!markers.length) return;
    markers.forEach(m => bounds.extend(m.getPosition()));
    map.fitBounds(bounds, 60);
  }

  function drawDefaultLines() {
    if (!window.google || !google.maps) return;
    clearPolylines();
    const included = state.origins.filter(o => o.include && o.show);
    const validDest = state.destinations.filter(d => (d.address || '').trim().length > 0);
    included.forEach(o => {
      validDest.forEach((d, i) => {
        const seg = state.results.matrix[o.id]?.[d.id]?.path || mockPolyline(o, d, i);
        drawPolyline(seg, o.color, 0.25);
      });
    });
  }

  function highlightRoutesFor(destId) {
    if (!window.google || !google.maps) return;
    clearPolylines();
    const included = state.origins.filter(o => o.include && o.show);
    included.forEach((o, i) => {
      const seg = state.results.matrix[o.id]?.[destId]?.path || mockPolyline(o, { id: destId }, i);
      drawPolyline(seg, o.color, 0.9, 6);
    });
  }

  function focusDestination(destId) {
    if (!window.google || !google.maps) return;
    const m = googleMarkers.destinations[destId];
    if (m) { map.panTo(m.getPosition()); map.setZoom(Math.max(map.getZoom(), 13)); }
  }

  function drawPolyline(path, color, opacity = 0.6, weight = 3) {
    if (!window.google || !google.maps) return;
    const poly = new google.maps.Polyline({ path, strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, map });
    googlePolylines.push(poly);
  }
  function clearPolylines() {
    googlePolylines.forEach(p => p.setMap(null));
    googlePolylines = [];
  }

  function mockPolyline(o, d, i = 0) {
    // Generate a small zig-zag path around SF center for demo purposes
    const base = { lat: 37.7749, lng: -122.4194 };
    const off = 0.01 + (i % 5) * 0.003;
    const hue = (o.key.charCodeAt(0) * 17 + i * 13) % 360;
    const path = [
      { lat: base.lat + (i - 1) * 0.02, lng: base.lng + (i - 1) * 0.02 },
      { lat: base.lat + off, lng: base.lng - off },
      { lat: base.lat - off, lng: base.lng + off },
      { lat: base.lat + off * 1.2, lng: base.lng + off * 0.6 },
    ];
    return path;
  }

  // Expose callback hook for Google Maps script if added
  window.onGoogleMapsReady = () => initMap();

  // Initialize UI
  document.addEventListener('DOMContentLoaded', init);
})();


