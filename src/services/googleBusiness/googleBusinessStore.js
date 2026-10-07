import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const CONNECTION_FILE = path.join(process.cwd(), "data", "google-business", "connection.json");

function getEncryptionKey() {
  const secret = String(process.env.GOOGLE_BUSINESS_TOKEN_SECRET || "").trim();

  if (secret.length < 24) {
    throw new Error(
      "GOOGLE_BUSINESS_TOKEN_SECRET precisa ter pelo menos 24 caracteres para armazenar tokens do Google Business."
    );
  }

  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function encryptJson(value) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
    updatedAt: new Date().toISOString(),
  };
}

function decryptJson(payload) {
  if (!payload || payload.version !== 1 || payload.algorithm !== "aes-256-gcm") {
    throw new Error("Formato de credencial do Google Business inválido.");
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

export async function saveGoogleBusinessConnection(connection) {
  await fs.mkdir(path.dirname(CONNECTION_FILE), { recursive: true });
  await fs.writeFile(
    CONNECTION_FILE,
    JSON.stringify(encryptJson(connection), null, 2),
    "utf8"
  );

  return connection;
}

export async function loadGoogleBusinessConnection() {
  try {
    const raw = await fs.readFile(CONNECTION_FILE, "utf8");
    return decryptJson(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function clearGoogleBusinessConnection() {
  try {
    await fs.unlink(CONNECTION_FILE);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export function connectionFilePath() {
  return CONNECTION_FILE;
}
