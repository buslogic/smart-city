-- Fix menuOrder for Linked Turnusi permissions
-- Change from 302050025000 to 302050030000 to avoid 5-level hierarchy parsing issue
-- Correct format: 30 20 50 03 00 00 (4 levels, not 5)

UPDATE permissions SET menu_order = 302050030000 WHERE menu_order = 302050025000;
UPDATE permissions SET menu_order = 302050030001 WHERE menu_order = 302050025001;
UPDATE permissions SET menu_order = 302050030002 WHERE menu_order = 302050025002;
UPDATE permissions SET menu_order = 302050030003 WHERE menu_order = 302050025003;
