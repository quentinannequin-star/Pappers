-- ============================================================
-- ALVORA DB — Supabase PostgreSQL Schema v2
-- Denormalized: siege address stored directly in companies
-- Run this in Supabase SQL Editor (supabase.com > SQL Editor)
-- ============================================================

-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. REFERENCE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_naf (
    code TEXT PRIMARY KEY,
    libelle TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_regions (
    code TEXT PRIMARY KEY,
    nom TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_departements (
    code TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    code_region TEXT REFERENCES ref_regions(code)
);

-- 3. MAIN TABLE (denormalized — siege address included)
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
    siren TEXT PRIMARY KEY,
    denomination TEXT,
    sigle TEXT,
    naf_code TEXT,
    forme_juridique TEXT,
    date_creation TEXT,
    tranche_effectif TEXT,
    categorie_entreprise TEXT,
    etat_administratif TEXT NOT NULL DEFAULT 'A',
    -- Denormalized siege address (from etablissements CSV)
    siege_code_postal TEXT,
    siege_ville TEXT,
    siege_departement TEXT,
    siege_adresse TEXT, -- numero + type_voie + libelle_voie
    -- Enrichment columns (NULL until enriched)
    dirigeant_nom TEXT,
    dirigeant_prenom TEXT,
    dirigeant_fonction TEXT,
    dirigeant_age_est INTEGER,
    ca_dernier_exercice REAL,
    resultat_net REAL,
    effectif_exact INTEGER,
    date_enrichissement TIMESTAMPTZ,
    -- Metadata
    date_chargement TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INDEXES (create AFTER bulk load for performance)
-- ============================================================
-- DROP these before bulk import, recreate after:
--   DROP INDEX IF EXISTS idx_companies_naf;
--   DROP INDEX IF EXISTS idx_companies_effectif;
--   DROP INDEX IF EXISTS idx_companies_denomination_trgm;
--   DROP INDEX IF EXISTS idx_companies_dept;

CREATE INDEX IF NOT EXISTS idx_companies_naf ON companies(naf_code);
CREATE INDEX IF NOT EXISTS idx_companies_etat ON companies(etat_administratif);
CREATE INDEX IF NOT EXISTS idx_companies_effectif ON companies(tranche_effectif);
CREATE INDEX IF NOT EXISTS idx_companies_categorie ON companies(categorie_entreprise);
CREATE INDEX IF NOT EXISTS idx_companies_dept ON companies(siege_departement);
CREATE INDEX IF NOT EXISTS idx_companies_denomination_trgm ON companies USING gin(denomination gin_trgm_ops);

-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_naf ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_departements ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all data
DO $$ BEGIN
    CREATE POLICY "Authenticated users can read companies"
        ON companies FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can read ref_naf"
        ON ref_naf FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can read ref_regions"
        ON ref_regions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can read ref_departements"
        ON ref_departements FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. ALLOWED EMAILS TABLE (server-side whitelist)
-- ============================================================

CREATE TABLE IF NOT EXISTS allowed_emails (
    email TEXT PRIMARY KEY
);

ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only service_role can read (not exposed to client)
-- No RLS policy for authenticated = no access from client

INSERT INTO allowed_emails (email) VALUES
    ('qannequin@alvora-partners.com'),
    ('pajouzel@alvora-partners.com'),
    ('hjanoir@alvora-partners.com'),
    ('quentinannequin@berkeley.edu')
ON CONFLICT (email) DO NOTHING;

-- 7. RPC FUNCTIONS
-- ============================================================

-- search_companies: NO JOIN — everything in companies table
CREATE OR REPLACE FUNCTION search_companies(
    p_naf_codes TEXT[] DEFAULT NULL,
    p_dept_codes TEXT[] DEFAULT NULL,
    p_effectif_min TEXT DEFAULT NULL,
    p_effectif_max TEXT DEFAULT NULL,
    p_formes TEXT[] DEFAULT NULL,
    p_min_age INTEGER DEFAULT NULL,
    p_denomination TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    siren TEXT,
    denomination TEXT,
    naf_code TEXT,
    naf_libelle TEXT,
    code_postal TEXT,
    ville TEXT,
    departement TEXT,
    tranche_effectif TEXT,
    categorie_entreprise TEXT,
    forme_juridique TEXT,
    date_creation TEXT,
    dirigeant_nom TEXT,
    dirigeant_prenom TEXT,
    dirigeant_fonction TEXT,
    ca_dernier_exercice REAL,
    resultat_net REAL,
    date_enrichissement TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.siren,
        c.denomination,
        c.naf_code,
        n.libelle AS naf_libelle,
        c.siege_code_postal AS code_postal,
        c.siege_ville AS ville,
        c.siege_departement AS departement,
        c.tranche_effectif,
        c.categorie_entreprise,
        c.forme_juridique,
        c.date_creation,
        c.dirigeant_nom,
        c.dirigeant_prenom,
        c.dirigeant_fonction,
        c.ca_dernier_exercice,
        c.resultat_net,
        c.date_enrichissement
    FROM companies c
    LEFT JOIN ref_naf n ON c.naf_code = n.code
    WHERE c.etat_administratif = 'A'
      AND (p_naf_codes IS NULL OR c.naf_code = ANY(p_naf_codes))
      AND (p_dept_codes IS NULL OR c.siege_departement = ANY(p_dept_codes))
      AND (p_effectif_min IS NULL OR c.tranche_effectif >= p_effectif_min)
      AND (p_effectif_max IS NULL OR c.tranche_effectif <= p_effectif_max)
      AND (c.tranche_effectif IS NULL OR c.tranche_effectif != 'NN')
      AND (p_min_age IS NULL OR c.date_creation <= to_char(CURRENT_DATE - (p_min_age || ' years')::INTERVAL, 'YYYY-MM-DD'))
      AND (p_denomination IS NULL OR c.denomination ILIKE '%' || p_denomination || '%')
      AND (p_formes IS NULL OR c.forme_juridique = ANY(p_formes))
    ORDER BY c.denomination
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- count_companies: capped at 10001 for performance
CREATE OR REPLACE FUNCTION count_companies(
    p_naf_codes TEXT[] DEFAULT NULL,
    p_dept_codes TEXT[] DEFAULT NULL,
    p_effectif_min TEXT DEFAULT NULL,
    p_effectif_max TEXT DEFAULT NULL,
    p_formes TEXT[] DEFAULT NULL,
    p_min_age INTEGER DEFAULT NULL,
    p_denomination TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO result
    FROM (
        SELECT 1
        FROM companies c
        WHERE c.etat_administratif = 'A'
          AND (p_naf_codes IS NULL OR c.naf_code = ANY(p_naf_codes))
          AND (p_dept_codes IS NULL OR c.siege_departement = ANY(p_dept_codes))
          AND (p_effectif_min IS NULL OR c.tranche_effectif >= p_effectif_min)
          AND (p_effectif_max IS NULL OR c.tranche_effectif <= p_effectif_max)
          AND (c.tranche_effectif IS NULL OR c.tranche_effectif != 'NN')
          AND (p_min_age IS NULL OR c.date_creation <= to_char(CURRENT_DATE - (p_min_age || ' years')::INTERVAL, 'YYYY-MM-DD'))
          AND (p_denomination IS NULL OR c.denomination ILIKE '%' || p_denomination || '%')
          AND (p_formes IS NULL OR c.forme_juridique = ANY(p_formes))
        LIMIT 10001
    ) sub;

    RETURN result;
END;
$$;
