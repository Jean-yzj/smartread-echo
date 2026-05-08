import { NextRequest, NextResponse } from "next/server";

import { extractCatalogForBook } from "@/lib/books/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    title?: string;
    author?: string;
    isbn?: string;
    sourceUrl?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "title-required" },
      { status: 400 },
    );
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
