-- migrate:up
-- ==============================================================================
-- CUSTOM GPS DISTANCE AGGREGATE - БEZ PostGIS
-- ==============================================================================
-- Haversine formula za precizno računanje distance između GPS tačaka
-- Parallelizable sa COMBINEFUNC → radi sa kompresovanim chunk-ovima
-- ==============================================================================

-- 1. TYPE za GPS tačku
CREATE TYPE gps_point AS (
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    ts TIMESTAMPTZ
);

-- 2. HAVERSINE FORMULA - Earth distance calculation
CREATE OR REPLACE FUNCTION haversine_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    R CONSTANT DOUBLE PRECISION := 6371.0; -- Earth radius in km
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    -- Handle NULL values
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN 0.0;
    END IF;

    -- Convert to radians
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);

    -- Haversine formula
    a := sin(dlat/2.0) * sin(dlat/2.0) +
         cos(radians(lat1)) * cos(radians(lat2)) *
         sin(dlon/2.0) * sin(dlon/2.0);

    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION haversine_distance IS
'Calculates great-circle distance between two GPS points using Haversine formula. Returns distance in kilometers.';

-- 3. STATE FUNCTION - Accumulates GPS points into array
CREATE OR REPLACE FUNCTION gps_distance_sfunc(
    state public.gps_point[],
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    ts TIMESTAMPTZ
) RETURNS public.gps_point[] AS $$
BEGIN
    -- Skip NULL coordinates
    IF lat IS NULL OR lng IS NULL OR ts IS NULL THEN
        RETURN state;
    END IF;

    -- Append new GPS point to array
    RETURN state || ROW(lat, lng, ts)::public.gps_point;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- 4. COMBINE FUNCTION - Merges arrays from different chunks
CREATE OR REPLACE FUNCTION gps_distance_combinefunc(
    state1 public.gps_point[],
    state2 public.gps_point[]
) RETURNS public.gps_point[] AS $$
BEGIN
    -- Merge two arrays (will be sorted in finalfunc)
    RETURN state1 || state2;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- 5. FINAL FUNCTION - Sorts points and calculates total distance
CREATE OR REPLACE FUNCTION gps_distance_finalfunc(
    state public.gps_point[]
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    sorted_points public.gps_point[];
    total_distance DOUBLE PRECISION := 0.0;
    i INTEGER;
BEGIN
    -- Return 0 if no points or only one point
    IF state IS NULL OR array_length(state, 1) IS NULL OR array_length(state, 1) < 2 THEN
        RETURN 0.0;
    END IF;

    -- Sort points by timestamp
    SELECT array_agg(point ORDER BY (point).ts)
    INTO sorted_points
    FROM unnest(state) AS point;

    -- Calculate total distance between consecutive points
    FOR i IN 2..array_length(sorted_points, 1) LOOP
        total_distance := total_distance + public.haversine_distance(
            (sorted_points[i-1]).lat,
            (sorted_points[i-1]).lng,
            (sorted_points[i]).lat,
            (sorted_points[i]).lng
        );
    END LOOP;

    RETURN total_distance;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- 6. CUSTOM AGGREGATE - Combines all functions
CREATE AGGREGATE gps_total_distance(
    DOUBLE PRECISION,  -- lat
    DOUBLE PRECISION,  -- lng
    TIMESTAMPTZ        -- time
) (
    SFUNC = gps_distance_sfunc,
    STYPE = public.gps_point[],
    FINALFUNC = gps_distance_finalfunc,
    COMBINEFUNC = gps_distance_combinefunc,
    INITCOND = '{}',
    PARALLEL = SAFE
);

COMMENT ON AGGREGATE gps_total_distance(DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ) IS
'Calculates total GPS distance by summing Haversine distances between consecutive points. Parallelizable and works with compressed chunks.';

-- migrate:down

DROP AGGREGATE IF EXISTS gps_total_distance(DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS gps_distance_finalfunc(gps_point[]);
DROP FUNCTION IF EXISTS gps_distance_combinefunc(gps_point[], gps_point[]);
DROP FUNCTION IF EXISTS gps_distance_sfunc(gps_point[], DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS haversine_distance(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP TYPE IF EXISTS gps_point;
