class MapController {
    constructor() {
        this.allPlaces = [];      // All fetched places for current category
        this.userPoint = null;    // { x: lng, y: lat, id, type:'user' }
        this.markers = [];
        this.userMarker = null;
        this.map = null;
        this.visualizer = null;
        this.idCounter = 1;
        this.currentCategory = 'hospital';
        this.sortMode = 'dist';   // 'dist' or 'rating'

        // Category config
        this.categoryConfig = {
            hospital:     { label: 'Hospital',     icon: 'fa-hospital',          color: '#3b82f6', hudColor: '#3b82f6' },
            police:       { label: 'Police',        icon: 'fa-shield-halved',     color: '#818cf8', hudColor: '#818cf8' },
            fire_station: { label: 'Fire Station',  icon: 'fa-fire-extinguisher', color: '#f97316', hudColor: '#f97316' },
            supermarket:  { label: 'Supermarket',   icon: 'fa-cart-shopping',     color: '#10b981', hudColor: '#10b981' },
            pharmacy:     { label: 'Pharmacy',      icon: 'fa-pills',             color: '#ec4899', hudColor: '#ec4899' },
            gas_station:  { label: 'Gas Station',   icon: 'fa-gas-pump',          color: '#eab308', hudColor: '#eab308' },
        };
    }

    init(mapElement) {
        this.map = new google.maps.Map(mapElement, {
            center: { lat: 20.5937, lng: 78.9629 }, // Default: India center
            zoom: 12,
            styles: [
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
                { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
                { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
                { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
                { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
                { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
                { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
                { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
                { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
            ],
            disableDefaultUI: true,
            zoomControl: true,
        });

        this.visualizer = new Visualizer(this.map);
        this.setupEvents();
        this.autoLocate();
    }

    // ─── GEOLOCATION ────────────────────────────────────────────────────────────

    autoLocate() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }
        this.showLoading('Getting your location...');
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            this.map.setCenter({ lat, lng });
            this.map.setZoom(14);
            this.setUserPoint(lng, lat);
            // Automatically fetch places for the current category
            await this.fetchPlaces();
        }, (err) => {
            this.hideLoading();
            console.warn('Geolocation denied or failed:', err.message);
            alert('Could not get your location. Please allow location access and try again.');
        }, { timeout: 10000 });
    }

    setUserPoint(lng, lat) {
        this.userPoint = { id: 'user', x: lng, y: lat, type: 'user', subtype: 'user', name: 'Your Location', rating: 'N/A' };
        if (this.userMarker) this.userMarker.setMap(null);
        this.userMarker = new google.maps.Marker({
            position: { lat, lng },
            map: this.map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#f43f5e',
                fillOpacity: 1,
                strokeWeight: 3,
                strokeColor: '#fff',
                scale: 10
            },
            title: 'Your Location',
            zIndex: 999
        });
        // Add pulsing info window
        const iw = new google.maps.InfoWindow({ content: '<div style="color:#000;font-weight:bold;font-size:12px;">📍 You are here</div>' });
        this.userMarker.addListener('click', () => iw.open(this.map, this.userMarker));
    }

    // ─── FETCH PLACES ────────────────────────────────────────────────────────────

    async fetchPlaces() {
        if (!this.userPoint) {
            alert('Please allow location access first.');
            return;
        }
        const radius = parseInt(document.getElementById('filter-radius').value);
        const cfg = this.categoryConfig[this.currentCategory];
        this.showLoading(`Fetching ${cfg.label}s nearby...`);
        this.clearPlaceMarkers();
        this.allPlaces = [];
        document.getElementById('results-panel').classList.add('hidden');

        try {
            const { Place } = await google.maps.importLibrary('places');
            const center = new google.maps.LatLng(this.userPoint.y, this.userPoint.x);

            // Map our category names to valid Google Places API type strings
            const typeMap = {
                hospital: 'hospital',
                police: 'police',
                fire_station: 'fire_station',
                supermarket: 'grocery_or_supermarket',
                pharmacy: 'pharmacy',
                gas_station: 'gas_station'
            };
            const placeType = typeMap[this.currentCategory] || this.currentCategory;

            const request = {
                fields: ['displayName', 'location', 'rating', 'id'],
                locationRestriction: {
                    center: center,
                    radius: radius
                },
                includedPrimaryTypes: [placeType],
                maxResultCount: 20,
            };

            const { places } = await Place.searchNearby(request);
            console.log(`[Places API] Found ${places.length} results for ${this.currentCategory}`);

            places.forEach(place => {
                const lat = place.location.lat();
                const lng = place.location.lng();
                const dist = this.haversineDist(this.userPoint.y, this.userPoint.x, lat, lng);
                const p = {
                    id: 'p_' + this.idCounter++,
                    x: lng,
                    y: lat,
                    type: 'service',
                    subtype: this.currentCategory,
                    name: place.displayName || 'Unknown',
                    rating: place.rating || null,
                    dist_km: dist
                };
                this.allPlaces.push(p);
            });

            if (places.length === 0) {
                console.warn('[Places API] Zero results. Try a larger radius.');
            }
        } catch (err) {
            console.error('[Places API] Error:', err);
            alert(`Could not fetch places: ${err.message}\n\nMake sure the Places API (New) is enabled in Google Cloud Console.`);
        } finally {
            this.applyFiltersAndRender();
            this.hideLoading();
        }
    }

    // ─── HAVERSINE & EUCLIDEAN ───────────────────────────────────────────────────

    haversineDist(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    euclideanDist(p1, p2) {
        return Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
    }

    // ─── FILTERS & RENDER ────────────────────────────────────────────────────────

    applyFiltersAndRender() {
        const minRating = parseFloat(document.getElementById('filter-rating').value);

        const filtered = this.allPlaces.filter(p => {
            if (minRating > 0 && (p.rating === null || p.rating < minRating)) return false;
            return true;
        });

        this.clearPlaceMarkers();
        filtered.forEach(p => this.drawPlaceMarker(p));

        if (filtered.length === 0) {
            document.getElementById('results-panel').classList.add('hidden');
            alert('No places found matching your filters. Try adjusting filters or increasing the search radius.');
            return;
        }

        this.renderResultsList(filtered);
        document.getElementById('results-panel').classList.remove('hidden');
    }

    renderResultsList(places) {
        const sorted = [...places].sort((a, b) => {
            if (this.sortMode === 'rating') {
                return (b.rating || 0) - (a.rating || 0);
            }
            return a.dist_km - b.dist_km;
        });

        const container = document.getElementById('results-list');
        container.innerHTML = '';
        const cfg = this.categoryConfig[this.currentCategory];

        sorted.forEach((p, i) => {
            const stars = p.rating ? '⭐'.repeat(Math.round(p.rating)) + ` ${p.rating}` : 'No rating';
            const div = document.createElement('div');
            div.className = 'result-item flex items-center gap-2 bg-slate-800/70 hover:bg-slate-700/70 p-2 rounded-lg cursor-pointer transition border border-transparent hover:border-slate-500';
            div.dataset.id = p.id;
            div.innerHTML = `
                <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style="background:${cfg.color}22;color:${cfg.color}">${i+1}</div>
                <div class="flex-grow min-w-0">
                    <div class="text-white text-xs font-medium truncate">${p.name}</div>
                    <div class="text-slate-400 text-[10px]">${stars}</div>
                </div>
                <div class="flex-shrink-0 text-right">
                    <div class="text-emerald-400 text-xs font-mono font-semibold">${p.dist_km.toFixed(2)} km</div>
                </div>`;
            div.addEventListener('click', () => this.focusPlace(p));
            container.appendChild(div);
        });
    }

    focusPlace(p) {
        this.map.panTo({ lat: p.y, lng: p.x });
        this.map.setZoom(16);
    }

    // ─── D&C ALGORITHM ──────────────────────────────────────────────────────────

    async runAlgorithm() {
        if (!this.userPoint) { alert('Allow location access first.'); return; }

        const minRating = parseFloat(document.getElementById('filter-rating').value);
        const filtered = this.allPlaces.filter(p => minRating === 0 || (p.rating !== null && p.rating >= minRating));

        if (filtered.length === 0) {
            alert('No places match your filters. Adjust filters and try again.');
            return;
        }

        // Build points list: user + filtered places
        const points = [this.userPoint, ...filtered];

        const btn = document.getElementById('btn-find-nearest');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running D&C...';
        btn.disabled = true;

        try {
            const result = await api.runAlgorithm(points);
            if (!result) throw new Error('No result');

            const dc = result.divide_and_conquer;
            const bf = result.brute_force;

            if (!dc.closest_pair) { alert('Could not find a pair.'); return; }

            // Identify the service point from the pair
            const p1 = dc.closest_pair[0];
            const p2 = dc.closest_pair[1];
            const svc = p1.type === 'service' ? p1 : p2;
            const user = p1.type === 'user' ? p1 : p2;

            // Euclidean distance in degrees (raw)
            const eucDeg = this.euclideanDist(p1, p2);
            // Real distance in km
            const realKm = this.haversineDist(user.y, user.x, svc.y, svc.x);

            // Show top result card
            document.getElementById('res-top').classList.remove('hidden');
            document.getElementById('res-top-name').textContent = svc.name;
            document.getElementById('res-top-rating').textContent = svc.rating ? `⭐ ${svc.rating} / 5.0` : 'No rating available';
            document.getElementById('res-top-dist').textContent = `${realKm.toFixed(2)} km away`;
            document.getElementById('res-formula-sub').innerHTML =
                `d = √((${p2.x.toFixed(5)} − ${p1.x.toFixed(5)})² + (${p2.y.toFixed(5)} − ${p1.y.toFixed(5)})²)<br>` +
                `d ≈ <b>${eucDeg.toFixed(6)}</b> degrees ≈ <b>${realKm.toFixed(2)} km</b>`;
            document.getElementById('res-dc-time').textContent = dc.time_ms.toFixed(3) + ' ms';
            document.getElementById('res-comp').textContent = `${dc.comparisons} vs ${bf.comparisons}`;

            // Draw line on map
            this.visualizer.setPoints(points);
            this.visualizer.clearOverlays();
            this.visualizer.drawConnection(
                { x: user.x, y: user.y },
                { x: svc.x, y: svc.y },
                this.categoryConfig[this.currentCategory].color, 3
            );
            this.visualizer.drawHighlight({ x: svc.x, y: svc.y }, this.categoryConfig[this.currentCategory].color);

            // Pan to midpoint
            this.map.panTo({
                lat: (user.y + svc.y) / 2,
                lng: (user.x + svc.x) / 2
            });

        } catch (e) {
            console.error(e);
            alert('Algorithm error. Please try again.');
        } finally {
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Find Nearest';
            btn.disabled = false;
        }
    }

    // ─── MARKERS ─────────────────────────────────────────────────────────────────

    drawPlaceMarker(p) {
        const cfg = this.categoryConfig[p.subtype] || { color: '#8b5cf6' };
        const icon = {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: cfg.color,
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#fff',
            scale: 6
        };
        const ratingStr = p.rating ? ` ⭐${p.rating}` : '';
        const marker = new google.maps.Marker({
            position: { lat: p.y, lng: p.x },
            map: this.map,
            icon,
            title: `${p.name}${ratingStr} — ${p.dist_km.toFixed(2)} km`
        });

        // InfoWindow on click
        const iw = new google.maps.InfoWindow({
            content: `<div style="color:#000;font-size:12px;max-width:180px">
                <b>${p.name}</b><br>
                ${p.rating ? '⭐ ' + p.rating : 'No rating'}<br>
                <span style="color:#059669">${p.dist_km.toFixed(2)} km away</span>
            </div>`
        });
        marker.addListener('click', () => iw.open(this.map, marker));
        this.markers.push(marker);
    }

    clearPlaceMarkers() {
        this.markers.forEach(m => m.setMap(null));
        this.markers = [];
        this.visualizer && this.visualizer.clearOverlays();
    }

    // ─── UI HELPERS ──────────────────────────────────────────────────────────────

    showLoading(msg = 'Loading...') {
        document.getElementById('map-loading-text').textContent = msg;
        document.getElementById('map-loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('map-loading').classList.add('hidden');
    }

    updateHUD() {
        const cfg = this.categoryConfig[this.currentCategory];
        const hud = document.getElementById('hud-category');
        hud.querySelector('div').style.background = cfg.hudColor;
        hud.querySelector('span').textContent = cfg.label;
    }

    // ─── EVENTS ──────────────────────────────────────────────────────────────────

    setupEvents() {
        // Category buttons
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active-cat'));
                btn.classList.add('active-cat');
                this.currentCategory = btn.dataset.cat;
                this.updateHUD();
                // Auto-fetch when category changes if user is located
                if (this.userPoint) this.fetchPlaces();
            });
        });

        // Use My Location
        document.getElementById('btn-use-location').addEventListener('click', () => {
            this.clearPlaceMarkers();
            document.getElementById('results-panel').classList.add('hidden');
            this.autoLocate();
        });

        // Find Nearest button
        document.getElementById('btn-find-nearest').addEventListener('click', async () => {
            if (this.allPlaces.length === 0) {
                // Fetch first then run
                await this.fetchPlaces();
            }
            this.runAlgorithm();
        });

        // Clear
        document.getElementById('btn-clear').addEventListener('click', () => {
            this.clearPlaceMarkers();
            this.allPlaces = [];
            document.getElementById('results-panel').classList.add('hidden');
            document.getElementById('res-top').classList.add('hidden');
        });

        // Sort buttons
        document.getElementById('sort-dist').addEventListener('click', () => {
            this.sortMode = 'dist';
            document.getElementById('sort-dist').className = 'sort-btn text-xs px-2 py-0.5 rounded bg-primary text-white';
            document.getElementById('sort-rating').className = 'sort-btn text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600';
            const minRating = parseFloat(document.getElementById('filter-rating').value);
            const filtered = this.allPlaces.filter(p => minRating === 0 || (p.rating !== null && p.rating >= minRating));
            this.renderResultsList(filtered);
        });
        document.getElementById('sort-rating').addEventListener('click', () => {
            this.sortMode = 'rating';
            document.getElementById('sort-rating').className = 'sort-btn text-xs px-2 py-0.5 rounded bg-primary text-white';
            document.getElementById('sort-dist').className = 'sort-btn text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600';
            const minRating = parseFloat(document.getElementById('filter-rating').value);
            const filtered = this.allPlaces.filter(p => minRating === 0 || (p.rating !== null && p.rating >= minRating));
            this.renderResultsList(filtered);
        });

        // Filter changes trigger re-render (no new API call)
        document.getElementById('filter-rating').addEventListener('change', () => {
            if (this.allPlaces.length > 0) this.applyFiltersAndRender();
        });

        // Radius change re-fetches
        document.getElementById('filter-radius').addEventListener('change', () => {
            if (this.userPoint) this.fetchPlaces();
        });
    }
}

window.mapInstance = new MapController();
