#!/bin/bash

# Extract environmental zone boundaries from raster to GeoJSON
# This script converts the EEA Environmental Zones raster to vector polygons

# Set paths
GDAL_POLYGONIZE="/opt/homebrew/bin/gdal_polygonize.py"
OGR2OGR="/opt/homebrew/bin/ogr2ogr"
RASTER_FILE="raw-data/environmental-zones/eea_r_3035_1_km_env-zones_p_2018_v01_r00.tif"
TEMP_SHAPEFILE="raw-data/environmental-zones/temp_zones.shp"
OUTPUT_GEOJSON="public/data/environmental-zones.geojson"

# Check if input file exists
if [ ! -f "$RASTER_FILE" ]; then
    echo "Error: Raster file not found: $RASTER_FILE"
    exit 1
fi

echo "Converting raster to vector polygons..."

# Polygonize the raster (convert raster pixels to vector polygons)
"$GDAL_POLYGONIZE" "$RASTER_FILE" -f "ESRI Shapefile" "$TEMP_SHAPEFILE" zones DN

echo "Converting to GeoJSON and filtering for Portugal zones..."

# Convert to GeoJSON, filter for Portugal zones (9, 11, 12, 13), and reproject to WGS84
# Zone 9 = Lusitano
# Zone 11 = Mediterrânico Montanhoso
# Zone 12 = Mediterrânico Norte
# Zone 13 = Mediterrânico Sul
"$OGR2OGR" -f "GeoJSON" \
    -t_srs EPSG:4326 \
    -where "DN IN (9, 11, 12, 13)" \
    -simplify 500 \
    "$OUTPUT_GEOJSON" \
    "$TEMP_SHAPEFILE"

# Clean up temporary shapefile
rm -f raw-data/environmental-zones/temp_zones.*

echo "✓ Environmental zones boundaries saved to $OUTPUT_GEOJSON"
