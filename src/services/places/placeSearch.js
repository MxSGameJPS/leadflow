import { searchGoogleMapsScraper } from "./googleMapsScraper.js";
import { searchGooglePlaces } from "./googlePlaces.js";

function providerName() {
  return String(process.env.LEADFLOW_PLACES_PROVIDER || "scraper").trim().toLowerCase();
}

export async function searchPlaces(input, options = {}) {
  const provider = providerName();

  if (["scraper", "google_maps_scraper", "maps"].includes(provider)) {
    return searchGoogleMapsScraper(input, options);
  }

  if (["google", "google_places", "google_places_api"].includes(provider)) {
    return searchGooglePlaces(input, options);
  }

  if (provider === "auto") {
    try {
      return await searchGoogleMapsScraper(input, options);
    } catch (scraperError) {
      if (!process.env.GOOGLE_PLACES_API_KEY) throw scraperError;
      try {
        return await searchGooglePlaces(input, options);
      } catch (googleError) {
        throw new Error("Scraper local: " + scraperError.message + " Fallback Google Places: " + googleError.message);
      }
    }
  }

  throw new Error("LEADFLOW_PLACES_PROVIDER inválido: " + provider + ". Use scraper, google_places ou auto.");
}
