import "server-only";

import * as cheerio from "cheerio";
import type { BookSearchResult as ServerBookResult } from "@/lib/books/shared";

type OpenLibrarySearchResponse = {
  docs?: Array<{
    title?: string;
    author_name?: string[];
    isbn?: string[];
    number_of_pages_median?: number;
    cover_i?: number;
    first_sentence?: string | string[];
    publisher?: string[];
  }>;
};

const CATEGORY_OPTIONS = ["商業類", "思考類", "文學類"] as const;

const BUSINESS_CATEGORY_HINTS = [
  "商業",
  "創業",
  "公司",
  "管理",
  "策略",
  "投資",
  "財富",
  "行銷",
  "產品",
  "品牌",
  "從0到1",
  "勝算",
  "納瓦爾",
  "morgan housel",
  "peter thiel",
];

const THINKING_CATEGORY_HINTS = [
  "思考",
  "思維",
  "框架",
  "習慣",
  "學習",
  "心理",
  "歷史",
  "科學",
  "邏輯",
  "工作",
  "睡覺",
  "kahneman",
  "james clear",
  "cal newport",
  "yuval",
];

const LITERATURE_CATEGORY_HINTS = [
  "文學",
  "小說",
  "散文",
  "詩",
  "劇",
  "故事",
  "長篇",
  "短篇",
];

const LOCAL_BOOK_CATALOG: ServerBookResult[] = [
  {
    title: "原子習慣",
    author: "James Clear",
    category: "習慣養成",
    isbn: "9780735211292",
    totalPages: 320,
    description: "用微小但可重複的行為設計，建立會自己運轉的生活系統。",
    coverImage:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
  {
    title: "思考的框架",
    author: "Shane Parrish",
    category: "思維決策",
    isbn: "9780593719978",
    totalPages: 304,
    description: "用模型與原則整理決策，讓閱讀最後會回到真實行動。",
    coverImage:
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
  {
    title: "深度工作力",
    author: "Cal Newport",
    category: "生產力",
    isbn: "9781455586691",
    totalPages: 304,
    description: "建立長時間專注與高價值輸出的工作方法。",
    coverImage:
      "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
];

const SOURCE_TRUST_SCORES: Record<string, number> = {
  "Google Books": 3.2,
  "博客來": 3.4,
  "金石堂": 3.4,
  "三民網路書店": 3.5,
  "Open Library": 1.6,
  "SmartRead 推薦書庫": 1.4,
};

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/[\s:：\-_/.,()（）]/g, "");
}

function includesCategoryHint(haystack: string, hints: string[]) {
  return hints.some((hint) => haystack.includes(normalizeKeyword(hint)));
}

export function categorizeBook(input: {
  title: string;
  author: string;
  category?: string;
  description?: string;
}) {
  if (CATEGORY_OPTIONS.includes(input.category as (typeof CATEGORY_OPTIONS)[number])) {
    return input.category as (typeof CATEGORY_OPTIONS)[number];
  }

  const haystack = normalizeKeyword(
    `${input.title}${input.author}${input.category ?? ""}${input.description ?? ""}`,
  );

  if (includesCategoryHint(haystack, LITERATURE_CATEGORY_HINTS)) {
    return "文學類";
  }

  if (includesCategoryHint(haystack, BUSINESS_CATEGORY_HINTS)) {
    return "商業類";
  }

  if (includesCategoryHint(haystack, THINKING_CATEGORY_HINTS)) {
    return "思考類";
  }

  return "思考類";
}

function normalizeBookResult(result: ServerBookResult): ServerBookResult {
  return {
    ...result,
    category: categorizeBook(result),
  };
}

function getSourceTrustScore(source?: string) {
  return SOURCE_TRUST_SCORES[source ?? ""] ?? 1;
}

function normalizePageCountValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = Math.round(value);
  if (normalized < 40 || normalized > 2400) {
    return 0;
  }

  return normalized;
}

function stripTrailingPageNumber(line: string) {
  return line
    .replace(/\s*[·•‧・\-–—]?\s*\d{1,4}\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 4200,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJsonLdBlocks($: cheerio.CheerioAPI) {
  const scripts = $('script[type="application/ld+json"]')
    .toArray()
    .map((node) => $(node).contents().text().trim())
    .filter(Boolean);

  const parsed: Array<Record<string, unknown>> = [];

  for (const script of scripts) {
    try {
      const data = JSON.parse(script) as unknown;
      const values = Array.isArray(data)
        ? data
        : typeof data === "object" && data && "@graph" in data
          ? ((data as { "@graph"?: unknown[] })["@graph"] ?? [])
          : [data];

      for (const value of values) {
        if (value && typeof value === "object") {
          parsed.push(value as Record<string, unknown>);
        }
      }
    } catch {
      continue;
    }
  }

  return parsed;
}

function extractJsonLdBookMeta($: cheerio.CheerioAPI) {
  const blocks = parseJsonLdBlocks($);
  const bookLike = blocks.find((entry) => {
    const type = entry["@type"];
    const types = Array.isArray(type) ? type : [type];
    return types.some((item) =>
      typeof item === "string" && /book|product/i.test(item),
    );
  });

  if (!bookLike) {
    return null;
  }

  const author = (() => {
    const value = bookLike.author;
    if (typeof value === "string") {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "string"
            ? item
            : typeof item === "object" && item && "name" in item
              ? String((item as { name?: unknown }).name ?? "").trim()
              : "",
        )
        .filter(Boolean)
        .join(", ");
    }
    if (value && typeof value === "object" && "name" in value) {
      return String((value as { name?: unknown }).name ?? "").trim();
    }
    return "";
  })();

  const publisher = (() => {
    const value = bookLike.publisher;
    if (typeof value === "string") {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "string"
            ? item
            : typeof item === "object" && item && "name" in item
              ? String((item as { name?: unknown }).name ?? "").trim()
              : "",
        )
        .find(Boolean) ?? "";
    }
    if (value && typeof value === "object" && "name" in value) {
      return String((value as { name?: unknown }).name ?? "").trim();
    }
    return "";
  })();

  const image = (() => {
    const value = bookLike.image;
    if (typeof value === "string") {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value.find((item): item is string => typeof item === "string") ?? "";
    }
    return "";
  })();

  const pageCountCandidate =
    bookLike.numberOfPages ??
    bookLike.pageCount ??
    bookLike.numberOfPagesTotal ??
    "";

  return {
    title: typeof bookLike.name === "string" ? bookLike.name.trim() : "",
    author,
    publisher,
    isbn: typeof bookLike.isbn === "string" ? bookLike.isbn.trim() : "",
    description:
      typeof bookLike.description === "string" ? bookLike.description.trim() : "",
    coverImage: image,
    totalPages: normalizePageCountValue(Number(pageCountCandidate)),
  };
}

export function dedupeBookResults(results: ServerBookResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = normalizeKeyword(`${result.title}-${result.author}-${result.isbn}`);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function searchLocalCatalog(keyword: string) {
  const normalizedKeyword = normalizeKeyword(keyword);

  return LOCAL_BOOK_CATALOG.filter((book) => {
    const haystack = normalizeKeyword(
      `${book.title}${book.author}${book.isbn}${book.description}`,
    );
    return haystack.includes(normalizedKeyword);
  })
    .map(normalizeBookResult)
    .slice(0, 6);
}

export async function fetchGoogleCandidates(keyword: string) {
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keyword)}&orderBy=relevance&printType=books&maxResults=8`,
    {
      headers: {
        "user-agent": "SmartReadEcho/1.0",
      },
      next: { revalidate: 3600 },
    },
    3200,
  );

  if (!response.ok) {
    throw new Error(`google-books-${response.status}`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      volumeInfo?: {
        title?: string;
        authors?: string[];
        description?: string;
        pageCount?: number;
        publisher?: string;
        imageLinks?: { thumbnail?: string };
        industryIdentifiers?: Array<{
          type?: string;
          identifier?: string;
        }>;
      };
    }>;
  };

  return (data.items ?? []).map((item) => {
    const volume = item.volumeInfo ?? {};
    const isbn =
      volume.industryIdentifiers?.find((id) => id.type?.includes("ISBN"))
        ?.identifier ?? "";

    return normalizeBookResult({
      title: volume.title ?? "未命名書籍",
      author: volume.authors?.join(", ") ?? "",
      category: "",
      isbn,
      totalPages: volume.pageCount ?? 0,
      description: volume.description ?? "",
      coverImage:
        volume.imageLinks?.thumbnail?.replace("http://", "https://") ?? "",
      source: "Google Books",
      publisher: volume.publisher ?? "",
    });
  });
}

export async function fetchOpenLibraryCandidates(keyword: string) {
  const response = await fetchWithTimeout(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(keyword)}&limit=8`,
    {
      headers: {
        "user-agent": "SmartReadEcho/1.0",
      },
      next: { revalidate: 3600 },
    },
    3200,
  );

  if (!response.ok) {
    throw new Error(`open-library-${response.status}`);
  }

  const data = (await response.json()) as OpenLibrarySearchResponse;

  return (data.docs ?? [])
    .filter((item) => item.title)
    .slice(0, 8)
    .map((item) =>
      normalizeBookResult({
        title: item.title ?? "未命名書籍",
        author: item.author_name?.join(", ") ?? "",
        category: "",
        isbn: item.isbn?.[0] ?? "",
        totalPages: item.number_of_pages_median ?? 0,
        description: Array.isArray(item.first_sentence)
          ? item.first_sentence[0] ?? ""
          : item.first_sentence ?? "",
        coverImage: item.cover_i
          ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg`
          : "",
        source: "Open Library",
        publisher: item.publisher?.[0] ?? "",
      }),
    );
}

export function scoreBookMatch(
  target: { title: string; author?: string; isbn?: string },
  candidate: ServerBookResult,
) {
  const targetTitle = normalizeKeyword(target.title);
  const targetAuthor = normalizeKeyword(target.author ?? "");
  const targetIsbn = normalizeKeyword(target.isbn ?? "");
  const candidateTitle = normalizeKeyword(candidate.title);
  const candidateAuthor = normalizeKeyword(candidate.author);
  const candidateIsbn = normalizeKeyword(candidate.isbn);

  let score = 0;

  if (targetIsbn && candidateIsbn && targetIsbn === candidateIsbn) {
    score += 24;
  }

  if (candidateTitle === targetTitle) {
    score += 14;
  } else if (
    candidateTitle.includes(targetTitle) ||
    targetTitle.includes(candidateTitle)
  ) {
    score += 9;
  }

  if (targetAuthor && candidateAuthor === targetAuthor) {
    score += 10;
  } else if (
    targetAuthor &&
    (candidateAuthor.includes(targetAuthor) || targetAuthor.includes(candidateAuthor))
  ) {
    score += 6;
  }

  if (candidate.totalPages > 0) {
    score += 3;
  }

  return score;
}

export function chooseVerifiedPageCount(candidates: ServerBookResult[]) {
  const validCandidates = candidates
    .map((item) => ({
      count: normalizePageCountValue(item.totalPages),
      trust: getSourceTrustScore(item.source),
    }))
    .filter((item) => item.count > 0);

  if (!validCandidates.length) {
    return 0;
  }

  const counts = validCandidates.map((item) => item.count).sort((a, b) => a - b);
  const smallest = counts[0];
  const largest = counts[counts.length - 1];
  const substantialCandidates = validCandidates.filter((item) => item.count >= 150);
  const hasClearlyTinyOutlier =
    smallest < 120 &&
    largest >= 180 &&
    largest / Math.max(smallest, 1) >= 1.7 &&
    substantialCandidates.length >= Math.ceil(validCandidates.length / 2);

  const pool = hasClearlyTinyOutlier ? substantialCandidates : validCandidates;
  const clustered = pool.map((current) => {
    const support = pool.reduce((sum, candidate) => {
      const tolerance = Math.max(18, Math.round(current.count * 0.08));
      return Math.abs(candidate.count - current.count) <= tolerance
        ? sum + candidate.trust
        : sum;
    }, 0);

    return {
      ...current,
      support,
    };
  });

  const best = clustered.sort((a, b) => {
    if (b.support !== a.support) {
      return b.support - a.support;
    }
    if (b.trust !== a.trust) {
      return b.trust - a.trust;
    }
    return b.count - a.count;
  })[0];

  return best?.count ?? 0;
}

function normalizeCatalogLines(lines: string[]) {
  const cleaned = lines
    .map((line) => stripTrailingPageNumber(line.replace(/^[\s\-•●◆■□▪︎‧・]+/, "").trim()))
    .filter(Boolean)
    .filter((line) => line.length >= 2 && line.length <= 80)
    .filter(
      (line) =>
        !/^(目錄|目次|contents?)$/i.test(line) &&
        !/頁|isbn|作者|出版社|裝訂|電話|客服|營業時間|網路書店|台北市|聯絡資訊|圖書目錄|聚焦三民|小山丘|東大|弘雅|回首頁|購物車|快速結帳|更多內容|版權|出版資訊|推薦商品|延伸閱讀|最新消息|會員中心|>>/.test(
          line.toLowerCase(),
        ),
    );

  const chapterLikeLines = cleaned.filter((line) =>
    /^(第[\d一二三四五六七八九十百零兩]+[章回節部篇冊]|chapter|part|序|自序|推薦序|導讀|前言|後記|楔子|附錄|導論|結語|索引|[0-9]{1,2}[、.．)].+|[0-9]{1,2}\s+.+|[一二三四五六七八九十]{1,3}[、.．)].+|[•●◆■□▪︎‧・]\s*.+)/i.test(
      line,
    ),
  );

  if (!chapterLikeLines.length) {
    return [];
  }

  return chapterLikeLines.slice(0, 18).map((title, index) => ({
    title,
    order: index + 1,
  }));
}

export function extractCatalogEntries(text: string) {
  const normalized = text.replace(/\r/g, "");
  const lines = normalized
    .split(/(?:<BR\s*\/?>|\n|。)/i)
    .map((line) => line.replace(/<[^>]+>/g, " ").trim());

  return normalizeCatalogLines(lines);
}

export function extractCatalogFromText(text: string) {
  const normalized = text.replace(/\r/g, "");
  const explicitBlock =
    normalized.match(/【目錄】([\s\S]{0,2200}?)(?:【[^】]+】|$)/) ||
    normalized.match(/【目次】([\s\S]{0,2200}?)(?:【[^】]+】|$)/);

  if (explicitBlock) {
    const parsed = extractCatalogEntries(explicitBlock[1]);
    if (parsed.length) {
      return parsed;
    }
  }

  const anchor = normalized.match(
    /(?:^|\n)\s*[【]?(?:目錄|目次)(?:】|[\s:：\n])([\s\S]{0,2200})/,
  );

  if (!anchor) {
    return [];
  }

  const lines = anchor[1]
    .split(/\n+/)
    .map((line) => line.trim())
    .flatMap((line) => line.split(/<BR\s*\/?>/i).map((item) => item.replace(/<[^>]+>/g, " ").trim()));

  return normalizeCatalogLines(lines);
}

async function fetchHtml(url: string) {
  const response = await fetchWithTimeout(url, {
    headers: {
      "user-agent": "Mozilla/5.0 SmartReadEcho/1.0",
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
    next: { revalidate: 3600 },
  }, 4200);

  if (!response.ok) {
    throw new Error(`fetch-${response.status}`);
  }

  return response.text();
}

function pickText($: cheerio.CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const value = $(selector).first().text().trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export function parseBooksComProduct(html: string, url: string): ServerBookResult | null {
  const $ = cheerio.load(html);
  const bodyText = $("body").text();
  const jsonLd = extractJsonLdBookMeta($);
  const title =
    $('meta[property="og:title"]').attr("content")?.replace(/^博客來-/, "").trim() ||
    jsonLd?.title ||
    pickText($, ["h1"]);
  if (!title) {
    return null;
  }

  const author =
    jsonLd?.author ??
    bodyText.match(/作者[：:\s]+([^\n]{1,40})/)?.[1]?.trim() ??
    "";
  const publisher =
    jsonLd?.publisher ??
    bodyText.match(/出版社[：:\s]+([^\n]{1,40})/)?.[1]?.trim() ??
    "";
  const pageMatch = bodyText.match(/(?:平裝|精裝|軟精裝)\s*\/\s*(\d+)\s*頁/);
  const isbn =
    jsonLd?.isbn ??
    bodyText.match(/ISBN[：:\s]+([0-9Xx-]{10,20})/)?.[1]?.trim() ??
    "";
  const description =
    jsonLd?.description ||
    $('meta[name="description"]').attr("content")?.trim() ||
    pickText($, [".mod_b.type02_m058 .bd", ".content", "#summary"]);
  const coverImage =
    jsonLd?.coverImage ||
    $('meta[property="og:image"]').attr("content")?.trim() || "";

  return normalizeBookResult({
    title,
    author,
    category: "",
    isbn,
    totalPages: normalizePageCountValue(jsonLd?.totalPages || Number(pageMatch?.[1] ?? 0)),
    description,
    coverImage,
    publisher,
    source: "博客來",
    sourceUrl: url,
    catalog: extractCatalogFromText(bodyText),
  });
}

export function parseKingstoneProduct(html: string, url: string): ServerBookResult | null {
  const $ = cheerio.load(html);
  const jsonLd = extractJsonLdBookMeta($);
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || "";
  const bodyText = $("body").text();
  const title =
    $('meta[property="og:title"]').attr("content")?.replace(/\s*－金石堂$/, "").trim() ||
    jsonLd?.title ||
    pickText($, ["h1"]);

  if (!title) {
    return null;
  }

  const author =
    jsonLd?.author ||
    metaDescription.match(/作者:\s*([^|]+)/)?.[1]?.trim() ||
    pickText($, [".basic2box .author", ".author"]) ||
    "";
  const publisher =
    jsonLd?.publisher ||
    metaDescription.match(/\|\s*([^|]+?)\s+\d{4}\/\d{2}\/\d{2}出版/)?.[1]?.trim() ||
    pickText($, [".title_basic:contains('出版社') + a", ".publish a"]) ||
    "";
  const isbn =
    jsonLd?.isbn ||
    metaDescription.match(/ISBN:\s*([0-9Xx-]{10,20})/)?.[1]?.trim() ||
    bodyText.match(/ISBN[：:\s]+([0-9Xx-]{10,20})/)?.[1]?.trim() ||
    "";
  const coverImage =
    jsonLd?.coverImage ||
    $('meta[property="og:image"]').attr("content")?.trim() || "";
  const description =
    jsonLd?.description ||
    pickText($, [".pdintro_txt1field", ".panelCon", ".content_pcoll"]) ||
    metaDescription;
  const catalogHtml = $(".catalogfield").first().html()?.trim() ?? "";
  const catalogEntries = extractCatalogEntries(catalogHtml);
  const parsedCatalog = catalogEntries.length
    ? catalogEntries
    : extractCatalogFromText(catalogHtml);

  return normalizeBookResult({
    title,
    author: author.replace(/\s*著$/, "").trim(),
    category: "",
    isbn,
    totalPages: normalizePageCountValue(
      jsonLd?.totalPages || Number(bodyText.match(/頁數[：:\s]+(\d+)/)?.[1] ?? 0),
    ),
    description,
    coverImage,
    publisher,
    source: "金石堂",
    sourceUrl: url,
    catalog: parsedCatalog,
  });
}

export function parseSanminProduct(html: string, url: string): ServerBookResult | null {
  const $ = cheerio.load(html);
  const jsonLd = extractJsonLdBookMeta($);
  const bodyText = $("body").text();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || "";
  const title =
    $('meta[property="og:title"]').attr("content")?.replace(/\s*-\s*三民網路書店$/, "").trim() ||
    jsonLd?.title ||
    pickText($, ["h1"]);
  if (!title) {
    return null;
  }

  const author =
    jsonLd?.author ||
    metaDescription.match(/作者：([^，]+)/)?.[1]?.trim() ||
    bodyText.match(/作者[：:\s]+([^\n]{1,60})/)?.[1]?.trim() ||
    "";
  const publisher =
    jsonLd?.publisher ||
    metaDescription.match(/出版社：([^，]+)/)?.[1]?.trim() ||
    bodyText.match(/出版社[：:\s]+([^\n]{1,40})/)?.[1]?.trim() ||
    "";
  const pageMatch =
    metaDescription.match(/頁數：(\d+)/) ||
    bodyText.match(/裝訂／頁數[：:\s]+[^／\n]{0,20}／\s*(\d+)\s*頁/);
  const isbn =
    jsonLd?.isbn ||
    metaDescription.match(/ISBN：([0-9Xx-]{10,20})/)?.[1]?.trim() ||
    bodyText.match(/ISBN13?[：:\s]+([0-9Xx-]{10,20})/)?.[1]?.trim() ||
    "";
  const description =
    jsonLd?.description ||
    metaDescription ||
    pickText($, [".Introduction", ".ProdDesc", ".editor"]);
  const coverImage =
    jsonLd?.coverImage ||
    $('meta[property="og:image"]').attr("content")?.trim() || "";

  const detailText = pickText($, [
    ".ProdDesc",
    ".Introduction",
    ".editor",
    ".ProductContent",
    ".BookContent",
  ]);

  return normalizeBookResult({
    title,
    author,
    category: "",
    isbn,
    totalPages: normalizePageCountValue(jsonLd?.totalPages || Number(pageMatch?.[1] ?? 0)),
    description,
    coverImage,
    publisher,
    source: "三民網路書店",
    sourceUrl: url,
    catalog: extractCatalogFromText(detailText || metaDescription),
  });
}

export async function scrapeProductPage(url: string) {
  const html = await fetchHtml(url);

  if (url.includes("books.com.tw")) {
    return parseBooksComProduct(html, url);
  }

  if (url.includes("kingstone.com.tw")) {
    return parseKingstoneProduct(html, url);
  }

  if (url.includes("sanmin.com.tw")) {
    return parseSanminProduct(html, url);
  }

  const $ = cheerio.load(html);
  const jsonLd = extractJsonLdBookMeta($);
  const bodyText = $("body").text();
  const title =
    jsonLd?.title ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    pickText($, ["h1", "title"]);

  if (!title) {
    return null;
  }

  const description =
    jsonLd?.description ||
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";
  const coverImage =
    jsonLd?.coverImage ||
    $('meta[property="og:image"]').attr("content")?.trim() || "";
  const pageMatch = bodyText.match(/(\d+)\s*頁/);
  const publisher =
    jsonLd?.publisher ??
    bodyText.match(/出版社[：:\s]+([^\n]{1,40})/)?.[1]?.trim() ??
    "";
  const isbn =
    jsonLd?.isbn ??
    bodyText.match(/ISBN(?:13)?[：:\s]+([0-9Xx-]{10,20})/)?.[1]?.trim() ??
    "";

  return normalizeBookResult({
    title,
    author: jsonLd?.author || "",
    category: "",
    isbn,
    totalPages: normalizePageCountValue(jsonLd?.totalPages || Number(pageMatch?.[1] ?? 0)),
    description,
    coverImage,
    publisher,
    source: new URL(url).hostname,
    sourceUrl: url,
    catalog: extractCatalogFromText(bodyText),
  });
}

export async function searchSanminCandidates(keyword: string) {
  const url = `https://www.sanmin.com.tw/search/index/?ct=K&qu=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const normalizedKeyword = normalizeKeyword(keyword);

  const links = $('a[href^="/product/index/"] h3')
    .toArray()
    .map((heading) => {
      const title = $(heading).text().trim();
      const anchor = $(heading).closest("a");
      const href = anchor.attr("href") ?? "";
      return { title, href };
    })
    .filter((item) => item.href && item.title)
    .filter(
      (item) =>
        normalizeKeyword(item.title).includes(normalizedKeyword) ||
        normalizedKeyword.includes(normalizeKeyword(item.title)),
    )
    .filter((item, index, all) => all.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 3)
    .map((item) => item.href);

  const products = await Promise.all(
    links.map((link) => scrapeProductPage(`https://www.sanmin.com.tw${link}`)),
  );

  return products.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function searchKingstoneCandidates(keyword: string) {
  const url = `https://www.kingstone.com.tw/search/key/${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const normalizedKeyword = normalizeKeyword(keyword);

  const links = $('h3.pdnamebox a[href^="/basic/"]')
    .toArray()
    .map((anchor) => {
      const href = $(anchor).attr("href") ?? "";
      const title = $(anchor).text().trim();
      const unit = $(anchor).closest(".displayunit");
      const author = unit.find(".author a").map((_, el) => $(el).text().trim()).get().join(", ");
      const publisher = unit.find(".publish a").first().text().trim();
      return { href, title, author, publisher };
    })
    .filter((item) => item.href && item.title)
    .filter(
      (item) =>
        normalizeKeyword(item.title).includes(normalizedKeyword) ||
        normalizedKeyword.includes(normalizeKeyword(item.title)),
    )
    .filter((item, index, all) => all.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 4);

  const products: Array<ServerBookResult | null> = await Promise.all(
    links.map(async (item) => {
      const result = await scrapeProductPage(`https://www.kingstone.com.tw${item.href}`);
      if (!result) {
        return null;
      }
      return normalizeBookResult({
        ...result,
        author: result.author || item.author,
        publisher: result.publisher || item.publisher,
      });
    }),
  );

  return products.filter((item): item is ServerBookResult => Boolean(item));
}

export async function calibrateBookMetadata(input: {
  title: string;
  author?: string;
  isbn?: string;
  totalPages?: number;
  sourceUrl?: string;
}) {
  const keyword = [input.title, input.author].filter(Boolean).join(" ");
  const localResults = searchLocalCatalog(keyword);

  const settled = await Promise.allSettled([
    fetchGoogleCandidates(keyword),
    fetchOpenLibraryCandidates(keyword),
    searchSanminCandidates(keyword),
    searchKingstoneCandidates(keyword),
    input.sourceUrl ? scrapeProductPage(input.sourceUrl) : Promise.resolve(null),
  ]);

  const merged = dedupeBookResults(
    [
      ...localResults,
      ...settled.flatMap((entry) => {
        if (entry.status !== "fulfilled" || !entry.value) {
          return [];
        }
        return Array.isArray(entry.value) ? entry.value : [entry.value];
      }),
    ],
  );

  const ranked = merged
    .map((candidate) => ({
      candidate,
      score: scoreBookMatch(input, candidate),
    }))
    .filter((entry) => entry.score >= 12)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return null;
  }

  const reliableCandidates = ranked
    .filter((entry) => entry.score >= ranked[0].score - 3)
    .map((entry) => entry.candidate);

  const verifiedPageCount = chooseVerifiedPageCount(reliableCandidates);
  const best = ranked[0].candidate;
  const bestRichCandidate =
    reliableCandidates.find(
      (candidate) =>
        Boolean(candidate.sourceUrl || candidate.publisher || candidate.catalog?.length),
    ) ?? best;

  return {
    ...best,
    publisher: best.publisher || bestRichCandidate.publisher || "",
    source: best.source || bestRichCandidate.source || "",
    sourceUrl: best.sourceUrl || bestRichCandidate.sourceUrl || "",
    catalog: best.catalog?.length ? best.catalog : bestRichCandidate.catalog ?? [],
    totalPages: verifiedPageCount || best.totalPages || input.totalPages || 0,
    alternatives: reliableCandidates.slice(0, 3),
  };
}

export async function extractCatalogForBook(input: {
  title: string;
  author?: string;
  isbn?: string;
  sourceUrl?: string;
}) {
  if (input.sourceUrl) {
    const scraped = await scrapeProductPage(input.sourceUrl);
    if (scraped) {
      return scraped;
    }
  }

  const calibrated = await calibrateBookMetadata(input);
  if (!calibrated) {
    return null;
  }

  if (calibrated.catalog?.length) {
    return calibrated;
  }

  return calibrated;
}
