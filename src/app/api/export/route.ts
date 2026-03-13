import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
  const deptCodes = params.get("depts")?.split(",").filter(Boolean) || [];
  const effectifMin = params.get("eff_min") || "03";
  const effectifMax = params.get("eff_max") || "42";
  const minAge = parseInt(params.get("age") || "0");
  const denomination = params.get("q") || "";

  const { data, error } = await supabase.rpc("search_companies", {
    p_naf_codes: nafCodes.length > 0 ? nafCodes : null,
    p_dept_codes: deptCodes.length > 0 ? deptCodes : null,
    p_effectif_min: effectifMin || null,
    p_effectif_max: effectifMax || null,
    p_formes: null,
    p_min_age: minAge > 0 ? minAge : null,
    p_denomination: denomination || null,
    p_limit: 10000,
    p_offset: 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build CSV
  const rows = data || [];
  if (rows.length === 0) {
    return new NextResponse("Aucun résultat", { status: 200 });
  }

  const headers = [
    "SIREN",
    "Dénomination",
    "Code NAF",
    "Activité",
    "Code Postal",
    "Ville",
    "Département",
    "Région",
    "Effectif",
    "Catégorie",
    "Date Création",
    "Dirigeant",
    "CA",
    "Résultat Net",
  ];

  const csvRows = rows.map((r: Record<string, unknown>) => {
    return [
      r.siren,
      r.denomination,
      r.naf_code,
      r.naf_libelle,
      r.code_postal,
      r.ville,
      r.departement_nom,
      r.region_nom,
      r.tranche_effectif,
      r.categorie_entreprise,
      r.date_creation,
      [r.dirigeant_prenom, r.dirigeant_nom].filter(Boolean).join(" "),
      r.ca_dernier_exercice,
      r.resultat_net,
    ]
      .map((v) => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(",");
  });

  const csv =
    "\uFEFF" + headers.map((h) => `"${h}"`).join(",") + "\n" + csvRows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="alvora_export.csv"',
    },
  });
}
