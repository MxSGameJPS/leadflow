import {
  loadGoogleBusinessConnection,
  saveGoogleBusinessConnection,
} from "./googleBusinessStore.js";

export const GOOGLE_BUSINESS_SCOPE =
  "https://www.googleapis.com/auth/business.manage";

const OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

const API = {
  accountManagement: "https://mybusinessaccountmanagement.googleapis.com",
  businessInformation: "https://mybusinessbusinessinformation.googleapis.com",
  legacy: "https://mybusiness.googleapis.com",
  performance: "https://businessprofileperformance.googleapis.com",
};

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(name + " não configurado.");
  return value;
}

function clientConfig() {
  return {
    clientId: requiredEnv("GOOGLE_BUSINESS_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_BUSINESS_CLIENT_SECRET"),
  };
}

export function isGoogleBusinessConfigured() {
  return Boolean(
    process.env.GOOGLE_BUSINESS_CLIENT_ID &&
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET &&
      process.env.GOOGLE_BUSINESS_TOKEN_SECRET
  );
}

export function buildGoogleBusinessOAuthUrl({ redirectUri, state }) {
  const { clientId } = clientConfig();
  const url = new URL(OAUTH_AUTHORIZE_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_BUSINESS_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return url.toString();
}

async function tokenRequest(params) {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      body?.error_description ||
      body?.error ||
      "Falha OAuth do Google (" + response.status + ").";
    throw new Error(message);
  }

  return body;
}

export async function exchangeGoogleBusinessCode({ code, redirectUri }) {
  const { clientId, clientSecret } = clientConfig();

  const token = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  if (!token.refresh_token) {
    throw new Error(
      "O Google não retornou refresh_token. Revogue o acesso anterior e conecte novamente com consentimento."
    );
  }

  const connection = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    tokenType: token.token_type || "Bearer",
    scope: token.scope || GOOGLE_BUSINESS_SCOPE,
    connectedAt: new Date().toISOString(),
  };

  await saveGoogleBusinessConnection(connection);
  return connection;
}

async function refreshConnection(connection) {
  const { clientId, clientSecret } = clientConfig();

  const token = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: connection.refreshToken,
    grant_type: "refresh_token",
  });

  const updated = {
    ...connection,
    accessToken: token.access_token,
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    tokenType: token.token_type || connection.tokenType || "Bearer",
    scope: token.scope || connection.scope || GOOGLE_BUSINESS_SCOPE,
    refreshedAt: new Date().toISOString(),
  };

  await saveGoogleBusinessConnection(updated);
  return updated;
}

export async function getGoogleBusinessAccessToken() {
  let connection = await loadGoogleBusinessConnection();

  if (!connection?.refreshToken) {
    throw new Error("Google Business ainda não está conectado.");
  }

  const expiresSoon =
    !connection.accessToken ||
    !connection.expiresAt ||
    Number(connection.expiresAt) <= Date.now() + 60000;

  if (expiresSoon) connection = await refreshConnection(connection);

  return connection.accessToken;
}

async function readGoogleError(response) {
  const payload = await response.json().catch(() => null);
  const apiMessage = payload?.error?.message || payload?.error_description;

  if (apiMessage) {
    const error = new Error(apiMessage);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const error = new Error(
    "Google Business API retornou HTTP " + response.status + "."
  );
  error.status = response.status;
  throw error;
}

export async function googleBusinessRequest({
  api,
  path,
  method = "GET",
  query,
  body,
}) {
  const base = API[api];
  if (!base) throw new Error("API Google Business desconhecida: " + api);

  const token = await getGoogleBusinessAccessToken();
  const url = new URL(path, base);

  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      authorization: "Bearer " + token,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) await readGoogleError(response);
  if (response.status === 204) return null;

  return response.json();
}

export function normalizeAccountName(value) {
  const id = String(value || "").replace(/^accounts\//, "").trim();
  if (!id) throw new Error("accountId é obrigatório.");
  return "accounts/" + id;
}

export function normalizeLocationName(value) {
  const id = String(value || "").replace(/^locations\//, "").trim();
  if (!id) throw new Error("locationId é obrigatório.");
  return "locations/" + id;
}

export function legacyLocationParent(accountId, locationId) {
  return normalizeAccountName(accountId) + "/" + normalizeLocationName(locationId);
}

export function dateParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data inválida.");

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export async function listGoogleBusinessAccounts() {
  return googleBusinessRequest({
    api: "accountManagement",
    path: "/v1/accounts",
    query: { pageSize: 20 },
  });
}

export async function listGoogleBusinessLocations(accountId) {
  const account = normalizeAccountName(accountId);

  return googleBusinessRequest({
    api: "businessInformation",
    path: "/v1/" + account + "/locations",
    query: {
      pageSize: 100,
      readMask:
        "name,title,storeCode,phoneNumbers,websiteUri,regularHours,categories,serviceArea,metadata,profile",
    },
  });
}

export async function listGoogleBusinessReviews({
  accountId,
  locationId,
  pageSize = 50,
  pageToken,
}) {
  const parent = legacyLocationParent(accountId, locationId);

  return googleBusinessRequest({
    api: "legacy",
    path: "/v4/" + parent + "/reviews",
    query: { pageSize, pageToken },
  });
}

export async function replyGoogleBusinessReview({
  accountId,
  locationId,
  reviewId,
  comment,
}) {
  const parent = legacyLocationParent(accountId, locationId);
  const safeReviewId = encodeURIComponent(String(reviewId || "").trim());

  if (!safeReviewId) throw new Error("reviewId é obrigatório.");
  if (!String(comment || "").trim()) throw new Error("comment é obrigatório.");

  return googleBusinessRequest({
    api: "legacy",
    path: "/v4/" + parent + "/reviews/" + safeReviewId + "/reply",
    method: "PUT",
    body: { comment: String(comment).trim() },
  });
}

export async function listGoogleBusinessPosts({
  accountId,
  locationId,
  pageSize = 50,
  pageToken,
}) {
  const parent = legacyLocationParent(accountId, locationId);

  return googleBusinessRequest({
    api: "legacy",
    path: "/v4/" + parent + "/localPosts",
    query: { pageSize, pageToken },
  });
}

export async function createGoogleBusinessPost({
  accountId,
  locationId,
  summary,
  callToAction,
}) {
  const parent = legacyLocationParent(accountId, locationId);
  const payload = {
    languageCode: "pt-BR",
    summary: String(summary || "").trim(),
  };

  if (!payload.summary) throw new Error("summary é obrigatório.");
  if (callToAction) payload.callToAction = callToAction;

  return googleBusinessRequest({
    api: "legacy",
    path: "/v4/" + parent + "/localPosts",
    method: "POST",
    body: payload,
  });
}

export async function getGoogleBusinessPerformance({
  locationId,
  startDate,
  endDate,
  metrics,
}) {
  const location = normalizeLocationName(locationId);
  const start = dateParts(startDate);
  const end = dateParts(endDate);
  const dailyMetrics =
    metrics?.length
      ? metrics
      : [
          "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
          "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
          "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
          "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
          "BUSINESS_DIRECTION_REQUESTS",
          "CALL_CLICKS",
          "WEBSITE_CLICKS",
        ];

  return googleBusinessRequest({
    api: "performance",
    path: "/v1/" + location + ":fetchMultiDailyMetricsTimeSeries",
    query: {
      dailyMetrics,
      "dailyRange.startDate.year": start.year,
      "dailyRange.startDate.month": start.month,
      "dailyRange.startDate.day": start.day,
      "dailyRange.endDate.year": end.year,
      "dailyRange.endDate.month": end.month,
      "dailyRange.endDate.day": end.day,
    },
  });
}

export async function getGoogleBusinessSearchKeywords({
  locationId,
  startMonth,
  endMonth,
  pageSize = 100,
  pageToken,
}) {
  const location = normalizeLocationName(locationId);
  const start = dateParts(startMonth);
  const end = dateParts(endMonth);

  return googleBusinessRequest({
    api: "performance",
    path: "/v1/" + location + "/searchkeywords/impressions/monthly",
    query: {
      "monthlyRange.startMonth.year": start.year,
      "monthlyRange.startMonth.month": start.month,
      "monthlyRange.endMonth.year": end.year,
      "monthlyRange.endMonth.month": end.month,
      pageSize,
      pageToken,
    },
  });
}
