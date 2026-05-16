import math
import time

def euclidean_distance(p1, p2):
    # p1 and p2 are (x, y, id, type, data_dict)
    if p1[3] == p2[3]:
        return float('inf') # Infinity if both are services or both are emergencies
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def brute_force_closest_pair(points):
    min_dist = float('inf')
    closest_pair = None
    comparisons = 0
    start_time = time.perf_counter()
    
    n = len(points)
    for i in range(n):
        for j in range(i + 1, n):
            comparisons += 1
            if points[i][3] != points[j][3]:
                dist = math.sqrt((points[i][0] - points[j][0])**2 + (points[i][1] - points[j][1])**2)
                if dist < min_dist:
                    min_dist = dist
                    closest_pair = (points[i], points[j])
                    
    end_time = time.perf_counter()
    return {
        'closest_pair': closest_pair,
        'min_dist': min_dist,
        'comparisons': comparisons,
        'time_ms': (end_time - start_time) * 1000
    }

def divide_and_conquer_closest_pair(points_x, points_y, depth=0, viz_steps=None):
    if viz_steps is None:
        viz_steps = []
        
    n = len(points_x)
    
    if n <= 3:
        # Base case: use brute force
        res = brute_force_closest_pair(points_x)
        viz_steps.append({
            'type': 'base_case',
            'depth': depth,
            'points': [p[2] for p in points_x], # Send IDs
            'min_dist': res['min_dist'],
            'closest_pair': [p[2] for p in res['closest_pair']] if res['closest_pair'] else None
        })
        res['viz_steps'] = viz_steps
        return res
        
    mid = n // 2
    mid_point = points_x[mid]
    
    viz_steps.append({
        'type': 'split',
        'depth': depth,
        'mid_x': mid_point[0],
        'left_points': [p[2] for p in points_x[:mid]],
        'right_points': [p[2] for p in points_x[mid:]]
    })
    
    left_y = []
    right_y = []
    for p in points_y:
        if p[0] <= mid_point[0]:
            left_y.append(p)
        else:
            right_y.append(p)
            
    res_left = divide_and_conquer_closest_pair(points_x[:mid], left_y, depth + 1, viz_steps)
    res_right = divide_and_conquer_closest_pair(points_x[mid:], right_y, depth + 1, viz_steps)
    
    if res_left['min_dist'] < res_right['min_dist']:
        min_dist = res_left['min_dist']
        closest_pair = res_left['closest_pair']
    else:
        min_dist = res_right['min_dist']
        closest_pair = res_right['closest_pair']
        
    comparisons = res_left['comparisons'] + res_right['comparisons'] + 1
    
    # Check strip
    strip = []
    for p in points_y:
        if abs(p[0] - mid_point[0]) < min_dist:
            strip.append(p)
            
    viz_steps.append({
        'type': 'strip_check',
        'depth': depth,
        'strip_points': [p[2] for p in strip],
        'current_min': min_dist
    })
    
    strip_len = len(strip)
    for i in range(strip_len):
        for j in range(i + 1, min(i + 7, strip_len)):
            comparisons += 1
            if strip[i][3] != strip[j][3]:
                dist = math.sqrt((strip[i][0] - strip[j][0])**2 + (strip[i][1] - strip[j][1])**2)
                if dist < min_dist:
                    min_dist = dist
                    closest_pair = (strip[i], strip[j])
                    
    viz_steps.append({
        'type': 'merge',
        'depth': depth,
        'min_dist': min_dist,
        'closest_pair': [p[2] for p in closest_pair] if closest_pair else None
    })
    
    return {
        'closest_pair': closest_pair,
        'min_dist': min_dist,
        'comparisons': comparisons,
        'viz_steps': viz_steps
    }

def run_closest_pair(points):
    start_time = time.perf_counter()
    points_x = sorted(points, key=lambda p: p[0])
    points_y = sorted(points, key=lambda p: p[1])
    
    res = divide_and_conquer_closest_pair(points_x, points_y)
    
    end_time = time.perf_counter()
    res['time_ms'] = (end_time - start_time) * 1000
    return res
