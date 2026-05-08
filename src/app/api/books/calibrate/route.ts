import { NextRequest, NextResponse } from "next/server";

import { calibrateBookMetadata } from "@/lib/books/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    title?: string;
    author?: string;
    isbn?: string;
    totalPages?: number;
    sourceUrl?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "title-required" },
      { status: 400 },
    );
  }

  const result = await calibrateBookMetadata({
    title: body.title.trim(),
    author: body.author?.trim(),
    isbn: body.isbn?.trim(),
    totalPages: Number(body.totalPages || 0),
    sourceUrl: body.sourceUrl?.trim(),
  });

  if (!result) {
    return NextResponse.json({ result: null, message: "找不到可用的校正資料。" });
  }

  return NextResponse.json({
    result,
    message: result.totalPages
      ? `已校正頁數：${result.totalPages} 頁`
      : "已找到版本資料，但頁數仍未提供。",
  });
}
