-- Fix menuOrder for Schedule Print permissions
-- Change from 302050015000 to 302050020000
-- Move Turnus Defaults from 302050020000 to 302050030000
-- Move Linked Turnusi from 302050030000 to 302050040000
-- Correct hierarchy: Schedule (01) -> Schedule Print (02) -> Turnus Defaults (03) -> Linked Turnusi (04)

-- First, move Linked Turnusi to temporary high numbers to avoid conflicts
UPDATE permissions SET menu_order = 302050090000 WHERE menu_order = 302050030000;
UPDATE permissions SET menu_order = 302050090001 WHERE menu_order = 302050030001;
UPDATE permissions SET menu_order = 302050090002 WHERE menu_order = 302050030002;
UPDATE permissions SET menu_order = 302050090003 WHERE menu_order = 302050030003;

-- Move Turnus Defaults to temporary numbers
UPDATE permissions SET menu_order = 302050080000 WHERE menu_order = 302050020000;
UPDATE permissions SET menu_order = 302050080001 WHERE menu_order = 302050020001;
UPDATE permissions SET menu_order = 302050080002 WHERE menu_order = 302050020002;
UPDATE permissions SET menu_order = 302050080003 WHERE menu_order = 302050020003;
UPDATE permissions SET menu_order = 302050080004 WHERE menu_order = 302050020004;
UPDATE permissions SET menu_order = 302050080005 WHERE menu_order = 302050020005;

-- Move Schedule Print to 020000 range
UPDATE permissions SET menu_order = 302050020000 WHERE menu_order = 302050015000;
UPDATE permissions SET menu_order = 302050020001 WHERE menu_order = 302050015001;

-- Move Turnus Defaults to 030000 range
UPDATE permissions SET menu_order = 302050030000 WHERE menu_order = 302050080000;
UPDATE permissions SET menu_order = 302050030001 WHERE menu_order = 302050080001;
UPDATE permissions SET menu_order = 302050030002 WHERE menu_order = 302050080002;
UPDATE permissions SET menu_order = 302050030003 WHERE menu_order = 302050080003;
UPDATE permissions SET menu_order = 302050030004 WHERE menu_order = 302050080004;
UPDATE permissions SET menu_order = 302050030005 WHERE menu_order = 302050080005;

-- Move Linked Turnusi to 040000 range
UPDATE permissions SET menu_order = 302050040000 WHERE menu_order = 302050090000;
UPDATE permissions SET menu_order = 302050040001 WHERE menu_order = 302050090001;
UPDATE permissions SET menu_order = 302050040002 WHERE menu_order = 302050090002;
UPDATE permissions SET menu_order = 302050040003 WHERE menu_order = 302050090003;
