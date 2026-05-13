import { NextResponse } from "next/server";

const DEFAULT_VERTEX_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_VERTEX_LOCATION = "global";

function getVertexApiHost(location: string) {
  return location === "global"
    ? "https://aiplatform.googleapis.com"
    : `https://${location}-aiplatform.googleapis.com`;
}

function getVertexConfig() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() ?? "";
  const location =
    process.env.GOOGLE_CLOUD_LOCATION?.trim() || DEFAULT_VERTEX_LOCATION;
  const model = process.env.GOOGLE_VERTEX_MODEL?.trim() || DEFAULT_VERTEX_MODEL;
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY?.trim() ?? "";
  const accessToken = process.env.GOOGLE_VERTEX_ACCESS_TOKEN?.trim() ?? "";

  if (!projectId) {
    throw new Error("missing-project-id");
  }

  if (!apiKey && !accessToken) {
    throw new Error("missing-vertex-credentials");
  }

  return { projectId, location, model, apiKey, accessToken };
}

function extractTextFromCandidate(payload: unknown) {
  const candidates = Array.isArray((payload as { candidates?: unknown[] })?.candidates)
    ? ((payload as { candidates?: unknown[] }).candidates ?? [])
    : [];

  const text = candidates
    .flatMap((candidate) => {
      const parts = Array.isArray(
        (candidate as { content?: { parts?: unknown[] } })?.content?.parts,
      )
        ? ((candidate as { content?: { parts?: unknown[] } }).content?.parts ?? [])
        : [];

      return parts
        .map((part) => (typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : ""))
        .filter(Boolean);
    })
    .join("\n")
    .trim();

  return text;
}

function normalizeOcrText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "請先上傳圖片。" },
        { status: 400 },
      );
    }

    const { projectId, location, model, apiKey, accessToken } = getVertexConfig();
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64Image = bytes.toString("base64");

    const endpoint = new URL(
      `${getVertexApiHost(location)}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`,
    );

    if (apiKey) {
      endpoint.searchParams.set("key", apiKey);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Extract every visible character from this book-page image.",
                  "Return only the transcribed text in reading order.",
                  "Preserve paragraph and line breaks when they are visible.",
                  "Do not summarize, translate, explain, or add markdown fences.",
                ].join(" "),
              },
              {
                inlineData: {
                  mimeType: file.type || "image/jpeg",
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          topP: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { message: "Google OCR 暫時失敗。", detail: errorText },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as unknown;
    const text = normalizeOcrText(extractTextFromCandidate(payload));

    if (!text) {
      return NextResponse.json(
        { message: "Google OCR 沒有讀到可用文字。" },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "missing-project-id") {
        return NextResponse.json(
          { message: "缺少 GOOGLE_CLOUD_PROJECT_ID。" },
          { status: 500 },
        );
      }

      if (error.message === "missing-vertex-credentials") {
        return NextResponse.json(
          {
            message:
              "缺少 Google Vertex OCR 憑證，請設定 GOOGLE_VERTEX_API_KEY 或 GOOGLE_VERTEX_ACCESS_TOKEN。",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { message: "Google OCR 發生未預期錯誤。" },
      { status: 500 },
    );
  }
}
