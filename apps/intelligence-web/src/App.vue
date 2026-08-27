<template>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">SOLAR OPERATIONS / TERRITORY INTELLIGENCE</p>
        <h1>Deploy tomorrow with evidence.</h1>
        <p class="subtitle">Deterministic sales analytics from every East and West schedule block, with every metric traceable to an appointment record.</p>
      </div>
      <div class="upload-box">
        <label class="upload-button">
          <input type="file" accept=".xlsx" @change="upload" />
          {{ uploading ? "Importing…" : "Import Excel" }}
        </label>
        <select v-model="uploadRegion" aria-label="Upload region">
          <option value="EAST">East</option>
          <option value="WEST">West</option>
        </select>
        <span v-if="uploadMessage" class="upload-message">{{ uploadMessage }}</span>
      </div>
    </header>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <section class="filters panel">
      <div class="filter-heading">
        <div>
          <p class="eyebrow">FILTERS</p>
          <h2>Read the field</h2>
        </div>
        <div class="filter-actions"><span v-if="isAllDataView" class="all-data-badge">All imported data</span><button class="quiet-button" @click="resetFilters">Reset</button></div>
      </div>
      <div class="filter-grid">
        <label>Date from<input v-model="filters.from" type="date" @change="loadDashboard" /></label>
        <label>Date to<input v-model="filters.to" type="date" @change="loadDashboard" /></label>
        <label>Region<select v-model="filters.region" @change="loadDashboard"><option value="">All regions</option><option value="EAST">East</option><option value="WEST">West</option></select></label>
        <label>City<select v-model="filters.city" @change="loadDashboard"><option value="">All cities</option><option v-for="city in filterOptions.cities" :key="city" :value="city">{{ city }}</option></select></label>
        <label>Setter<select v-model="filters.setter" @change="loadDashboard"><option value="">All setters</option><option v-for="setter in filterOptions.setters" :key="setter" :value="setter">{{ setter }}</option></select></label>
        <label>Closer<select v-model="filters.closer" @change="loadDashboard"><option value="">All closers</option><option v-for="closer in filterOptions.closers" :key="closer" :value="closer">{{ closer }}</option></select></label>
        <label>Result<select v-model="filters.result" @change="loadDashboard"><option value="">All results</option><option v-for="result in resultOptions" :key="result.value" :value="result.value">{{ result.label }}</option></select></label>
      </div>
    </section>

    <section v-if="dashboard" class="dashboard-content">
      <div class="context-line">
        <span>Anchor date: <strong>{{ dashboard.anchorDate ?? "No dated appointments" }}</strong></span>
        <span>{{ dashboard.source.appointmentCount.toLocaleString() }} traceable records in view</span>
      </div>

      <section class="kpi-grid">
        <article v-for="card in kpis" :key="card.label" class="kpi panel">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.note }}</small>
        </article>
      </section>

      <section class="two-column">
        <article class="panel chart-panel">
          <div class="section-heading"><div><p class="eyebrow">GEOGRAPHY</p><h2>City / hood ranking</h2></div><span class="section-note">Close rate = smoothed closes ÷ sits</span></div>
          <div class="table-wrap">
            <table><thead><tr><th>Area</th><th>Sets</th><th>Closes</th><th>Close rate</th><th>Confidence</th><th>Opportunity</th></tr></thead>
              <tbody><tr v-for="row in dashboard.ranking.slice(0, 12)" :key="row.key"><td><strong>{{ areaLabel(row) }}</strong><small>{{ row.region }}</small></td><td>{{ row.totalSets }}</td><td>{{ row.closes }}</td><td>{{ pct(row.closeRatePct) }}</td><td><span class="confidence-pill" :class="confidenceClass(row.confidence)">{{ confidenceLabel(row.confidence) }}</span></td><td><span class="priority" :class="row.deploymentPriority.toLowerCase()">{{ row.opportunityScore }}</span></td></tr></tbody>
            </table>
          </div>
        </article>

        <article class="panel chart-panel map-panel">
          <div class="section-heading"><div><p class="eyebrow">GEOSPATIAL FIELD</p><h2>Deployment map</h2></div><select v-model="selectedMapLayer" aria-label="Map layer"><option v-for="layer in mapLayerOptions" :key="layer.value" :value="layer.value">{{ layer.label }}</option></select></div>
          <div class="geo-map" role="img" aria-label="Geospatial territory map">
            <div class="map-tiles"><img v-for="tile in mapTileGrid.tiles" :key="`${tile.x}-${tile.y}`" :src="tile.url" alt="" :style="{ left: `${((tile.x - mapTileGrid.startX) / mapTileGrid.columns) * 100}%`, top: `${((tile.y - mapTileGrid.startY) / mapTileGrid.rows) * 100}%`, width: `${100 / mapTileGrid.columns}%`, height: `${100 / mapTileGrid.rows}%` }" /></div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <g v-for="point in visibleMapPoints" :key="point.key" class="map-point">
                <title>{{ point.label }} · {{ mapLayerOptions.find((layer) => layer.value === selectedMapLayer)?.label }}: {{ layerValue(point).toFixed(1) }} · {{ point.coordinateSource === "PROPERTY" ? "property coordinate" : "city centroid" }}</title>
                <circle :cx="mapX(point)" :cy="mapY(point)" :r="pointRadius(point)" :fill="mapColor(point)" :class="`confidence-${confidenceClass(point.confidence)}`" />
              </g>
            </svg>
            <span class="map-source-note">{{ mapCoordinateNote }}</span>
          </div>
          <div class="legend"><span><i class="dot-key high-dot"></i>Higher layer value</span><span><i class="dot-key low-dot"></i>Lower layer value</span><span><i class="dot-key confidence-dot"></i>Point size = layer magnitude</span></div>
        </article>
      </section>

      <section class="deployment-grid">
        <article class="panel chart-panel deployment-plan">
          <div class="section-heading"><div><p class="eyebrow">TOMORROW'S DEPLOYMENT PLAN</p><h2>Recommended territories</h2></div><span class="section-note">Minimum {{ dashboard.ranking[0]?.minimumSampleSize ?? 10 }} sets</span></div>
          <div v-if="deploymentPlan.recommendations.length" class="recommendation-list">
            <details v-for="(recommendation, index) in deploymentPlan.recommendations" :key="recommendation.territory.key" :open="index === 0" class="recommendation-card">
              <summary><span class="recommendation-rank">0{{ index + 1 }}</span><span class="recommendation-name"><strong>{{ areaLabel(recommendation.territory) }}</strong><small>{{ recommendation.suggestedReps }} rep{{ recommendation.suggestedReps === 1 ? "" : "s" }} · {{ recommendation.recentTrend.replaceAll("_", " ") }}</small></span><span class="recommendation-score">{{ recommendation.territory.opportunityScore }}<small>{{ recommendation.confidence }}</small></span></summary>
              <ul><li v-for="reason in recommendation.reasons" :key="reason">{{ reason }}</li></ul>
              <div class="component-list"><div v-for="component in recommendation.territory.scoreBreakdown.components" :key="component.key" class="component-row"><span>{{ component.label }}<small>{{ component.explanation }}</small></span><b>{{ component.contribution.toFixed(1) }}</b></div></div>
            </details>
          </div>
          <p v-else class="empty-inline">No territory meets the minimum sample threshold yet.</p>
          <p class="methodology">{{ deploymentPlan.methodology[2] }}</p>
        </article>
        <article class="panel chart-panel avoid-panel">
          <div class="section-heading"><div><p class="eyebrow">GUARDRAILS</p><h2>Areas to avoid</h2></div></div>
          <div v-if="deploymentPlan.avoid.length" class="avoid-list"><div v-for="item in deploymentPlan.avoid" :key="item.territory.key" class="avoid-row"><span><strong>{{ areaLabel(item.territory) }}</strong><small>{{ item.reason }}</small></span><b>{{ confidenceLabel(item.confidence) }}</b></div></div>
          <p v-else class="empty-inline">No deterministic avoid signal in this view.</p>
          <p class="methodology">Avoidance is based on cancellation/DQ pressure, declining smoothed momentum, or insufficient sample—not AI recommendations.</p>
        </article>
      </section>

      <section class="panel chart-panel drilldown-panel">
        <div class="section-heading"><div><p class="eyebrow">TERRITORY DRILL-DOWN</p><h2>City → hood → street</h2></div><span class="section-note">Each row links to traceable appointment IDs</span></div>
        <div class="drilldown-controls"><label>City<select v-model="drilldownCity" @change="changeDrilldownCity"><option value="">All cities</option><option v-for="city in filterOptions.cities" :key="city" :value="city">{{ city }}</option></select></label><label>Hood<select v-model="drilldownHood" :disabled="!drilldownCity" @change="loadDrilldown"><option value="">All hoods</option><option v-for="hood in drilldownHoodOptions" :key="hood" :value="hood">{{ hood }}</option></select></label></div>
        <div class="table-wrap"><table><thead><tr><th>Level</th><th>Area</th><th>Sets</th><th>Close rate</th><th>Sit rate</th><th>Cancel / DQ</th><th>Confidence</th><th>Opportunity</th></tr></thead><tbody><tr v-for="node in drilldown?.nodes.slice(0, 25)" :key="node.key"><td>{{ node.level }}</td><td><strong>{{ node.street ?? node.hood ?? node.city }}</strong><small>{{ node.city }}{{ node.hood && node.level === "STREET" ? ` · ${node.hood}` : "" }}</small></td><td>{{ node.metrics.totalSets }}</td><td>{{ pct(node.closeRatePct) }}</td><td>{{ pct(node.sitRatePct) }}</td><td>{{ pct(node.cancellationDqRatePct) }}</td><td><span class="confidence-pill" :class="confidenceClass(node.confidence)">{{ confidenceLabel(node.confidence) }}</span></td><td><span class="priority" :class="node.opportunityScore >= 65 ? 'high' : node.opportunityScore >= 35 ? 'medium' : 'low'">{{ node.opportunityScore }}</span></td></tr></tbody></table></div>
      </section>

      <section class="three-column">
        <article class="panel chart-panel"><div class="section-heading"><div><p class="eyebrow">SETTERS</p><h2>Best set-to-close</h2></div></div><div class="rep-list"><div v-for="row in dashboard.bySetter.slice(0, 7)" :key="row.name" class="rep-row"><span><strong>{{ row.name }}</strong><small>{{ row.totalSets }} sets · {{ row.closes }} closes</small></span><b>{{ pct(row.closeRatePct) }}</b></div></div></article>
        <article class="panel chart-panel"><div class="section-heading"><div><p class="eyebrow">CLOSERS</p><h2>Best close rate</h2></div></div><div class="rep-list"><div v-for="row in dashboard.byCloser.slice(0, 7)" :key="row.name" class="rep-row"><span><strong>{{ row.name }}</strong><small>{{ row.totalSets }} sets · {{ row.closes }} closes</small></span><b>{{ pct(row.closeRatePct) }}</b></div></div></article>
        <article class="panel chart-panel"><div class="section-heading"><div><p class="eyebrow">MOMENTUM</p><h2>Heating / declining</h2></div></div><div class="momentum-list"><div v-for="row in dashboard.momentum.slice(0, 8)" :key="row.key" class="momentum-row"><span><strong>{{ areaLabel(row) }}</strong><small>{{ row.recent7.totalSets }} sets in 7d · {{ row.recent30.totalSets }} in 30d</small></span><b :class="row.direction.toLowerCase()">{{ row.momentumPp > 0 ? "+" : "" }}{{ row.momentumPp }}pp</b></div></div></article>
      </section>

      <section class="panel trace-note"><span class="trace-icon">↳</span><div><strong>Traceability is built in.</strong><p>Summary cards and rankings are calculated from normalized appointment facts. Use the API trace endpoint to drill into the exact records behind the current view.</p></div></section>
    </section>

    <section v-else-if="loadingDashboard" class="empty panel"><h2>Loading territory data…</h2><p>Reading normalized appointment records and rebuilding deterministic territory scores.</p></section>
    <section v-else-if="!error" class="empty panel"><h2>Upload a schedule to open the territory view.</h2><p>East and West Excel blocks are parsed, normalized, deduplicated, and scored without an AI layer.</p></section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { IntelligenceDashboard, MapLayer, TerritoryDrilldownResponse } from "@solar/analytics-contracts";

type DashboardFilterState = Record<"from" | "to" | "region" | "city" | "setter" | "closer" | "result", string>;

const apiBase = (import.meta.env.VITE_INTELLIGENCE_API_URL as string | undefined) ?? "http://localhost:4100";
const dashboard = ref<IntelligenceDashboard | null>(null);
const error = ref("");
const loadingDashboard = ref(true);
const uploading = ref(false);
const uploadMessage = ref("");
const uploadRegion = ref<"EAST" | "WEST">("EAST");
const filters = reactive<DashboardFilterState>({ from: "", to: "", region: "", city: "", setter: "", closer: "", result: "" });
const filterOptions = reactive({ cities: [] as string[], hoods: [] as string[], streets: [] as string[], setters: [] as string[], closers: [] as string[] });
const selectedMapLayer = ref<MapLayer>("OPPORTUNITY");
const drilldown = ref<TerritoryDrilldownResponse | null>(null);
const drilldownCity = ref("");
const drilldownHood = ref("");
const mapLayerOptions: Array<{ value: MapLayer; label: string }> = [
  { value: "OPPORTUNITY", label: "Final opportunity" },
  { value: "SETS", label: "Sets" },
  { value: "SITS", label: "Sits" },
  { value: "CLOSES", label: "Closes" },
  { value: "CANCELLATION_DQ", label: "Cancellation / DQ" },
  { value: "CLOSE_RATE", label: "Smoothed close rate" },
  { value: "MOMENTUM_7D", label: "7-day momentum" },
  { value: "SATURATION", label: "Saturation" },
];
const resultOptions = [
  { value: "CLOSED", label: "Closed" },
  { value: "DID_NOT_CLOSE", label: "Did not close" },
  { value: "CREDIT_FAIL", label: "Credit fail" },
  { value: "CANCELLED_DQ", label: "Cancellation / DQ" },
  { value: "RESCHEDULED", label: "Rescheduled" },
];
const isAllDataView = computed(() => Object.values(filters).every((value) => !value));
const deploymentPlan = computed(() => dashboard.value?.deploymentPlan ?? { recommendations: [], avoid: [], methodology: ["", "", "No deployment plan is available from the current API response."] });
const visibleMapPoints = computed(() => dashboard.value?.map.filter((point) => point.latitude != null && point.longitude != null).slice(0, 3000) ?? []);
const mapCoordinateNote = computed(() => {
  const exact = visibleMapPoints.value.filter((point) => point.coordinateSource === "PROPERTY").length;
  return exact > 0 ? `${exact.toLocaleString()} property coordinates · centroid fallback where unavailable` : "City-centroid fallback · upload property coordinates to place exact appointments";
});
const drilldownHoodOptions = computed(() => {
  if (!drilldownCity.value) return [];
  return [...new Set((drilldown.value?.nodes ?? []).map((node) => node.hood).filter((hood): hood is string => Boolean(hood)))].sort();
});
const mapTileGrid = computed(() => {
  const zoom = 9;
  const startX = Math.floor(tileX(-80.65, zoom));
  const endX = Math.floor(tileX(-78.05, zoom));
  const startY = Math.floor(tileY(40.95, zoom));
  const endY = Math.floor(tileY(39.35, zoom));
  const tiles = [];
  for (let y = startY; y <= endY; y += 1) for (let x = startX; x <= endX; x += 1) tiles.push({ x, y, url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png` });
  return { tiles, startX, startY, columns: endX - startX + 1, rows: endY - startY + 1, north: inverseTileY(startY, zoom), south: inverseTileY(endY + 1, zoom), west: inverseTileX(startX, zoom), east: inverseTileX(endX + 1, zoom) };
});

const kpis = computed(() => dashboard.value ? [
  { label: "Total sets", value: dashboard.value.metrics.totalSets.toLocaleString(), note: "normalized appointment records" },
  { label: "Confirmed", value: dashboard.value.metrics.confirmed.toLocaleString(), note: "explicitly confirmed" },
  { label: "Sits", value: dashboard.value.metrics.sits.toLocaleString(), note: "closed + did not close + credit fail" },
  { label: "Closes", value: dashboard.value.metrics.closes.toLocaleString(), note: `${pct(dashboard.value.metrics.sitToClosePct)} of sits` },
  { label: "Cancellation / DQ", value: dashboard.value.metrics.cancellationDq.toLocaleString(), note: "did not sit, DQ, cancel, reschedule" },
  { label: "Set-to-close", value: pct(dashboard.value.metrics.setToClosePct), note: "closes ÷ total sets" },
] : []);

onMounted(async () => { await Promise.all([loadDashboard(), loadFilterOptions(), loadDrilldown()]); });

async function loadDashboard() {
  error.value = "";
  loadingDashboard.value = true;
  try {
    const params = queryParams(filters);
    const response = await fetch(`${apiBase}/api/v1/intelligence/dashboard?${params}`);
    if (!response.ok) throw new Error(await response.text());
    dashboard.value = await response.json() as IntelligenceDashboard;
    void loadDrilldown();
  } catch (caught) { error.value = `Dashboard unavailable: ${caught instanceof Error ? caught.message : "check the intelligence API"}`; }
  finally { loadingDashboard.value = false; }
}

async function loadFilterOptions() {
  try {
    const response = await fetch(`${apiBase}/api/v1/intelligence/filters`);
    if (!response.ok) return;
    const result = await response.json() as typeof filterOptions;
    filterOptions.cities = result.cities;
    filterOptions.hoods = result.hoods ?? [];
    filterOptions.streets = result.streets ?? [];
    filterOptions.setters = result.setters;
    filterOptions.closers = result.closers;
  } catch { /* The dashboard call carries the visible error state. */ }
}

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true; uploadMessage.value = ""; error.value = "";
  try {
    const body = new FormData(); body.append("file", file);
    const response = await fetch(`${apiBase}/api/v1/intelligence/uploads?region=${uploadRegion.value}`, { method: "POST", body });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json() as { insertedRows: number; duplicateRows: number; alreadyImported?: boolean };
    uploadMessage.value = result.alreadyImported ? "Already imported." : `${result.insertedRows.toLocaleString()} records imported · ${result.duplicateRows.toLocaleString()} duplicates skipped.`;
    await Promise.all([loadDashboard(), loadFilterOptions()]);
  } catch (caught) { error.value = `Import failed: ${caught instanceof Error ? caught.message : "unknown error"}`; }
  finally { uploading.value = false; (event.target as HTMLInputElement).value = ""; }
}

async function loadDrilldown() {
  try {
    const source = { ...filters, city: drilldownCity.value, hood: drilldownHood.value };
    const response = await fetch(`${apiBase}/api/v1/intelligence/territories?${queryParams(source)}`);
    if (!response.ok) return;
    drilldown.value = await response.json() as TerritoryDrilldownResponse;
  } catch { /* The dashboard carries the visible error state. */ }
}

function queryParams(source: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(source)) if (value) params.set(key, value);
  return params;
}

function resetFilters() { Object.assign(filters, { from: "", to: "", region: "", city: "", setter: "", closer: "", result: "" }); drilldownCity.value = ""; drilldownHood.value = ""; void loadDashboard(); void loadDrilldown(); }
function changeDrilldownCity() { drilldownHood.value = ""; void loadDrilldown(); }
function pct(value: number) { return `${value.toFixed(1)}%`; }
function areaLabel(row: { city?: string | null; hood?: string | null; name?: string }) { return row.city ? row.hood && row.hood !== row.city ? `${row.city} · ${row.hood}` : row.city : row.name ?? "Unknown"; }
function mapX(point: { longitude: number | null }) { return point.longitude == null ? 0 : ((point.longitude - mapTileGrid.value.west) / (mapTileGrid.value.east - mapTileGrid.value.west)) * 100; }
function mapY(point: { latitude: number | null }) { return point.latitude == null ? 0 : ((mapTileGrid.value.north - point.latitude) / (mapTileGrid.value.north - mapTileGrid.value.south)) * 100; }
function tileX(longitude: number, zoom: number) { return ((longitude + 180) / 360) * 2 ** zoom; }
function tileY(latitude: number, zoom: number) { const radians = latitude * Math.PI / 180; return ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoom; }
function inverseTileX(value: number, zoom: number) { return value / 2 ** zoom * 360 - 180; }
function inverseTileY(value: number, zoom: number) { return 180 / Math.PI * Math.atan(Math.sinh(Math.PI * (1 - 2 * value / 2 ** zoom))); }
function confidenceLabel(value: string | null | undefined) { return value ?? "LOW"; }
function confidenceClass(value: string | null | undefined) { return confidenceLabel(value).toLowerCase(); }
function layerValue(point: IntelligenceDashboard["map"][number]) {
  if (point.layerValues?.[selectedMapLayer.value] != null) return point.layerValues[selectedMapLayer.value];
  if (selectedMapLayer.value === "SETS") return point.sets ?? 0;
  if (selectedMapLayer.value === "SITS") return point.sits ?? 0;
  if (selectedMapLayer.value === "CLOSES") return point.closes ?? 0;
  if (selectedMapLayer.value === "CANCELLATION_DQ") return point.cancellationDq ?? 0;
  if (selectedMapLayer.value === "CLOSE_RATE") return point.closeRatePct ?? 0;
  if (selectedMapLayer.value === "MOMENTUM_7D") return 50 + (point.momentumPp ?? 0) * 5;
  if (selectedMapLayer.value === "SATURATION") return point.saturationPct ?? 0;
  return point.opportunityScore ?? 0;
}
function pointRadius(point: IntelligenceDashboard["map"][number]) { return Math.max(1.2, Math.min(4.8, 1.2 + Math.sqrt(Math.max(0, layerValue(point))) / 2.3)); }
function mapColor(point: IntelligenceDashboard["map"][number]) {
  const value = layerValue(point);
  if (selectedMapLayer.value === "CANCELLATION_DQ") return `hsl(${Math.max(0, 12 - value / 3)}, 72%, 52%)`;
  if (selectedMapLayer.value === "MOMENTUM_7D") return value >= 50 ? `hsl(${155 - Math.min(55, value - 50)}, 70%, 42%)` : `hsl(${Math.min(355, 28 + (50 - value) * 2)}, 70%, 52%)`;
  if (selectedMapLayer.value === "SATURATION") return `hsl(${Math.max(30, 140 - Math.min(100, value))}, 65%, 45%)`;
  return `hsl(${Math.max(25, 170 - Math.min(145, value * 1.35))}, 68%, 43%)`;
}
</script>
