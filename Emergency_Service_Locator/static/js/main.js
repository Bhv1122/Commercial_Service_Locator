document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const grid = document.getElementById('canvas-grid');
    const svgBackground = document.getElementById('svg-background');
    const svgLines = document.getElementById('svg-lines');
    const svgPoints = document.getElementById('svg-points');
    const emptyState = document.getElementById('empty-state');
    
    // Controls
    const algoSelect = document.getElementById('algorithm-select');
    const btnPlay = document.getElementById('btn-play');
    const btnPause = document.getElementById('btn-pause');
    const btnStep = document.getElementById('btn-step');
    const btnReset = document.getElementById('btn-reset');
    const btnRandom = document.getElementById('btn-random');
    const btnClear = document.getElementById('btn-clear');
    const speedControl = document.getElementById('speed-control');

    // Stats
    const statDesc = document.getElementById('stat-description');
    const statComps = document.getElementById('stat-comparisons');
    const statDist = document.getElementById('stat-distance');
    const statDepthContainer = document.getElementById('stat-depth-container');
    const statDepth = document.getElementById('stat-depth');
    const algoInsight = document.getElementById('algo-insight');

    // Chart elements
    const btnBenchmark = document.getElementById('btn-benchmark');
    const btnDownload = document.getElementById('btn-download');
    const errorMsg = document.getElementById('error-msg');
    let performanceChart = null;
    let chartData = [];

    // --- State Variables ---
    let points = [];
    let isRunning = false;
    let timer = null;
    let generator = null;
    let currentState = null;
    let speed = parseInt(speedControl.value);

    // --- Grid Constants ---
    const GRID_WIDTH = 800;
    const GRID_HEIGHT = 500;

    // --- Init ---
    initChart();
    generateRandomPoints(15);

    // --- DOM Event Listeners ---
    grid.addEventListener('click', (e) => {
        if (isRunning) return;
        const rect = grid.getBoundingClientRect();
        // Scale coordinates to internal viewBox
        const scaleX = GRID_WIDTH / rect.width;
        const scaleY = GRID_HEIGHT / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        points.push({
            id: Date.now(),
            x: x,
            y: y,
            type: Math.random() > 0.5 ? 'ambulance' : 'hospital'
        });
        resetAlgorithm();
    });

    btnRandom.addEventListener('click', () => generateRandomPoints(15));
    btnClear.addEventListener('click', () => { points = []; resetAlgorithm(); });
    btnPlay.addEventListener('click', togglePlay);
    btnPause.addEventListener('click', togglePlay);
    btnStep.addEventListener('click', stepAlgorithm);
    btnReset.addEventListener('click', resetAlgorithm);
    algoSelect.addEventListener('change', () => {
        resetAlgorithm();
        updateInsightText();
    });
    
    speedControl.addEventListener('input', (e) => {
        speed = 2050 - parseInt(e.target.value);
        if (isRunning) {
            clearInterval(timer);
            timer = setInterval(stepAlgorithm, speed);
        }
    });

    // --- Functions ---
    function generateRandomPoints(count = 15) {
        resetAlgorithm();
        points = [];
        for (let i = 0; i < count; i++) {
            points.push({
                id: i,
                x: Math.floor(Math.random() * (GRID_WIDTH - 40)) + 20,
                y: Math.floor(Math.random() * (GRID_HEIGHT - 40)) + 20,
                type: Math.random() > 0.5 ? 'ambulance' : 'hospital'
            });
        }
        drawFrame();
    }

    function resetAlgorithm() {
        isRunning = false;
        clearInterval(timer);
        generator = null;
        currentState = null;
        
        btnPlay.classList.remove('hidden');
        btnPause.classList.add('hidden');
        
        statDesc.textContent = 'Waiting to start...';
        statComps.textContent = '0';
        statDist.textContent = '∞';
        statDepthContainer.classList.add('hidden');
        
        drawFrame();
    }

    function togglePlay() {
        if (isRunning) {
            isRunning = false;
            clearInterval(timer);
            btnPlay.classList.remove('hidden');
            btnPause.classList.add('hidden');
        } else {
            if (points.length < 2) return;
            isRunning = true;
            btnPlay.classList.add('hidden');
            btnPause.classList.remove('hidden');
            timer = setInterval(stepAlgorithm, speed);
        }
    }

    function stepAlgorithm() {
        if (points.length < 2) return;

        if (!generator) {
            const algoFunc = algoSelect.value === 'divideAndConquer' ? divideAndConquerClosestPair : bruteForceClosestPair;
            generator = algoFunc(points);
        }

        const { value, done } = generator.next();

        if (done) {
            isRunning = false;
            clearInterval(timer);
            btnPlay.classList.remove('hidden');
            btnPause.classList.add('hidden');
            
            if (value) {
                currentState = { ...currentState, ...value, step: 'done', description: `Done! Min distance: ${value.minDistance.toFixed(2)}` };
            }
        } else {
            currentState = value;
        }

        updateStatsUI();
        drawFrame();
    }

    function updateStatsUI() {
        if (!currentState) return;
        statDesc.textContent = currentState.description || '';
        statComps.textContent = currentState.comparisons || 0;
        
        if (currentState.minDistance && currentState.minDistance !== Infinity) {
            statDist.textContent = currentState.minDistance.toFixed(2);
        }

        if (currentState.depth !== undefined) {
            statDepthContainer.classList.remove('hidden');
            statDepth.innerHTML = '';
            for(let i=0; i<Math.max(1, currentState.depth + 1); i++) {
                const d = document.createElement('div');
                d.className = 'w-2 h-4 bg-secondary rounded-sm opacity-80';
                statDepth.appendChild(d);
            }
        }
    }

    function updateInsightText() {
        if (algoSelect.value === 'divideAndConquer') {
            algoInsight.textContent = "The Divide & Conquer approach recursively splits the plane in half. The closest pair is either entirely in the left half, entirely in the right half, or split across the mid-line (the strip). We only need to check points within the strip that are closer than the current minimum distance.";
        } else {
            algoInsight.textContent = "Brute Force checks the distance between every single pair of points. While simple to implement, its O(N²) time complexity makes it extremely slow for large datasets.";
        }
    }

    // --- SVG Drawing Logic ---
    function drawFrame() {
        if (points.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }

        svgBackground.innerHTML = '';
        svgLines.innerHTML = '';
        svgPoints.innerHTML = '';

        // Draw Active Region Highlights
        if (currentState?.activeRegion) {
            const xs = currentState.activeRegion.map(p => p.x);
            const minX = Math.min(...xs) - 10;
            const width = Math.max(...xs) - Math.min(...xs) + 20;
            
            const rect = createSvgElement('rect', {
                x: minX, y: 0, width: width, height: GRID_HEIGHT,
                fill: '#ffffff', 'fill-opacity': '0.02'
            });
            svgBackground.appendChild(rect);
        }

        // Draw Midpoint Line
        if (currentState?.midPoint) {
            const line = createSvgElement('line', {
                x1: currentState.midPoint.x, y1: 0,
                x2: currentState.midPoint.x, y2: GRID_HEIGHT,
                stroke: '#3b82f6', 'stroke-width': '2', 'stroke-dasharray': '5,5',
                opacity: '0.5'
            });
            svgLines.appendChild(line);
        }

        // Draw Mid Strip
        if (currentState?.midPoint && currentState?.minDistance && currentState.minDistance !== Infinity) {
            const rect = createSvgElement('rect', {
                x: currentState.midPoint.x - currentState.minDistance, y: 0,
                width: currentState.minDistance * 2, height: GRID_HEIGHT,
                fill: '#8b5cf6', 'fill-opacity': '0.1'
            });
            svgBackground.appendChild(rect);
        }

        // Draw Active Compare Line
        if (currentState?.activePoints?.length === 2) {
            const line = createSvgElement('line', {
                x1: currentState.activePoints[0].x, y1: currentState.activePoints[0].y,
                x2: currentState.activePoints[1].x, y2: currentState.activePoints[1].y,
                stroke: '#f59e0b', 'stroke-width': '2'
            });
            svgLines.appendChild(line);
        }

        // Draw Closest Pair Line
        if (currentState?.closestPair) {
            const line = createSvgElement('line', {
                x1: currentState.closestPair[0].x, y1: currentState.closestPair[0].y,
                x2: currentState.closestPair[1].x, y2: currentState.closestPair[1].y,
                stroke: '#10b981', 'stroke-width': '3'
            });
            svgLines.appendChild(line);
        }

        // Draw Points
        points.forEach(p => {
            const isActive = currentState?.activePoints?.find(a => a.id === p.id);
            const isClosest = currentState?.closestPair?.find(a => a.id === p.id);
            const isStrip = currentState?.stripPoints?.find(a => a.id === p.id);

            let fill = p.type === 'ambulance' ? '#ef4444' : '#3b82f6';
            let r = 6;

            if (isClosest) { fill = '#10b981'; r = 8; }
            else if (isActive) { fill = '#f59e0b'; r = 8; }
            else if (isStrip) { fill = '#8b5cf6'; }

            const circle = createSvgElement('circle', {
                cx: p.x, cy: p.y, r: r, fill: fill,
                class: 'drop-shadow-md'
            });
            svgPoints.appendChild(circle);
        });
    }

    function createSvgElement(tag, attrs) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (let k in attrs) el.setAttribute(k, attrs[k]);
        return el;
    }

    // --- Performance Chart Logic ---
    function initChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, sans-serif';

        performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Brute Force (ms)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: '#ef4444',
                        borderWidth: 3,
                        tension: 0.4
                    },
                    {
                        label: 'Divide & Conquer (ms)',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: '#3b82f6',
                        borderWidth: 3,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        title: { display: true, text: 'Time (ms)' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        title: { display: true, text: 'Number of Points (N)' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#fff' } }
                }
            }
        });
    }

    btnBenchmark.addEventListener('click', async () => {
        btnBenchmark.disabled = true;
        btnDownload.disabled = true;
        btnBenchmark.innerHTML = '<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Running...';
        errorMsg.classList.add('hidden');

        const sizes = [10, 50, 100, 500, 1000, 5000, 10000];
        chartData = [];

        try {
            performanceChart.data.labels = [];
            performanceChart.data.datasets[0].data = [];
            performanceChart.data.datasets[1].data = [];
            performanceChart.update();

            for (const n of sizes) {
                // Generate random points payload
                const payloadPoints = Array.from({ length: n }, () => ({
                    x: Math.random() * 1000,
                    y: Math.random() * 1000
                }));

                const response = await fetch('/api/benchmark', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ points: payloadPoints })
                });

                if (!response.ok) throw new Error('API Error');

                const result = await response.json();
                
                chartData.push(result);
                performanceChart.data.labels.push(result.n.toString());
                performanceChart.data.datasets[0].data.push(result.bruteForceTimeMs);
                performanceChart.data.datasets[1].data.push(result.divideConquerTimeMs);
                performanceChart.update();
            }

            btnDownload.disabled = false;
        } catch (err) {
            errorMsg.textContent = 'Warning: Failed to fetch benchmark results from the server.';
            errorMsg.classList.remove('hidden');
        } finally {
            btnBenchmark.disabled = false;
            btnBenchmark.innerHTML = 'Run Benchmark Test';
        }
    });

    btnDownload.addEventListener('click', () => {
        if (chartData.length === 0) return;
        
        let csvContent = "data:text/csv;charset=utf-8,Number of Points,Brute Force Time (ms),Divide & Conquer Time (ms)\n";
        csvContent += chartData.map(row => `${row.n},${row.bruteForceTimeMs},${row.divideConquerTimeMs}`).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "performance_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
