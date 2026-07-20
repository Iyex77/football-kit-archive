import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getRequestIp, isRateLimited } from "../../../lib/rate-limit";
import { getAuthenticatedUser } from "../../../lib/supabase-server";

export const runtime = "nodejs";

const maxImageBytes = 8 * 1024 * 1024;
const userFacingImportError = "No se pudo importar esta imagen. Prueba con otra URL directa.";

const extensionByContentType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const getExtension = (contentType: string) => extensionByContentType[contentType] ?? "jpg";

const jsonError = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const { user, supabase } = await getAuthenticatedUser(authHeader);

  if (!user || !supabase) {
    return jsonError("Sesión no válida para importar imágenes.", 401);
  }

  if (
    isRateLimited(`import-image:${user.id}`, { limit: 20, windowMs: 60_000 }) ||
    isRateLimited(`import-image:${getRequestIp(request)}`, {
      limit: 20,
      windowMs: 60_000,
    })
  ) {
    return jsonError("Demasiadas peticiones, inténtalo de nuevo en un minuto.", 429);
  }

  let imageUrl = "";

  try {
    const body = (await request.json()) as { imageUrl?: unknown };
    imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  } catch {
    return jsonError("El cuerpo de la petición no es válido.", 400);
  }

  const parsedUrl = await parseHttpUrl(imageUrl);

  if (!parsedUrl) {
    return jsonError("La URL de imagen no es válida.", 400);
  }

  try {
    const controller = new AbortController();
    const imageResponse = await fetch(parsedUrl, {
      headers: {
        Accept: "image/jpeg,image/png,image/webp",
        "User-Agent": "football-shirts-image-importer/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!imageResponse.ok) {
      controller.abort();
      console.error("IMPORT IMAGE DOWNLOAD ERROR", {
        imageUrl,
        status: imageResponse.status,
        statusText: imageResponse.statusText,
        contentType: imageResponse.headers.get("content-type"),
      });
      return jsonError(userFacingImportError, 400);
    }

    const contentType = imageResponse.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!Object.keys(extensionByContentType).includes(contentType)) {
      controller.abort();
      console.error("IMPORT IMAGE INVALID CONTENT TYPE", {
        imageUrl,
        contentType,
      });
      return jsonError(userFacingImportError, 400);
    }

    if (!imageResponse.body) {
      return jsonError("La imagen descargada está vacía.", 400);
    }

    // Enforce the size cap while streaming, rather than trusting
    // content-length (which a malicious/misconfigured server can omit or lie
    // about) and buffering the whole body via arrayBuffer() first.
    const reader = imageResponse.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        totalBytes += value.byteLength;

        if (totalBytes > maxImageBytes) {
          controller.abort();
          return jsonError("La imagen no puede superar los 8 MB.", 400);
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const imageBuffer = Buffer.concat(chunks);
    if (imageBuffer.byteLength === 0) {
      return jsonError("La imagen descargada está vacía.", 400);
    }

    const id = `img-${crypto.randomUUID()}`;
    const path = `${user.id}/${crypto.randomUUID()}.${getExtension(contentType)}`;

    const { error } = await supabase.storage.from("shirts").upload(path, imageBuffer, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    });

    if (error) {
      console.error("SUPABASE STORAGE IMPORT ERROR", {
        imageUrl,
        path,
        contentType,
        message: error.message,
      });
      return jsonError("Error subiendo la imagen a Supabase.", 500);
    }

    const { data } = supabase.storage.from("shirts").getPublicUrl(path);

    return Response.json({
      id,
      label: "",
      path,
      publicUrl: data.publicUrl,
    });
  } catch (error) {
    console.error("IMPORT IMAGE UNEXPECTED ERROR", {
      imageUrl,
      error,
    });
    return jsonError(userFacingImportError, 500);
  }
}

// Resolves the hostname to its actual IP addresses and validates those,
// instead of only pattern-matching the literal hostname string. This closes
// the straightforward "give it a hostname that resolves to a private IP"
// bypass. It does not fully eliminate DNS-rebinding (the TOCTOU window
// between this lookup and the fetch() call above re-resolving DNS), which
// would require pinning the connection to the validated IP.
async function parseHttpUrl(value: string): Promise<URL | null> {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    if (isBlockedIp(url.hostname)) {
      return null;
    }

    const literalIpVersion = isIP(url.hostname);

    if (literalIpVersion !== 0) {
      return url;
    }

    const resolved = await lookup(url.hostname, { all: true, verbatim: true });

    if (resolved.length === 0 || resolved.some((entry) => isBlockedIp(entry.address))) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function isBlockedIp(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  const version = isIP(normalized);

  if (version === 4) {
    return isBlockedIpv4(normalized);
  }

  if (version === 6) {
    return isBlockedIpv6(normalized);
  }

  // Not a literal IP (a hostname) — caller is responsible for resolving it
  // and re-checking the resolved addresses.
  return false;
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);

  if (parts.length !== 4) {
    return true;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function isBlockedIpv6(address: string): boolean {
  if (address === "::1" || address === "::") {
    return true;
  }

  if (/^fe[89ab][0-9a-f]:/.test(address)) {
    return true;
  }

  if (/^f[cd][0-9a-f]{2}:/.test(address)) {
    return true;
  }

  const ipv4Mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (ipv4Mapped) {
    return isBlockedIpv4(ipv4Mapped[1]);
  }

  return false;
}
