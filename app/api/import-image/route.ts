import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Supabase no está configurado.", 500);
  }

  let imageUrl = "";

  try {
    const body = (await request.json()) as { imageUrl?: unknown };
    imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  } catch {
    return jsonError("El cuerpo de la petición no es válido.", 400);
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return jsonError("La URL de imagen no es válida.", 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return jsonError("La URL debe empezar por http o https.", 400);
  }

  try {
    const imageResponse = await fetch(parsedUrl, {
      headers: {
        Accept: "image/jpeg,image/png,image/webp",
        "User-Agent": "football-shirts-image-importer/1.0",
      },
      redirect: "follow",
    });

    if (!imageResponse.ok) {
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
      console.error("IMPORT IMAGE INVALID CONTENT TYPE", {
        imageUrl,
        contentType,
      });
      return jsonError(userFacingImportError, 400);
    }

    const contentLength = Number(imageResponse.headers.get("content-length"));
    if (contentLength > maxImageBytes) {
      return jsonError("La imagen no puede superar los 8 MB.", 400);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength === 0) {
      return jsonError("La imagen descargada está vacía.", 400);
    }
    if (imageBuffer.byteLength > maxImageBytes) {
      return jsonError("La imagen no puede superar los 8 MB.", 400);
    }

    const id = `img-${crypto.randomUUID()}`;
    const path = `${crypto.randomUUID()}.${getExtension(contentType)}`;
    const authHeader = request.headers.get("authorization") ?? undefined;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: authHeader
        ? {
            headers: {
              Authorization: authHeader,
            },
          }
        : undefined,
    });

    const { error } = await supabase.storage.from("shirts").upload(path, Buffer.from(imageBuffer), {
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
        error,
      });
      return jsonError(`Error subiendo la imagen a Supabase: ${error.message}`, 500);
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
