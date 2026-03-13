import { createClient } from "@/lib/supabase/server";
import type { SearchFilters, SearchResult } from "@/types/database";

export async function searchCompanies(filters: SearchFilters) {
  const supabase = await createClient();

  // We use a database function for the complex join query
  const { data, error, count } = await supabase.rpc("search_companies", {
    p_naf_codes: filters.naf_codes.length > 0 ? filters.naf_codes : null,
    p_dept_codes:
      filters.departement_codes.length > 0 ? filters.departement_codes : null,
    p_effectif_min: filters.effectif_min || null,
    p_effectif_max: filters.effectif_max || null,
    p_formes: filters.formes.length > 0 ? filters.formes : null,
    p_min_age: filters.min_age > 0 ? filters.min_age : null,
    p_denomination: filters.denomination || null,
    p_limit: filters.per_page,
    p_offset: (filters.page - 1) * filters.per_page,
  });

  if (error) {
    console.error("Search error:", error);
    throw error;
  }

  // Get total count with a separate call
  const { data: countData } = await supabase.rpc("count_companies", {
    p_naf_codes: filters.naf_codes.length > 0 ? filters.naf_codes : null,
    p_dept_codes:
      filters.departement_codes.length > 0 ? filters.departement_codes : null,
    p_effectif_min: filters.effectif_min || null,
    p_effectif_max: filters.effectif_max || null,
    p_formes: filters.formes.length > 0 ? filters.formes : null,
    p_min_age: filters.min_age > 0 ? filters.min_age : null,
    p_denomination: filters.denomination || null,
  });

  return {
    results: (data || []) as SearchResult[],
    total: (countData as number) || 0,
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
