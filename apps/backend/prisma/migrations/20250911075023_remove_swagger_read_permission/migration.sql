-- Uklanjanje swagger:read permisije koja nije potrebna
-- Swagger sada koristi samo API ključ bez dodatnih permisija

-- Prvo ukloni permisiju iz svih API ključeva koji je možda imaju
UPDATE api_keys 
SET permissions = JSON_REMOVE(permissions, JSON_UNQUOTE(JSON_SEARCH(permissions, 'one', 'swagger:read')))
WHERE JSON_SEARCH(permissions, 'one', 'swagger:read') IS NOT NULL;

-- Zatim obriši permisiju iz tabele
DELETE FROM permissions WHERE name = 'swagger:read';