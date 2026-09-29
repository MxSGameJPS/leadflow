export function numericValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let normalized = raw.replace(/\s/g, "");
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(normalized)) normalized = normalized.replace(/[.,]/g, "");
  else if (/^\d+,\d+$/.test(normalized)) normalized = normalized.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function bayesianRating(ratingInput, reviewCountInput, { priorMean = 4, priorWeight = 25 } = {}) {
  const rating = numericValue(ratingInput);
  if (rating === null || rating <= 0) return null;
  const reviewsRaw = numericValue(reviewCountInput);
  const reviews = reviewsRaw === null ? 1 : Math.max(0, Math.round(reviewsRaw));
  return (priorWeight * priorMean + reviews * rating) / (priorWeight + reviews);
}

export function opportunityGrade(score) {
  const value = Number(score || 0);
  if (value >= 80) return "A";
  if (value >= 60) return "B";
  if (value >= 40) return "C";
  return "D";
}

export function calculateOpportunityScore(input = {}) {
  const factors = [];
  const presence = input.presence || { hasOwnSite: Boolean(input.site), weak: !input.site, type: input.site ? "Site próprio" : "Sem presença encontrada" };
  const country = String(input.country || "BR").toUpperCase();
  const phone = String(input.phone || "");
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 12 || digits.length === 13
    ? (digits.startsWith("55") ? digits.slice(2) : "")
    : digits;
  const possibleWhatsapp = country === "BR" && /^\d{2}9\d{8}$/.test(local);
  const rating = numericValue(input.rating);
  const reviews = numericValue(input.reviews);
  const adjustedRating = bayesianRating(rating, reviews);

  let score = 8;

  if (!presence.hasOwnSite && presence.type === "Sem presença encontrada") {
    score += 38;
    factors.push("Sem site/presença própria");
  } else if (presence.weak) {
    score += 30;
    factors.push("Presença digital fraca ou de terceiros");
  } else {
    score += 4;
    factors.push("Já possui site próprio");
  }

  if (possibleWhatsapp) {
    score += 20;
    factors.push("Celular compatível com WhatsApp");
  } else if (phone) {
    score += 9;
    factors.push("Telefone disponível");
  }

  if (input.email) {
    score += 7;
    factors.push("E-mail disponível");
  }
  if (input.instagram) {
    score += 4;
    factors.push("Instagram disponível");
  }
  if (input.address) {
    score += 4;
    factors.push("Endereço disponível");
  }

  if (adjustedRating !== null) {
    if (adjustedRating >= 4.5) score += 10;
    else if (adjustedRating >= 4.2) score += 8;
    else if (adjustedRating >= 4) score += 5;
    else if (adjustedRating >= 3.5) score += 2;

    const count = reviews === null ? "volume desconhecido" : Math.round(reviews) + " avaliações";
    factors.push("Reputação Google " + Number(rating).toFixed(1) + "★ · " + count + " · confiança ajustada " + adjustedRating.toFixed(2));
  }

  if (reviews !== null) {
    if (reviews >= 500) {
      score += 10;
      factors.push("Reputação consolidada (500+ avaliações)");
    } else if (reviews >= 100) {
      score += 6;
      factors.push("Reputação estabelecida (100+ avaliações)");
    } else if (reviews >= 20) {
      score += 3;
      factors.push("Volume relevante de avaliações");
    }
  }

  const followers = numericValue(input.followers);
  if (followers !== null) {
    if (followers >= 10000) score += 6;
    else if (followers >= 1000) score += 4;
    else if (followers > 0) score += 2;
  }

  score = Math.min(100, Math.max(0, Math.round(score)));
  return {
    score,
    grade: opportunityGrade(score),
    factors,
    adjustedRating: adjustedRating === null ? null : Number(adjustedRating.toFixed(3)),
    possibleWhatsapp,
  };
}
