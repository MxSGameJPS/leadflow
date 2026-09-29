import { calculateOpportunityScore } from "./opportunityScoring.js";

export function waNorm(p) { if (!p) return null; let d = String(p).replace(/\D/g, ""); if (!d || d.length < 8) return null; if (!d.startsWith("55")) d = "55" + d; if (d.length < 12 || d.length > 13) return null; return d; }

export function autoScore(l) {
  return calculateOpportunityScore({
    phone: l.whatsapp || l.phone,
    email: l.email,
    instagram: l.instagram,
    address: l.address,
    rating: l.googleRating,
    reviews: l.googleReviews,
    followers: l.followers,
    presence: {
      hasOwnSite: Boolean(l.site && l.weakSite === false),
      weak: l.weakSite !== false,
      type: !l.site ? "Sem presença encontrada" : l.weakSite !== false ? "Presença fraca" : "Site próprio",
    },
    country: "BR",
  }).score;
}

export function gradeFromScore(s) { return s >= 70 ? "A" : s >= 50 ? "B" : s >= 30 ? "C" : "D"; }
