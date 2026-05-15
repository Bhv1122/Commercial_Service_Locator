from flask import Flask, render_template, request, jsonify
import math

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/benchmark', methods=['POST'])
def benchmark():
    data = request.get_json()
    if not data or 'points' not in data:
        return jsonify({'error': 'Points array is required'}), 400

    points = data['points']
    n = len(points)
    
    # Calculate estimates to avoid long-running blocking requests for huge n
    brute_force_time_ms = (n * n) * 0.0000005 * 1000
    if n > 0:
        divide_conquer_time_ms = (n * math.log2(n)) * 0.000002 * 1000
    else:
        divide_conquer_time_ms = 0
        
    return jsonify({
        'n': n,
        'bruteForceTimeMs': round(brute_force_time_ms, 4),
        'divideConquerTimeMs': round(divide_conquer_time_ms, 4)
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
