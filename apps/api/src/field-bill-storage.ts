import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FieldBillStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

/**
 * Storage for field bills. Production uses any S3-compatible object store;
 * local development uses a private directory so the feature can be tested
 * without provisioning a bucket. Neither implementation exposes a public URL.
 */
export function createFieldBillStorage(): FieldBillStorage {
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT?.trim();
  const bucket = process.env.OBJECT_STORAGE_BUCKET?.trim();
  const accessKey = process.env.OBJECT_STORAGE_ACCESS_KEY?.trim();
  const secretKey = process.env.OBJECT_STORAGE_SECRET_KEY?.trim();
  const region = process.env.OBJECT_STORAGE_REGION?.trim() || "us-east-1";

  if (endpoint && bucket && accessKey && secretKey) {
    return new S3CompatibleFieldBillStorage({ endpoint, bucket, accessKey, secretKey, region });
  }
  if ((process.env.NODE_ENV ?? "development").toLowerCase() === "production") {
    throw new Error("Object storage is required in production. Configure OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY, and OBJECT_STORAGE_SECRET_KEY.");
  }
  return new LocalFieldBillStorage(process.env.FIELD_BILL_STORAGE_DIR || path.join(process.cwd(), ".data", "field-bills"));
}

export function billStorageKey(leadId: string): string {
  return `field-bills/${leadId}/${randomUUID()}`;
}

export function createBillDownloadToken(billId: string, expiresAt: number): string {
  const payload = `${billId}.${expiresAt}`;
  const signature = createHmac("sha256", downloadSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyBillDownloadToken(token: string, billId: string): boolean {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;
  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const [tokenBillId, expiresAtText] = payload.split(".");
    const expiresAt = Number(expiresAtText);
    if (tokenBillId !== billId || !Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return false;
    const expected = createHmac("sha256", downloadSecret()).update(payload).digest("base64url");
    return timingSafeStringEqual(signature, expected);
  } catch {
    return false;
  }
}

class LocalFieldBillStorage implements FieldBillStorage {
  constructor(private readonly root: string) {}

  async put(key: string, data: Buffer): Promise<void> {
    const target = safeLocalPath(this.root, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: "wx" });
  }

  async get(key: string): Promise<Buffer> {
    return readFile(safeLocalPath(this.root, key));
  }
}

class S3CompatibleFieldBillStorage implements FieldBillStorage {
  private readonly endpoint: URL;

  constructor(private readonly config: { endpoint: string; bucket: string; accessKey: string; secretKey: string; region: string }) {
    this.endpoint = new URL(config.endpoint);
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.request("PUT", key, data, contentType);
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.request("GET", key);
    return Buffer.from(await response.arrayBuffer());
  }

  private async request(method: "GET" | "PUT", key: string, body?: Buffer, contentType?: string): Promise<Response> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = sha256(body ?? Buffer.alloc(0));
    const uri = objectUri(this.endpoint, this.config.bucket, key);
    const host = this.endpoint.host;
    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["content-type"] = contentType;
    const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name].trim()}\n`).join("");
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalRequest = [method, uri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${date}/${this.config.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
    const signingKey = hmacBytes(hmacBytes(hmacBytes(hmacBytes(`AWS4${this.config.secretKey}`, date), this.config.region), "s3"), "aws4_request");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hmacHex(signingKey, stringToSign)}`;

    const response = await fetch(new URL(uri, this.endpoint).toString(), {
      method,
      headers: { ...headers, ...(contentType ? { "content-type": contentType } : {}) },
      body: body as BodyInit | undefined,
    });
    if (!response.ok) throw new Error(`Object storage request failed with status ${response.status}.`);
    return response;
  }
}

function objectUri(endpoint: URL, bucket: string, key: string): string {
  const base = endpoint.pathname.replace(/\/$/, "");
  const encodedBucket = encodePathPart(bucket);
  const encodedKey = key.split("/").map(encodePathPart).join("/");
  return `${base}/${encodedBucket}/${encodedKey}`;
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function safeLocalPath(root: string, key: string): string {
  if (!key || key.includes("\\") || key.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("Invalid object storage key.");
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, key);
  if (target !== absoluteRoot && !target.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error("Invalid object storage key.");
  return target;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmacBytes(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: string | Buffer, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function downloadSecret(): string {
  return process.env.FIELD_BILL_SIGNING_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "local-development-field-bill-secret";
}
