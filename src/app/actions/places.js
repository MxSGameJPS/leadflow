"use server";

import { revalidatePath } from "next/cache";
import { listIbgeCities } from "../../services/locations/ibge.js";
import { searchPlaces } from "../../services/places/placeSearch.js";

function refreshLeadViews() {
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/crm");
}

export async function listCitiesAction(state) {
  return listIbgeCities(state);
}

export async function searchPlacesAction(filters) {
  return searchPlaces(filters);
}

export async function addPlacesToCrmAction(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Selecione ao menos um estabelecimento.");
  if (items.length > 60) throw new Error("O limite por envio é de 60 estabelecimentos.");

  // Carrega Prisma/Supabase somente quando o usuário realmente envia leads ao CRM.
  // Assim, a action leve de cidades não recompila todo o grafo de persistência no HMR.
  const { importLeads } = await import("../../repositories/leadRepository.js");

  const leads = items.map(item => ({
    externalId: item.placeId || item.externalId,
    source: item.source || "Google Maps",
    name: item.name,
    segment: item.segment,
    city: item.city,
    location: item.location,
    address: item.address,
    score: item.score,
    grade: item.grade,
    phone: item.phone,
    email: item.email,
    whatsapp: null,
    instagram: item.instagram,
    site: item.site,
    weakSite: item.weakSite,
    googleRating: item.googleRating,
    googleReviews: item.googleReviews,
    problem: item.problem,
    offer: item.offer,
    reason: item.reason,
    mapsLink: item.mapsLink,
    stage: "novo",
    notes: item.possibleWhatsApp
      ? "Celular encontrado no Google Maps. Pode ter WhatsApp, mas ainda não foi confirmado."
      : "Importado automaticamente do Google Maps.",
  }));

  const result = await importLeads(leads);
  const { saveLeadAssetSeed } = await import("../../services/projects/leadAssetStore.js");
  await Promise.all(items.map(item => saveLeadAssetSeed(item.placeId || item.externalId, {
    thumbnail: item.thumbnail,
    imageUrls: item.imageUrls,
    site: item.site,
    instagram: item.instagram,
    mapsLink: item.mapsLink,
  })));
  refreshLeadViews();
  return result;
}
