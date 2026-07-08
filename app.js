/**
 * Pakistan Deforestation Dashboard - Application Logic
 * Powered by ApexCharts & Leaflet.js
 */

// --- Constants & Configurations ---
const PIXEL_TO_HECTARE = 0.09; // 30m x 30m pixel = 900m² = 0.09 hectares
const PIXEL_TO_SQKM = 0.0009;  // 900m² = 0.0009 km²

// Shared ApexCharts base options (function so it returns a fresh object each time)
function buildCommonOpts() {
    return {
        theme: { mode: 'dark' },
        chart: {
            foreColor: '#8b949e',
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        grid: { borderColor: '#21262d', strokeDashArray: 4 },
        tooltip: { theme: 'dark' }
    };
}

// State Management
let state = {
    filters: {
        province: 'all',
        district: 'all',
        yearStart: 2001,
        yearEnd: 2024,
        minCanopy: 30
    },
    sorting: {
        column: 'y', // 'y' (year), 'c' (canopy), 'p' (province), 'd' (district), 'v' (value/loss)
        direction: 'desc' // 'asc' or 'desc'
    },
    searchQuery: '',
    pagination: {
        currentPage: 1,
        pageSize: 10
    },
    filteredStats: [],
    allYears: [],
    provinces: {},
    charts: {
        trend: null,
        canopy: null,
        matrix: null,
        province: null,
        district: null
    },
    map: null,
    mapMarkers: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Extract unique metadata from stats
    extractMetadata();
    
    // 2. Setup filter options in DOM
    setupFilterDOM();
    
    // 3. Initialize Map
    initMap();
    
    // 4. Initialize Charts
    initCharts();
    
    // 5. Setup Event Listeners
    setupEventListeners();
    
    // 6. First Render
    updateDashboard();
});

// Extract unique years, provinces, and districts for select boxes
function extractMetadata() {
    const yearsSet = new Set();
    const provinceMap = {}; // { provinceName: Set(districtNames) }

    DEFORESTATION_STATS.forEach(item => {
        yearsSet.add(item.y);
        
        if (!provinceMap[item.p]) {
            provinceMap[item.p] = new Set();
        }
        provinceMap[item.p].add(item.d);
    });

    state.allYears = Array.from(yearsSet).sort((a, b) => a - b);
    
    // Convert sets to sorted arrays
    state.provinces = {};
    Object.keys(provinceMap).sort().forEach(p => {
        state.provinces[p] = Array.from(provinceMap[p]).sort();
    });
}

// Setup the filter dropdowns in the sidebar
function setupFilterDOM() {
    const provinceSelect = document.getElementById('province-select');
    const districtSelect = document.getElementById('district-select');
    const yearStartSelect = document.getElementById('year-start');
    const yearEndSelect = document.getElementById('year-end');
    
    // Populate Provinces
    Object.keys(state.provinces).forEach(prov => {
        const opt = document.createElement('option');
        opt.value = prov;
        opt.textContent = prov;
        provinceSelect.appendChild(opt);
    });
    
    // Populate Years
    state.allYears.forEach(year => {
        const startOpt = document.createElement('option');
        startOpt.value = year;
        startOpt.textContent = year;
        yearStartSelect.appendChild(startOpt);
        
        const endOpt = document.createElement('option');
        endOpt.value = year;
        endOpt.textContent = year;
        yearEndSelect.appendChild(endOpt);
    });
    
    // Set default years
    yearStartSelect.value = state.filters.yearStart;
    yearEndSelect.value = state.filters.yearEnd;
}

// Update district dropdown based on selected province
function updateDistrictDropdown() {
    const districtSelect = document.getElementById('district-select');
    districtSelect.innerHTML = '<option value="all">All Districts</option>';
    
    const selectedProv = state.filters.province;
    
    if (selectedProv !== 'all' && state.provinces[selectedProv]) {
        state.provinces[selectedProv].forEach(dist => {
            const opt = document.createElement('option');
            opt.value = dist;
            opt.textContent = dist;
            districtSelect.appendChild(opt);
        });
    }
    
    state.filters.district = 'all';
}

// Setup all DOM and action event listeners
function setupEventListeners() {
    // Province filter
    document.getElementById('province-select').addEventListener('change', (e) => {
        state.filters.province = e.target.value;
        updateDistrictDropdown();
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    // District filter
    document.getElementById('district-select').addEventListener('change', (e) => {
        state.filters.district = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    // Year range filters
    document.getElementById('year-start').addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (val > state.filters.yearEnd) {
            alert("Start year cannot be after End year!");
            e.target.value = state.filters.yearStart;
            return;
        }
        state.filters.yearStart = val;
        
        document.getElementById('date-search').value = '';
        
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    document.getElementById('year-end').addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (val < state.filters.yearStart) {
            alert("End year cannot be before Start year!");
            e.target.value = state.filters.yearEnd;
            return;
        }
        state.filters.yearEnd = val;
        
        document.getElementById('date-search').value = '';
        
        state.pagination.currentPage = 1;
        updateDashboard();
    });

    // Specific Year Search
    document.getElementById('date-search').addEventListener('change', (e) => {
        const val = e.target.value; 
        if (val) {
            const year = parseInt(val);
            
            // Constrain year to available data bounds
            const minYear = Math.min(...state.allYears);
            const maxYear = Math.max(...state.allYears);
            let targetYear = year;
            if (year < minYear) targetYear = minYear;
            if (year > maxYear) targetYear = maxYear;
            
            state.filters.yearStart = targetYear;
            state.filters.yearEnd = targetYear;
            
            // Sync dropdowns to reflect the selected year
            document.getElementById('year-start').value = targetYear;
            document.getElementById('year-end').value = targetYear;
            
            state.pagination.currentPage = 1;
            updateDashboard();
        }
    });
    
    // Canopy Cover Slider
    const canopySlider = document.getElementById('canopy-slider');
    const canopyValLabel = document.getElementById('canopy-val');
    canopySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        canopyValLabel.textContent = `${val}%`;
        state.filters.minCanopy = val;
    });
    canopySlider.addEventListener('change', () => {
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    // Table Sorting selector (sidebar)
    document.getElementById('table-sort-by').addEventListener('change', (e) => {
        const val = e.target.value;
        const [col, dir] = val.split('-');
        state.sorting.column = col;
        state.sorting.direction = dir;
        
        // Update table headers representation
        updateTableSortHeadersDOM();
        
        renderTable();
    });
    
    // Search Box
    document.getElementById('table-search').addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        state.pagination.currentPage = 1;
        renderTable();
    });
    
    // Table Header Clicks for Sorting
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (state.sorting.column === col) {
                state.sorting.direction = state.sorting.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sorting.column = col;
                state.sorting.direction = 'desc'; // Default to desc
            }
            
            // Sync with sidebar select
            const sortSelect = document.getElementById('table-sort-by');
            sortSelect.value = `${state.sorting.column}-${state.sorting.direction}`;
            
            updateTableSortHeadersDOM();
            renderTable();
        });
    });
    
    // Export Data Button
    document.getElementById('btn-export').addEventListener('click', exportCSV);
}

// Sync CSS classes on table headers based on sorting state
function updateTableSortHeadersDOM() {
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        const col = th.getAttribute('data-sort');
        const icon = th.querySelector('i');
        
        if (state.sorting.column === col) {
            th.classList.add('active-sort');
            icon.className = state.sorting.direction === 'asc' 
                ? 'fa-solid fa-sort-amount-up th-sort-icon' 
                : 'fa-solid fa-sort-amount-down-alt th-sort-icon';
        } else {
            th.classList.remove('active-sort');
            icon.className = 'fa-solid fa-sort th-sort-icon';
        }
    });
}

// --- Leaflet Map Logics ---
function initMap() {
    // Center map around Pakistan geographically
    state.map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([31.2, 70.8], 5.5);
    
    // Add dark CartoDB tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);
}

function updateMap() {
    // Clear old markers
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];
    
    const { province, district, minCanopy, yearStart, yearEnd } = state.filters;
    
    // Filter grid points
    const activeGrid = DEFORESTATION_GRID.filter(item => {
        if (item.y < yearStart || item.y > yearEnd) return false;
        if (province !== 'all' && item.p !== province) return false;
        if (district !== 'all' && item.d !== district) return false;
        if (item.c < minCanopy) return false;
        return true;
    });
    
    const bounds = [];
    
    activeGrid.forEach(cell => {
        // Radius scale based on pixel count
        // Minimum radius of 500m, scales with square root of count for area representation
        const areaHectares = cell.v * PIXEL_TO_HECTARE;
        const radius = Math.max(800, Math.sqrt(cell.v) * 200); 
        
        // Color based on canopy cover
        let color = '#10b981'; // Green (>=75%)
        if (cell.c < 50) {
            color = '#ef4444'; // Red (<50%)
        } else if (cell.c < 75) {
            color = '#f59e0b'; // Orange (50-75%)
        }
        
        const circle = L.circle([cell.lat, cell.lng], {
            radius: radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.55,
            stroke: true,
            weight: 1,
            opacity: 0.8
        });
        
        // Popup content with styled details
        const popupContent = `
            <div class="map-popup-title">${cell.d}, ${cell.p}</div>
            <div class="map-popup-grid">
                <span class="label">Year:</span>
                <span class="value">${cell.y}</span>
                
                <span class="label">Lat / Lng:</span>
                <span class="value">${cell.lat.toFixed(3)}, ${cell.lng.toFixed(3)}</span>
                
                <span class="label">Forest Loss:</span>
                <span class="value danger">${areaHectares.toLocaleString(undefined, {maximumFractionDigits: 1})} ha</span>
                
                <span class="label">Avg Canopy:</span>
                <span class="value">${cell.c}%</span>
            </div>
        `;
        
        circle.bindPopup(popupContent, { closeButton: false });
        circle.addTo(state.map);
        state.mapMarkers.push(circle);
        
        bounds.push([cell.lat, cell.lng]);
    });
    
    // Auto zoom map to active filters bounding box
    if (bounds.length > 0 && (province !== 'all' || district !== 'all')) {
        state.map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 9 });
    } else if (province === 'all' && district === 'all') {
        state.map.setView([31.2, 70.8], 5.5);
    }
}

// --- ApexCharts Initializations ---
function initCharts() {
    // Theme options for all dark-theme charts
    const commonChartOptions = {
        theme: { mode: 'dark' },
        chart: {
            foreColor: '#8b949e',
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        grid: {
            borderColor: '#21262d',
            strokeDashArray: 4
        },
        tooltip: { theme: 'dark' }
    };

    // 1. Trend Chart
    state.charts.trend = new ApexCharts(document.getElementById('chart-yearly-trend'), {
        ...commonChartOptions,
        chart: {
            ...commonChartOptions.chart,
            type: 'area',
            height: '100%',
            animations: { enabled: true }
        },
        colors: ['#ef4444'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 90, 100]
            }
        },
        stroke: { curve: 'smooth', width: 3 },
        dataLabels: { enabled: false },
        series: [{ name: 'Forest Loss (ha)', data: [] }],
        xaxis: { 
            labels: { rotate: -45 }
        },
        yaxis: {
            title: { text: 'Area Lost (Hectares)' },
            labels: {
                formatter: (val) => val.toLocaleString(undefined, { maximumFractionDigits: 0 })
            }
        }
    });
    state.charts.trend.render();

    // 2. Canopy Distribution Chart
    state.charts.canopy = new ApexCharts(document.getElementById('chart-canopy-dist'), {
        ...commonChartOptions,
        chart: {
            ...commonChartOptions.chart,
            type: 'bar',
            height: '100%'
        },
        colors: ['#10b981'],
        plotOptions: {
            bar: {
                borderRadius: 4,
                horizontal: false,
                columnWidth: '60%',
                distributed: false
            }
        },
        dataLabels: { enabled: false },
        series: [{ name: 'Forest Loss (ha)', data: [] }],
        xaxis: { categories: [] },
        yaxis: {
            title: { text: 'Area Lost (Hectares)' },
            labels: {
                formatter: (val) => val.toLocaleString(undefined, { maximumFractionDigits: 0 })
            }
        }
    });
    state.charts.canopy.render();

    // 3. Matrix Heatmap Chart
    state.charts.matrix = new ApexCharts(document.getElementById('chart-heatmap-matrix'), {
        ...commonChartOptions,
        chart: {
            ...commonChartOptions.chart,
            type: 'heatmap',
            height: '100%'
        },
        dataLabels: { enabled: false },
        colors: ['#ef4444'], // Base color for heatmap
        plotOptions: {
            heatmap: {
                radius: 2,
                enableShades: true,
                shadeIntensity: 0.5,
                colorScale: {
                    ranges: [
                        { from: 0, to: 0, color: '#161b22', name: 'No Loss' },
                        { from: 0.1, to: 50, color: '#1b2d24', name: 'Very Low (<50 ha)' },
                        { from: 50.1, to: 200, color: '#325c3a', name: 'Low (50-200 ha)' },
                        { from: 200.1, to: 500, color: '#f59e0b', name: 'Moderate (200-500 ha)' },
                        { from: 500.1, to: 20000, color: '#ef4444', name: 'Severe (>500 ha)' }
                    ]
                }
            }
        },
        series: [],
        xaxis: { 
            type: 'category',
            labels: { rotate: -45 }
        },
        yaxis: {
            title: { text: 'Canopy Cover Bracket' }
        },
        tooltip: {
            y: {
                formatter: (val) => `${val.toLocaleString(undefined, {maximumFractionDigits: 1})} ha`
            }
        }
    });
    state.charts.matrix.render();

    // 4. Province Comparison Chart
    state.charts.province = new ApexCharts(document.getElementById('chart-province-loss'), {
        ...commonChartOptions,
        chart: {
            ...commonChartOptions.chart,
            type: 'bar',
            height: '100%'
        },
        colors: ['#3b82f6'],
        plotOptions: {
            bar: {
                borderRadius: 4,
                horizontal: true,
                barHeight: '60%'
            }
        },
        dataLabels: { enabled: false },
        series: [{ name: 'Forest Loss (ha)', data: [] }],
        xaxis: {
            categories: [],
            title: { text: 'Area Lost (Hectares)' },
            labels: {
                formatter: (val) => Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 })
            }
        }
    });
    state.charts.province.render();

    // 5. Top 10 Districts Chart
    state.charts.district = new ApexCharts(document.getElementById('chart-district-loss'), {
        ...commonChartOptions,
        chart: {
            ...commonChartOptions.chart,
            type: 'bar',
            height: '100%'
        },
        colors: ['#f59e0b'],
        plotOptions: {
            bar: {
                borderRadius: 4,
                horizontal: true,
                barHeight: '70%'
            }
        },
        dataLabels: { enabled: false },
        series: [{ name: 'Forest Loss (ha)', data: [] }],
        xaxis: {
            categories: [],
            title: { text: 'Area Lost (Hectares)' },
            labels: {
                formatter: (val) => Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 })
            }
        }
    });
    state.charts.district.render();
}

// --- Data Updating & Calculations ---
function updateDashboard() {
    // 1. Filter the dataset based on active choices
    const { province, district, yearStart, yearEnd, minCanopy } = state.filters;
    
    state.filteredStats = DEFORESTATION_STATS.filter(item => {
        if (item.y < yearStart || item.y > yearEnd) return false;
        if (item.c < minCanopy) return false;
        if (province !== 'all' && item.p !== province) return false;
        if (district !== 'all' && item.d !== district) return false;
        return true;
    });

    // 2. Refresh KPIs
    calculateKPIs();

    // 3. Refresh Charts
    updateTrendChart();
    updateCanopyChart();
    updateHeatmapMatrix();
    updateProvinceChart();
    updateDistrictChart();

    // 4. Refresh Map
    updateMap();

    // 5. Render Table (this handles pagination)
    renderTable();
}

// Calculate total metrics and fill KPI cards
function calculateKPIs() {
    if (state.filteredStats.length === 0) {
        document.getElementById('val-total-loss').textContent = "0 km²";
        document.getElementById('val-total-loss-hectares').textContent = "0 hectares";
        document.getElementById('val-peak-year').textContent = "N/A";
        document.getElementById('val-peak-year-loss').textContent = "0 ha lost";
        document.getElementById('val-hottest-region').textContent = "N/A";
        document.getElementById('val-hottest-region-loss').textContent = "0 ha lost";
        document.getElementById('val-avg-canopy').textContent = "0%";
        document.getElementById('val-avg-canopy-desc').textContent = "No active forests";
        return;
    }

    let totalPixels = 0;
    let canopySum = 0;
    
    const yearLossMap = {};
    const districtLossMap = {};
    
    state.filteredStats.forEach(item => {
        const val = item.v;
        totalPixels += val;
        canopySum += (item.c * val);
        
        yearLossMap[item.y] = (yearLossMap[item.y] || 0) + val;
        
        // Group by full name "District (Province)" to avoid naming collisions
        const distKey = `${item.d} (${item.p})`;
        districtLossMap[distKey] = (districtLossMap[distKey] || 0) + val;
    });

    // Total Loss Area calculations
    const lossHectares = totalPixels * PIXEL_TO_HECTARE;
    const lossSqkm = totalPixels * PIXEL_TO_SQKM;
    
    document.getElementById('val-total-loss').textContent = `${lossSqkm.toLocaleString(undefined, {maximumFractionDigits: 1})} km²`;
    document.getElementById('val-total-loss-hectares').textContent = `${lossHectares.toLocaleString(undefined, {maximumFractionDigits: 0})} hectares`;

    // Weighted Average Canopy Cover
    const avgCanopy = canopySum / totalPixels;
    document.getElementById('val-avg-canopy').textContent = `${avgCanopy.toFixed(1)}%`;
    
    let canopyHealth = "Dense Canopy (>70%)";
    if (avgCanopy < 50) canopyHealth = "Sparse Canopy (<50%)";
    else if (avgCanopy < 70) canopyHealth = "Moderate Canopy (50-70%)";
    document.getElementById('val-avg-canopy-desc').textContent = canopyHealth;

    // Peak Year Finder
    let peakYear = 2001;
    let peakYearVal = 0;
    Object.keys(yearLossMap).forEach(y => {
        if (yearLossMap[y] > peakYearVal) {
            peakYearVal = yearLossMap[y];
            peakYear = y;
        }
    });
    
    const peakYearHa = peakYearVal * PIXEL_TO_HECTARE;
    document.getElementById('val-peak-year').textContent = peakYear;
    document.getElementById('val-peak-year-loss').textContent = `${peakYearHa.toLocaleString(undefined, {maximumFractionDigits: 0})} ha lost`;

    // Hottest District Finder
    let hotDistrict = "N/A";
    let hotDistrictVal = 0;
    Object.keys(districtLossMap).forEach(d => {
        if (districtLossMap[d] > hotDistrictVal) {
            hotDistrictVal = districtLossMap[d];
            hotDistrict = d;
        }
    });
    
    const hotDistrictHa = hotDistrictVal * PIXEL_TO_HECTARE;
    // Strip parenthesized province name for display heading but keep tooltip or subtext
    const displayName = hotDistrict.split(' (')[0];
    document.getElementById('val-hottest-region').textContent = displayName;
    document.getElementById('val-hottest-region').title = hotDistrict;
    document.getElementById('val-hottest-region-loss').textContent = `${hotDistrictHa.toLocaleString(undefined, {maximumFractionDigits: 0})} ha lost`;
}

// Chart 1 Update: Yearly Trend
function updateTrendChart() {
    const dataMap = {};
    // Populate all years in range with 0 initially to prevent line breaks
    for (let y = state.filters.yearStart; y <= state.filters.yearEnd; y++) {
        dataMap[y] = 0;
    }
    
    state.filteredStats.forEach(item => {
        dataMap[item.y] = (dataMap[item.y] || 0) + (item.v * PIXEL_TO_HECTARE);
    });
    
    const years = Object.keys(dataMap).sort();
    const values = years.map(y => Math.round(dataMap[y]));
    
    // Destroy and recreate to ensure Y-axis autoscales to the actual data range
    if (state.charts.trend) {
        state.charts.trend.destroy();
    }
    state.charts.trend = new ApexCharts(document.getElementById('chart-yearly-trend'), {
        ...buildCommonOpts(),
        chart: {
            ...buildCommonOpts().chart,
            type: 'area',
            height: '100%',
            animations: { enabled: true }
        },
        colors: ['#ef4444'],
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 90, 100] }
        },
        stroke: { curve: 'smooth', width: 3 },
        dataLabels: { enabled: false },
        series: [{ name: 'Forest Loss (ha)', data: values }],
        xaxis: {
            categories: years,
            labels: { rotate: -45 }
        },
        yaxis: {
            title: { text: 'Area Lost (Hectares)' },
            labels: { formatter: (val) => val.toLocaleString(undefined, { maximumFractionDigits: 0 }) }
        }
    });
    state.charts.trend.render();
}

// Chart 2 Update: Canopy Cover distribution (grouped by 10% ranges)
function updateCanopyChart() {
    const bins = {
        '30-39%': 0,
        '40-49%': 0,
        '50-59%': 0,
        '60-69%': 0,
        '70-79%': 0,
        '80-89%': 0,
        '90-100%': 0
    };
    
    state.filteredStats.forEach(item => {
        const val = item.v * PIXEL_TO_HECTARE;
        if (item.c >= 90) bins['90-100%'] += val;
        else if (item.c >= 80) bins['80-89%'] += val;
        else if (item.c >= 70) bins['70-79%'] += val;
        else if (item.c >= 60) bins['60-69%'] += val;
        else if (item.c >= 50) bins['50-59%'] += val;
        else if (item.c >= 40) bins['40-49%'] += val;
        else if (item.c >= 30) bins['30-39%'] += val;
    });
    
    const categories = Object.keys(bins);
    const values = categories.map(k => Math.round(bins[k]));
    
    // Destroy and recreate to ensure Y-axis autoscales to the actual data range
    if (state.charts.canopy) {
        state.charts.canopy.destroy();
    }
    state.charts.canopy = new ApexCharts(document.getElementById('chart-canopy-dist'), {
        ...buildCommonOpts(),
        chart: {
            ...buildCommonOpts().chart,
            type: 'bar',
            height: '100%'
        },
        colors: ['#10b981'],
        plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '60%', distributed: false } },
        dataLabels: { enabled: false },
        series: [{ name: 'Forest Loss (ha)', data: values }],
        xaxis: { categories: categories },
        yaxis: {
            title: { text: 'Area Lost (Hectares)' },
            labels: { formatter: (val) => val.toLocaleString(undefined, { maximumFractionDigits: 0 }) }
        }
    });
    state.charts.canopy.render();
}

// Chart 3 Update: Heatmap Matrix (Year vs Canopy Cover Bin)
function updateHeatmapMatrix() {
    const canopyBrackets = [
        '90-100%',
        '80-89%',
        '70-79%',
        '60-69%',
        '50-59%',
        '40-49%',
        '30-39%'
    ];
    
    // Matrix: { bracketName: { year: hectares } }
    const matrix = {};
    canopyBrackets.forEach(b => {
        matrix[b] = {};
        for (let y = state.filters.yearStart; y <= state.filters.yearEnd; y++) {
            matrix[b][y] = 0;
        }
    });
    
    state.filteredStats.forEach(item => {
        let bracket = null;
        if (item.c >= 90) bracket = '90-100%';
        else if (item.c >= 80) bracket = '80-89%';
        else if (item.c >= 70) bracket = '70-79%';
        else if (item.c >= 60) bracket = '60-69%';
        else if (item.c >= 50) bracket = '50-59%';
        else if (item.c >= 40) bracket = '40-49%';
        else if (item.c >= 30) bracket = '30-39%';
        
        if (bracket && matrix[bracket] && matrix[bracket][item.y] !== undefined) {
            matrix[bracket][item.y] += (item.v * PIXEL_TO_HECTARE);
        }
    });
    
    const years = [];
    for (let y = state.filters.yearStart; y <= state.filters.yearEnd; y++) {
        years.push(String(y));
    }
    
    // Transform matrix to ApexCharts Heatmap format:
    // array of { name: bracketName, data: [ {x: year, y: value}, ... ] }
    const series = canopyBrackets.map(bracket => {
        const data = years.map(y => {
            return {
                x: y,
                y: Math.round(matrix[bracket][y] * 10) / 10 // Rounded to 1 decimal place
            };
        });
        return {
            name: bracket,
            data: data
        };
    });
    state.charts.matrix.updateOptions({
        xaxis: { categories: years }
    });
    
    state.charts.matrix.updateSeries(series);
}

// Chart 4 Update: Provincial Deforestation comparison
function updateProvinceChart() {
    const dataMap = {};
    
    state.filteredStats.forEach(item => {
        dataMap[item.p] = (dataMap[item.p] || 0) + (item.v * PIXEL_TO_HECTARE);
    });
    
    // Sort provinces descending by loss
    const sortedProvinces = Object.keys(dataMap).sort((a, b) => dataMap[b] - dataMap[a]);
    const values = sortedProvinces.map(p => Math.round(dataMap[p]));
    
    // Destroy and re-create the chart — this is necessary because ApexCharts'
    // updateOptions with xaxis.categories causes the axis to show indices not values
    if (state.charts.province) {
        state.charts.province.destroy();
    }
    state.charts.province = new ApexCharts(document.getElementById('chart-province-loss'), {
        ...buildCommonOpts(),
        chart: { ...buildCommonOpts().chart, type: 'bar', height: '100%' },
        colors: ['#3b82f6'],
        plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '60%' } },
        dataLabels: { enabled: false },
        series: [{ name: 'Forest Loss (ha)', data: values }],
        xaxis: {
            categories: sortedProvinces,
            title: { text: 'Area Lost (Hectares)' },
            labels: { formatter: (val) => Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 }) }
        }
    });
    state.charts.province.render();
}

// Chart 5 Update: Top 10 Deforestation Districts
function updateDistrictChart() {
    const dataMap = {};
    
    state.filteredStats.forEach(item => {
        const key = `${item.d} (${item.p})`;
        dataMap[key] = (dataMap[key] || 0) + (item.v * PIXEL_TO_HECTARE);
    });
    
    // Take top 10
    const sortedDistricts = Object.keys(dataMap)
        .sort((a, b) => dataMap[b] - dataMap[a])
        .slice(0, 10);
    const cleanCategories = sortedDistricts.map(d => d.split(' (')[0]);
    const values = sortedDistricts.map(d => Math.round(dataMap[d]));
    
    // Destroy and re-create the chart
    if (state.charts.district) {
        state.charts.district.destroy();
    }
    state.charts.district = new ApexCharts(document.getElementById('chart-district-loss'), {
        ...buildCommonOpts(),
        chart: { ...buildCommonOpts().chart, type: 'bar', height: '100%' },
        colors: ['#f59e0b'],
        plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '70%' } },
        dataLabels: { enabled: false },
        series: [{ name: 'Forest Loss (ha)', data: values }],
        xaxis: {
            categories: cleanCategories,
            title: { text: 'Area Lost (Hectares)' },
            labels: { formatter: (val) => Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 }) }
        }
    });
    state.charts.district.render();
}

// --- Data Table Logics ---

// Main Table render (performs filtering, sorting, searching, and pagination)
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    
    // 1. Apply Search Filter
    let records = state.filteredStats;
    if (state.searchQuery) {
        records = records.filter(item => 
            item.p.toLowerCase().includes(state.searchQuery) || 
            item.d.toLowerCase().includes(state.searchQuery)
        );
    }
    
    // 2. Sort Records
    const col = state.sorting.column;
    const dir = state.sorting.direction === 'asc' ? 1 : -1;
    
    records.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        
        // Handle string comparison for province/district
        if (typeof valA === 'string') {
            return valA.localeCompare(valB) * dir;
        }
        
        // Numeric comparisons (year, canopy, pixel value)
        return (valA - valB) * dir;
    });
    
    const totalRecords = records.length;
    document.getElementById('pag-total').textContent = totalRecords;
    
    if (totalRecords === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 40px;">No records found matching filters</td></tr>`;
        document.getElementById('pag-start').textContent = 0;
        document.getElementById('pag-end').textContent = 0;
        document.getElementById('pagination-controls').innerHTML = '';
        return;
    }
    
    // 3. Paginate
    const { currentPage, pageSize } = state.pagination;
    const totalPages = Math.ceil(totalRecords / pageSize);
    
    // Adjust current page if out of bounds
    let activePage = Math.min(currentPage, totalPages);
    activePage = Math.max(1, activePage);
    state.pagination.currentPage = activePage;
    
    const startIndex = (activePage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    
    document.getElementById('pag-start').textContent = startIndex + 1;
    document.getElementById('pag-end').textContent = endIndex;
    
    const pageRecords = records.slice(startIndex, endIndex);
    
    // 4. Render Table DOM
    pageRecords.forEach(item => {
        const areaHectares = item.v * PIXEL_TO_HECTARE;
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${item.y}</strong></td>
            <td><span class="table-badge-canopy">${item.c}%</span></td>
            <td>${item.p}</td>
            <td>${item.d}</td>
            <td><span class="table-badge-loss">${areaHectares.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} ha</span></td>
        `;
        tbody.appendChild(tr);
    });
    
    // 5. Render Pagination Controls
    renderPaginationControls(totalPages, activePage);
}

function renderPaginationControls(totalPages, activePage) {
    const controls = document.getElementById('pagination-controls');
    controls.innerHTML = '';
    
    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.className = `pag-btn ${activePage === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
    prevBtn.addEventListener('click', () => {
        if (activePage > 1) {
            state.pagination.currentPage = activePage - 1;
            renderTable();
        }
    });
    controls.appendChild(prevBtn);
    
    // Numeric Page Buttons (limit to max 5 buttons)
    let startPage = Math.max(1, activePage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.className = 'pag-btn';
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => {
            state.pagination.currentPage = 1;
            renderTable();
        });
        controls.appendChild(firstBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.color = 'var(--text-secondary)';
            dots.style.padding = '0 5px';
            controls.appendChild(dots);
        }
    }
    
    for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.className = `pag-btn ${p === activePage ? 'active' : ''}`;
        btn.textContent = p;
        btn.addEventListener('click', () => {
            state.pagination.currentPage = p;
            renderTable();
        });
        controls.appendChild(btn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.color = 'var(--text-secondary)';
            dots.style.padding = '0 5px';
            controls.appendChild(dots);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.className = 'pag-btn';
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener('click', () => {
            state.pagination.currentPage = totalPages;
            renderTable();
        });
        controls.appendChild(lastBtn);
    }
    
    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = `pag-btn ${activePage === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
    nextBtn.addEventListener('click', () => {
        if (activePage < totalPages) {
            state.pagination.currentPage = activePage + 1;
            renderTable();
        }
    });
    controls.appendChild(nextBtn);
}

// --- CSV Export Logics ---

function exportCSV() {
    let records = state.filteredStats;
    
    // Apply search if active
    if (state.searchQuery) {
        records = records.filter(item => 
            item.p.toLowerCase().includes(state.searchQuery) || 
            item.d.toLowerCase().includes(state.searchQuery)
        );
    }
    
    // Apply sorting
    const col = state.sorting.column;
    const dir = state.sorting.direction === 'asc' ? 1 : -1;
    records.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        if (typeof valA === 'string') {
            return valA.localeCompare(valB) * dir;
        }
        return (valA - valB) * dir;
    });
    
    // Build CSV Content
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Year,Canopy Cover (%),Province,District,Loss (Hectares),Loss (Sq Km)\n";
    
    records.forEach(item => {
        const areaHectares = item.v * PIXEL_TO_HECTARE;
        const areaSqkm = item.v * PIXEL_TO_SQKM;
        // Escape commas in province and district names just in case
        const pName = `"${item.p.replace(/"/g, '""')}"`;
        const dName = `"${item.d.replace(/"/g, '""')}"`;
        
        csvContent += `${item.y},${item.c},${pName},${dName},${areaHectares.toFixed(2)},${areaSqkm.toFixed(4)}\n`;
    });
    
    // Trigger browser download download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    
    // Generate filename based on filters
    const provName = state.filters.province.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `pakistan_deforestation_${provName}_${state.filters.yearStart}_${state.filters.yearEnd}.csv`;
    
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
}
