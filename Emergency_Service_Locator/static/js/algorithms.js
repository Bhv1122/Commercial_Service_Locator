// Distance Utility
const getDistance = (p1, p2) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};
  
// Brute Force Algorithm Generator
function* bruteForceClosestPair(points) {
    let minDistance = Infinity;
    let closestPair = null;
    let comparisons = 0;

    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            comparisons++;
            const p1 = points[i];
            const p2 = points[j];
            
            yield {
                step: 'compare',
                description: `Comparing (${p1.x.toFixed(1)}, ${p1.y.toFixed(1)}) and (${p2.x.toFixed(1)}, ${p2.y.toFixed(1)})`,
                activePoints: [p1, p2],
                comparisons,
                minDistance,
                closestPair
            };

            const d = getDistance(p1, p2);
            if (d < minDistance) {
                minDistance = d;
                closestPair = [p1, p2];
                
                yield {
                    step: 'update_min',
                    description: `New minimum distance found: ${d.toFixed(2)}`,
                    activePoints: [p1, p2],
                    comparisons,
                    minDistance,
                    closestPair
                };
            }
        }
    }

    return { closestPair, minDistance, comparisons };
}

// Divide and Conquer Algorithm Generator
function* divideAndConquerClosestPair(points, depth = 0) {
    const Px = [...points].sort((a, b) => a.x - b.x);
    const Py = [...points].sort((a, b) => a.y - b.y);
    let comparisons = 0;

    function* recurse(Px, Py, depth) {
        const n = Px.length;
        
        // Base Case
        if (n <= 3) {
            yield {
                step: 'base_case',
                description: `Base case reached with ${n} points. Using Brute Force.`,
                activeRegion: Px,
                depth
            };
            
            let minD = Infinity;
            let closest = null;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    comparisons++;
                    const d = getDistance(Px[i], Px[j]);
                    
                    yield {
                        step: 'compare',
                        description: `Comparing base case points.`,
                        activePoints: [Px[i], Px[j]],
                        comparisons,
                        activeRegion: Px,
                        depth
                    };

                    if (d < minD) {
                        minD = d;
                        closest = [Px[i], Px[j]];
                    }
                }
            }
            return { closestPair: closest, minDistance: minD };
        }

        // Divide
        const mid = Math.floor(n / 2);
        const midPoint = Px[mid];
        
        yield {
            step: 'divide',
            description: `Dividing points at x = ${midPoint.x.toFixed(1)}`,
            midPoint: midPoint,
            activeRegion: Px,
            depth
        };

        const PxLeft = Px.slice(0, mid);
        const PxRight = Px.slice(mid);
        
        const PyLeft = [];
        const PyRight = [];
        for (let p of Py) {
            if (p.x <= midPoint.x && PyLeft.length < mid) {
                PyLeft.push(p);
            } else {
                PyRight.push(p);
            }
        }

        // Conquer Left
        const leftResult = yield* recurse(PxLeft, PyLeft, depth + 1);
        // Conquer Right
        const rightResult = yield* recurse(PxRight, PyRight, depth + 1);

        // Merge Phase
        let d = leftResult.minDistance;
        let closest = leftResult.closestPair;

        if (rightResult.minDistance < d) {
            d = rightResult.minDistance;
            closest = rightResult.closestPair;
        }

        yield {
            step: 'merge',
            description: `Merge step: minimum of left and right halves is ${d.toFixed(2)}`,
            closestPair: closest,
            minDistance: d,
            activeRegion: Px,
            depth
        };

        // Build mid strip
        const strip = [];
        for (let p of Py) {
            if (Math.abs(p.x - midPoint.x) < d) {
                strip.push(p);
            }
        }

        if (strip.length > 0) {
            yield {
                step: 'mid_strip',
                description: `Checking mid-strip points within distance ${d.toFixed(2)}`,
                stripPoints: strip,
                midPoint: midPoint,
                minDistance: d,
                depth
            };
        }

        // Check strip points
        for (let i = 0; i < strip.length; i++) {
            for (let j = i + 1; j < strip.length && (strip[j].y - strip[i].y) < d; j++) {
                comparisons++;
                const p1 = strip[i];
                const p2 = strip[j];

                yield {
                    step: 'compare_strip',
                    description: `Comparing strip points`,
                    activePoints: [p1, p2],
                    comparisons,
                    stripPoints: strip,
                    depth
                };

                const dist = getDistance(p1, p2);
                if (dist < d) {
                    d = dist;
                    closest = [p1, p2];
                    
                    yield {
                        step: 'update_min',
                        description: `New closer pair found in strip! Distance: ${d.toFixed(2)}`,
                        activePoints: [p1, p2],
                        closestPair: closest,
                        minDistance: d,
                        comparisons,
                        depth
                    };
                }
            }
        }

        return { closestPair: closest, minDistance: d };
    }

    const finalResult = yield* recurse(Px, Py, 0);
    
    yield {
        step: 'done',
        description: `Algorithm complete! Closest pair distance is ${finalResult.minDistance.toFixed(2)}`,
        closestPair: finalResult.closestPair,
        minDistance: finalResult.minDistance,
        comparisons,
        depth: 0
    };

    return finalResult;
}
