/**
 * PlacesPage — handles the /places/<category> split-screen page.
 * Fetches real nearby places from Google Places API (new),
 * renders them on the map and in the list, and runs D&C algorithm.
 */
class PlacesPage {
    constructor() {
        this.map = null;
        this.userPoint = null;
        this.allPlaces = [];
        this.markers = [];
        this.userMarker = null;
        this.resultLine = null;
        this.resultCircle = null;
        this.idCounter = 1;
        this.sortMode = 'dist';
        this.category = PAGE_CATEGORY;
        this.categoryLabel = PAGE_CATEGORY_LABEL;
        this.categoryColor = PAGE_CATEGORY_COLOR;

        // Google Places type mapping (expanded to include local & government places)
        this.typeMap = {
            hospital:     ['hospital', 'medical_clinic', 'emergency_room', 'doctor'],
            police:       ['police', 'local_government_office'],
            fire_station: ['fire_station'],
            supermarket:  ['supermarket', 'grocery_store', 'convenience_store', 'market', 'discount_store', 'department_store', 'wholesaler'],
            pharmacy:     ['pharmacy', 'drugstore', 'medical_clinic', 'hospital'],
            gas_station:  ['gas_station']
        };
    }

    // ─── INIT ─────────────────────────────────────────────────────────────────

    async init(mapElement) {
        this.map = new google.maps.Map(mapElement, {
            center: { lat: 20.5937, lng: 78.9629 },
            zoom: 13,
            styles: [
                { elementType: "geometry", stylers: [{ color: "#1a2035" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#1a2035" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#8a9bb0" }] },
                { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3d57" }] },
                { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7a8fa6" }] },
                { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a5f7a" }] },
                { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#c4a86a" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1b2e" }] },
                { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d5a7a" }] },
                { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
                { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1d3d2a" }] },
                { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2a3a50" }] },
            ],
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy'
        });

        this.setupEvents();
        await this.autoLocate();
    }

    // ─── GEOLOCATION ──────────────────────────────────────────────────────────

    async autoLocate() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                this.setStatus('Geolocation not supported. Showing default location.', 'warn');
                this.hideLoading();
                resolve();
                return;
            }

            this.setStatus('Detecting your location...', 'info');
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                this.map.setCenter({ lat, lng });
                this.map.setZoom(14);
                this.setUserMarker(lng, lat);
                this.userPoint = { id: 'user', x: lng, y: lat, type: 'user', subtype: 'user', name: 'Your Location', rating: null };

                await this.fetchPlaces();
                resolve();
            }, (err) => {
                console.error('Geolocation error:', err.message);
                this.hideLoading();
                this.setStatus('Location denied. Please allow location access and refresh.', 'error');
                this.clearSkeletons();
                resolve();
            }, { timeout: 10000, enableHighAccuracy: true });
        });
    }

    setUserMarker(lng, lat) {
        if (this.userMarker) this.userMarker.setMap(null);
        this.userMarker = new google.maps.Marker({
            position: { lat, lng },
            map: this.map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#f43f5e',
                fillOpacity: 1,
                strokeWeight: 3,
                strokeColor: '#ffffff',
                scale: 10
            },
            title: 'Your Location',
            zIndex: 999
        });
        new google.maps.InfoWindow({ content: '<div style="color:#000;font-weight:600;font-size:12px;">📍 You are here</div>' })
            .open(this.map, this.userMarker);
    }

    // ─── FETCH PLACES ─────────────────────────────────────────────────────────

    async fetchPlaces() {
        this.showLoading(`Fetching ${this.categoryLabel} nearby...`);
        this.clearMarkers();
        this.allPlaces = [];
        this.clearSkeletons();

        const radius = parseInt(document.getElementById('filter-radius').value);

        try {
            const { Place } = await google.maps.importLibrary('places');
            const center = new google.maps.LatLng(this.userPoint.y, this.userPoint.x);
            const placeTypes = this.typeMap[this.category] || [this.category];

            const request = {
                fields: ['displayName', 'location', 'rating', 'userRatingCount', 'formattedAddress', 'id', 'businessStatus'],
                locationRestriction: { center, radius },
                includedTypes: placeTypes,
                maxResultCount: 20,
            };

            const { places } = await Place.searchNearby(request);
            console.log(`[Places] Found ${places.length} results for ${placeTypes.join(', ')} within ${radius}m`);

            places.forEach(place => {
                const lat = place.location.lat();
                const lng = place.location.lng();
                const dist = this.haversineDist(this.userPoint.y, this.userPoint.x, lat, lng);

                this.allPlaces.push({
                    id: 'p_' + this.idCounter++,
                    x: lng,
                    y: lat,
                    type: 'service',
                    subtype: this.category,
                    name: place.displayName || 'Unknown',
                    rating: place.rating || null,
                    ratingCount: place.userRatingCount || 0,
                    address: place.formattedAddress || '',
                    status: place.businessStatus || '',
                    dist_km: dist
                });
            });

            if (places.length === 0) {
                this.setStatus(`No ${this.categoryLabel} found within ${radius / 1000}km. Try increasing radius.`, 'warn');
            } else {
                this.setStatus(`${places.length} ${this.categoryLabel} found near you`, 'ok');
            }

        } catch (err) {
            console.error('[Places] Error:', err);
            this.setStatus(`Error: ${err.message}`, 'error');
        } finally {
            this.applyFiltersAndRender();
            this.hideLoading();
        }
    }

    // ─── FILTERS & RENDER ─────────────────────────────────────────────────────

    applyFiltersAndRender() {
        const minRating = parseFloat(document.getElementById('filter-rating').value);
        const filtered = this.allPlaces.filter(p =>
            minRating === 0 || (p.rating !== null && p.rating >= minRating)
        );

        this.clearMarkers();
        filtered.forEach(p => this.drawMarker(p));

        document.getElementById('list-count').textContent = filtered.length;
        this.renderList(filtered);
    }

    renderList(places) {
        const sorted = [...places].sort((a, b) =>
            this.sortMode === 'rating'
                ? (b.rating || 0) - (a.rating || 0)
                : a.dist_km - b.dist_km
        );

        const container = document.getElementById('places-list');
        container.innerHTML = '';

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-slate-500">
                    <i class="fa-solid fa-circle-xmark text-3xl mb-3 block"></i>
                    <div class="text-sm">No places match your filters.</div>
                    <div class="text-xs mt-1">Try changing the rating filter or radius.</div>
                </div>`;
            return;
        }

        sorted.forEach((p, i) => {
            const stars = this.renderStars(p.rating);
            const ratingCount = p.ratingCount > 0 ? `(${p.ratingCount.toLocaleString()})` : '';
            const isOpen = p.status === 'OPERATIONAL' ? '' :
                           p.status ? `<span class="text-red-400 text-[10px]">⚠ ${p.status.replace('_', ' ')}</span>` : '';

            const card = document.createElement('div');
            card.className = 'place-card group rounded-xl border border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-700/50 p-3 cursor-pointer transition-all duration-200 hover:shadow-md';
            card.dataset.id = p.id;
            card.innerHTML = `
                <div class="flex gap-3 items-start">
                    <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style="background:${this.categoryColor}25;border:1px solid ${this.categoryColor}40;color:${this.categoryColor}">
                        ${i + 1}
                    </div>
                    <div class="flex-grow min-w-0">
                        <div class="text-white font-semibold text-sm truncate">${p.name}</div>
                        <div class="flex items-center gap-1 mt-0.5">
                            ${stars}
                            <span class="text-slate-400 text-[10px]">${ratingCount}</span>
                        </div>
                        ${p.address ? `<div class="text-slate-500 text-[10px] mt-0.5 truncate">${p.address}</div>` : ''}
                        ${isOpen}
                    </div>
                    <div class="flex-shrink-0 text-right">
                        <div class="text-emerald-400 text-xs font-mono font-semibold">${p.dist_km.toFixed(2)} km</div>
                        <div class="text-slate-500 text-[10px]">away</div>
                    </div>
                </div>`;
            card.addEventListener('click', () => this.focusPlace(p, card));
            container.appendChild(card);
        });
    }

    renderStars(rating) {
        if (!rating) return '<span class="text-slate-500 text-[10px]">No rating</span>';
        const full = Math.floor(rating);
        const half = rating - full >= 0.5;
        let html = '';
        for (let i = 0; i < 5; i++) {
            if (i < full) html += '<i class="fa-solid fa-star text-yellow-400 text-[10px]"></i>';
            else if (i === full && half) html += '<i class="fa-solid fa-star-half-stroke text-yellow-400 text-[10px]"></i>';
            else html += '<i class="fa-regular fa-star text-slate-600 text-[10px]"></i>';
        }
        html += `<span class="text-yellow-400 text-[10px] ml-0.5 font-medium">${rating}</span>`;
        return html;
    }

    focusPlace(p, card) {
        // Highlight card
        document.querySelectorAll('.place-card').forEach(c => c.classList.remove('ring-1', 'ring-primary'));
        card.classList.add('ring-1', 'ring-primary');
        // Pan map
        this.map.panTo({ lat: p.y, lng: p.x });
        this.map.setZoom(16);
    }

    // ─── D&C ALGORITHM ────────────────────────────────────────────────────────

    async runAlgorithm() {
        if (!this.userPoint) { alert('Location not detected yet.'); return; }

        const minRating = parseFloat(document.getElementById('filter-rating').value);
        const filtered = this.allPlaces.filter(p =>
            minRating === 0 || (p.rating !== null && p.rating >= minRating)
        );

        if (filtered.length === 0) {
            alert('No places match your current filters.');
            return;
        }

        const btn = document.getElementById('btn-find-nearest');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running...';
        btn.disabled = true;

        try {
            const points = [this.userPoint, ...filtered];
            const result = await api.runAlgorithm(points);
            if (!result || !result.divide_and_conquer) throw new Error('No result from algorithm');

            const dc = result.divide_and_conquer;
            const bf = result.brute_force;

            if (!dc.closest_pair) {
                alert('Could not find a nearest pair.');
                return;
            }

            const p1 = dc.closest_pair[0];
            const p2 = dc.closest_pair[1];
            const svc = p1.type === 'service' ? p1 : p2;
            const user = p1.type === 'user' ? p1 : p2;

            const realKm = this.haversineDist(user.y, user.x, svc.y, svc.x);
            const eucDeg = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

            // Show overlay on map
            this.clearResultOverlays();

            this.resultLine = new google.maps.Polyline({
                path: [{ lat: user.y, lng: user.x }, { lat: svc.y, lng: svc.x }],
                geodesic: true,
                strokeColor: this.categoryColor,
                strokeOpacity: 0.9,
                strokeWeight: 3,
                map: this.map
            });

            this.resultCircle = new google.maps.Circle({
                strokeColor: this.categoryColor,
                strokeOpacity: 0.7,
                strokeWeight: 2,
                fillColor: this.categoryColor,
                fillOpacity: 0.12,
                map: this.map,
                center: { lat: svc.y, lng: svc.x },
                radius: 200
            });

            // Fill result UI
            document.getElementById('result-overlay').classList.remove('hidden');
            document.getElementById('result-name').textContent = svc.name;
            document.getElementById('result-rating').innerHTML = this.renderStars(svc.rating);
            document.getElementById('result-dist').textContent = `${realKm.toFixed(2)} km away`;
            document.getElementById('result-dc-time').textContent = dc.time_ms.toFixed(3) + ' ms';
            document.getElementById('result-bf-time').textContent = bf.time_ms.toFixed(3) + ' ms';
            document.getElementById('result-comp').textContent = `${dc.comparisons} vs ${bf.comparisons}`;
            document.getElementById('result-formula').innerHTML =
                `d = √((${p2.x.toFixed(5)} − ${p1.x.toFixed(5)})² + (${p2.y.toFixed(5)} − ${p1.y.toFixed(5)})²)<br>` +
                `&nbsp;&nbsp;= √(${((p2.x - p1.x) ** 2).toFixed(8)} + ${((p2.y - p1.y) ** 2).toFixed(8)})<br>` +
                `&nbsp;&nbsp;≈ <b>${eucDeg.toFixed(6)}</b> degrees ≈ <b>${realKm.toFixed(3)} km</b>`;

            // Highlight the winning card in list
            document.querySelectorAll('.place-card').forEach(c => {
                c.classList.remove('ring-1', 'ring-primary');
                if (c.dataset.id === svc.id) {
                    c.classList.add('ring-1', 'ring-primary');
                    c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });

            // Pan to midpoint
            this.map.panTo({ lat: (user.y + svc.y) / 2, lng: (user.x + svc.x) / 2 });
            this.map.setZoom(14);

        } catch (err) {
            console.error('Algorithm error:', err);
            alert('Algorithm error: ' + err.message);
        } finally {
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Find Nearest (D&C)';
            btn.disabled = false;
        }
    }

    // ─── MARKERS ──────────────────────────────────────────────────────────────

    drawMarker(p) {
        const icon = {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: this.categoryColor,
            fillOpacity: 1,
            strokeWeight: 1.5,
            strokeColor: '#ffffff',
            scale: 7
        };

        const marker = new google.maps.Marker({
            position: { lat: p.y, lng: p.x },
            map: this.map,
            icon,
            title: `${p.name} — ${p.dist_km.toFixed(2)} km`
        });

        // Build star HTML
        const starsHtml = p.rating
            ? `${'★'.repeat(Math.round(p.rating))}${'☆'.repeat(5 - Math.round(p.rating))} <b>${p.rating}</b>${p.ratingCount ? ` <span style="color:#888">(${p.ratingCount.toLocaleString()} reviews)</span>` : ''}`
            : '<span style="color:#888">No rating yet</span>';

        // Google Maps navigate URL
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.y},${p.x}&destination_place_id=${encodeURIComponent(p.name)}`;

        // Street View URL
        const streetViewUrl = `https://www.google.com/maps?q=&layer=c&cbll=${p.y},${p.x}`;

        const iwContent = `
            <div style="font-family:Inter,sans-serif;min-width:220px;max-width:270px;padding:4px 2px">
                <div style="font-size:15px;font-weight:700;color:#111;margin-bottom:4px;line-height:1.3">${p.name}</div>

                <div style="font-size:12px;color:#f59e0b;margin-bottom:6px">${starsHtml}</div>

                ${p.address ? `
                <div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:6px">
                    <span style="color:#6b7280;font-size:13px;margin-top:1px">📍</span>
                    <span style="font-size:11px;color:#4b5563;line-height:1.4">${p.address}</span>
                </div>` : ''}

                <div style="display:flex;align-items:center;gap:5px;margin-bottom:10px">
                    <span style="color:#6b7280;font-size:12px">📏</span>
                    <span style="font-size:12px;font-weight:600;color:#059669">${p.dist_km.toFixed(2)} km from you</span>
                </div>

                ${p.status && p.status !== 'OPERATIONAL' ? `
                <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:4px 8px;font-size:11px;color:#b91c1c;margin-bottom:8px">
                    ⚠ ${p.status.replace(/_/g, ' ')}
                </div>` : ''}

                <div style="display:flex;gap:6px;margin-top:4px">
                    <a href="${navUrl}" target="_blank" rel="noopener"
                        style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;background:#2563eb;color:#fff;text-decoration:none;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:600;transition:background 0.2s"
                        onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                        🧭 Navigate
                    </a>
                    <a href="${streetViewUrl}" target="_blank" rel="noopener"
                        style="display:flex;align-items:center;justify-content:center;gap:4px;background:#f3f4f6;color:#374151;text-decoration:none;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:500;border:1px solid #e5e7eb"
                        onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                        🌐 View
                    </a>
                </div>
            </div>`;

        const iw = new google.maps.InfoWindow({ content: iwContent, maxWidth: 290 });

        marker.addListener('click', () => {
            // Close all other open info windows
            this.markers.forEach(m => m.iw.close());
            iw.open(this.map, marker);
            // Highlight the corresponding list card
            document.querySelectorAll('.place-card').forEach(c => {
                c.classList.remove('ring-1', 'ring-primary');
                if (c.dataset.id === p.id) {
                    c.classList.add('ring-1', 'ring-primary');
                    c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        });

        this.markers.push({ marker, iw, id: p.id });
    }


    clearMarkers() {
        this.markers.forEach(m => m.marker.setMap(null));
        this.markers = [];
    }

    clearResultOverlays() {
        if (this.resultLine) { this.resultLine.setMap(null); this.resultLine = null; }
        if (this.resultCircle) { this.resultCircle.setMap(null); this.resultCircle = null; }
    }

    // ─── UTILS ────────────────────────────────────────────────────────────────

    haversineDist(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    showLoading(msg) {
        document.getElementById('map-loading-text').textContent = msg;
        document.getElementById('map-loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('map-loading').classList.add('hidden');
    }

    clearSkeletons() {
        document.querySelectorAll('.skeleton-item').forEach(el => el.remove());
    }

    setStatus(msg, type = 'info') {
        const el = document.getElementById('list-status-text');
        if (!el) return;
        el.textContent = msg;
        const icons = { info: '🔵', ok: '🟢', warn: '🟡', error: '🔴' };
        el.parentElement.querySelector('i')?.classList.remove('text-primary', 'text-emerald-400', 'text-yellow-400', 'text-red-400');
        if (el.parentElement.querySelector('i')) {
            const colors = { info: 'text-primary', ok: 'text-emerald-400', warn: 'text-yellow-400', error: 'text-red-400' };
            el.parentElement.querySelector('i').classList.add(colors[type] || 'text-primary');
        }
    }

    // ─── EVENTS ───────────────────────────────────────────────────────────────

    setupEvents() {
        document.getElementById('btn-find-nearest').addEventListener('click', () => {
            if (this.allPlaces.length === 0) {
                this.fetchPlaces().then(() => this.runAlgorithm());
            } else {
                this.runAlgorithm();
            }
        });

        document.getElementById('btn-refresh').addEventListener('click', async () => {
            this.clearResultOverlays();
            document.getElementById('result-overlay').classList.add('hidden');
            if (this.userPoint) {
                await this.fetchPlaces();
            } else {
                await this.autoLocate();
            }
        });

        document.getElementById('filter-rating').addEventListener('change', () => {
            if (this.allPlaces.length > 0) this.applyFiltersAndRender();
        });

        document.getElementById('filter-radius').addEventListener('change', () => {
            if (this.userPoint) this.fetchPlaces();
        });

        document.getElementById('sort-dist').addEventListener('click', () => {
            this.sortMode = 'dist';
            document.getElementById('sort-dist').className = 'text-xs px-2.5 py-1 rounded-lg bg-primary text-white font-medium transition';
            document.getElementById('sort-rating').className = 'text-xs px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition';
            const minRating = parseFloat(document.getElementById('filter-rating').value);
            const filtered = this.allPlaces.filter(p => minRating === 0 || (p.rating !== null && p.rating >= minRating));
            this.renderList(filtered);
        });

        document.getElementById('sort-rating').addEventListener('click', () => {
            this.sortMode = 'rating';
            document.getElementById('sort-rating').className = 'text-xs px-2.5 py-1 rounded-lg bg-primary text-white font-medium transition';
            document.getElementById('sort-dist').className = 'text-xs px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition';
            const minRating = parseFloat(document.getElementById('filter-rating').value);
            const filtered = this.allPlaces.filter(p => minRating === 0 || (p.rating !== null && p.rating >= minRating));
            this.renderList(filtered);
        });
    }
}
