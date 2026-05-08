import { NextRequest, NextResponse } from "next/server";

import { calibrateBookMetadata, extractCatalogForBook } from "@/lib/books/server";

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

  const catalogResult =
    result.sourceUrl || body.sourceUrl?.trim()
      ? await extractCatalogForBook({
          title: result.title,
          author: result.author,
          isbn: result.isbn,
          sourceUrl: result.sourceUrl || body.sourceUrl?.trim(),
        }).catch(() => null)
      : null;

  const mergedResult = {
    ...result,
    publisher: catalogResult?.publisher || result.publisher,
    source: catalogResult?.source || result.source,
    sourceUrl: catalogResult?.sourceUrl || result.sourceUrl,
    catalog: catalogResult?.catalog?.length ? catalogResult.catalog : result.catalog ?? [],
  };

  if (!mergedResult.catalog?.length && Array.isArray(result.alternatives)) {
    for (const candidate of result.alternatives) {
      if (!candidate?.sourceUrl) {
        continue;
      }

      const fallbackCatalog = await extractCatalogForBook({
        title: candidate.title,
        author: candidate.author,
        isbn: candidate.isbn,
        sourceUrl: candidate.sourceUrl,
      }).catch(() => null);

      if (fallbackCatalog?.catalog?.length) {
        mergedResult.publisher = fallbackCatalog.publisher || mergedResult.publisher;
        mergedResult.source = fallbackCatalog.source || mergedResult.source;
        mergedResult.sourceUrl = fallbackCatalog.sourceUrl || mergedResult.sourceUrl;
        mergedResult.catalog = fallbackCatalog.catalog;
        break;
      }
    }
  }

  return NextResponse.json({
    result: mergedResult,
    message: mergedResult.totalPages
      ? mergedResult.catalog?.length
        ? `已校正頁數：${mergedResult.totalPages} 頁，並補上 ${mergedResult.catalog.length} 筆目錄`
        : `已校正頁數：${mergedResult.totalPages} 頁`
      : mergedResult.catalog?.length
        ? `已補上 ${mergedResult.catalog.length} 筆目錄`
        : "已找到版本資料，但頁數仍未提供。",
  });
}
