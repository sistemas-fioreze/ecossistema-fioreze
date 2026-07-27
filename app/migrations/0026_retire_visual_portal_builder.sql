PRAGMA foreign_keys = ON;

-- O construtor visual livre foi substituido pelo template oficial e unico do
-- Portal do Hospede. As tabelas permanecem no schema apenas para preservar a
-- ordem historica das migrations e impedir alteracoes retroativas na 0025.
DELETE FROM visual_portal_templates;
DELETE FROM visual_portals;
