"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { FiltersSidebar } from "./filters-sidebar";
import { ResultsTable } from "./results-table";
import type { RefNaf, RefDepartement, RefRegion, SearchResult } from "@/types/database";

interface DashboardLayoutProps {
  nafCodes: RefNaf[];
  regions: RefRegion[];
  departements: RefDepartement[];
  results: SearchResult[];
  total: number;
  capped: boolean;
  page: number;
  perPage: number;
}

export function DashboardLayout({
  nafCodes,
  regions,
  departements,
  results,
  total,
  capped,
  page,
  perPage,
}: DashboardLayoutProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <FiltersSidebar
        nafCodes={nafCodes}
        regions={regions}
        departements={departements}
        open={filtersOpen}
        onToggle={() => setFiltersOpen(!filtersOpen)}
      />
      <div className="flex flex-1 flex-col">
        <ResultsTable
          results={results}
          total={total}
          capped={capped}
          page={page}
          perPage={perPage}
          onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          filtersOpen={filtersOpen}
        />
      </div>
    </div>
  );
}
