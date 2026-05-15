class Visualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.steps = [];
        this.points = [];
        this.isAnimating = false;
        this.animationSpeed = 800; // ms per step
    }

    setPoints(points) {
        this.points = points;
    }

    async animate(steps, finalPair) {
        this.steps = steps;
        this.isAnimating = true;

        for (let step of this.steps) {
            if (!this.isAnimating) break;
            
            // Draw points base state
            window.mapInstance.drawBase();
            
            this.renderStep(step);
            await this.sleep(this.animationSpeed);
        }

        // Final state
        window.mapInstance.drawBase();
        if (finalPair) {
            this.drawConnection(finalPair[0], finalPair[1], '#10b981', 3); // Emerald
            
            // Highlight the two points
            const p1 = this.points.find(p => p.id === finalPair[0].id);
            const p2 = this.points.find(p => p.id === finalPair[1].id);
            if (p1) this.drawHighlight(p1, '#10b981');
            if (p2) this.drawHighlight(p2, '#10b981');
        }
        
        this.isAnimating = false;
    }

    renderStep(step) {
        if (step.type === 'split') {
            // Draw vertical split line
            this.ctx.beginPath();
            this.ctx.moveTo(step.mid_x, 0);
            this.ctx.lineTo(step.mid_x, this.canvas.height);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.setLineDash([5, 5]);
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Highlight left/right areas
            this.ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
            this.ctx.fillRect(0, 0, step.mid_x, this.canvas.height);
            this.ctx.fillStyle = 'rgba(244, 63, 94, 0.05)';
            this.ctx.fillRect(step.mid_x, 0, this.canvas.width - step.mid_x, this.canvas.height);
        }
        else if (step.type === 'strip_check') {
            // Highlight strip region
            // We don't have mid_x directly in step, but we can draw a strip
            // Actually, we could infer it or just highlight the points
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
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.stroke();
    }

    drawHighlight(p, color) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    stop() {
        this.isAnimating = false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
