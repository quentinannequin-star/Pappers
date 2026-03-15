export interface Company {
  siren: string;
  denomination: string | null;
  sigle: string | null;
  naf_code: string | null;
  forme_juridique: string | null;
  date_creation: string | null;
  tranche_effectif: string | null;
  categorie_entreprise: string | null;
  etat_administratif: string;
  // Denormalized siege address
  siege_code_postal: string | null;
  siege_ville: string | null;
  siege_departement: string | null;
  siege_adresse: string | null;
  dirigeant_nom: string | null;
  dirigeant_prenom: string | null;
  dirigeant_fonction: string | null;
  dirigeant_age_est: number | null;
  ca_dernier_exercice: number | null;
  resultat_net: number | null;
  effectif_exact: number | null;
  date_enrichissement: string | null;
  date_chargement: string | null;
}

export interface Etablissement {
  siret: string;
  siren: string;
  nic: string | null;
  denomination_usuelle: string | null;
  enseigne: string | null;
  naf_code: string | null;
  est_siege: boolean;
  numero_voie: string | null;
  type_voie: string | null;
  libelle_voie: string | null;
  code_postal: string | null;
  commune: string | null;
  code_commune: string | null;
  departement: string | null;
  etat_administratif: string;
  date_creation: string | null;
  tranche_effectif: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RefNaf {
  code: string;
  libelle: string;
}

export interface RefDepartement {
  code: string;
  nom: string;
  code_region: string;
}

export interface RefRegion {
  code: string;
  nom: string;
}

export interface SearchFilters {
  naf_codes: string[];
  region_codes: string[];
  departement_codes: string[];
  effectif_min: string;
  effectif_max: string;
  formes: string[];
  min_age: number;
  denomination: string;
  page: number;
  per_page: number;
}

export interface SearchResult {
  siren: string;
  denomination: string | null;
  naf_code: string | null;
  naf_libelle: string | null;
  code_postal: string | null;
  ville: string | null;
  departement_nom: string | null;
  region_nom: string | null;
  tranche_effectif: string | null;
  categorie_entreprise: string | null;
  forme_juridique: string | null;
  date_creation: string | null;
  dirigeant_nom: string | null;
  dirigeant_prenom: string | null;
  dirigeant_fonction: string | null;
  ca_dernier_exercice: number | null;
  resultat_net: number | null;
  date_enrichissement: string | null;
}

export const FORME_JURIDIQUE_LABELS: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "2110": "Indivision",
  "2210": "Société créée de fait",
  "2900": "Autre groupement de droit privé",
  "3120": "SARL unipersonnelle (EARL)",
  "3220": "SARL d'exercice libéral",
  "5202": "SA coopérative",
  "5485": "SA à directoire",
  "5499": "SA à conseil d'administration",
  "5599": "SA à participation ouvrière",
  "5710": "SAS",
  "5720": "SASU",
  "6316": "SARL de famille",
  "6533": "SARL coopérative artisanale",
  "6534": "SARL coopérative agricole",
  "6540": "SARL",
  "6541": "SARL unipersonnelle (EURL)",
  "6589": "SARL d'aménagement foncier",
  "6597": "SARL commerciale",
  "6598": "SARL libérale",
  "6599": "SARL (autre)",
  "7210": "Commune et commune nouvelle",
  "7361": "Communauté de communes",
  "9110": "Syndicat de propriétaires",
  "9220": "Association déclarée",
  "9221": "Association déclarée d'insertion",
  "9260": "Association de droit local",
};

export const EFFECTIF_LABELS: Record<string, string> = {
  "00": "0 salarié",
  "01": "1-2",
  "02": "3-5",
  "03": "6-9",
  "11": "10-19",
  "12": "20-49",
  "21": "50-99",
  "22": "100-199",
  "31": "200-249",
  "32": "250-499",
  "41": "500-999",
  "42": "1 000-1 999",
  "51": "2 000-4 999",
  "52": "5 000-9 999",
  "53": "10 000+",
};
