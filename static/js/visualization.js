class Visualizer {
    constructor(map) {
        this.map = map;
        this.steps = [];
        this.points = [];
        this.isAnimating = false;
        this.animationSpeed = 800; // ms per step
        
        this.overlays = []; // Track map overlays to clear them
    }

    setPoints(points) {
        this.points = points;
    }

    async animate(steps, finalPair) {
        this.clearOverlays();
        this.steps = steps;
        this.isAnimating = true;

        for (let step of this.steps) {
            if (!this.isAnimating) break;
            this.renderStep(step);
            await this.sleep(this.animationSpeed);
        }

        if (finalPair) {
            this.drawConnection(finalPair[0], finalPair[1], '#10b981', 4); // Emerald
            
            const p1 = this.points.find(p => p.id === finalPair[0].id);
            const p2 = this.points.find(p => p.id === finalPair[1].id);
            if (p1) this.drawHighlight(p1, '#10b981');
            if (p2) this.drawHighlight(p2, '#10b981');
        }
        
        this.isAnimating = false;
    }

    showMultipleFinalPairs(pairs) {
        this.clearOverlays();
        
        // pairs is an array of pairs: [ {pair: [p1, p2], type: 'hospital'}, ... ]
        for (let item of pairs) {
            if (!item.pair) continue;
            let color = '#10b981';
            if (item.type === 'hospital') color = '#3b82f6';
            else if (item.type === 'police') color = '#60a5fa';
            else if (item.type === 'fire') color = '#f97316';
            
            const p1 = this.points.find(p => p.id === item.pair[0].id);
            const p2 = this.points.find(p => p.id === item.pair[1].id);
            if (p1 && p2) {
                this.drawConnection(p1, p2, color, 4);
                this.drawHighlight(p1, color);
                this.drawHighlight(p2, color);
            }
        }
    }

    renderStep(step) {
        if (step.type === 'split') {
            const bounds = this.map.getBounds();
            if (!bounds) return;
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            
            const line = new google.maps.Polyline({
                path: [
                    { lat: ne.lat(), lng: step.mid_x },
                    { lat: sw.lat(), lng: step.mid_x }
                ],
                geodesic: true,
                strokeColor: '#ffffff',
                strokeOpacity: 0.5,
                strokeWeight: 2,
                map: this.map
            });
            this.overlays.push(line);
            
            // Draw left/right colored overlays
            const leftRect = new google.maps.Rectangle({
                bounds: {
                    north: ne.lat(),
                    south: sw.lat(),
                    east: step.mid_x,
                    west: sw.lng()
                },
                fillColor: '#3b82f6',
                fillOpacity: 0.05,
                strokeWeight: 0,
                map: this.map
            });
            this.overlays.push(leftRect);
            
            const rightRect = new google.maps.Rectangle({
                bounds: {
                    north: ne.lat(),
                    south: sw.lat(),
                    east: ne.lng(),
                    west: step.mid_x
                },
                fillColor: '#f43f5e',
                fillOpacity: 0.05,
                strokeWeight: 0,
                map: this.map
            });
            this.overlays.push(rightRect);
        }
        else if (step.type === 'strip_check') {
            step.strip_points.forEach(pid => {
                const p = this.points.find(x => x.id === pid);
                if (p) this.drawHighlight(p, '#f59e0b'); // Amber
            });
        }
        else if (step.type === 'merge') {
            if (step.closest_pair) {
                const p1 = this.points.find(x => x.id === step.closest_pair[0]);
                const p2 = this.points.find(x => x.id === step.closest_pair[1]);
                if (p1 && p2) {
                    this.drawConnection(p1, p2, '#3b82f6', 2); // Blue
                }
            }
        }
    }

    drawConnection(p1, p2, color, width) {
        const line = new google.maps.Polyline({
            path: [
                { lat: p1.y, lng: p1.x },
                { lat: p2.y, lng: p2.x }
            ],
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: width,
            map: this.map
        });
        this.overlays.push(line);
    }

    drawHighlight(p, color) {
        const circle = new google.maps.Circle({
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.35,
            map: this.map,
            center: { lat: p.y, lng: p.x },
            radius: 500 // meters, approx
        });
        this.overlays.push(circle);
    }

    clearOverlays() {
        for (let overlay of this.overlays) {
            overlay.setMap(null);
        }
        this.overlays = [];
    }

    stop() {
        this.isAnimating = false;
        this.clearOverlays();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
