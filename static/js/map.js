class MapController {
    constructor() {
        this.points = [];
        this.pointIdCounter = 1;
        this.markers = [];
        
        // This will be set by initMap
        this.map = null;
        this.visualizer = null;
    }

    init(mapElement) {
        // Initialize Google Map centered roughly on a default location
        this.map = new google.maps.Map(mapElement, {
            center: { lat: 40.7128, lng: -74.0060 },
            zoom: 12,
            styles: [
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                {
                    featureType: "administrative.locality",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#d59563" }],
                },
                {
                    featureType: "poi",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#d59563" }],
                },
                {
                    featureType: "poi.park",
                    elementType: "geometry",
                    stylers: [{ color: "#263c3f" }],
                },
                {
                    featureType: "poi.park",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#6b9a76" }],
                },
                {
                    featureType: "road",
                    elementType: "geometry",
                    stylers: [{ color: "#38414e" }],
                },
                {
                    featureType: "road",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#212a37" }],
                },
                {
                    featureType: "road",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#9ca5b3" }],
                },
                {
                    featureType: "road.highway",
                    elementType: "geometry",
                    stylers: [{ color: "#746855" }],
                },
                {
                    featureType: "road.highway",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#1f2835" }],
                },
                {
                    featureType: "road.highway",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#f3d19c" }],
                },
                {
                    featureType: "transit",
                    elementType: "geometry",
                    stylers: [{ color: "#2f3948" }],
                },
                {
                    featureType: "transit.station",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#d59563" }],
                },
                {
                    featureType: "water",
                    elementType: "geometry",
                    stylers: [{ color: "#17263c" }],
                },
                {
                    featureType: "water",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#515c6d" }],
                },
                {
                    featureType: "water",
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#17263c" }],
                },
            ],
            disableDefaultUI: true,
            zoomControl: true,
        });

        this.visualizer = new Visualizer(this.map);
        this.setupEvents();
        
        // Auto-locate on load
        this.autoLocateAndFetch();
    }

    autoLocateAndFetch() {
        if (navigator.geolocation) {
            const btn = document.getElementById('btn-use-location');
            if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Auto-Locating...';
            
            navigator.geolocation.getCurrentPosition(async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                this.map.setCenter({ lat: lat, lng: lng });
                this.map.setZoom(14);
                
                // Clear any existing emergencies so we only have one main one
                this.points = this.points.filter(p => p.type !== 'emergency');
                this.clearMarkers();
                for (let p of this.points) {
                    this.drawMarkerForPoint(p);
                }
                
                this.addPoint(lng, lat, 'emergency', 'emergency');
                
                if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching Real Services...';
                
                await this.fetchRealServices(lat, lng);
                
                if(btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use My Location';
            }, (error) => {
                console.warn("Geolocation failed or denied. Using default map center.");
                if(btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use My Location';
            });
        }
    }

    async fetchRealServices(lat, lng) {
        const location = new google.maps.LatLng(lat, lng);
        const service = new google.maps.places.PlacesService(this.map);
        
        const types = ['hospital', 'police', 'fire_station'];
        
        const fetchPromises = types.map(type => {
            return new Promise((resolve) => {
                const request = {
                    location: location,
                    radius: '8000',
                    type: [type]
                };
                
                service.nearbySearch(request, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        results.forEach(place => {
                            let subtype = 'hospital';
                            if (type === 'police') subtype = 'police';
                            else if (type === 'fire_station') subtype = 'fire';
                            
                            const rating = place.rating || 'N/A';
                            this.addPoint(place.geometry.location.lng(), place.geometry.location.lat(), subtype, 'service', place.name || 'Unknown', rating);
                        });
                    }
                    resolve();
                });
            });
        });
        
        try {
            await Promise.all(fetchPromises);
        } catch (err) {
            console.error("Failed to fetch Places data:", err);
            alert("Could not fetch real services from Google Places.");
        }
    }

    setupEvents() {
        this.map.addListener('click', (e) => {
            const modeInput = document.querySelector('input[name="mode"]:checked');
            if (!modeInput) return;
            const mode = modeInput.value;
            const typeMap = {
                'emergency': 'emergency',
                'hospital': 'service',
                'police': 'service',
                'fire': 'service'
            };
            
            // X = lng, Y = lat
            this.addPoint(e.latLng.lng(), e.latLng.lat(), mode, typeMap[mode]);
        });

        const btnUseLocation = document.getElementById('btn-use-location');
        if (btnUseLocation) {
            btnUseLocation.addEventListener('click', () => {
                this.points = [];
                this.clearMarkers();
                this.visualizer.stop();
                document.getElementById('results-panel').classList.add('hidden');
                document.getElementById('res-general').classList.add('hidden');
                document.getElementById('res-all').classList.add('hidden');
                this.autoLocateAndFetch();
            });
        }

        document.getElementById('btn-clear').addEventListener('click', () => {
            this.points = [];
            this.clearMarkers();
            this.visualizer.stop();
            document.getElementById('results-panel').classList.add('hidden');
            document.getElementById('res-general').classList.add('hidden');
            document.getElementById('res-all').classList.add('hidden');
        });

        document.getElementById('btn-generate').addEventListener('click', () => {
            this.points = [];
            this.clearMarkers();
            this.visualizer.stop();
            
            const bounds = this.map.getBounds();
            if (!bounds) return;
            
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            
            const latSpan = ne.lat() - sw.lat();
            const lngSpan = ne.lng() - sw.lng();

            // 1 emergency
            this.addPoint(
                sw.lng() + lngSpan * Math.random(),
                sw.lat() + latSpan * Math.random(),
                'emergency', 'emergency'
            );
            
            // 15 services
            const services = ['hospital', 'police', 'fire'];
            for(let i=0; i<15; i++) {
                const subtype = services[Math.floor(Math.random() * services.length)];
                this.addPoint(
                    sw.lng() + lngSpan * Math.random(),
                    sw.lat() + latSpan * Math.random(),
                    subtype, 'service'
                );
            }
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
            
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Run General Locator';
            btn.disabled = false;

            if (result) {
                const dc = result.divide_and_conquer;
                const bf = result.brute_force;
                
                // Update UI
                document.getElementById('results-panel').classList.remove('hidden');
                document.getElementById('res-general').classList.remove('hidden');
                document.getElementById('res-all').classList.add('hidden');
                
                if (dc.closest_pair) {
                    const p1 = dc.closest_pair[0];
                    const p2 = dc.closest_pair[1];
                    const svc = p1.type === 'service' ? p1 : p2;
                    const ratingStr = svc.rating && svc.rating !== 'N/A' ? ` ⭐ ${svc.rating}` : '';
                    document.getElementById('res-service').textContent = svc.subtype.toUpperCase() + (svc.name && svc.name !== 'Unknown' ? ` (${svc.name})` : '') + ratingStr;
                    
                    if (document.getElementById('res-formula-sub')) {
                        document.getElementById('res-formula-sub').innerHTML = `d = &radic;((${p2.x.toFixed(4)} - ${p1.x.toFixed(4)})&sup2; + (${p2.y.toFixed(4)} - ${p1.y.toFixed(4)})&sup2;) <br>d &approx; ${dc.min_dist.toFixed(5)} degrees`;
                    }
                }
                
                document.getElementById('res-dist').textContent = dc.min_dist === Infinity ? 'None' : (dc.min_dist * 111).toFixed(2) + ' approx km';
                document.getElementById('res-dc-time').textContent = dc.time_ms.toFixed(3) + ' ms';
                if (document.getElementById('res-bf-time')) {
                    document.getElementById('res-bf-time').textContent = bf.time_ms.toFixed(3) + ' ms';
                    document.getElementById('res-comp').textContent = `${dc.comparisons} / ${bf.comparisons}`;
                }

                this.visualizer.setPoints(this.points);
                this.visualizer.animate(dc.viz_steps, dc.closest_pair);
            }
        });

        document.getElementById('btn-run-all').addEventListener('click', async () => {
            const emergencies = this.points.filter(p => p.type === 'emergency');
            const services = this.points.filter(p => p.type === 'service');
            
            if (emergencies.length === 0 || services.length === 0) {
                alert("You need at least one emergency and one service to run the algorithm.");
                return;
            }

            const btn = document.getElementById('btn-run-all');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finding...';
            btn.disabled = true;

            const result = await api.runAlgorithmAll(this.points);
            
            btn.innerHTML = '<i class="fa-solid fa-truck-medical"></i> Find All 3 Nearest';
            btn.disabled = false;

            if (result && result.results) {
                document.getElementById('results-panel').classList.remove('hidden');
                document.getElementById('res-general').classList.add('hidden');
                document.getElementById('res-all').classList.remove('hidden');
                
                const finalPairs = [];
                
                for (let type of ['hospital', 'police', 'fire']) {
                    const idMap = { 'hospital': 'res-hosp-dist', 'police': 'res-pol-dist', 'fire': 'res-fire-dist' };
                    const el = document.getElementById(idMap[type]);
                    if (el) {
                        if (result.results[type] && result.results[type].min_dist !== Infinity && result.results[type].closest_pair) {
                            const svc = result.results[type].closest_pair[0].type === 'service' ? result.results[type].closest_pair[0] : result.results[type].closest_pair[1];
                            const nameStr = svc.name && svc.name !== 'Unknown' ? ` (${svc.name})` : '';
                            const ratingStr = svc.rating && svc.rating !== 'N/A' ? ` ⭐ ${svc.rating}` : '';
                            el.textContent = (result.results[type].min_dist * 111).toFixed(2) + ' km' + nameStr + ratingStr;
                            finalPairs.push({
                                pair: result.results[type].closest_pair,
                                type: type
                            });
                        } else {
                            el.textContent = 'N/A';
                        }
                    }
                }
                
                document.getElementById('res-dc-time').textContent = result.total_time_ms.toFixed(3) + ' ms';
                
                this.visualizer.setPoints(this.points);
                this.visualizer.showMultipleFinalPairs(finalPairs);
            }
        });
    }

    addPoint(lng, lat, subtype, type, name = 'Unknown', rating = 'N/A') {
        const id = 'p_' + this.pointIdCounter++;
        const p = { id: id, x: lng, y: lat, subtype: subtype, type: type, name: name, rating: rating };
        this.points.push(p);
        this.drawMarkerForPoint(p);
    }

    drawMarkerForPoint(p) {
        let color, icon;
        if (p.type === 'emergency') {
            color = '#f43f5e';
            icon = {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#fff',
                scale: 8
            };
        } else {
            if (p.subtype === 'hospital') color = '#3b82f6';
            else if (p.subtype === 'police') color = '#60a5fa';
            else if (p.subtype === 'fire') color = '#f97316';
            
            icon = {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#fff',
                scale: 6
            };
        }

        const ratingStr = p.rating && p.rating !== 'N/A' ? ` (⭐ ${p.rating})` : '';
        const marker = new google.maps.Marker({
            position: { lat: p.y, lng: p.x },
            map: this.map,
            icon: icon,
            title: p.subtype.toUpperCase() + (p.name !== 'Unknown' ? ` - ${p.name}` : '') + ratingStr
        });
        
        this.markers.push(marker);
    }

    clearMarkers() {
        for (let m of this.markers) {
            m.setMap(null);
        }
        this.markers = [];
    }
}

window.mapInstance = new MapController();

// Google Maps Callback
function initMap() {
    window.mapInstance.init(document.getElementById('map'));
}
window.initMap = initMap;
