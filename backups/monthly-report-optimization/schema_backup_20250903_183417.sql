--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Ubuntu 16.9-1.pgdg22.04+1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-1.pgdg22.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: timescaledb; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS timescaledb WITH SCHEMA public;


--
-- Name: EXTENSION timescaledb; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION timescaledb IS 'Enables scalable inserts and complex queries for time-series data (Community Edition)';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: driving_event_type; Type: TYPE; Schema: public; Owner: smartcity_ts
--

CREATE TYPE public.driving_event_type AS ENUM (
    'harsh_acceleration',
    'harsh_braking',
    'sharp_turn',
    'speeding',
    'idle',
    'rapid_lane_change'
);


ALTER TYPE public.driving_event_type OWNER TO smartcity_ts;

--
-- Name: event_type; Type: TYPE; Schema: public; Owner: smartcity_ts
--

CREATE TYPE public.event_type AS ENUM (
    'acceleration',
    'braking',
    'cornering',
    'harsh_stop',
    'harsh_start'
);


ALTER TYPE public.event_type OWNER TO smartcity_ts;

--
-- Name: severity_level; Type: TYPE; Schema: public; Owner: smartcity_ts
--

CREATE TYPE public.severity_level AS ENUM (
    'normal',
    'moderate',
    'severe'
);


ALTER TYPE public.severity_level OWNER TO smartcity_ts;

--
-- Name: calculate_g_force(); Type: FUNCTION; Schema: public; Owner: smartcity_ts
--

CREATE FUNCTION public.calculate_g_force() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.g_force = ABS(NEW.acceleration_value) / 9.81;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_g_force() OWNER TO smartcity_ts;

--
-- Name: calculate_vehicle_mileage(integer, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: smartcity_ts
--

CREATE FUNCTION public.calculate_vehicle_mileage(p_vehicle_id integer, p_start_date timestamp with time zone, p_end_date timestamp with time zone) RETURNS TABLE(total_km numeric, avg_speed numeric, max_speed numeric, total_points integer, active_hours numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND(CAST(ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0 AS NUMERIC), 2) as total_km,
        ROUND(CAST(AVG(speed) AS NUMERIC), 1) as avg_speed,
        ROUND(CAST(MAX(speed) AS NUMERIC), 1) as max_speed,
        COUNT(*)::integer as total_points,
        ROUND(CAST(EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 3600.0 AS NUMERIC), 2) as active_hours
    FROM gps_data
    WHERE vehicle_id = p_vehicle_id
        AND time BETWEEN p_start_date AND p_end_date
        AND speed > 0;
END;
$$;


ALTER FUNCTION public.calculate_vehicle_mileage(p_vehicle_id integer, p_start_date timestamp with time zone, p_end_date timestamp with time zone) OWNER TO smartcity_ts;

--
-- Name: detect_aggressive_driving_batch(integer, character varying, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: smartcity_ts
--

CREATE FUNCTION public.detect_aggressive_driving_batch(p_vehicle_id integer, p_garage_no character varying, p_start_time timestamp with time zone, p_end_time timestamp with time zone) RETURNS TABLE(total_events integer, acceleration_events integer, braking_events integer, moderate_events integer, severe_events integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_detected_count INTEGER := 0;
BEGIN
    -- Detektuj agresivna ubrzanja/kočenja
    WITH speed_changes AS (
        SELECT 
            time,
            speed,
            LAG(speed) OVER (ORDER BY time) as prev_speed,
            LAG(time) OVER (ORDER BY time) as prev_time,
            LAG(lat) OVER (ORDER BY time) as prev_lat,
            LAG(lng) OVER (ORDER BY time) as prev_lng,
            lat,
            lng,
            course  -- Koristi COURSE umesto HEADING
        FROM gps_data
        WHERE vehicle_id = p_vehicle_id
            AND time BETWEEN p_start_time AND p_end_time
            AND speed IS NOT NULL
        ORDER BY time
    ),
    detected AS (
        SELECT 
            time,
            prev_time,
            speed,
            prev_speed,
            EXTRACT(EPOCH FROM (time - prev_time)) as time_diff_seconds,
            -- Računa ubrzanje u m/s²
            ((speed - prev_speed) * 0.27778) / NULLIF(EXTRACT(EPOCH FROM (time - prev_time)), 0) as acceleration_ms2,
            lat,
            lng,
            prev_lat,
            prev_lng,
            course
        FROM speed_changes
        WHERE prev_speed IS NOT NULL
            AND prev_time IS NOT NULL
            AND EXTRACT(EPOCH FROM (time - prev_time)) BETWEEN 1 AND 10
            -- Samo značajne promene brzine
            AND ABS(speed - prev_speed) > 2
    ),
    events_to_insert AS (
        SELECT 
            time,
            p_vehicle_id as vehicle_id,
            p_garage_no as garage_no,
            CASE 
                WHEN acceleration_ms2 > 0 THEN 'harsh_acceleration'::driving_event_type
                ELSE 'harsh_braking'::driving_event_type
            END as event_type,
            -- Mapiranje na INTEGER severity
            CASE 
                -- Za ubrzanja
                WHEN acceleration_ms2 > 2.5 THEN 5  -- severe acceleration
                WHEN acceleration_ms2 > 1.5 THEN 3  -- moderate acceleration
                WHEN acceleration_ms2 > 1.0 THEN 1  -- normal acceleration
                -- Za kočenja
                WHEN acceleration_ms2 < -3.5 THEN 5  -- severe braking
                WHEN acceleration_ms2 < -2.0 THEN 3  -- moderate braking
                WHEN acceleration_ms2 < -1.0 THEN 1  -- normal braking
                ELSE 1
            END as severity,
            prev_speed as speed_before,
            speed as speed_after,
            acceleration_ms2 as acceleration_value,
            ABS(acceleration_ms2) / 9.81 as g_force,
            (time_diff_seconds * 1000)::INTEGER as duration_ms,
            -- Računa približnu distancu
            ((prev_speed + speed) / 2.0) * time_diff_seconds / 3.6 as distance_meters,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326) as location,
            lat,
            lng,
            course as heading,  -- Mapiraj course na heading
            0.95 as confidence
        FROM detected
        WHERE 
            -- Filtriraj samo značajne događaje
            (acceleration_ms2 > 1.0 OR acceleration_ms2 < -1.0)
    )
    -- Insert događaje koji još ne postoje
    INSERT INTO driving_events (
        time, vehicle_id, garage_no, event_type, severity,
        speed_before, speed_after, acceleration_value, g_force,
        duration_ms, distance_meters, location, lat, lng, heading, confidence
    )
    SELECT DISTINCT ON (time, vehicle_id)
        time, vehicle_id, garage_no, event_type, severity,
        speed_before, speed_after, acceleration_value, g_force,
        duration_ms, distance_meters, location, lat, lng, heading, confidence
    FROM events_to_insert e
    WHERE NOT EXISTS (
        SELECT 1 FROM driving_events de 
        WHERE de.vehicle_id = e.vehicle_id 
            AND de.time = e.time
    )
    ON CONFLICT DO NOTHING;
    
    -- Vrati statistiku
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_events,
        COUNT(CASE WHEN event_type = 'harsh_acceleration' THEN 1 END)::INTEGER as acceleration_events,
        COUNT(CASE WHEN event_type = 'harsh_braking' THEN 1 END)::INTEGER as braking_events,
        COUNT(CASE WHEN severity = 3 THEN 1 END)::INTEGER as moderate_events,
        COUNT(CASE WHEN severity = 5 THEN 1 END)::INTEGER as severe_events
    FROM driving_events
    WHERE vehicle_id = p_vehicle_id
        AND time BETWEEN p_start_time AND p_end_time;
END;
$$;


ALTER FUNCTION public.detect_aggressive_driving_batch(p_vehicle_id integer, p_garage_no character varying, p_start_time timestamp with time zone, p_end_time timestamp with time zone) OWNER TO smartcity_ts;

--
-- Name: FUNCTION detect_aggressive_driving_batch(p_vehicle_id integer, p_garage_no character varying, p_start_time timestamp with time zone, p_end_time timestamp with time zone); Type: COMMENT; Schema: public; Owner: smartcity_ts
--

COMMENT ON FUNCTION public.detect_aggressive_driving_batch(p_vehicle_id integer, p_garage_no character varying, p_start_time timestamp with time zone, p_end_time timestamp with time zone) IS 'Detektuje agresivnu vožnju iz GPS podataka - FINALNA VERZIJA koja koristi course umesto heading';


--
-- Name: find_vehicles_near_point(double precision, double precision, integer); Type: FUNCTION; Schema: public; Owner: smartcity_ts
--

CREATE FUNCTION public.find_vehicles_near_point(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 1000) RETURNS TABLE(vehicle_id integer, garage_no character varying, distance_meters numeric, speed smallint, line_number character varying, last_update timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.vehicle_id,
        v.garage_no,
        ROUND(ST_Distance(
            v.location::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )::NUMERIC, 2) as distance_meters,
        v.speed,
        v.line_number,
        v.time as last_update
    FROM current_vehicle_positions v
    WHERE ST_DWithin(
        v.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_meters
    )
    ORDER BY distance_meters;
END;
$$;


ALTER FUNCTION public.find_vehicles_near_point(p_lat double precision, p_lng double precision, p_radius_meters integer) OWNER TO smartcity_ts;

--
-- Name: get_vehicle_driving_statistics(integer, date, date); Type: FUNCTION; Schema: public; Owner: smartcity_ts
--

CREATE FUNCTION public.get_vehicle_driving_statistics(p_vehicle_id integer, p_start_date date, p_end_date date) RETURNS TABLE(total_events integer, severe_accelerations integer, moderate_accelerations integer, severe_brakings integer, moderate_brakings integer, avg_g_force numeric, max_g_force numeric, total_distance_km numeric, events_per_100km numeric, most_common_hour integer, safety_score integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH event_stats AS (
        SELECT 
            COUNT(*) as evt_count,
            -- Koristi INTEGER severity (5=severe, 3=moderate, 1=normal)
            -- i ispravne enum vrednosti (harsh_acceleration, harsh_braking)
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity >= 4) as severe_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration' AND severity = 3) as moderate_acc,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity >= 4) as severe_brake,
            COUNT(*) FILTER (WHERE event_type = 'harsh_braking' AND severity = 3) as moderate_brake,
            AVG(g_force) as avg_g,
            MAX(g_force) as max_g,
            SUM(COALESCE(distance_meters, 0)) / 1000.0 as total_dist_km,
            MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM time)) as common_hour
        FROM driving_events
        WHERE vehicle_id = p_vehicle_id
            AND time::DATE BETWEEN p_start_date AND p_end_date
    ),
    -- Kalkuliši kilometražu iz GPS podataka za tačnu vrednost
    distance_stats AS (
        SELECT 
            COALESCE(
                (
                    WITH ordered_points AS (
                        SELECT 
                            location,
                            LAG(location) OVER (ORDER BY time) as prev_location
                        FROM gps_data
                        WHERE vehicle_id = p_vehicle_id
                            AND time::DATE BETWEEN p_start_date AND p_end_date
                            AND location IS NOT NULL
                        ORDER BY time
                    )
                    SELECT 
                        SUM(ST_Distance(prev_location::geography, location::geography)) / 1000.0
                    FROM ordered_points
                    WHERE prev_location IS NOT NULL
                ),
                0
            ) as total_km
    )
    SELECT 
        COALESCE(evt_count, 0)::INTEGER,
        COALESCE(severe_acc, 0)::INTEGER,
        COALESCE(moderate_acc, 0)::INTEGER,
        COALESCE(severe_brake, 0)::INTEGER,
        COALESCE(moderate_brake, 0)::INTEGER,
        ROUND(COALESCE(avg_g, 0)::NUMERIC, 3),
        ROUND(COALESCE(max_g, 0)::NUMERIC, 3),
        ROUND(COALESCE(d.total_km, 0)::NUMERIC, 2),
        CASE 
            WHEN d.total_km > 0 THEN 
                ROUND((evt_count::NUMERIC / d.total_km * 100)::NUMERIC, 2)
            ELSE 0
        END,
        COALESCE(common_hour, 0)::INTEGER,
        -- Realnija safety score formula
        CASE
            WHEN evt_count = 0 OR d.total_km = 0 THEN 100
            ELSE 
                GREATEST(
                    50,
                    LEAST(
                        100,
                        100 - LEAST(40,
                            -- Severe eventi × 3 poena
                            ((severe_acc + severe_brake)::NUMERIC / GREATEST(d.total_km, 1) * 100 * 3)::INTEGER +
                            -- Moderate eventi × 1 poen  
                            ((moderate_acc + moderate_brake)::NUMERIC / GREATEST(d.total_km, 1) * 100 * 1)::INTEGER
                        )
                    )
                )
        END::INTEGER
    FROM event_stats, distance_stats d;
END;
$$;


ALTER FUNCTION public.get_vehicle_driving_statistics(p_vehicle_id integer, p_start_date date, p_end_date date) OWNER TO smartcity_ts;

--
-- Name: FUNCTION get_vehicle_driving_statistics(p_vehicle_id integer, p_start_date date, p_end_date date); Type: COMMENT; Schema: public; Owner: smartcity_ts
--

COMMENT ON FUNCTION public.get_vehicle_driving_statistics(p_vehicle_id integer, p_start_date date, p_end_date date) IS 'FINALNA VERZIJA - koristi INTEGER severity (1=normal, 3=moderate, 5=severe) i ispravne enum vrednosti (harsh_acceleration, harsh_braking)';


--
-- Name: set_gps_location(); Type: FUNCTION; Schema: public; Owner: smartcity_ts
--

CREATE FUNCTION public.set_gps_location() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_gps_location() OWNER TO smartcity_ts;

--
-- Name: update_garage_number(integer, character varying); Type: FUNCTION; Schema: public; Owner: smartcity_ts
--

CREATE FUNCTION public.update_garage_number(p_vehicle_id integer, p_new_garage_no character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE gps_data 
    SET garage_no = p_new_garage_no 
    WHERE vehicle_id = p_vehicle_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    UPDATE driving_events
    SET garage_no = p_new_garage_no
    WHERE vehicle_id = p_vehicle_id;
    
    RAISE NOTICE 'Ažurirano % GPS tačaka za vozilo ID %', updated_count, p_vehicle_id;
    RETURN updated_count;
END;
$$;


ALTER FUNCTION public.update_garage_number(p_vehicle_id integer, p_new_garage_no character varying) OWNER TO smartcity_ts;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _compressed_hypertable_19; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._compressed_hypertable_19 (
);


ALTER TABLE _timescaledb_internal._compressed_hypertable_19 OWNER TO smartcity_ts;

--
-- Name: gps_data; Type: TABLE; Schema: public; Owner: smartcity_ts
--

CREATE TABLE public.gps_data (
    "time" timestamp with time zone NOT NULL,
    vehicle_id integer NOT NULL,
    garage_no character varying(20) NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    location public.geometry(Point,4326),
    speed double precision DEFAULT 0,
    course double precision,
    alt double precision,
    state integer DEFAULT 0,
    in_route boolean DEFAULT false,
    line_number character varying(10),
    departure_id integer,
    people_in integer DEFAULT 0,
    people_out integer DEFAULT 0,
    data_source character varying(50) DEFAULT 'legacy_sync'::character varying
);


ALTER TABLE public.gps_data OWNER TO smartcity_ts;

--
-- Name: _direct_view_21; Type: VIEW; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE VIEW _timescaledb_internal._direct_view_21 AS
 SELECT public.time_bucket('01:00:00'::interval, "time") AS hour,
    vehicle_id,
    garage_no,
    count(*) AS point_count,
    (avg(speed))::numeric(5,2) AS avg_speed,
    (max(speed))::numeric(5,2) AS max_speed,
    (min(
        CASE
            WHEN (speed > (0)::double precision) THEN speed
            ELSE NULL::double precision
        END))::numeric(5,2) AS min_moving_speed,
    (percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY speed))::numeric(5,2) AS speed_95th,
    (stddev(speed))::numeric(5,2) AS speed_std_dev,
    round(((public.st_length((public.st_makeline(location ORDER BY "time"))::public.geography) / (1000.0)::double precision))::numeric, 2) AS distance_km,
    count(
        CASE
            WHEN (speed = (0)::double precision) THEN 1
            ELSE NULL::integer
        END) AS stop_count,
    count(
        CASE
            WHEN (speed > (50)::double precision) THEN 1
            ELSE NULL::integer
        END) AS speeding_count
   FROM public.gps_data
  WHERE (vehicle_id IS NOT NULL)
  GROUP BY (public.time_bucket('01:00:00'::interval, "time")), vehicle_id, garage_no;


ALTER VIEW _timescaledb_internal._direct_view_21 OWNER TO smartcity_ts;

--
-- Name: _direct_view_22; Type: VIEW; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE VIEW _timescaledb_internal._direct_view_22 AS
 SELECT public.time_bucket('1 day'::interval, "time") AS day,
    vehicle_id,
    garage_no,
    count(*) AS total_points,
    count(DISTINCT date_trunc('hour'::text, "time")) AS active_hours,
    (avg(speed))::numeric(5,2) AS avg_speed,
    (max(speed))::numeric(5,2) AS max_speed,
    (percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY speed))::numeric(5,2) AS median_speed,
    (percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY speed))::numeric(5,2) AS speed_95th,
    round(((public.st_length((public.st_makeline(location ORDER BY "time"))::public.geography) / (1000.0)::double precision))::numeric, 2) AS total_km,
    min("time") AS first_point,
    max("time") AS last_point,
    (EXTRACT(epoch FROM (max("time") - min("time"))) / 3600.0) AS active_hours_decimal,
    count(
        CASE
            WHEN (speed > (50)::double precision) THEN 1
            ELSE NULL::integer
        END) AS speeding_points,
    count(
        CASE
            WHEN (speed = (0)::double precision) THEN 1
            ELSE NULL::integer
        END) AS stopped_points
   FROM public.gps_data
  WHERE (vehicle_id IS NOT NULL)
  GROUP BY (public.time_bucket('1 day'::interval, "time")), vehicle_id, garage_no;


ALTER VIEW _timescaledb_internal._direct_view_22 OWNER TO smartcity_ts;

--
-- Name: _hyper_18_914_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_914_chunk (
    CONSTRAINT constraint_908 CHECK ((("time" >= '2025-08-29 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-30 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_914_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_915_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_915_chunk (
    CONSTRAINT constraint_909 CHECK ((("time" >= '2025-08-30 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-31 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_915_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_916_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_916_chunk (
    CONSTRAINT constraint_910 CHECK ((("time" >= '2025-08-31 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-09-01 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_916_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_922_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_922_chunk (
    CONSTRAINT constraint_916 CHECK ((("time" >= '2025-08-20 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-21 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_922_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_923_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_923_chunk (
    CONSTRAINT constraint_917 CHECK ((("time" >= '2025-08-21 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-22 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_923_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_924_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_924_chunk (
    CONSTRAINT constraint_918 CHECK ((("time" >= '2025-08-22 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-23 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_924_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_925_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_925_chunk (
    CONSTRAINT constraint_919 CHECK ((("time" >= '2025-08-23 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-24 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_925_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_926_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_926_chunk (
    CONSTRAINT constraint_920 CHECK ((("time" >= '2025-08-24 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-25 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_926_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_927_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_927_chunk (
    CONSTRAINT constraint_921 CHECK ((("time" >= '2025-08-25 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-26 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_927_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_928_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_928_chunk (
    CONSTRAINT constraint_922 CHECK ((("time" >= '2025-08-26 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-27 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_928_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_929_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_929_chunk (
    CONSTRAINT constraint_923 CHECK ((("time" >= '2025-08-27 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-28 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_929_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_930_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_930_chunk (
    CONSTRAINT constraint_924 CHECK ((("time" >= '2025-08-28 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-29 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_930_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_931_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_931_chunk (
    CONSTRAINT constraint_925 CHECK ((("time" >= '2025-09-01 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-09-02 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_931_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_941_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_941_chunk (
    CONSTRAINT constraint_929 CHECK ((("time" >= '2025-09-02 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-09-03 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_941_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_944_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_944_chunk (
    CONSTRAINT constraint_930 CHECK ((("time" >= '2025-09-03 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-09-04 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_944_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_952_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_952_chunk (
    CONSTRAINT constraint_938 CHECK ((("time" >= '2024-12-30 00:00:00+00'::timestamp with time zone) AND ("time" < '2024-12-31 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_952_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_953_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_953_chunk (
    CONSTRAINT constraint_939 CHECK ((("time" >= '2025-08-01 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-02 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_953_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_954_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_954_chunk (
    CONSTRAINT constraint_940 CHECK ((("time" >= '2025-08-02 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-03 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_954_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_955_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_955_chunk (
    CONSTRAINT constraint_941 CHECK ((("time" >= '2025-08-03 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-04 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_955_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_956_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_956_chunk (
    CONSTRAINT constraint_942 CHECK ((("time" >= '2025-08-04 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-05 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_956_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_957_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_957_chunk (
    CONSTRAINT constraint_943 CHECK ((("time" >= '2025-08-05 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-06 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_957_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_958_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_958_chunk (
    CONSTRAINT constraint_944 CHECK ((("time" >= '2025-08-06 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-07 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_958_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_959_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_959_chunk (
    CONSTRAINT constraint_945 CHECK ((("time" >= '2025-08-07 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-08 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_959_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_960_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_960_chunk (
    CONSTRAINT constraint_946 CHECK ((("time" >= '2025-08-08 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-09 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_960_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_961_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_961_chunk (
    CONSTRAINT constraint_947 CHECK ((("time" >= '2025-08-09 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-10 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_961_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_962_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_962_chunk (
    CONSTRAINT constraint_948 CHECK ((("time" >= '2025-08-10 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-11 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_962_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_963_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_963_chunk (
    CONSTRAINT constraint_949 CHECK ((("time" >= '2025-08-11 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-12 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_963_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_964_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_964_chunk (
    CONSTRAINT constraint_950 CHECK ((("time" >= '2025-08-12 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-13 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_964_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_965_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_965_chunk (
    CONSTRAINT constraint_951 CHECK ((("time" >= '2025-08-13 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-14 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_965_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_966_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_966_chunk (
    CONSTRAINT constraint_952 CHECK ((("time" >= '2025-08-14 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-15 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_966_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_967_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_967_chunk (
    CONSTRAINT constraint_953 CHECK ((("time" >= '2025-08-15 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-16 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_967_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_968_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_968_chunk (
    CONSTRAINT constraint_954 CHECK ((("time" >= '2025-08-16 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-17 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_968_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_969_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_969_chunk (
    CONSTRAINT constraint_955 CHECK ((("time" >= '2025-08-17 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-18 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_969_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_970_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_970_chunk (
    CONSTRAINT constraint_956 CHECK ((("time" >= '2025-08-18 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-19 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_970_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_18_971_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_18_971_chunk (
    CONSTRAINT constraint_957 CHECK ((("time" >= '2025-08-19 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-20 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gps_data);


ALTER TABLE _timescaledb_internal._hyper_18_971_chunk OWNER TO smartcity_ts;

--
-- Name: driving_events; Type: TABLE; Schema: public; Owner: smartcity_ts
--

CREATE TABLE public.driving_events (
    id integer NOT NULL,
    "time" timestamp with time zone NOT NULL,
    vehicle_id integer NOT NULL,
    garage_no character varying(20) NOT NULL,
    event_type public.driving_event_type NOT NULL,
    severity integer,
    speed_before double precision,
    speed_after double precision,
    acceleration double precision,
    location public.geometry(Point,4326),
    lat double precision,
    lng double precision,
    duration_ms integer,
    threshold_value double precision,
    actual_value double precision,
    metadata jsonb,
    acceleration_value double precision,
    g_force double precision,
    distance_meters double precision DEFAULT 0,
    heading double precision,
    confidence double precision DEFAULT 0.8,
    CONSTRAINT driving_events_severity_check CHECK (((severity >= 1) AND (severity <= 5)))
);


ALTER TABLE public.driving_events OWNER TO smartcity_ts;

--
-- Name: _hyper_20_921_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_20_921_chunk (
    CONSTRAINT constraint_915 CHECK ((("time" >= '2025-08-28 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-09-04 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.driving_events);


ALTER TABLE _timescaledb_internal._hyper_20_921_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_20_932_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_20_932_chunk (
    CONSTRAINT constraint_926 CHECK ((("time" >= '2025-08-14 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-21 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.driving_events);


ALTER TABLE _timescaledb_internal._hyper_20_932_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_20_933_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_20_933_chunk (
    CONSTRAINT constraint_927 CHECK ((("time" >= '2025-08-21 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-28 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.driving_events);


ALTER TABLE _timescaledb_internal._hyper_20_933_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_20_972_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_20_972_chunk (
    CONSTRAINT constraint_958 CHECK ((("time" >= '2025-07-31 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-07 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.driving_events);


ALTER TABLE _timescaledb_internal._hyper_20_972_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_20_973_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_20_973_chunk (
    CONSTRAINT constraint_959 CHECK ((("time" >= '2025-08-07 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-08-14 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.driving_events);


ALTER TABLE _timescaledb_internal._hyper_20_973_chunk OWNER TO smartcity_ts;

--
-- Name: _materialized_hypertable_21; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_21 (
    hour timestamp with time zone NOT NULL,
    vehicle_id integer,
    garage_no character varying(20),
    point_count bigint,
    avg_speed numeric(5,2),
    max_speed numeric(5,2),
    min_moving_speed numeric(5,2),
    speed_95th numeric(5,2),
    speed_std_dev numeric(5,2),
    distance_km numeric,
    stop_count bigint,
    speeding_count bigint
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_21 OWNER TO smartcity_ts;

--
-- Name: _hyper_21_917_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_21_917_chunk (
    CONSTRAINT constraint_911 CHECK (((hour >= '2025-08-30 00:00:00+00'::timestamp with time zone) AND (hour < '2025-09-09 00:00:00+00'::timestamp with time zone)))
)
INHERITS (_timescaledb_internal._materialized_hypertable_21);


ALTER TABLE _timescaledb_internal._hyper_21_917_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_21_920_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_21_920_chunk (
    CONSTRAINT constraint_914 CHECK (((hour >= '2025-08-20 00:00:00+00'::timestamp with time zone) AND (hour < '2025-08-30 00:00:00+00'::timestamp with time zone)))
)
INHERITS (_timescaledb_internal._materialized_hypertable_21);


ALTER TABLE _timescaledb_internal._hyper_21_920_chunk OWNER TO smartcity_ts;

--
-- Name: _materialized_hypertable_22; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_22 (
    day timestamp with time zone NOT NULL,
    vehicle_id integer,
    garage_no character varying(20),
    total_points bigint,
    active_hours bigint,
    avg_speed numeric(5,2),
    max_speed numeric(5,2),
    median_speed numeric(5,2),
    speed_95th numeric(5,2),
    total_km numeric,
    first_point timestamp with time zone,
    last_point timestamp with time zone,
    active_hours_decimal numeric,
    speeding_points bigint,
    stopped_points bigint
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_22 OWNER TO smartcity_ts;

--
-- Name: _hyper_22_918_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_22_918_chunk (
    CONSTRAINT constraint_912 CHECK (((day >= '2025-08-30 00:00:00+00'::timestamp with time zone) AND (day < '2025-09-09 00:00:00+00'::timestamp with time zone)))
)
INHERITS (_timescaledb_internal._materialized_hypertable_22);


ALTER TABLE _timescaledb_internal._hyper_22_918_chunk OWNER TO smartcity_ts;

--
-- Name: _hyper_22_919_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal._hyper_22_919_chunk (
    CONSTRAINT constraint_913 CHECK (((day >= '2025-08-20 00:00:00+00'::timestamp with time zone) AND (day < '2025-08-30 00:00:00+00'::timestamp with time zone)))
)
INHERITS (_timescaledb_internal._materialized_hypertable_22);


ALTER TABLE _timescaledb_internal._hyper_22_919_chunk OWNER TO smartcity_ts;

--
-- Name: _partial_view_21; Type: VIEW; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE VIEW _timescaledb_internal._partial_view_21 AS
 SELECT public.time_bucket('01:00:00'::interval, "time") AS hour,
    vehicle_id,
    garage_no,
    count(*) AS point_count,
    (avg(speed))::numeric(5,2) AS avg_speed,
    (max(speed))::numeric(5,2) AS max_speed,
    (min(
        CASE
            WHEN (speed > (0)::double precision) THEN speed
            ELSE NULL::double precision
        END))::numeric(5,2) AS min_moving_speed,
    (percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY speed))::numeric(5,2) AS speed_95th,
    (stddev(speed))::numeric(5,2) AS speed_std_dev,
    round(((public.st_length((public.st_makeline(location ORDER BY "time"))::public.geography) / (1000.0)::double precision))::numeric, 2) AS distance_km,
    count(
        CASE
            WHEN (speed = (0)::double precision) THEN 1
            ELSE NULL::integer
        END) AS stop_count,
    count(
        CASE
            WHEN (speed > (50)::double precision) THEN 1
            ELSE NULL::integer
        END) AS speeding_count
   FROM public.gps_data
  WHERE (vehicle_id IS NOT NULL)
  GROUP BY (public.time_bucket('01:00:00'::interval, "time")), vehicle_id, garage_no;


ALTER VIEW _timescaledb_internal._partial_view_21 OWNER TO smartcity_ts;

--
-- Name: _partial_view_22; Type: VIEW; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE VIEW _timescaledb_internal._partial_view_22 AS
 SELECT public.time_bucket('1 day'::interval, "time") AS day,
    vehicle_id,
    garage_no,
    count(*) AS total_points,
    count(DISTINCT date_trunc('hour'::text, "time")) AS active_hours,
    (avg(speed))::numeric(5,2) AS avg_speed,
    (max(speed))::numeric(5,2) AS max_speed,
    (percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY speed))::numeric(5,2) AS median_speed,
    (percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY speed))::numeric(5,2) AS speed_95th,
    round(((public.st_length((public.st_makeline(location ORDER BY "time"))::public.geography) / (1000.0)::double precision))::numeric, 2) AS total_km,
    min("time") AS first_point,
    max("time") AS last_point,
    (EXTRACT(epoch FROM (max("time") - min("time"))) / 3600.0) AS active_hours_decimal,
    count(
        CASE
            WHEN (speed > (50)::double precision) THEN 1
            ELSE NULL::integer
        END) AS speeding_points,
    count(
        CASE
            WHEN (speed = (0)::double precision) THEN 1
            ELSE NULL::integer
        END) AS stopped_points
   FROM public.gps_data
  WHERE (vehicle_id IS NOT NULL)
  GROUP BY (public.time_bucket('1 day'::interval, "time")), vehicle_id, garage_no;


ALTER VIEW _timescaledb_internal._partial_view_22 OWNER TO smartcity_ts;

--
-- Name: compress_hyper_19_934_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal.compress_hyper_19_934_chunk (
    _ts_meta_count integer,
    vehicle_id integer,
    _ts_meta_min_1 timestamp with time zone,
    _ts_meta_max_1 timestamp with time zone,
    "time" _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_garage_no _timescaledb_internal.bloom1,
    garage_no _timescaledb_internal.compressed_data,
    lat _timescaledb_internal.compressed_data,
    lng _timescaledb_internal.compressed_data,
    location _timescaledb_internal.compressed_data,
    _ts_meta_v2_min_speed double precision,
    _ts_meta_v2_max_speed double precision,
    speed _timescaledb_internal.compressed_data,
    course _timescaledb_internal.compressed_data,
    alt _timescaledb_internal.compressed_data,
    state _timescaledb_internal.compressed_data,
    in_route _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_line_number _timescaledb_internal.bloom1,
    line_number _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_departure_id _timescaledb_internal.bloom1,
    departure_id _timescaledb_internal.compressed_data,
    people_in _timescaledb_internal.compressed_data,
    people_out _timescaledb_internal.compressed_data,
    data_source _timescaledb_internal.compressed_data
)
WITH (toast_tuple_target='128');
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_count SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN vehicle_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_min_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_max_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN "time" SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN garage_no SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN garage_no SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN lat SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN lng SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN location SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN location SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_v2_min_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_v2_max_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN speed SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN course SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN alt SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN state SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN in_route SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN line_number SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN line_number SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN departure_id SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN people_in SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN people_out SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN data_source SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_934_chunk ALTER COLUMN data_source SET STORAGE EXTENDED;


ALTER TABLE _timescaledb_internal.compress_hyper_19_934_chunk OWNER TO smartcity_ts;

--
-- Name: compress_hyper_19_935_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal.compress_hyper_19_935_chunk (
    _ts_meta_count integer,
    vehicle_id integer,
    _ts_meta_min_1 timestamp with time zone,
    _ts_meta_max_1 timestamp with time zone,
    "time" _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_garage_no _timescaledb_internal.bloom1,
    garage_no _timescaledb_internal.compressed_data,
    lat _timescaledb_internal.compressed_data,
    lng _timescaledb_internal.compressed_data,
    location _timescaledb_internal.compressed_data,
    _ts_meta_v2_min_speed double precision,
    _ts_meta_v2_max_speed double precision,
    speed _timescaledb_internal.compressed_data,
    course _timescaledb_internal.compressed_data,
    alt _timescaledb_internal.compressed_data,
    state _timescaledb_internal.compressed_data,
    in_route _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_line_number _timescaledb_internal.bloom1,
    line_number _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_departure_id _timescaledb_internal.bloom1,
    departure_id _timescaledb_internal.compressed_data,
    people_in _timescaledb_internal.compressed_data,
    people_out _timescaledb_internal.compressed_data,
    data_source _timescaledb_internal.compressed_data
)
WITH (toast_tuple_target='128');
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_count SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN vehicle_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_min_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_max_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN "time" SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN garage_no SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN garage_no SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN lat SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN lng SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN location SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN location SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_v2_min_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_v2_max_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN speed SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN course SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN alt SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN state SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN in_route SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN line_number SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN line_number SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN departure_id SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN people_in SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN people_out SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN data_source SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_935_chunk ALTER COLUMN data_source SET STORAGE EXTENDED;


ALTER TABLE _timescaledb_internal.compress_hyper_19_935_chunk OWNER TO smartcity_ts;

--
-- Name: compress_hyper_19_936_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal.compress_hyper_19_936_chunk (
    _ts_meta_count integer,
    vehicle_id integer,
    _ts_meta_min_1 timestamp with time zone,
    _ts_meta_max_1 timestamp with time zone,
    "time" _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_garage_no _timescaledb_internal.bloom1,
    garage_no _timescaledb_internal.compressed_data,
    lat _timescaledb_internal.compressed_data,
    lng _timescaledb_internal.compressed_data,
    location _timescaledb_internal.compressed_data,
    _ts_meta_v2_min_speed double precision,
    _ts_meta_v2_max_speed double precision,
    speed _timescaledb_internal.compressed_data,
    course _timescaledb_internal.compressed_data,
    alt _timescaledb_internal.compressed_data,
    state _timescaledb_internal.compressed_data,
    in_route _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_line_number _timescaledb_internal.bloom1,
    line_number _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_departure_id _timescaledb_internal.bloom1,
    departure_id _timescaledb_internal.compressed_data,
    people_in _timescaledb_internal.compressed_data,
    people_out _timescaledb_internal.compressed_data,
    data_source _timescaledb_internal.compressed_data
)
WITH (toast_tuple_target='128');
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_count SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN vehicle_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_min_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_max_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN "time" SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN garage_no SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN garage_no SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN lat SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN lng SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN location SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN location SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_v2_min_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_v2_max_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN speed SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN course SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN alt SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN state SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN in_route SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN line_number SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN line_number SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN departure_id SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN people_in SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN people_out SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN data_source SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_936_chunk ALTER COLUMN data_source SET STORAGE EXTENDED;


ALTER TABLE _timescaledb_internal.compress_hyper_19_936_chunk OWNER TO smartcity_ts;

--
-- Name: compress_hyper_19_937_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal.compress_hyper_19_937_chunk (
    _ts_meta_count integer,
    vehicle_id integer,
    _ts_meta_min_1 timestamp with time zone,
    _ts_meta_max_1 timestamp with time zone,
    "time" _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_garage_no _timescaledb_internal.bloom1,
    garage_no _timescaledb_internal.compressed_data,
    lat _timescaledb_internal.compressed_data,
    lng _timescaledb_internal.compressed_data,
    location _timescaledb_internal.compressed_data,
    _ts_meta_v2_min_speed double precision,
    _ts_meta_v2_max_speed double precision,
    speed _timescaledb_internal.compressed_data,
    course _timescaledb_internal.compressed_data,
    alt _timescaledb_internal.compressed_data,
    state _timescaledb_internal.compressed_data,
    in_route _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_line_number _timescaledb_internal.bloom1,
    line_number _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_departure_id _timescaledb_internal.bloom1,
    departure_id _timescaledb_internal.compressed_data,
    people_in _timescaledb_internal.compressed_data,
    people_out _timescaledb_internal.compressed_data,
    data_source _timescaledb_internal.compressed_data
)
WITH (toast_tuple_target='128');
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_count SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN vehicle_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_min_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_max_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN "time" SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN garage_no SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN garage_no SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN lat SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN lng SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN location SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN location SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_v2_min_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_v2_max_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN speed SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN course SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN alt SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN state SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN in_route SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN line_number SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN line_number SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN departure_id SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN people_in SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN people_out SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN data_source SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_937_chunk ALTER COLUMN data_source SET STORAGE EXTENDED;


ALTER TABLE _timescaledb_internal.compress_hyper_19_937_chunk OWNER TO smartcity_ts;

--
-- Name: compress_hyper_19_938_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal.compress_hyper_19_938_chunk (
    _ts_meta_count integer,
    vehicle_id integer,
    _ts_meta_min_1 timestamp with time zone,
    _ts_meta_max_1 timestamp with time zone,
    "time" _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_garage_no _timescaledb_internal.bloom1,
    garage_no _timescaledb_internal.compressed_data,
    lat _timescaledb_internal.compressed_data,
    lng _timescaledb_internal.compressed_data,
    location _timescaledb_internal.compressed_data,
    _ts_meta_v2_min_speed double precision,
    _ts_meta_v2_max_speed double precision,
    speed _timescaledb_internal.compressed_data,
    course _timescaledb_internal.compressed_data,
    alt _timescaledb_internal.compressed_data,
    state _timescaledb_internal.compressed_data,
    in_route _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_line_number _timescaledb_internal.bloom1,
    line_number _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_departure_id _timescaledb_internal.bloom1,
    departure_id _timescaledb_internal.compressed_data,
    people_in _timescaledb_internal.compressed_data,
    people_out _timescaledb_internal.compressed_data,
    data_source _timescaledb_internal.compressed_data
)
WITH (toast_tuple_target='128');
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_count SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN vehicle_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_min_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_max_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN "time" SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN garage_no SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN garage_no SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN lat SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN lng SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN location SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN location SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_v2_min_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_v2_max_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN speed SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN course SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN alt SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN state SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN in_route SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN line_number SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN line_number SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN departure_id SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN people_in SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN people_out SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN data_source SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_938_chunk ALTER COLUMN data_source SET STORAGE EXTENDED;


ALTER TABLE _timescaledb_internal.compress_hyper_19_938_chunk OWNER TO smartcity_ts;

--
-- Name: compress_hyper_19_939_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal.compress_hyper_19_939_chunk (
    _ts_meta_count integer,
    vehicle_id integer,
    _ts_meta_min_1 timestamp with time zone,
    _ts_meta_max_1 timestamp with time zone,
    "time" _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_garage_no _timescaledb_internal.bloom1,
    garage_no _timescaledb_internal.compressed_data,
    lat _timescaledb_internal.compressed_data,
    lng _timescaledb_internal.compressed_data,
    location _timescaledb_internal.compressed_data,
    _ts_meta_v2_min_speed double precision,
    _ts_meta_v2_max_speed double precision,
    speed _timescaledb_internal.compressed_data,
    course _timescaledb_internal.compressed_data,
    alt _timescaledb_internal.compressed_data,
    state _timescaledb_internal.compressed_data,
    in_route _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_line_number _timescaledb_internal.bloom1,
    line_number _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_departure_id _timescaledb_internal.bloom1,
    departure_id _timescaledb_internal.compressed_data,
    people_in _timescaledb_internal.compressed_data,
    people_out _timescaledb_internal.compressed_data,
    data_source _timescaledb_internal.compressed_data
)
WITH (toast_tuple_target='128');
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_count SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN vehicle_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_min_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_max_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN "time" SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN garage_no SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN garage_no SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN lat SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN lng SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN location SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN location SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_v2_min_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_v2_max_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN speed SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN course SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN alt SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN state SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN in_route SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN line_number SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN line_number SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN departure_id SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN people_in SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN people_out SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN data_source SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_939_chunk ALTER COLUMN data_source SET STORAGE EXTENDED;


ALTER TABLE _timescaledb_internal.compress_hyper_19_939_chunk OWNER TO smartcity_ts;

--
-- Name: compress_hyper_19_942_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TABLE _timescaledb_internal.compress_hyper_19_942_chunk (
    _ts_meta_count integer,
    vehicle_id integer,
    _ts_meta_min_1 timestamp with time zone,
    _ts_meta_max_1 timestamp with time zone,
    "time" _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_garage_no _timescaledb_internal.bloom1,
    garage_no _timescaledb_internal.compressed_data,
    lat _timescaledb_internal.compressed_data,
    lng _timescaledb_internal.compressed_data,
    location _timescaledb_internal.compressed_data,
    _ts_meta_v2_min_speed double precision,
    _ts_meta_v2_max_speed double precision,
    speed _timescaledb_internal.compressed_data,
    course _timescaledb_internal.compressed_data,
    alt _timescaledb_internal.compressed_data,
    state _timescaledb_internal.compressed_data,
    in_route _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_line_number _timescaledb_internal.bloom1,
    line_number _timescaledb_internal.compressed_data,
    _ts_meta_v2_bloom1_departure_id _timescaledb_internal.bloom1,
    departure_id _timescaledb_internal.compressed_data,
    people_in _timescaledb_internal.compressed_data,
    people_out _timescaledb_internal.compressed_data,
    data_source _timescaledb_internal.compressed_data
)
WITH (toast_tuple_target='128');
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_count SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN vehicle_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_min_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_max_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN "time" SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_v2_bloom1_garage_no SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN garage_no SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN garage_no SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN lat SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN lng SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN location SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN location SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_v2_min_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_v2_max_speed SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN speed SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN course SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN alt SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN state SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN in_route SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_v2_bloom1_line_number SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN line_number SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN line_number SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN _ts_meta_v2_bloom1_departure_id SET STORAGE EXTERNAL;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN departure_id SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN people_in SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN people_out SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN data_source SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_19_942_chunk ALTER COLUMN data_source SET STORAGE EXTENDED;


ALTER TABLE _timescaledb_internal.compress_hyper_19_942_chunk OWNER TO smartcity_ts;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: smartcity_ts
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    key character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    source character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    metadata jsonb,
    request_count integer DEFAULT 0
);


ALTER TABLE public.api_keys OWNER TO smartcity_ts;

--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: smartcity_ts
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_keys_id_seq OWNER TO smartcity_ts;

--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: smartcity_ts
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: current_vehicle_positions; Type: VIEW; Schema: public; Owner: smartcity_ts
--

CREATE VIEW public.current_vehicle_positions AS
 WITH latest_positions AS (
         SELECT DISTINCT ON (gps_data.vehicle_id) gps_data.vehicle_id,
            gps_data.garage_no,
            gps_data."time",
            gps_data.lat,
            gps_data.lng,
            gps_data.location,
            gps_data.speed,
            gps_data.state,
            gps_data.in_route
           FROM public.gps_data
          ORDER BY gps_data.vehicle_id, gps_data."time" DESC
        )
 SELECT vehicle_id,
    garage_no,
    "time" AS last_update,
    lat,
    lng,
    speed,
    state,
    in_route,
        CASE
            WHEN ("time" > (now() - '00:05:00'::interval)) THEN 'online'::text
            WHEN ("time" > (now() - '00:30:00'::interval)) THEN 'idle'::text
            ELSE 'offline'::text
        END AS status
   FROM latest_positions;


ALTER VIEW public.current_vehicle_positions OWNER TO smartcity_ts;

--
-- Name: daily_vehicle_stats; Type: VIEW; Schema: public; Owner: smartcity_ts
--

CREATE VIEW public.daily_vehicle_stats AS
 SELECT day,
    vehicle_id,
    garage_no,
    total_points,
    active_hours,
    avg_speed,
    max_speed,
    median_speed,
    speed_95th,
    total_km,
    first_point,
    last_point,
    active_hours_decimal,
    speeding_points,
    stopped_points
   FROM _timescaledb_internal._materialized_hypertable_22;


ALTER VIEW public.daily_vehicle_stats OWNER TO smartcity_ts;

--
-- Name: driving_events_id_seq; Type: SEQUENCE; Schema: public; Owner: smartcity_ts
--

CREATE SEQUENCE public.driving_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.driving_events_id_seq OWNER TO smartcity_ts;

--
-- Name: driving_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: smartcity_ts
--

ALTER SEQUENCE public.driving_events_id_seq OWNED BY public.driving_events.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: smartcity_ts
--

CREATE TABLE public.schema_migrations (
    version character varying(128) NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO smartcity_ts;

--
-- Name: vehicle_hourly_stats; Type: VIEW; Schema: public; Owner: smartcity_ts
--

CREATE VIEW public.vehicle_hourly_stats AS
 SELECT hour,
    vehicle_id,
    garage_no,
    point_count,
    avg_speed,
    max_speed,
    min_moving_speed,
    speed_95th,
    speed_std_dev,
    distance_km,
    stop_count,
    speeding_count
   FROM _timescaledb_internal._materialized_hypertable_21;


ALTER VIEW public.vehicle_hourly_stats OWNER TO smartcity_ts;

--
-- Name: vehicle_summary; Type: VIEW; Schema: public; Owner: smartcity_ts
--

CREATE VIEW public.vehicle_summary AS
 SELECT vehicle_id,
    garage_no,
    count(*) AS total_points,
    min("time") AS first_seen,
    max("time") AS last_seen,
    round((avg(speed))::numeric, 1) AS avg_speed,
    max(speed) AS max_speed
   FROM public.gps_data
  GROUP BY vehicle_id, garage_no;


ALTER VIEW public.vehicle_summary OWNER TO smartcity_ts;

--
-- Name: _hyper_18_914_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_914_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_914_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_914_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_914_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_914_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_914_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_914_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_914_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_914_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_914_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_914_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_915_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_915_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_915_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_915_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_915_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_915_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_915_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_915_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_915_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_915_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_915_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_915_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_916_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_916_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_916_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_916_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_916_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_916_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_916_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_916_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_916_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_916_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_916_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_916_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_922_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_922_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_922_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_922_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_922_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_922_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_922_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_922_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_922_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_922_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_922_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_922_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_923_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_923_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_923_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_923_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_923_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_923_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_923_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_923_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_923_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_923_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_923_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_923_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_924_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_924_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_924_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_924_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_924_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_924_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_924_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_924_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_924_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_924_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_924_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_924_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_925_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_925_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_925_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_925_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_925_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_925_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_925_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_925_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_925_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_925_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_925_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_925_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_926_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_926_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_926_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_926_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_926_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_926_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_926_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_926_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_926_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_926_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_926_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_926_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_927_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_927_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_927_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_927_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_927_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_927_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_927_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_927_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_927_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_927_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_927_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_927_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_928_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_928_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_928_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_928_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_928_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_928_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_928_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_928_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_928_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_928_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_928_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_928_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_929_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_929_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_929_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_929_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_929_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_929_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_929_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_929_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_929_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_929_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_929_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_929_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_930_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_930_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_930_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_930_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_930_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_930_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_930_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_930_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_930_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_930_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_930_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_930_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_931_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_931_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_931_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_931_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_931_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_931_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_931_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_931_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_931_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_931_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_931_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_931_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_941_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_941_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_941_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_941_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_941_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_941_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_941_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_941_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_941_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_941_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_941_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_941_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_944_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_944_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_944_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_944_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_944_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_944_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_944_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_944_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_944_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_944_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_944_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_944_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_952_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_952_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_952_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_952_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_952_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_952_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_952_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_952_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_952_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_952_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_952_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_952_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_953_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_953_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_953_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_953_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_953_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_953_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_953_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_953_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_953_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_953_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_953_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_953_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_954_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_954_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_954_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_954_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_954_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_954_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_954_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_954_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_954_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_954_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_954_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_954_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_955_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_955_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_955_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_955_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_955_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_955_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_955_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_955_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_955_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_955_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_955_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_955_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_956_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_956_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_956_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_956_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_956_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_956_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_956_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_956_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_956_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_956_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_956_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_956_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_957_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_957_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_957_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_957_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_957_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_957_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_957_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_957_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_957_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_957_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_957_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_957_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_958_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_958_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_958_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_958_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_958_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_958_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_958_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_958_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_958_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_958_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_958_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_958_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_959_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_959_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_959_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_959_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_959_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_959_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_959_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_959_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_959_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_959_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_959_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_959_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_960_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_960_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_960_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_960_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_960_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_960_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_960_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_960_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_960_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_960_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_960_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_960_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_961_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_961_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_961_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_961_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_961_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_961_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_961_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_961_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_961_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_961_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_961_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_961_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_962_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_962_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_962_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_962_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_962_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_962_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_962_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_962_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_962_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_962_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_962_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_962_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_963_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_963_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_963_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_963_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_963_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_963_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_963_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_963_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_963_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_963_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_963_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_963_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_964_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_964_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_964_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_964_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_964_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_964_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_964_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_964_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_964_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_964_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_964_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_964_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_965_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_965_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_965_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_965_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_965_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_965_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_965_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_965_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_965_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_965_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_965_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_965_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_966_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_966_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_966_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_966_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_966_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_966_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_966_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_966_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_966_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_966_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_966_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_966_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_967_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_967_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_967_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_967_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_967_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_967_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_967_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_967_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_967_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_967_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_967_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_967_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_968_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_968_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_968_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_968_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_968_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_968_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_968_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_968_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_968_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_968_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_968_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_968_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_969_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_969_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_969_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_969_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_969_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_969_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_969_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_969_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_969_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_969_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_969_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_969_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_970_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_970_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_970_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_970_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_970_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_970_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_970_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_970_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_970_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_970_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_970_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_970_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_18_971_chunk speed; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_971_chunk ALTER COLUMN speed SET DEFAULT 0;


--
-- Name: _hyper_18_971_chunk state; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_971_chunk ALTER COLUMN state SET DEFAULT 0;


--
-- Name: _hyper_18_971_chunk in_route; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_971_chunk ALTER COLUMN in_route SET DEFAULT false;


--
-- Name: _hyper_18_971_chunk people_in; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_971_chunk ALTER COLUMN people_in SET DEFAULT 0;


--
-- Name: _hyper_18_971_chunk people_out; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_971_chunk ALTER COLUMN people_out SET DEFAULT 0;


--
-- Name: _hyper_18_971_chunk data_source; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_971_chunk ALTER COLUMN data_source SET DEFAULT 'legacy_sync'::character varying;


--
-- Name: _hyper_20_921_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_921_chunk ALTER COLUMN id SET DEFAULT nextval('public.driving_events_id_seq'::regclass);


--
-- Name: _hyper_20_921_chunk distance_meters; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_921_chunk ALTER COLUMN distance_meters SET DEFAULT 0;


--
-- Name: _hyper_20_921_chunk confidence; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_921_chunk ALTER COLUMN confidence SET DEFAULT 0.8;


--
-- Name: _hyper_20_932_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_932_chunk ALTER COLUMN id SET DEFAULT nextval('public.driving_events_id_seq'::regclass);


--
-- Name: _hyper_20_932_chunk distance_meters; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_932_chunk ALTER COLUMN distance_meters SET DEFAULT 0;


--
-- Name: _hyper_20_932_chunk confidence; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_932_chunk ALTER COLUMN confidence SET DEFAULT 0.8;


--
-- Name: _hyper_20_933_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_933_chunk ALTER COLUMN id SET DEFAULT nextval('public.driving_events_id_seq'::regclass);


--
-- Name: _hyper_20_933_chunk distance_meters; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_933_chunk ALTER COLUMN distance_meters SET DEFAULT 0;


--
-- Name: _hyper_20_933_chunk confidence; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_933_chunk ALTER COLUMN confidence SET DEFAULT 0.8;


--
-- Name: _hyper_20_972_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_972_chunk ALTER COLUMN id SET DEFAULT nextval('public.driving_events_id_seq'::regclass);


--
-- Name: _hyper_20_972_chunk distance_meters; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_972_chunk ALTER COLUMN distance_meters SET DEFAULT 0;


--
-- Name: _hyper_20_972_chunk confidence; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_972_chunk ALTER COLUMN confidence SET DEFAULT 0.8;


--
-- Name: _hyper_20_973_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_973_chunk ALTER COLUMN id SET DEFAULT nextval('public.driving_events_id_seq'::regclass);


--
-- Name: _hyper_20_973_chunk distance_meters; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_973_chunk ALTER COLUMN distance_meters SET DEFAULT 0;


--
-- Name: _hyper_20_973_chunk confidence; Type: DEFAULT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_973_chunk ALTER COLUMN confidence SET DEFAULT 0.8;


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: smartcity_ts
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: driving_events id; Type: DEFAULT; Schema: public; Owner: smartcity_ts
--

ALTER TABLE ONLY public.driving_events ALTER COLUMN id SET DEFAULT nextval('public.driving_events_id_seq'::regclass);


--
-- Name: _hyper_18_914_chunk 914_21_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_914_chunk
    ADD CONSTRAINT "914_21_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_915_chunk 915_22_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_915_chunk
    ADD CONSTRAINT "915_22_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_916_chunk 916_23_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_916_chunk
    ADD CONSTRAINT "916_23_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_20_921_chunk 921_24_driving_event_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_921_chunk
    ADD CONSTRAINT "921_24_driving_event_unique" UNIQUE (vehicle_id, "time", event_type);


--
-- Name: _hyper_18_922_chunk 922_25_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_922_chunk
    ADD CONSTRAINT "922_25_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_923_chunk 923_26_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_923_chunk
    ADD CONSTRAINT "923_26_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_924_chunk 924_27_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_924_chunk
    ADD CONSTRAINT "924_27_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_925_chunk 925_28_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_925_chunk
    ADD CONSTRAINT "925_28_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_926_chunk 926_29_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_926_chunk
    ADD CONSTRAINT "926_29_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_927_chunk 927_30_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_927_chunk
    ADD CONSTRAINT "927_30_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_928_chunk 928_31_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_928_chunk
    ADD CONSTRAINT "928_31_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_929_chunk 929_32_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_929_chunk
    ADD CONSTRAINT "929_32_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_930_chunk 930_33_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_930_chunk
    ADD CONSTRAINT "930_33_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_931_chunk 931_34_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_931_chunk
    ADD CONSTRAINT "931_34_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_20_932_chunk 932_35_driving_event_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_932_chunk
    ADD CONSTRAINT "932_35_driving_event_unique" UNIQUE (vehicle_id, "time", event_type);


--
-- Name: _hyper_20_933_chunk 933_36_driving_event_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_933_chunk
    ADD CONSTRAINT "933_36_driving_event_unique" UNIQUE (vehicle_id, "time", event_type);


--
-- Name: _hyper_18_941_chunk 941_38_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_941_chunk
    ADD CONSTRAINT "941_38_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_944_chunk 944_39_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_944_chunk
    ADD CONSTRAINT "944_39_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_952_chunk 952_47_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_952_chunk
    ADD CONSTRAINT "952_47_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_953_chunk 953_48_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_953_chunk
    ADD CONSTRAINT "953_48_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_954_chunk 954_49_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_954_chunk
    ADD CONSTRAINT "954_49_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_955_chunk 955_50_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_955_chunk
    ADD CONSTRAINT "955_50_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_956_chunk 956_51_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_956_chunk
    ADD CONSTRAINT "956_51_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_957_chunk 957_52_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_957_chunk
    ADD CONSTRAINT "957_52_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_958_chunk 958_53_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_958_chunk
    ADD CONSTRAINT "958_53_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_959_chunk 959_54_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_959_chunk
    ADD CONSTRAINT "959_54_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_960_chunk 960_55_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_960_chunk
    ADD CONSTRAINT "960_55_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_961_chunk 961_56_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_961_chunk
    ADD CONSTRAINT "961_56_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_962_chunk 962_57_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_962_chunk
    ADD CONSTRAINT "962_57_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_963_chunk 963_58_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_963_chunk
    ADD CONSTRAINT "963_58_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_964_chunk 964_59_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_964_chunk
    ADD CONSTRAINT "964_59_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_965_chunk 965_60_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_965_chunk
    ADD CONSTRAINT "965_60_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_966_chunk 966_61_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_966_chunk
    ADD CONSTRAINT "966_61_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_967_chunk 967_62_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_967_chunk
    ADD CONSTRAINT "967_62_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_968_chunk 968_63_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_968_chunk
    ADD CONSTRAINT "968_63_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_969_chunk 969_64_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_969_chunk
    ADD CONSTRAINT "969_64_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_970_chunk 970_65_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_970_chunk
    ADD CONSTRAINT "970_65_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_18_971_chunk 971_66_gps_vehicle_time_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_18_971_chunk
    ADD CONSTRAINT "971_66_gps_vehicle_time_unique" UNIQUE (vehicle_id, "time");


--
-- Name: _hyper_20_972_chunk 972_67_driving_event_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_972_chunk
    ADD CONSTRAINT "972_67_driving_event_unique" UNIQUE (vehicle_id, "time", event_type);


--
-- Name: _hyper_20_973_chunk 973_68_driving_event_unique; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: smartcity_ts
--

ALTER TABLE ONLY _timescaledb_internal._hyper_20_973_chunk
    ADD CONSTRAINT "973_68_driving_event_unique" UNIQUE (vehicle_id, "time", event_type);


--
-- Name: api_keys api_keys_key_key; Type: CONSTRAINT; Schema: public; Owner: smartcity_ts
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_key UNIQUE (key);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: smartcity_ts
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: driving_events driving_event_unique; Type: CONSTRAINT; Schema: public; Owner: smartcity_ts
--

ALTER TABLE ONLY public.driving_events
    ADD CONSTRAINT driving_event_unique UNIQUE (vehicle_id, "time", event_type);


--
-- Name: gps_data gps_vehicle_time_unique; Type: CONSTRAINT; Schema: public; Owner: smartcity_ts
--

ALTER TABLE ONLY public.gps_data
    ADD CONSTRAINT gps_vehicle_time_unique UNIQUE (vehicle_id, "time");


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: smartcity_ts
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: _hyper_18_914_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_914_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_914_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_914_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_914_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_914_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_914_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_914_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_914_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_914_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_914_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_914_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_914_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_914_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_914_chunk USING gist (location);


--
-- Name: _hyper_18_914_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_914_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_914_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_914_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_914_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_914_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_915_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_915_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_915_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_915_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_915_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_915_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_915_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_915_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_915_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_915_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_915_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_915_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_915_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_915_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_915_chunk USING gist (location);


--
-- Name: _hyper_18_915_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_915_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_915_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_915_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_915_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_915_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_916_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_916_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_916_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_916_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_916_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_916_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_916_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_916_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_916_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_916_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_916_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_916_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_916_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_916_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_916_chunk USING gist (location);


--
-- Name: _hyper_18_916_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_916_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_916_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_916_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_916_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_916_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_922_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_922_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_922_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_922_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_922_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_922_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_922_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_922_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_922_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_922_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_922_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_922_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_922_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_922_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_922_chunk USING gist (location);


--
-- Name: _hyper_18_922_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_922_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_922_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_922_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_922_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_922_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_923_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_923_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_923_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_923_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_923_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_923_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_923_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_923_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_923_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_923_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_923_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_923_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_923_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_923_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_923_chunk USING gist (location);


--
-- Name: _hyper_18_923_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_923_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_923_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_923_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_923_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_923_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_924_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_924_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_924_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_924_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_924_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_924_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_924_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_924_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_924_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_924_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_924_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_924_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_924_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_924_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_924_chunk USING gist (location);


--
-- Name: _hyper_18_924_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_924_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_924_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_924_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_924_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_924_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_925_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_925_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_925_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_925_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_925_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_925_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_925_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_925_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_925_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_925_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_925_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_925_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_925_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_925_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_925_chunk USING gist (location);


--
-- Name: _hyper_18_925_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_925_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_925_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_925_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_925_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_925_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_926_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_926_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_926_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_926_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_926_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_926_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_926_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_926_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_926_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_926_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_926_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_926_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_926_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_926_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_926_chunk USING gist (location);


--
-- Name: _hyper_18_926_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_926_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_926_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_926_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_926_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_926_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_927_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_927_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_927_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_927_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_927_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_927_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_927_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_927_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_927_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_927_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_927_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_927_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_927_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_927_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_927_chunk USING gist (location);


--
-- Name: _hyper_18_927_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_927_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_927_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_927_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_927_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_927_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_928_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_928_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_928_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_928_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_928_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_928_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_928_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_928_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_928_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_928_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_928_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_928_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_928_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_928_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_928_chunk USING gist (location);


--
-- Name: _hyper_18_928_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_928_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_928_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_928_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_928_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_928_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_929_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_929_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_929_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_929_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_929_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_929_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_929_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_929_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_929_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_929_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_929_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_929_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_929_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_929_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_929_chunk USING gist (location);


--
-- Name: _hyper_18_929_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_929_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_929_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_929_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_929_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_929_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_930_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_930_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_930_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_930_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_930_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_930_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_930_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_930_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_930_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_930_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_930_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_930_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_930_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_930_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_930_chunk USING gist (location);


--
-- Name: _hyper_18_930_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_930_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_930_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_930_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_930_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_930_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_931_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_931_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_931_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_931_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_931_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_931_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_931_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_931_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_931_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_931_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_931_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_931_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_931_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_931_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_931_chunk USING gist (location);


--
-- Name: _hyper_18_931_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_931_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_931_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_931_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_931_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_931_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_941_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_941_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_941_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_941_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_941_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_941_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_941_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_941_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_941_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_941_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_941_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_941_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_941_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_941_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_941_chunk USING gist (location);


--
-- Name: _hyper_18_941_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_941_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_941_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_941_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_941_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_941_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_944_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_944_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_944_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_944_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_944_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_944_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_944_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_944_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_944_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_944_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_944_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_944_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_944_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_944_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_944_chunk USING gist (location);


--
-- Name: _hyper_18_944_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_944_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_944_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_944_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_944_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_944_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_952_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_952_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_952_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_952_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_952_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_952_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_952_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_952_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_952_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_952_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_952_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_952_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_952_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_952_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_952_chunk USING gist (location);


--
-- Name: _hyper_18_952_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_952_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_952_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_952_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_952_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_952_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_953_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_953_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_953_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_953_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_953_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_953_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_953_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_953_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_953_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_953_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_953_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_953_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_953_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_953_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_953_chunk USING gist (location);


--
-- Name: _hyper_18_953_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_953_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_953_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_953_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_953_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_953_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_954_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_954_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_954_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_954_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_954_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_954_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_954_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_954_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_954_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_954_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_954_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_954_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_954_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_954_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_954_chunk USING gist (location);


--
-- Name: _hyper_18_954_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_954_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_954_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_954_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_954_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_954_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_955_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_955_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_955_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_955_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_955_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_955_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_955_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_955_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_955_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_955_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_955_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_955_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_955_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_955_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_955_chunk USING gist (location);


--
-- Name: _hyper_18_955_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_955_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_955_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_955_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_955_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_955_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_956_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_956_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_956_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_956_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_956_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_956_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_956_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_956_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_956_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_956_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_956_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_956_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_956_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_956_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_956_chunk USING gist (location);


--
-- Name: _hyper_18_956_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_956_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_956_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_956_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_956_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_956_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_957_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_957_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_957_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_957_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_957_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_957_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_957_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_957_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_957_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_957_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_957_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_957_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_957_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_957_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_957_chunk USING gist (location);


--
-- Name: _hyper_18_957_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_957_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_957_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_957_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_957_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_957_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_958_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_958_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_958_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_958_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_958_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_958_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_958_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_958_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_958_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_958_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_958_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_958_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_958_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_958_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_958_chunk USING gist (location);


--
-- Name: _hyper_18_958_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_958_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_958_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_958_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_958_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_958_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_959_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_959_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_959_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_959_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_959_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_959_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_959_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_959_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_959_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_959_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_959_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_959_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_959_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_959_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_959_chunk USING gist (location);


--
-- Name: _hyper_18_959_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_959_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_959_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_959_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_959_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_959_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_960_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_960_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_960_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_960_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_960_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_960_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_960_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_960_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_960_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_960_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_960_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_960_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_960_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_960_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_960_chunk USING gist (location);


--
-- Name: _hyper_18_960_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_960_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_960_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_960_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_960_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_960_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_961_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_961_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_961_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_961_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_961_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_961_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_961_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_961_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_961_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_961_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_961_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_961_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_961_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_961_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_961_chunk USING gist (location);


--
-- Name: _hyper_18_961_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_961_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_961_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_961_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_961_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_961_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_962_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_962_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_962_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_962_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_962_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_962_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_962_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_962_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_962_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_962_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_962_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_962_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_962_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_962_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_962_chunk USING gist (location);


--
-- Name: _hyper_18_962_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_962_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_962_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_962_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_962_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_962_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_963_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_963_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_963_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_963_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_963_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_963_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_963_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_963_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_963_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_963_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_963_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_963_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_963_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_963_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_963_chunk USING gist (location);


--
-- Name: _hyper_18_963_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_963_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_963_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_963_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_963_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_963_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_964_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_964_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_964_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_964_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_964_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_964_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_964_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_964_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_964_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_964_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_964_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_964_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_964_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_964_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_964_chunk USING gist (location);


--
-- Name: _hyper_18_964_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_964_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_964_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_964_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_964_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_964_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_965_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_965_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_965_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_965_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_965_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_965_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_965_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_965_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_965_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_965_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_965_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_965_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_965_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_965_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_965_chunk USING gist (location);


--
-- Name: _hyper_18_965_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_965_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_965_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_965_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_965_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_965_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_966_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_966_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_966_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_966_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_966_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_966_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_966_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_966_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_966_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_966_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_966_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_966_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_966_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_966_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_966_chunk USING gist (location);


--
-- Name: _hyper_18_966_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_966_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_966_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_966_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_966_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_966_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_967_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_967_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_967_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_967_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_967_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_967_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_967_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_967_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_967_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_967_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_967_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_967_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_967_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_967_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_967_chunk USING gist (location);


--
-- Name: _hyper_18_967_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_967_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_967_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_967_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_967_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_967_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_968_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_968_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_968_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_968_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_968_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_968_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_968_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_968_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_968_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_968_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_968_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_968_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_968_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_968_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_968_chunk USING gist (location);


--
-- Name: _hyper_18_968_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_968_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_968_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_968_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_968_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_968_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_969_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_969_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_969_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_969_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_969_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_969_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_969_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_969_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_969_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_969_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_969_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_969_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_969_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_969_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_969_chunk USING gist (location);


--
-- Name: _hyper_18_969_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_969_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_969_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_969_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_969_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_969_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_970_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_970_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_970_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_970_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_970_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_970_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_970_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_970_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_970_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_970_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_970_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_970_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_970_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_970_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_970_chunk USING gist (location);


--
-- Name: _hyper_18_970_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_970_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_970_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_970_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_970_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_970_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_971_chunk_gps_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_971_chunk_gps_data_time_idx ON _timescaledb_internal._hyper_18_971_chunk USING btree ("time" DESC);


--
-- Name: _hyper_18_971_chunk_idx_gps_departure_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_971_chunk_idx_gps_departure_time ON _timescaledb_internal._hyper_18_971_chunk USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: _hyper_18_971_chunk_idx_gps_garage_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_971_chunk_idx_gps_garage_time ON _timescaledb_internal._hyper_18_971_chunk USING btree (garage_no, "time" DESC);


--
-- Name: _hyper_18_971_chunk_idx_gps_line_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_971_chunk_idx_gps_line_time ON _timescaledb_internal._hyper_18_971_chunk USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: _hyper_18_971_chunk_idx_gps_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_971_chunk_idx_gps_location ON _timescaledb_internal._hyper_18_971_chunk USING gist (location);


--
-- Name: _hyper_18_971_chunk_idx_gps_speed; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_971_chunk_idx_gps_speed ON _timescaledb_internal._hyper_18_971_chunk USING btree (speed) WHERE (speed > '0'::double precision);


--
-- Name: _hyper_18_971_chunk_idx_gps_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_18_971_chunk_idx_gps_vehicle_time ON _timescaledb_internal._hyper_18_971_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_20_921_chunk_driving_events_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_921_chunk_driving_events_time_idx ON _timescaledb_internal._hyper_20_921_chunk USING btree ("time" DESC);


--
-- Name: _hyper_20_921_chunk_idx_driving_event_type; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_921_chunk_idx_driving_event_type ON _timescaledb_internal._hyper_20_921_chunk USING btree (event_type, "time" DESC);


--
-- Name: _hyper_20_921_chunk_idx_driving_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_921_chunk_idx_driving_location ON _timescaledb_internal._hyper_20_921_chunk USING gist (location);


--
-- Name: _hyper_20_921_chunk_idx_driving_severity; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_921_chunk_idx_driving_severity ON _timescaledb_internal._hyper_20_921_chunk USING btree (severity) WHERE (severity >= 3);


--
-- Name: _hyper_20_921_chunk_idx_driving_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_921_chunk_idx_driving_vehicle_time ON _timescaledb_internal._hyper_20_921_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_20_932_chunk_driving_events_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_932_chunk_driving_events_time_idx ON _timescaledb_internal._hyper_20_932_chunk USING btree ("time" DESC);


--
-- Name: _hyper_20_932_chunk_idx_driving_event_type; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_932_chunk_idx_driving_event_type ON _timescaledb_internal._hyper_20_932_chunk USING btree (event_type, "time" DESC);


--
-- Name: _hyper_20_932_chunk_idx_driving_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_932_chunk_idx_driving_location ON _timescaledb_internal._hyper_20_932_chunk USING gist (location);


--
-- Name: _hyper_20_932_chunk_idx_driving_severity; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_932_chunk_idx_driving_severity ON _timescaledb_internal._hyper_20_932_chunk USING btree (severity) WHERE (severity >= 3);


--
-- Name: _hyper_20_932_chunk_idx_driving_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_932_chunk_idx_driving_vehicle_time ON _timescaledb_internal._hyper_20_932_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_20_933_chunk_driving_events_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_933_chunk_driving_events_time_idx ON _timescaledb_internal._hyper_20_933_chunk USING btree ("time" DESC);


--
-- Name: _hyper_20_933_chunk_idx_driving_event_type; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_933_chunk_idx_driving_event_type ON _timescaledb_internal._hyper_20_933_chunk USING btree (event_type, "time" DESC);


--
-- Name: _hyper_20_933_chunk_idx_driving_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_933_chunk_idx_driving_location ON _timescaledb_internal._hyper_20_933_chunk USING gist (location);


--
-- Name: _hyper_20_933_chunk_idx_driving_severity; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_933_chunk_idx_driving_severity ON _timescaledb_internal._hyper_20_933_chunk USING btree (severity) WHERE (severity >= 3);


--
-- Name: _hyper_20_933_chunk_idx_driving_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_933_chunk_idx_driving_vehicle_time ON _timescaledb_internal._hyper_20_933_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_20_972_chunk_driving_events_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_972_chunk_driving_events_time_idx ON _timescaledb_internal._hyper_20_972_chunk USING btree ("time" DESC);


--
-- Name: _hyper_20_972_chunk_idx_driving_event_type; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_972_chunk_idx_driving_event_type ON _timescaledb_internal._hyper_20_972_chunk USING btree (event_type, "time" DESC);


--
-- Name: _hyper_20_972_chunk_idx_driving_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_972_chunk_idx_driving_location ON _timescaledb_internal._hyper_20_972_chunk USING gist (location);


--
-- Name: _hyper_20_972_chunk_idx_driving_severity; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_972_chunk_idx_driving_severity ON _timescaledb_internal._hyper_20_972_chunk USING btree (severity) WHERE (severity >= 3);


--
-- Name: _hyper_20_972_chunk_idx_driving_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_972_chunk_idx_driving_vehicle_time ON _timescaledb_internal._hyper_20_972_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_20_973_chunk_driving_events_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_973_chunk_driving_events_time_idx ON _timescaledb_internal._hyper_20_973_chunk USING btree ("time" DESC);


--
-- Name: _hyper_20_973_chunk_idx_driving_event_type; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_973_chunk_idx_driving_event_type ON _timescaledb_internal._hyper_20_973_chunk USING btree (event_type, "time" DESC);


--
-- Name: _hyper_20_973_chunk_idx_driving_location; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_973_chunk_idx_driving_location ON _timescaledb_internal._hyper_20_973_chunk USING gist (location);


--
-- Name: _hyper_20_973_chunk_idx_driving_severity; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_973_chunk_idx_driving_severity ON _timescaledb_internal._hyper_20_973_chunk USING btree (severity) WHERE (severity >= 3);


--
-- Name: _hyper_20_973_chunk_idx_driving_vehicle_time; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_20_973_chunk_idx_driving_vehicle_time ON _timescaledb_internal._hyper_20_973_chunk USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_21_917_chunk__materialized_hypertable_21_garage_no_hour_; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_21_917_chunk__materialized_hypertable_21_garage_no_hour_ ON _timescaledb_internal._hyper_21_917_chunk USING btree (garage_no, hour DESC);


--
-- Name: _hyper_21_917_chunk__materialized_hypertable_21_hour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_21_917_chunk__materialized_hypertable_21_hour_idx ON _timescaledb_internal._hyper_21_917_chunk USING btree (hour DESC);


--
-- Name: _hyper_21_917_chunk__materialized_hypertable_21_vehicle_id_hour; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_21_917_chunk__materialized_hypertable_21_vehicle_id_hour ON _timescaledb_internal._hyper_21_917_chunk USING btree (vehicle_id, hour DESC);


--
-- Name: _hyper_21_920_chunk__materialized_hypertable_21_garage_no_hour_; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_21_920_chunk__materialized_hypertable_21_garage_no_hour_ ON _timescaledb_internal._hyper_21_920_chunk USING btree (garage_no, hour DESC);


--
-- Name: _hyper_21_920_chunk__materialized_hypertable_21_hour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_21_920_chunk__materialized_hypertable_21_hour_idx ON _timescaledb_internal._hyper_21_920_chunk USING btree (hour DESC);


--
-- Name: _hyper_21_920_chunk__materialized_hypertable_21_vehicle_id_hour; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_21_920_chunk__materialized_hypertable_21_vehicle_id_hour ON _timescaledb_internal._hyper_21_920_chunk USING btree (vehicle_id, hour DESC);


--
-- Name: _hyper_22_918_chunk__materialized_hypertable_22_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_22_918_chunk__materialized_hypertable_22_day_idx ON _timescaledb_internal._hyper_22_918_chunk USING btree (day DESC);


--
-- Name: _hyper_22_918_chunk__materialized_hypertable_22_garage_no_day_i; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_22_918_chunk__materialized_hypertable_22_garage_no_day_i ON _timescaledb_internal._hyper_22_918_chunk USING btree (garage_no, day DESC);


--
-- Name: _hyper_22_918_chunk__materialized_hypertable_22_vehicle_id_day_; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_22_918_chunk__materialized_hypertable_22_vehicle_id_day_ ON _timescaledb_internal._hyper_22_918_chunk USING btree (vehicle_id, day DESC);


--
-- Name: _hyper_22_919_chunk__materialized_hypertable_22_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_22_919_chunk__materialized_hypertable_22_day_idx ON _timescaledb_internal._hyper_22_919_chunk USING btree (day DESC);


--
-- Name: _hyper_22_919_chunk__materialized_hypertable_22_garage_no_day_i; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_22_919_chunk__materialized_hypertable_22_garage_no_day_i ON _timescaledb_internal._hyper_22_919_chunk USING btree (garage_no, day DESC);


--
-- Name: _hyper_22_919_chunk__materialized_hypertable_22_vehicle_id_day_; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _hyper_22_919_chunk__materialized_hypertable_22_vehicle_id_day_ ON _timescaledb_internal._hyper_22_919_chunk USING btree (vehicle_id, day DESC);


--
-- Name: _materialized_hypertable_21_garage_no_hour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _materialized_hypertable_21_garage_no_hour_idx ON _timescaledb_internal._materialized_hypertable_21 USING btree (garage_no, hour DESC);


--
-- Name: _materialized_hypertable_21_hour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _materialized_hypertable_21_hour_idx ON _timescaledb_internal._materialized_hypertable_21 USING btree (hour DESC);


--
-- Name: _materialized_hypertable_21_vehicle_id_hour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _materialized_hypertable_21_vehicle_id_hour_idx ON _timescaledb_internal._materialized_hypertable_21 USING btree (vehicle_id, hour DESC);


--
-- Name: _materialized_hypertable_22_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _materialized_hypertable_22_day_idx ON _timescaledb_internal._materialized_hypertable_22 USING btree (day DESC);


--
-- Name: _materialized_hypertable_22_garage_no_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _materialized_hypertable_22_garage_no_day_idx ON _timescaledb_internal._materialized_hypertable_22 USING btree (garage_no, day DESC);


--
-- Name: _materialized_hypertable_22_vehicle_id_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX _materialized_hypertable_22_vehicle_id_day_idx ON _timescaledb_internal._materialized_hypertable_22 USING btree (vehicle_id, day DESC);


--
-- Name: compress_hyper_19_934_chunk_vehicle_id__ts_meta_min_1__ts_m_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX compress_hyper_19_934_chunk_vehicle_id__ts_meta_min_1__ts_m_idx ON _timescaledb_internal.compress_hyper_19_934_chunk USING btree (vehicle_id, _ts_meta_min_1 DESC, _ts_meta_max_1 DESC);


--
-- Name: compress_hyper_19_935_chunk_vehicle_id__ts_meta_min_1__ts_m_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX compress_hyper_19_935_chunk_vehicle_id__ts_meta_min_1__ts_m_idx ON _timescaledb_internal.compress_hyper_19_935_chunk USING btree (vehicle_id, _ts_meta_min_1 DESC, _ts_meta_max_1 DESC);


--
-- Name: compress_hyper_19_936_chunk_vehicle_id__ts_meta_min_1__ts_m_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX compress_hyper_19_936_chunk_vehicle_id__ts_meta_min_1__ts_m_idx ON _timescaledb_internal.compress_hyper_19_936_chunk USING btree (vehicle_id, _ts_meta_min_1 DESC, _ts_meta_max_1 DESC);


--
-- Name: compress_hyper_19_937_chunk_vehicle_id__ts_meta_min_1__ts_m_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX compress_hyper_19_937_chunk_vehicle_id__ts_meta_min_1__ts_m_idx ON _timescaledb_internal.compress_hyper_19_937_chunk USING btree (vehicle_id, _ts_meta_min_1 DESC, _ts_meta_max_1 DESC);


--
-- Name: compress_hyper_19_938_chunk_vehicle_id__ts_meta_min_1__ts_m_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX compress_hyper_19_938_chunk_vehicle_id__ts_meta_min_1__ts_m_idx ON _timescaledb_internal.compress_hyper_19_938_chunk USING btree (vehicle_id, _ts_meta_min_1 DESC, _ts_meta_max_1 DESC);


--
-- Name: compress_hyper_19_939_chunk_vehicle_id__ts_meta_min_1__ts_m_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX compress_hyper_19_939_chunk_vehicle_id__ts_meta_min_1__ts_m_idx ON _timescaledb_internal.compress_hyper_19_939_chunk USING btree (vehicle_id, _ts_meta_min_1 DESC, _ts_meta_max_1 DESC);


--
-- Name: compress_hyper_19_942_chunk_vehicle_id__ts_meta_min_1__ts_m_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE INDEX compress_hyper_19_942_chunk_vehicle_id__ts_meta_min_1__ts_m_idx ON _timescaledb_internal.compress_hyper_19_942_chunk USING btree (vehicle_id, _ts_meta_min_1 DESC, _ts_meta_max_1 DESC);


--
-- Name: driving_events_time_idx; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX driving_events_time_idx ON public.driving_events USING btree ("time" DESC);


--
-- Name: gps_data_time_idx; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX gps_data_time_idx ON public.gps_data USING btree ("time" DESC);


--
-- Name: idx_api_keys_request_count; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_api_keys_request_count ON public.api_keys USING btree (request_count);


--
-- Name: idx_driving_event_type; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_driving_event_type ON public.driving_events USING btree (event_type, "time" DESC);


--
-- Name: idx_driving_location; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_driving_location ON public.driving_events USING gist (location);


--
-- Name: idx_driving_severity; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_driving_severity ON public.driving_events USING btree (severity) WHERE (severity >= 3);


--
-- Name: idx_driving_vehicle_time; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_driving_vehicle_time ON public.driving_events USING btree (vehicle_id, "time" DESC);


--
-- Name: idx_gps_departure_time; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_gps_departure_time ON public.gps_data USING btree (departure_id, "time" DESC) WHERE (departure_id IS NOT NULL);


--
-- Name: idx_gps_garage_time; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_gps_garage_time ON public.gps_data USING btree (garage_no, "time" DESC);


--
-- Name: idx_gps_line_time; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_gps_line_time ON public.gps_data USING btree (line_number, "time" DESC) WHERE (line_number IS NOT NULL);


--
-- Name: idx_gps_location; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_gps_location ON public.gps_data USING gist (location);


--
-- Name: idx_gps_speed; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_gps_speed ON public.gps_data USING btree (speed) WHERE (speed > (0)::double precision);


--
-- Name: idx_gps_vehicle_time; Type: INDEX; Schema: public; Owner: smartcity_ts
--

CREATE INDEX idx_gps_vehicle_time ON public.gps_data USING btree (vehicle_id, "time" DESC);


--
-- Name: _hyper_18_914_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_914_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_915_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_915_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_916_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_916_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_922_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_922_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_923_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_923_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_924_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_924_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_925_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_925_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_926_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_926_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_927_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_927_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_928_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_928_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_929_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_929_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_930_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_930_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_931_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_931_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_941_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_941_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_944_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_944_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_952_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_952_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_953_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_953_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_954_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_954_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_955_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_955_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_956_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_956_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_957_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_957_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_958_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_958_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_959_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_959_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_960_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_960_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_961_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_961_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_962_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_962_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_963_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_963_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_964_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_964_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_965_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_965_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_966_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_966_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_967_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_967_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_968_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_968_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_969_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_969_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_970_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_970_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_971_chunk set_location_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON _timescaledb_internal._hyper_18_971_chunk FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: _hyper_18_914_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_914_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_915_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_915_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_916_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_916_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_922_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_922_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_923_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_923_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_924_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_924_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_925_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_925_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_926_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_926_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_927_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_927_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_928_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_928_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_929_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_929_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_930_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_930_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_931_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_931_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_941_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_941_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_944_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_944_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_952_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_952_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_953_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_953_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_954_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_954_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_955_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_955_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_956_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_956_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_957_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_957_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_958_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_958_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_959_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_959_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_960_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_960_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_961_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_961_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_962_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_962_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_963_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_963_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_964_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_964_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_965_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_965_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_966_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_966_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_967_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_967_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_968_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_968_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_969_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_969_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_970_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_970_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _hyper_18_971_chunk ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON _timescaledb_internal._hyper_18_971_chunk FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: _compressed_hypertable_19 ts_insert_blocker; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON _timescaledb_internal._compressed_hypertable_19 FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: _materialized_hypertable_21 ts_insert_blocker; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON _timescaledb_internal._materialized_hypertable_21 FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: _materialized_hypertable_22 ts_insert_blocker; Type: TRIGGER; Schema: _timescaledb_internal; Owner: smartcity_ts
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON _timescaledb_internal._materialized_hypertable_22 FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: gps_data set_location_trigger; Type: TRIGGER; Schema: public; Owner: smartcity_ts
--

CREATE TRIGGER set_location_trigger BEFORE INSERT OR UPDATE ON public.gps_data FOR EACH ROW EXECUTE FUNCTION public.set_gps_location();


--
-- Name: gps_data ts_cagg_invalidation_trigger; Type: TRIGGER; Schema: public; Owner: smartcity_ts
--

CREATE TRIGGER ts_cagg_invalidation_trigger AFTER INSERT OR DELETE OR UPDATE ON public.gps_data FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.continuous_agg_invalidation_trigger('18');


--
-- Name: driving_events ts_insert_blocker; Type: TRIGGER; Schema: public; Owner: smartcity_ts
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON public.driving_events FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- Name: gps_data ts_insert_blocker; Type: TRIGGER; Schema: public; Owner: smartcity_ts
--

CREATE TRIGGER ts_insert_blocker BEFORE INSERT ON public.gps_data FOR EACH ROW EXECUTE FUNCTION _timescaledb_functions.insert_blocker();


--
-- PostgreSQL database dump complete
--

