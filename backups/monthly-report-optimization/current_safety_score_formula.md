# Current Safety Score Formula Documentation
Date: 03.09.2025

## Formula iz PostGIS funkcije `get_vehicle_driving_statistics`

```sql
CASE
    WHEN evt_count = 0 OR d.total_km = 0 THEN 100
    ELSE 
        GREATEST(
            50,  -- Minimum safety score je 50
            LEAST(
                100,  -- Maximum safety score je 100
                100 - LEAST(40,  -- Maksimalni penalty je 40 poena
                    -- Severe eventi × 3 poena
                    ((severe_acc + severe_brake)::NUMERIC / GREATEST(d.total_km, 1) * 100 * 3)::INTEGER +
                    -- Moderate eventi × 1 poen  
                    ((moderate_acc + moderate_brake)::NUMERIC / GREATEST(d.total_km, 1) * 100 * 1)::INTEGER
                )
            )
        )
END::INTEGER
```

## Objašnjenje logike:

1. **Bazni slučajevi:**
   - Ako nema eventi ili kilometraže → Score = 100

2. **Penalty kalkulacija:**
   - Severe eventi (ubrzanja/kočenja) = 3 poena penaltija po eventu/km
   - Moderate eventi = 1 poen penaltija po eventu/km
   - Eventi se normalizuju po kilometraži (* 100 za procenat)

3. **Ograničenja:**
   - Minimum score = 50 (čak i najgori vozači imaju 50)
   - Maximum score = 100 (savršena vožnja)
   - Maximum penalty = 40 poena (ne može ispod 60)

## Problemi sa trenutnom formulom:
- Fiksni težinski faktori (3 i 1)
- Ne uzima u obzir vreme vožnje
- Ne razlikuje gradsku/međugradsku vožnju
- Ne koristi g_force vrednosti direktno