"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";
import type { SearchResult } from "@/types/database";
import { EFFECTIF_LABELS } from "@/types/database";
import { useState } from "react";

interface ResultsTableProps {
  results: SearchResult[];
  total: number;
  capped: boolean;
  page: number;
  perPage: number;
}

export function ResultsTable({
  results,
  total,
  capped,
  page,
  perPage,
}: ResultsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  const totalPages = Math.ceil(total / perPage);

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/dashboard?${params.toString()}`);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      const response = await fetch(`/api/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `alvora_export_${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-zinc-900 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-indigo-950 px-5 py-2.5">
            <span className="text-3xl font-bold text-indigo-400">
              {capped ? "10 000+" : total.toLocaleString("fr-FR")}
            </span>
            <span className="ml-2 text-sm font-medium text-indigo-500">sociétés</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={total === 0 || exporting}
            className="rounded-xl"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting ? "Génération en cours..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-24 text-xs font-medium uppercase tracking-wider text-zinc-500">SIREN</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Dénomination</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Activité</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Ville</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Département</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Effectif</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">Forme juridique</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-950">
                        <Search className="h-6 w-6 text-indigo-400" />
                      </div>
                      <p className="text-sm text-zinc-500">
                        {total === 0
                          ? "Aucun résultat. Ajustez vos filtres."
                          : "Utilisez les filtres pour lancer une recherche."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                results.map((company) => (
                  <TableRow
                    key={company.siren}
                    className="cursor-pointer border-zinc-800/50 transition-colors hover:bg-zinc-800/50"
                    onClick={() => router.push(`/company/${company.siren}`)}
                  >
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {company.siren}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-semibold text-white">
                      {company.denomination || "—"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-zinc-400">
                      {company.naf_libelle || company.naf_code || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {company.ville || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {company.departement_nom || "—"}
                    </TableCell>
                    <TableCell>
                      {company.tranche_effectif ? (
                        <span className="inline-flex rounded-lg bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                          {EFFECTIF_LABELS[company.tranche_effectif] || company.tranche_effectif}
                        </span>
                      ) : (
                        <span className="text-sm text-zinc-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {company.forme_juridique || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900 px-6 py-3">
          <span className="text-sm text-zinc-500">
            Page {page} sur {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-xl"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-xl"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
