-- Add missing indexes for performance optimization
-- Date: 03.09.2025

-- Composite index for vehicle queries with time range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_data_vehicle_time 
ON gps_data (vehicle_id, time DESC);

-- Index for driving_events 
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driving_events_vehicle_time 
ON driving_events (vehicle_id, time DESC);

-- Index for location queries (PostGIS spatial index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_data_location 
ON gps_data USING GIST (location) 
WHERE location IS NOT NULL;

-- Partial index for active vehicles
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_data_active_vehicles 
ON gps_data (vehicle_id) 
WHERE time >= NOW() - INTERVAL '90 days';

-- Analyze tables after index creation
ANALYZE gps_data;
ANALYZE driving_events;