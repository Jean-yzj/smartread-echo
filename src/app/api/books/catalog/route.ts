import { NextRequest, NextResponse } from "next/server";

import { extractCatalogEntries, extractCatalogForBook } from "@/lib/books/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    title?: string;
    author?: string;
    isbn?: string;
    sourceUrl?: string;
    manualText?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "title-required" },
      { status: 400 },
    );
  }

  if (body.manualText?.trim()) {
    const catalog = extractCatalogEntries(body.manualText.trim());

    return NextResponse.json({
      result: {
        title: body.title.trim(),
        author: body.author?.trim() ?? "",
        category: "",
        isbn: body.isbn?.trim() ?? "",
        totalPages: 0,
        description: "",
        coverImage: "",
        source: "手動補錄",
        sourceUrl: body.sourceUrl?.trim() ?? "",
        catalog,
      },
      message: catalog.length
        ? `已從貼上的文字解析 ${catalog.length} 個目錄項目`
        : "目前無法從這段文字解析出章節，請貼更完整的目錄內容。",
    });
  }

  const result = await extractCatalogForBook({
    title: body.title.trim(),
    author: body.author?.trim(),
    isbn: body.isbn?.trim(),
    sourceUrl: body.sourceUrl?.trim(),
  });

  if (!result) {
    return NextResponse.json({ result: null, message: "目前找不到這本書的目錄來源。" });
  }

  return NextResponse.json({
    result,
    message: result.catalog?.length
      ? `已擷取 ${result.catalog.length} 個目錄項目`
      : "已找到版本資料，但尚未擷取到可用目錄。",
  });
}
