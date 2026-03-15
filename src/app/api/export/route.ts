import { createClient } from "@/lib/supabase/server";
import { fetchAllDirigeants, rateLimit } from "@/lib/enrichment";
import { NextRequest, NextResponse } from "next/server";

const EXPORT_LIMIT = 5000; // Max rows per export
const throttle = rateLimit(6); // 6 req/s — safe under 7/s API limit

export const maxDuration = 300; // Allow up to 5 min for large exports (Vercel)

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;

  const nafCodes = params.get("naf")?.split(",").filter(Boolean) || [];
  const regionCodes = params.get("regions")?.split(",").filter(Boolean) || [];
  const deptCodes = params.get("depts")?.split(",").filter(Boolean) || [];
  const effectifMin = params.get("eff_min") || "";
  const effectifMax = params.get("eff_max") || "";
  const minAge = parseInt(params.get("age") || "0");
  const denomination = params.get("q") || "";
  const excludeEI = params.get("no_ei") === "1";

  // Build query — same logic as queries.ts searchCompanies
  let query = supabase
    .from("companies")
    .select(
      "siren, denomination, naf_code, tranche_effectif, categorie_entreprise, forme_juridique, date_creation, siege_code_postal, siege_ville, siege_departement, siege_adresse, dirigeant_nom, dirigeant_prenom, dirigeant_fonction, ca_dernier_exercice, resultat_net"
    )
    .eq("etat_administratif", "A");

  // NAF filter
  if (nafCodes.length > 0) {
    query = query.in("naf_code", nafCodes);
  }

  // Region → departement resolution
  let deptFilter = [...deptCodes];
  if (regionCodes.length > 0 && deptFilter.length === 0) {
    const { data: regionDepts } = await supabase
      .from("ref_departements")
      .select("code")
      .in("code_region", regionCodes);
    if (regionDepts) {
      deptFilter = regionDepts.map((d) => d.code);
    }
  }
  if (deptFilter.length > 0) {
    query = query.in("siege_departement", deptFilter);
  }

  // Effectif filter
  if (effectifMin && effectifMin !== "00") {
    query = query.gte("tranche_effectif", effectifMin);
  }
  if (effectifMax && effectifMax !== "53") {
    query = query.lte("tranche_effectif", effectifMax);
  }

  // Exclude EI
  if (excludeEI) {
    query = query.neq("forme_juridique", "1000");
  }

  // Denomination search
  if (denomination) {
    query = query.ilike("denomination", `%${denomination}%`);
  }

  // Min age
  if (minAge > 0) {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - minAge);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];
    query = query.lte("date_creation", cutoffStr);
  }

  // Limit export size
  query = query.range(0, EXPORT_LIMIT - 1);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];
  if (rows.length === 0) {
    return new NextResponse("Aucun résultat à exporter", { status: 200 });
  }

  // Fetch NAF libelles for all codes in the results
  const nafCodesInResults = [...new Set(rows.map((r) => r.naf_code).filter(Boolean))];
  let nafMap: Record<string, string> = {};
  if (nafCodesInResults.length > 0) {
    const { data: nafData } = await supabase
      .from("ref_naf")
      .select("code, libelle")
      .in("code", nafCodesInResults as string[]);
    if (nafData) {
      nafMap = Object.fromEntries(nafData.map((n) => [n.code, n.libelle]));
    }
  }

  // Enrich each company with dirigeants from API Gouv (throttled)
  const enrichedRows: Array<{
    row: (typeof rows)[0];
    dirigeants: string;
  }> = [];

  for (const row of rows) {
    await throttle();
    const dirigeants = await fetchAllDirigeants(row.siren);

    const dirigeantsStr =
      dirigeants.length > 0
        ? dirigeants
            .map((d) => {
              const name = [d.prenom, d.nom].filter(Boolean).join(" ");
              return d.fonction ? `${name} (${d.fonction})` : name;
            })
            .join(", ")
        : "";

    enrichedRows.push({ row, dirigeants: dirigeantsStr });
  }

  // Build CSV
  const headers = [
    "SIREN",
    "Dénomination",
    "Code NAF",
    "Activité",
    "Code Postal",
    "Ville",
    "Département",
    "Forme Juridique",
    "Effectif",
    "Catégorie",
    "Date Création",
    "Dirigeants",
    "CA",
    "Résultat Net",
  ];

  const csvEscape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvRows = enrichedRows.map(({ row, dirigeants }) => {
    return [
      row.siren,
      row.denomination,
      row.naf_code,
      row.naf_code ? nafMap[row.naf_code] || "" : "",
      row.siege_code_postal,
      row.siege_ville,
      row.siege_departement,
      row.forme_juridique,
      row.tranche_effectif,
      row.categorie_entreprise,
      row.date_creation,
      dirigeants,
      row.ca_dernier_exercice,
      row.resultat_net,
    ]
      .map(csvEscape)
      .join(",");
  });

  const csv =
    "\uFEFF" + headers.map((h) => `"${h}"`).join(",") + "\n" + csvRows.join("\n");

  const timestamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alvora_export_${timestamp}.csv"`,
    },
  });
}
