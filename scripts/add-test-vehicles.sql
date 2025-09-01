-- Dodavanje test vozila P93597 i P93598 koja imaju GPS podatke

-- Prvo proveri da li već postoje
SELECT id, garage_number FROM bus_vehicles WHERE garage_number IN ('P93597', 'P93598');

-- Dodaj vozila ako ne postoje
INSERT INTO bus_vehicles (
    garage_number,
    registration_number,
    manufacturer,
    model,
    year_of_manufacture,
    vehicle_type,
    fuel_type,
    engine_euro_standard,
    seats_total,
    standing_capacity,
    is_active,
    has_air_conditioning,
    has_wifi,
    has_usb_chargers,
    has_accessibility_features,
    legacy_id,
    created_at,
    updated_at
) VALUES 
(
    'P93597',
    'BG-597-GH',
    'Mercedes-Benz',
    'Citaro',
    2020,
    1, -- gradski autobus
    1, -- dizel
    6, -- Euro 6
    35,
    65,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    460, -- legacy_id koji odgovara vehicle_id u GPS podacima
    NOW(),
    NOW()
),
(
    'P93598',
    'BG-598-GH',
    'Mercedes-Benz',
    'Citaro',
    2020,
    1, -- gradski autobus
    1, -- dizel
    6, -- Euro 6
    35,
    65,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    461, -- legacy_id koji odgovara vehicle_id u GPS podacima
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE 
    manufacturer = VALUES(manufacturer),
    model = VALUES(model),
    updated_at = NOW();

-- Verifikuj da su dodata
SELECT id, garage_number, manufacturer, model, legacy_id 
FROM bus_vehicles 
WHERE garage_number IN ('P93597', 'P93598');

-- Ukupan broj vozila
SELECT COUNT(*) as total_vehicles FROM bus_vehicles;