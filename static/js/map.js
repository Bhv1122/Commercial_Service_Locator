class MapController {
    constructor() {
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tooltip = document.getElementById('tooltip');
        this.points = [];
        this.pointIdCounter = 1;
        this.visualizer = new Visualizer(this.canvas, this.ctx);
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupEvents();
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.drawBase();
    }

    setupEvents() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const mode = document.querySelector('input[name="mode"]:checked').value;
            
            const typeMap = {
                'emergency': 'emergency',
                'hospital': 'service',
                'police': 'service',
                'fire': 'service'
            };

            this.addPoint(x, y, mode, typeMap[mode]);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Hover logic for tooltip
            let hovered = null;
            for (let p of this.points) {
                const dist = Math.hypot(p.x - x, p.y - y);
                if (dist < 10) {
                    hovered = p;
                    break;
                }
            }
            
            if (hovered) {
                this.tooltip.style.left = `${e.clientX}px`;
                this.tooltip.style.top = `${e.clientY}px`;
                this.tooltip.innerHTML = `<b>${hovered.subtype.toUpperCase()}</b><br>X: ${Math.round(hovered.x)}, Y: ${Math.round(hovered.y)}`;
                this.tooltip.classList.remove('hidden');
            } else {
                this.tooltip.classList.add('hidden');
            }
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
            this.points = [];
            this.visualizer.stop();
            document.getElementById('results-panel').classList.add('hidden');
            this.drawBase();
        });

        document.getElementById('btn-generate').addEventListener('click', () => {
            this.points = [];
            // Generate 1 emergency and 15 services
            this.addPoint(Math.random() * this.canvas.width, Math.random() * this.canvas.height, 'emergency', 'emergency');
            
            const services = ['hospital', 'police', 'fire'];
            for(let i=0; i<15; i++) {
                const subtype = services[Math.floor(Math.random() * services.length)];
                this.addPoint(Math.random() * this.canvas.width, Math.random() * this.canvas.height, subtype, 'service');
            }
            this.drawBase();
        });

        document.getElementById('btn-run-algo').addEventListener('click', async () => {
            const emergencies = this.points.filter(p => p.type === 'emergency');
            const services = this.points.filter(p => p.type === 'service');
            
            if (emergencies.length === 0 || services.length === 0) {
                alert("You need at least one emergency and one service to run the algorithm.");
                return;
            }

            const btn = document.getElementById('btn-run-algo');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running...';
            btn.disabled = true;

            const result = await api.runAlgorithm(this.points);
            
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Run Locator Algorithm';
            btn.disabled = false;

            if (result) {
                const dc = result.divide_and_conquer;
                const bf = result.brute_force;
                
                // Update UI
                document.getElementById('results-panel').classList.remove('hidden');
                
                if (dc.closest_pair) {
                    const svc = dc.closest_pair[0].type === 'service' ? dc.closest_pair[0] : dc.closest_pair[1];
                    document.getElementById('res-service').textContent = svc.subtype.toUpperCase();
                }
                
                document.getElementById('res-dist').textContent = dc.min_dist === Infinity ? 'None' : dc.min_dist.toFixed(2) + ' units';
                document.getElementById('res-dc-time').textContent = dc.time_ms.toFixed(3) + ' ms';
                document.getElementById('res-bf-time').textContent = bf.time_ms.toFixed(3) + ' ms';
                document.getElementById('res-comp').textContent = `${dc.comparisons} / ${bf.comparisons}`;

                this.visualizer.setPoints(this.points);
                this.visualizer.animate(dc.viz_steps, dc.closest_pair);
            }
        });
    }

    addPoint(x, y, subtype, type) {
        this.points.push({
            id: 'p_' + this.pointIdCounter++,
            x: x,
            y: y,
            subtype: subtype,
            type: type
        });
        this.drawBase();
    }

    drawBase() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let p of this.points) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            
            if (p.type === 'emergency') {
                this.ctx.fillStyle = '#f43f5e'; // Accent red
                this.ctx.shadowColor = '#f43f5e';
                this.ctx.shadowBlur = 10;
            } else {
                if (p.subtype === 'hospital') {
                    this.ctx.fillStyle = '#3b82f6'; // Primary blue
                    this.ctx.shadowColor = '#3b82f6';
                } else if (p.subtype === 'police') {
                    this.ctx.fillStyle = '#60a5fa'; // Light blue
                    this.ctx.shadowColor = '#60a5fa';
                } else if (p.subtype === 'fire') {
                    this.ctx.fillStyle = '#f97316'; // Orange
                    this.ctx.shadowColor = '#f97316';
                }
                this.ctx.shadowBlur = 5;
            }
            
            this.ctx.fill();
            this.ctx.shadowBlur = 0; // reset
        }
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    window.mapInstance = new MapController();
});
