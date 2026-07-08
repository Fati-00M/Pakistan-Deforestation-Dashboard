import csv
import json
import os
import math

def preprocess():
    csv_file = 'Deforestation_by_location.csv'
    output_js_file = 'data.js'
    
    print(f"Reading {csv_file}...")
    
    stats_agg = {}
    grid_agg = {}
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        row_count = 0
        for row in reader:
            row_count += 1
            try:
                # Extract year
                y_str = row.get('year') or ''
                if not y_str:
                    continue
                year = int(y_str)
                
                # Extract canopy cover
                c_str = row.get('treecover2000') or ''
                if not c_str:
                    continue
                canopy = int(c_str)
                
                # Extract administrative locations
                province = (row.get('adm1_name') or '').strip()
                if not province:
                    province = "Unknown"
                
                district = (row.get('adm2_name') or '').strip()
                if not district:
                    district = "Unknown"
                
                # Update stats aggregation
                stats_key = (year, canopy, province, district)
                stats_agg[stats_key] = stats_agg.get(stats_key, 0) + 1
                
                # Extract coordinates
                lat_str = row.get('latitude') or ''
                lon_str = row.get('longitude') or ''
                if lat_str and lon_str:
                    lat = float(lat_str)
                    lon = float(lon_str)
                    
                    # Round coordinates to 0.05 degree resolution (~5km)
                    glat = round(round(lat / 0.05) * 0.05, 4)
                    glon = round(round(lon / 0.05) * 0.05, 4)
                    
                    grid_key = (year, glat, glon, province, district)
                    if grid_key not in grid_agg:
                        grid_agg[grid_key] = {'count': 0, 'canopy_sum': 0}
                    grid_agg[grid_key]['count'] += 1
                    grid_agg[grid_key]['canopy_sum'] += canopy
                    
            except Exception as e:
                # Skip any malformed rows silently
                continue

    print(f"Processed {row_count} rows.")
    
    # Format stats output as array of dicts with short keys
    stats_list = []
    for (year, canopy, province, district), count in stats_agg.items():
        stats_list.append({
            'y': year,
            'c': canopy,
            'p': province,
            'd': district,
            'v': count
        })
        
    # Format grid output as array of dicts
    grid_list = []
    for (year, lat, lon, province, district), info in grid_agg.items():
        avg_canopy = round(info['canopy_sum'] / info['count'], 1) if info['count'] > 0 else 0
        grid_list.append({
            'y': year,
            'lat': lat,
            'lng': lon,
            'p': province,
            'd': district,
            'v': info['count'],
            'c': avg_canopy
        })
        
    print(f"Aggregated stats size: {len(stats_list)} records.")
    print(f"Aggregated grid size: {len(grid_list)} records.")
    
    # Write to data.js
    with open(output_js_file, 'w', encoding='utf-8') as out_f:
        out_f.write("// Pakistan Deforestation Dashboard Preprocessed Data\n")
        out_f.write("// Stats: y=year, c=canopy, p=province, d=district, v=pixel_count\n")
        out_f.write("const DEFORESTATION_STATS = ")
        json.dump(stats_list, out_f, separators=(',', ':'))
        out_f.write(";\n\n")
        out_f.write("// Grid: y=year, lat=latitude, lng=longitude, p=province, d=district, v=pixel_count, c=avg_canopy\n")
        out_f.write("const DEFORESTATION_GRID = ")
        json.dump(grid_list, out_f, separators=(',', ':'))
        out_f.write(";\n")
        
    print(f"Successfully generated {output_js_file}!")

if __name__ == '__main__':
    preprocess()
