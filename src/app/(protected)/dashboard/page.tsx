import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { searchCompanies, getRefNaf, getRefRegions, getRefDepartements } from "@/lib/queries";

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;

  // Load reference data for filters
  const [nafCodes, regions, departements] = await Promise.all([
    getRefNaf(),
    getRefRegions(),
    getRefDepartements(),
  ]);

  const hasFilters = params.naf || params.depts || params.q || params.regions || params.eff_min || params.eff_max || params.age || params.page || params.no_ei;
  const page = parseInt(params.page || "1");
  const perPage = 50;

  let results: Awaited<ReturnType<typeof searchCompanies>> = {
    results: [],
    total: 0,
    capped: false,
  };

  if (hasFilters) {
    try {
      results = await searchCompanies({
        naf_codes: params.naf?.split(",").filter(Boolean) || [],
        region_codes: params.regions?.split(",").filter(Boolean) || [],
        departement_codes: params.depts?.split(",").filter(Boolean) || [],
        effectif_min: params.eff_min || "",
        effectif_max: params.eff_max || "",
        formes: params.formes?.split(",").filter(Boolean) || [],
        exclude_ei: params.no_ei === "1",
        min_age: parseInt(params.age || "0"),
        denomination: params.q || "",
        page,
        per_page: perPage,
      });
    } catch (err) {
      console.error("Search failed:", err);
    }
  }

  return (
    <DashboardLayout
      nafCodes={nafCodes}
      regions={regions}
      departements={departements}
      results={results.results}
      total={results.total}
      capped={results.capped}
      page={page}
      perPage={perPage}
    />
  );
}
