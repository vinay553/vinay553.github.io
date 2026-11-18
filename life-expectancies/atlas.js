'use strict';

const byId = id => document.getElementById(id);
const map = byId('map');
const context = map.getContext('2d');
const baseLayer = document.createElement('canvas');
const baseContext = baseLayer.getContext('2d');
const tooltip = byId('tooltip');
const query = byId('query');
const results = byId('results');
const number = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent', maximumFractionDigits: 1
});
const marks = ['<72', '72–75', '75–78', '78–81', '81–84', '84+'];
const colors = ['#e6b280', '#f3d7a0', '#e6ecbc', '#b2d0ac', '#74a99b', '#33766c'];
const color = d3.scaleThreshold([72, 75, 78, 81, 84], colors);
const noData = '#e0dfd8';
const normalize = value => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ');

let width, height, pixelRatio, countyShapes, statePath, dataset, mapData, stateData;
let counties, countyById, stateNames, selected, hovered, drag;
let metric = 'observed';
let paintedView, paintedMetric;
let view = {scale: 1, x: 0, y: 0};

async function load(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

async function start() {
  [dataset, mapData, stateData] = await Promise.all([
    load('data/county-data.json'), load('data/counties.json'), load('data/states.json')
  ]);
  stateNames = Object.fromEntries(stateData.features.map(({properties}) => [properties.abbr, properties.name]));
  counties = Object.entries(dataset.counties).map(([id, stats]) => ({
    ...stats, id, label: `${stats.name}, ${stats.state}`,
    search: normalize(`${stats.name} ${stats.state} ${stateNames[stats.state]} ${id}`)
  })).sort((a, b) => a.label.localeCompare(b.label));
  countyById = new Map(counties.map(county => [county.id, county]));
  byId('load-status').hidden = true;
  byId('explorer').hidden = false;
  const {n, baseline, r2} = dataset.model;
  byId('model-summary').textContent =
    `The model uses ${number.format(n)} counties. Their average unadjusted estimate is ${baseline.toFixed(1)} years. The predictors explain ${percent.format(r2)} of the variation across those counties.`;
  byId('legend').replaceChildren(...marks.map((label, index) => {
    const item = document.createElement('div');
    const swatch = document.createElement('i');
    swatch.style.background = colors[index];
    swatch.setAttribute('aria-hidden', 'true');
    item.append(swatch, label);
    return item;
  }));
  select(new URLSearchParams(location.search).get('county') || '06001', false);
  new ResizeObserver(rebuildMap).observe(map);
}

function rebuildMap() {
  const size = map.getBoundingClientRect();
  if (size.width === width && size.height === height) return;
  width = size.width;
  height = size.height;
  pixelRatio = window.devicePixelRatio || 1;
  map.width = Math.round(width * pixelRatio);
  map.height = Math.round(height * pixelRatio);
  baseLayer.width = map.width;
  baseLayer.height = map.height;
  const padding = Math.min(24, width * .048);
  const projection = d3.geoAlbersUsa().fitExtent([[padding, padding], [width - padding, height - padding]], stateData);
  const path = d3.geoPath(projection);
  countyShapes = mapData.features.flatMap(feature => {
    const shape = path(feature);
    if (!shape) return [];
    return [{id: feature.id, path: new Path2D(shape), bounds: path.bounds(feature)}];
  });
  statePath = new Path2D(path(stateData));
  setView(1, 0, 0);
}

function positionContext(layer) {
  layer.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  layer.translate(view.x, view.y);
  layer.scale(view.scale, view.scale);
  layer.lineJoin = 'round';
}

function paintCounties() {
  baseContext.resetTransform();
  baseContext.clearRect(0, 0, baseLayer.width, baseLayer.height);
  positionContext(baseContext);
  baseContext.lineWidth = .35 / view.scale;
  baseContext.strokeStyle = '#f7f8f2';
  const left = -view.x / view.scale;
  const top = -view.y / view.scale;
  const right = left + width / view.scale;
  const bottom = top + height / view.scale;
  for (const shape of countyShapes) {
    const [[x0, y0], [x1, y1]] = shape.bounds;
    if (x1 < left || x0 > right || y1 < top || y0 > bottom) continue;
    const value = countyById.get(shape.id)[metric];
    baseContext.fillStyle = value === null ? noData : color(value);
    baseContext.fill(shape.path);
    baseContext.stroke(shape.path);
  }
  baseContext.lineWidth = .7 / view.scale;
  baseContext.strokeStyle = '#496254';
  baseContext.stroke(statePath);
  paintedView = view;
  paintedMetric = metric;
}

function draw() {
  if (!countyShapes) return;
  if (paintedView !== view || paintedMetric !== metric) paintCounties();
  context.resetTransform();
  context.clearRect(0, 0, map.width, map.height);
  context.drawImage(baseLayer, 0, 0);
  positionContext(context);
  for (const [id, stroke, lineWidth] of [[hovered, '#1f3f34', 1.15], [selected, '#1f3f34', 2]]) {
    const shape = countyShapes.find(item => item.id === id);
    if (shape) {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth / view.scale;
      context.stroke(shape.path);
    }
  }
}

function setView(scale, x, y) {
  view = {
    scale,
    x: Math.max(width * (1 - scale), Math.min(x, 0)),
    y: Math.max(height * (1 - scale), Math.min(y, 0))
  };
  hovered = null;
  tooltip.hidden = true;
  map.classList.toggle('can-pan', scale > 1);
  byId('zoom-out').disabled = scale === 1;
  byId('zoom-in').disabled = scale === 10;
  draw();
}

function zoom(factor) {
  const scale = Math.max(1, Math.min(10, view.scale * factor));
  const ratio = scale / view.scale;
  setView(scale, width / 2 + (view.x - width / 2) * ratio, height / 2 + (view.y - height / 2) * ratio);
}

function locationOnMap(event) {
  const rect = map.getBoundingClientRect();
  return {x: event.clientX - rect.left, y: event.clientY - rect.top};
}

function pick(point) {
  if (!countyShapes) return null;
  const x = (point.x - view.x) / view.scale;
  const y = (point.y - view.y) / view.scale;
  context.save();
  context.resetTransform();
  const match = countyShapes.find(({bounds: [[left, top], [right, bottom]], path}) =>
    x >= left && x <= right && y >= top && y <= bottom && context.isPointInPath(path, x, y));
  context.restore();
  return match?.id || null;
}

function lifeValue(value) {
  return value === null ? '—' : `${value.toFixed(1)} <small>yrs</small>`;
}

function populationValue(county) {
  return county.population == null ? '—' : number.format(county.population);
}

function select(id, share = true) {
  const county = countyById.get(id) || countyById.get('06001') || counties[0];
  selected = county.id;
  if (share) {
    const url = new URL(location.href);
    url.searchParams.set('county', county.id);
    history.replaceState(null, '', url);
  }
  const profile = byId('profile');
  profile.innerHTML = `
    <div class="eyebrow" id="profile-state"></div>
    <h2 id="profile-name"></h2>
    <dl>
      <div><dt>Unadjusted</dt><dd>${lifeValue(county.observed)}</dd></div>
      <div><dt>Adjusted</dt><dd>${lifeValue(county.adjusted)}</dd></div>
    </dl>
    <p class="coverage" id="tract-coverage"></p>
    <div class="county-facts">
      <div><span>Population <small>(2011–2015 ACS)</small></span>
        <strong>${populationValue(county)}</strong></div>
      <div><span>Median household income <small>(2015 dollars)</small></span>
        <strong>${county.income ? money.format(county.income) : '—'}</strong></div>
    </div>
    <h3>Race and ethnicity</h3>
    <ul class="race"></ul>
    <p class="race-note">2011–2015 ACS. Hispanic or Latino includes any race. All other groups are non-Hispanic.</p>`;
  byId('profile-state').textContent = stateNames[county.state];
  byId('profile-name').textContent = county.name;
  byId('tract-coverage').textContent = county.coverage === null
    ? 'No comparable tract population available.'
    : `Tract coverage: ${percent.format(county.coverage)} of 2010 residents.${county.coverage < dataset.model.minCoverage ? ' At least 80% is required.' : ''}`;
  const list = profile.querySelector('.race');
  if (county.race) {
    county.race.forEach((share, index) => {
      const row = document.createElement('li');
      row.innerHTML = '<span class="race-label"><span></span><span class="race-value"></span></span><span class="bar" aria-hidden="true"><i></i></span>';
      row.querySelector('.race-label span').textContent = dataset.model.raceLabels[index];
      row.querySelector('.race-value').textContent = percent.format(share);
      row.querySelector('i').style.width = percent.format(share);
      list.append(row);
    });
  } else {
    const row = document.createElement('li');
    row.textContent = 'No demographic estimate available.';
    list.append(row);
  }
  draw();
}

function search() {
  if (!counties) return;
  const term = normalize(query.value).trim().replace(/ +/g, ' ');
  const words = term.split(' ').filter(Boolean);
  results.replaceChildren();
  results.hidden = !words.length;
  if (!words.length) return;
  const matches = counties.filter(county => words.every(word => county.search.includes(word)));
  const rank = county => {
    if ([county.name, county.label, county.id].some(value => normalize(value).replace(/ +/g, ' ') === term)) return 0;
    return county.search.startsWith(term) ? 1 : 2;
  };
  const hits = matches.sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  for (const county of hits) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = county.label;
    button.addEventListener('click', () => {
      select(county.id);
      query.value = county.label;
      results.hidden = true;
      query.focus();
    });
    results.append(button);
  }
  if (!hits.length) {
    const status = document.createElement('p');
    status.textContent = 'No matching counties.';
    results.append(status);
  }
}

document.querySelectorAll('input[name=metric]').forEach(input => input.addEventListener('change', () => {
  metric = input.value;
  byId('legend-context').textContent = metric === 'observed' ? 'Unadjusted · years' : 'Adjusted · years';
  draw();
}));
query.addEventListener('input', search);
query.addEventListener('keydown', event => {
  if (event.key === 'Escape') results.hidden = true;
});
byId('find').addEventListener('submit', event => {
  event.preventDefault();
  if (!results.hidden) results.querySelector('button')?.click();
});
document.addEventListener('pointerdown', event => {
  if (!byId('find').contains(event.target)) results.hidden = true;
});
document.addEventListener('focusin', event => {
  if (!byId('find').contains(event.target)) results.hidden = true;
});

byId('zoom-in').addEventListener('click', () => zoom(1.65));
byId('zoom-out').addEventListener('click', () => zoom(1 / 1.65));
byId('reset').addEventListener('click', () => setView(1, 0, 0));
map.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const {x, y} = locationOnMap(event);
  drag = {x, y, originX: view.x, originY: view.y, moved: false};
  map.setPointerCapture(event.pointerId);
});
map.addEventListener('pointermove', event => {
  const point = locationOnMap(event);
  if (drag) {
    const dx = point.x - drag.x;
    const dy = point.y - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved && view.scale > 1) {
      map.classList.add('dragging');
      setView(view.scale, drag.originX + dx, drag.originY + dy);
    }
    return;
  }
  const id = pick(point);
  if (id !== hovered) {
    hovered = id;
    draw();
  }
  tooltip.hidden = !id || event.pointerType === 'touch';
  if (!tooltip.hidden) {
    const county = countyById.get(id);
    const value = county[metric];
    const life = value === null ? 'No estimate' : value.toFixed(1) + ' years';
    tooltip.textContent = `${county.label} · ${life} · Population ${populationValue(county)}`;
    tooltip.style.left = `${Math.max(4, Math.min(point.x + 12, width - tooltip.offsetWidth - 4))}px`;
    tooltip.style.top = `${Math.max(4, point.y - tooltip.offsetHeight - 9)}px`;
  }
});
map.addEventListener('pointerup', event => {
  if (drag && !drag.moved) {
    const id = pick(locationOnMap(event));
    if (id) {
      query.value = '';
      select(id);
      if (matchMedia('(max-width: 900px)').matches) {
        byId('profile').scrollIntoView({block: 'start'});
      }
    }
  }
  drag = null;
  map.classList.remove('dragging');
});
map.addEventListener('pointercancel', () => {
  drag = null;
  map.classList.remove('dragging');
});
map.addEventListener('pointerleave', () => {
  tooltip.hidden = true;
  hovered = null;
  draw();
});

start().catch(error => {
  byId('load-status').textContent = 'The county data could not load. Reload the page to try again.';
  console.error(error);
});
