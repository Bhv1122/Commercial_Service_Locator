from flask import Flask, render_template, request, jsonify
from core.database import init_db, query_db, insert_db, delete_db, update_db
from core.algorithm import run_closest_pair, brute_force_closest_pair

app = Flask(__name__)

# Initialize database
init_db()

# --- WEB ROUTES ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/education')
def education():
    return render_template('education.html')

# --- API ROUTES ---

@app.route('/api/services', methods=['GET'])
def get_services():
    services = query_db("SELECT * FROM services")
    return jsonify([dict(ix) for ix in services] if services else [])

@app.route('/api/services', methods=['POST'])
def add_service():
    data = request.json
    service_id = insert_db(
        "INSERT INTO services (name, type, x, y, status, response_speed) VALUES (?, ?, ?, ?, ?, ?)",
        (data.get('name', 'Unknown'), data.get('type', 'hospital'), data.get('x', 0), data.get('y', 0), data.get('status', 'available'), data.get('response_speed', 10))
    )
    return jsonify({'id': service_id}), 201

@app.route('/api/services/<int:service_id>', methods=['DELETE'])
def remove_service(service_id):
    delete_db("DELETE FROM services WHERE id=?", (service_id,))
    return jsonify({'status': 'deleted'})

@app.route('/api/requests', methods=['GET'])
def get_requests():
    reqs = query_db("SELECT * FROM requests")
    return jsonify([dict(ix) for ix in reqs] if reqs else [])

@app.route('/api/requests', methods=['POST'])
def add_request():
    data = request.json
    req_id = insert_db(
        "INSERT INTO requests (type, x, y) VALUES (?, ?, ?)",
        (data.get('type', 'medical'), data.get('x', 0), data.get('y', 0))
    )
    return jsonify({'id': req_id}), 201

@app.route('/api/algorithm/run', methods=['POST'])
def run_algorithm():
    data = request.json
    points_data = data.get('points', [])
    
    if not points_data:
        # Fetch from DB if no points provided
        services = query_db("SELECT * FROM services")
        reqs = query_db("SELECT * FROM requests ORDER BY id DESC LIMIT 1") # Get latest request
        if services:
            for s in services:
                points_data.append((s['x'], s['y'], f"s_{s['id']}", 'service', dict(s)))
        if reqs:
            r = reqs[0]
            points_data.append((r['x'], r['y'], f"r_{r['id']}", 'emergency', dict(r)))
            
    else:
        # points_data should be [ {id, x, y, type, ...} ]
        formatted_points = []
        for p in points_data:
            formatted_points.append((p['x'], p['y'], p['id'], p['type'], p))
        points_data = formatted_points

    if len(points_data) < 2:
        return jsonify({'error': 'Not enough points to find a pair'}), 400

    # Run Brute Force
    bf_result = brute_force_closest_pair(points_data)
    
    # Run Divide & Conquer
    dc_result = run_closest_pair(points_data)
    
    return jsonify({
        'brute_force': bf_result,
        'divide_and_conquer': dc_result
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
