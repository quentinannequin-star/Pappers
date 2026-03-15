const RECHERCHE_API_BASE =
  "https://recherche-entreprises.api.gouv.fr/search";

export async function fetchDirigeants(
  siren: string
): Promise<{
  nom: string | null;
  prenom: string | null;
  fonction: string | null;
  age_est: number | null;
}> {
  try {
    const resp = await fetch(`${RECHERCHE_API_BASE}?q=${siren}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return { nom: null, prenom: null, fonction: null, age_est: null };

    const data = await resp.json();
    const results = data.results || [];
    if (results.length === 0)
      return { nom: null, prenom: null, fonction: null, age_est: null };

    const company = results[0];
    const dirigeants = company.dirigeants || [];

    if (dirigeants.length === 0)
      return { nom: null, prenom: null, fonction: null, age_est: null };

    const d = dirigeants[0];
    let age_est: number | null = null;
    if (d.date_naissance) {
      const birthYear = parseInt(d.date_naissance.substring(0, 4));
      if (!isNaN(birthYear)) {
        age_est = new Date().getFullYear() - birthYear;
      }
    }

    return {
      nom: d.nom || null,
      prenom: d.prenom || null,
      fonction: d.qualite || null,
      age_est,
    };
  } catch {
    return { nom: null, prenom: null, fonction: null, age_est: null };
  }
}

// Fetch ALL dirigeants for a SIREN (for CSV export)
export async function fetchAllDirigeants(
  siren: string
): Promise<{ nom: string; prenom: string; fonction: string }[]> {
  try {
    const resp = await fetch(`${RECHERCHE_API_BASE}?q=${siren}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    const results = data.results || [];
    if (results.length === 0) return [];

    const company = results[0];
    // Verify SIREN matches (API searches by text, not exact SIREN)
    if (company.siren !== siren) return [];

    const dirigeants = company.dirigeants || [];
    return dirigeants.map((d: { nom?: string; prenom?: string; qualite?: string }) => ({
      nom: d.nom || "",
      prenom: d.prenom || "",
      fonction: d.qualite || "",
    }));
  } catch {
    return [];
  }
}

// Rate limiter: max N requests per second
export function rateLimit(perSecond: number) {
  let lastCall = 0;
  const minInterval = 1000 / perSecond;

  return async () => {
    const now = Date.now();
    const wait = minInterval - (now - lastCall);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastCall = Date.now();
  };
}
