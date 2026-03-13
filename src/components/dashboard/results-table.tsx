"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { SearchResult } from "@/types/database";
import { EFFECTIF_LABELS } from "@/types/database";
import { useState } from "react";

interface ResultsTableProps {
  results: SearchResult[];
  total: number;
  page: number;
  perPage: number;
}

export function ResultsTable({
  results,
  total,
  page,
  perPage,
}: ResultsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enriching, setEnriching] = useState(false);

  const totalPages = Math.ceil(total / perPage);
  const enrichedCount = results.filter((r) => r.date_enrichissement).length;

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/dashboard?${params.toString()}`);
  }

  async function handleExport() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    window.open(`/api/export?${params.toString()}`, "_blank");
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const sirens = results
        .filter((r) => !r.date_enrichissement)
        .map((r) => r.siren);

      if (sirens.length === 0) return;

      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sirens: sirens.slice(0, 50) }),
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setEnriching(false);
    }
  }

  function formatCA(ca: number | null) {
    if (ca == null) return "—";
    if (ca >= 1_000_000) return `${(ca / 1_000_000).toFixed(1)}M€`;
    if (ca >= 1_000) return `${(ca / 1_000).toFixed(0)}k€`;
    return `${ca}€`;
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-2xl font-bold">{total.toLocaleString("fr-FR")}</span>
            <span className="ml-2 text-sm text-zinc-500">sociétés trouvées</span>
          </div>
          {enrichedCount > 0 && (
            <Badge variant="secondary">
              {enrichedCount} enrichie{enrichedCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnrich}
            disabled={enriching || results.length === 0}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {enriching ? "Enrichissement..." : "Enrichir"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={total === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">SIREN</TableHead>
              <TableHead>Dénomination</TableHead>
              <TableHead>Activité</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Effectif</TableHead>
              <TableHead>Dirigeant</TableHead>
              <TableHead className="text-right">CA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-zinc-500">
                  {total === 0
                    ? "Aucun résultat. Ajustez vos filtres."
                    : "Lancez une recherche pour afficher les résultats."}
                </TableCell>
              </TableRow>
            ) : (
              results.map((company) => (
                <TableRow
                  key={company.siren}
                  className="cursor-pointer hover:bg-zinc-50"
                  onClick={() => router.push(`/company/${company.siren}`)}
                >
                  <TableCell className="font-mono text-xs text-zinc-500">
                    {company.siren}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {company.denomination || "—"}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm text-zinc-600">
                    {company.naf_libelle || company.naf_code || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {company.ville || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {company.departement_nom || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {company.tranche_effectif
                      ? EFFECTIF_LABELS[company.tranche_effectif] ||
                        company.tranche_effectif
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {company.dirigeant_nom
                      ? `${company.dirigeant_prenom || ""} ${company.dirigeant_nom}`.trim()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCA(company.ca_dernier_exercice)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-6 py-3">
          <span className="text-sm text-zinc-500">
            Page {page} sur {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
