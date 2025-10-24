-- ============================================
-- Migracija: Dodavanje unique constraints za Turnusi Sync
-- ============================================
-- Cilj: Sprečiti duple inserte pri sinhronizaciji sa legacy bazama
-- ============================================

-- ============================================
-- KORAK 1: Čišćenje postojećih duplikata
-- ============================================

-- Čišćenje duplikata iz turnus_groups_names
-- Zadržava zapis sa najvećim id (najnoviji)
DELETE t1 FROM turnus_groups_names t1
INNER JOIN turnus_groups_names t2
WHERE t1.name = t2.name
  AND t1.id < t2.id;

-- Čišćenje duplikata iz turnus_days
-- Zadržava zapis sa najvećim id (najnoviji)
DELETE t1 FROM turnus_days t1
INNER JOIN turnus_days t2
WHERE t1.turnus_id = t2.turnus_id
  AND t1.dayname = t2.dayname
  AND t1.id < t2.id;

-- ============================================
-- KORAK 2: Dodavanje unique indexes
-- ============================================

-- Dodaj unique index za turnus_groups_names.name
-- Garantuje da svaka grupa ima jedinstveno ime
CREATE UNIQUE INDEX `turnus_groups_names_name_key` ON `turnus_groups_names`(`name`);

-- Dodaj unique index za turnus_days (turnus_id, dayname)
-- Garantuje da svaki turnus može imati samo jedan dan sa istim imenom
CREATE UNIQUE INDEX `turnus_days_turnus_id_dayname_key` ON `turnus_days`(`turnus_id`, `dayname`);

-- ============================================
-- NAPOMENA:
-- ============================================
-- turnus_groups_assign već ima composite PK (turnus_id, group_id, date_from)
-- pa nije potreban dodatni unique constraint.
-- ============================================
