import { analyzeCreatorSource } from "@/lib/server/creator-service";
import type { CreatorAnalyzeRequest } from "@/lib/creator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return !!value && typeof value === "object";
}

function badRequest(message: string, details?: unknown) {
  return Response.json({ ok: false, error: message, details }, { status: 400 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!isRecord(body)) {
    return badRequest("Request body must be an object");
  }

  const filename = body.filename;
  const transcriptText = body.transcriptText;
  const transcriptChunks = body.transcriptChunks;

  if (typeof filename !== "string" || !filename.trim()) {
    return badRequest("filename is required");
  }
  if (typeof transcriptText !== "string") {
    return badRequest("transcriptText must be a string");
  }
  if (!Array.isArray(transcriptChunks)) {
    return badRequest("transcriptChunks must be an array");
  }

  const payload = body as unknown as CreatorAnalyzeRequest;
  const result = await analyzeCreatorSource(payload);
  return Response.json(result);
}
