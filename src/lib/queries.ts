import { createClient } from "@/lib/supabase/server";
import type { SearchFilters, SearchResult } from "@/types/database";

const MAX_COUNT = 10000;

export async function searchCompanies(filters: SearchFilters) {
  const supabase = await createClient();

  // Query companies directly — siege address is denormalized, no JOIN needed
  let query = supabase
    .from("companies")
    .select(
      "siren, denomination, naf_code, tranche_effectif, categorie_entreprise, forme_juridique, date_creation, siege_code_postal, siege_ville, siege_departement, siege_adresse, dirigeant_nom, dirigeant_prenom, dirigeant_fonction, ca_dernier_exercice, resultat_net, date_enrichissement",
      { count: "estimated" }
    )
    .eq("etat_administratif", "A");

  // NAF code filter
  if (filters.naf_codes.length > 0) {
    query = query.in("naf_code", filters.naf_codes);
  }

  // Region → departement resolution + departement filter
  let deptFilter = [...filters.departement_codes];
  if (filters.region_codes.length > 0 && deptFilter.length === 0) {
    // Resolve region codes to department codes
    const { data: regionDepts } = await supabase
      .from("ref_departements")
      .select("code")
      .in("code_region", filters.region_codes);
    if (regionDepts) {
      deptFilter = regionDepts.map((d) => d.code);
    }
  }
  if (deptFilter.length > 0) {
    query = query.in("siege_departement", deptFilter);
  }

  // Effectif filter — only apply if user explicitly changed from defaults
  if (filters.effectif_min && filters.effectif_min !== "00") {
    query = query.gte("tranche_effectif", filters.effectif_min);
  }
  if (filters.effectif_max && filters.effectif_max !== "53") {
    query = query.lte("tranche_effectif", filters.effectif_max);
  }

  // Denomination search
  if (filters.denomination) {
    query = query.ilike("denomination", `%${filters.denomination}%`);
  }

  // Min age filter
  if (filters.min_age > 0) {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - filters.min_age);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];
    query = query.lte("date_creation", cutoffStr);
  }

  // Forme juridique filter
  if (filters.formes.length > 0) {
    query = query.in("forme_juridique", filters.formes);
  }

  // Pagination — no ORDER BY to avoid full-table sort timeout on 16M rows
  query = query.range(
    (filters.page - 1) * filters.per_page,
    filters.page * filters.per_page - 1
  );

  const { data, error, count } = await query;

  if (error) {
    console.error("Search error:", error);
    throw error;
  }

  // Fetch NAF libelles for the results
  const nafCodes = [
    ...new Set((data || []).map((c) => c.naf_code).filter(Boolean)),
  ];
  let nafMap: Record<string, string> = {};

  if (nafCodes.length > 0) {
    const { data: nafData } = await supabase
      .from("ref_naf")
      .select("code, libelle")
      .in("code", nafCodes as string[]);

    if (nafData) {
      nafMap = Object.fromEntries(nafData.map((n) => [n.code, n.libelle]));
    }
  }

  const results: SearchResult[] = (data || []).map((c) => ({
    siren: c.siren,
    denomination: c.denomination,
    naf_code: c.naf_code,
    naf_libelle: c.naf_code ? nafMap[c.naf_code] || null : null,
    code_postal: c.siege_code_postal,
    ville: c.siege_ville,
    departement_nom: c.siege_departement, // departement code for now
    region_nom: null,
    tranche_effectif: c.tranche_effectif,
    categorie_entreprise: c.categorie_entreprise,
    forme_juridique: c.forme_juridique,
    date_creation: c.date_creation,
    dirigeant_nom: c.dirigeant_nom,
    dirigeant_prenom: c.dirigeant_prenom,
    dirigeant_fonction: c.dirigeant_fonction,
    ca_dernier_exercice: c.ca_dernier_exercice,
    resultat_net: c.resultat_net,
    date_enrichissement: c.date_enrichissement,
  }));

  // Cap count at MAX_COUNT for performance
  const total = count !== null ? Math.min(count, MAX_COUNT) : 0;

  return {
    results,
    total,
    capped: count !== null && count > MAX_COUNT,
  };
}

export async function getRefNaf() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ref_naf")
    .select("code, libelle")
    .order("code");
  return data || [];
}

export async function getRefRegions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ref_regions")
    .select("code, nom")
    .order("nom");
  return data || [];
}

export async function getRefDepartements(regionCodes?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("ref_departements")
    .select("code, nom, code_region")
    .order("nom");

  if (regionCodes && regionCodes.length > 0) {
    query = query.in("code_region", regionCodes);
  }

  const { data } = await query;
  return data || [];
}
