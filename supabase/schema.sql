-- ============================================================
-- ALVORA DB — Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor (supabase.com > SQL Editor)
-- ============================================================

-- 1. REFERENCE TABLES
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

-- 2. MAIN TABLES
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

CREATE TABLE IF NOT EXISTS etablissements (
    siret TEXT PRIMARY KEY,
    siren TEXT REFERENCES companies(siren),
    nic TEXT,
    denomination_usuelle TEXT,
    enseigne TEXT,
    naf_code TEXT,
    est_siege BOOLEAN DEFAULT FALSE,
    numero_voie TEXT,
    type_voie TEXT,
    libelle_voie TEXT,
    code_postal TEXT,
    commune TEXT,
    code_commune TEXT,
    departement TEXT,
    etat_administratif TEXT NOT NULL DEFAULT 'A',
    date_creation TEXT,
    tranche_effectif TEXT,
    latitude REAL,
    longitude REAL
);

-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_companies_naf ON companies(naf_code);
CREATE INDEX IF NOT EXISTS idx_companies_etat ON companies(etat_administratif);
CREATE INDEX IF NOT EXISTS idx_companies_effectif ON companies(tranche_effectif);
CREATE INDEX IF NOT EXISTS idx_companies_categorie ON companies(categorie_entreprise);
CREATE INDEX IF NOT EXISTS idx_companies_denomination ON companies(denomination);
-- trigram index for text search on denomination
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_companies_denomination_trgm ON companies USING gin(denomination gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_etab_siren ON etablissements(siren);
CREATE INDEX IF NOT EXISTS idx_etab_naf ON etablissements(naf_code);
CREATE INDEX IF NOT EXISTS idx_etab_dept ON etablissements(departement);
CREATE INDEX IF NOT EXISTS idx_etab_cp ON etablissements(code_postal);
CREATE INDEX IF NOT EXISTS idx_etab_siege ON etablissements(est_siege);
CREATE INDEX IF NOT EXISTS idx_etab_etat ON etablissements(etat_administratif);
CREATE INDEX IF NOT EXISTS idx_etab_commune ON etablissements(commune);
CREATE INDEX IF NOT EXISTS idx_etab_filter ON etablissements(etat_administratif, naf_code, departement);

-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_naf ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_departements ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all data
CREATE POLICY "Authenticated users can read companies"
    ON companies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read etablissements"
    ON etablissements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read ref_naf"
    ON ref_naf FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read ref_regions"
    ON ref_regions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read ref_departements"
    ON ref_departements FOR SELECT TO authenticated USING (true);

-- 5. RPC FUNCTIONS (called from Next.js)
-- ============================================================

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
    departement_nom TEXT,
    region_nom TEXT,
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
        e.code_postal,
        e.commune AS ville,
        d.nom AS departement_nom,
        r.nom AS region_nom,
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
    JOIN etablissements e ON c.siren = e.siren AND e.est_siege = TRUE
    LEFT JOIN ref_naf n ON c.naf_code = n.code
    LEFT JOIN ref_departements d ON e.departement = d.code
    LEFT JOIN ref_regions r ON d.code_region = r.code
    WHERE c.etat_administratif = 'A'
      AND e.etat_administratif = 'A'
      AND (p_naf_codes IS NULL OR c.naf_code = ANY(p_naf_codes))
      AND (p_dept_codes IS NULL OR e.departement = ANY(p_dept_codes))
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
    FROM companies c
    JOIN etablissements e ON c.siren = e.siren AND e.est_siege = TRUE
    WHERE c.etat_administratif = 'A'
      AND e.etat_administratif = 'A'
      AND (p_naf_codes IS NULL OR c.naf_code = ANY(p_naf_codes))
      AND (p_dept_codes IS NULL OR e.departement = ANY(p_dept_codes))
      AND (p_effectif_min IS NULL OR c.tranche_effectif >= p_effectif_min)
      AND (p_effectif_max IS NULL OR c.tranche_effectif <= p_effectif_max)
      AND (c.tranche_effectif IS NULL OR c.tranche_effectif != 'NN')
      AND (p_min_age IS NULL OR c.date_creation <= to_char(CURRENT_DATE - (p_min_age || ' years')::INTERVAL, 'YYYY-MM-DD'))
      AND (p_denomination IS NULL OR c.denomination ILIKE '%' || p_denomination || '%')
      AND (p_formes IS NULL OR c.forme_juridique = ANY(p_formes));

    RETURN result;
END;
$$;
