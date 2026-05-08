import { NextRequest, NextResponse } from "next/server";

import {
  dedupeBookResults,
  fetchGoogleCandidates,
  fetchOpenLibraryCandidates,
  searchKingstoneCandidates,
  searchLocalCatalog,
  searchSanminCandidates,
} from "@/lib/books/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ results: [], message: "" });
  }

  const localResults = searchLocalCatalog(query);
  const settled = await Promise.allSettled([
    fetchGoogleCandidates(query),
    fetchOpenLibraryCandidates(query),
    searchSanminCandidates(query),
    searchKingstoneCandidates(query),
  ]);

  const remoteResults = settled
    .flatMap((entry) => (entry.status === "fulfilled" ? entry.value : []))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const results = dedupeBookResults([...localResults, ...remoteResults]).slice(0, 10);

  const hasGoogle = settled[0]?.status === "fulfilled";
  const hasOpenLibrary = settled[1]?.status === "fulfilled";
  const hasSanmin = settled[2]?.status === "fulfilled";
  const hasKingstone = settled[3]?.status === "fulfilled";

  let message = "";
  if (!results.length) {
    message = "找不到相符書籍，可直接手動新增。";
  } else if (!hasGoogle || !hasOpenLibrary || !hasSanmin || !hasKingstone) {
    message = "部分資料源暫時不可用，已改用可用來源搜尋。";
  }

  return NextResponse.json({
    results,
    message,
    providers: {
      googleBooks: hasGoogle,
      openLibrary: hasOpenLibrary,
      sanmin: hasSanmin,
      kingstone: hasKingstone,
    },
  });
}
