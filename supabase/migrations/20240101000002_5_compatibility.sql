-- Compatibility layer: Map profiles to customers for new views
CREATE OR REPLACE VIEW customers AS
SELECT 
    id,
    full_name,
    email,
    phone,
    created_at,
    updated_at
FROM profiles;

COMMENT ON VIEW customers IS 'Compatibility view mapping profiles to customers';

GRANT SELECT ON customers TO authenticated;