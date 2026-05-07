"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import Tesseract from "tesseract.js";
import {
  BookCopy,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Download,
  GitBranch,
  Library,
  Plus,
  Quote,
  ScanText,
  Search,
  Share2,
  Sparkles,
  Star,
  TimerReset,
  Trophy,
  Waves,
} from "lucide-react";

type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  totalPages: number;
  currentPage: number;
  description: string;
  coverImage: string;
  createdAt: string;
};

type Note = {
  id: string;
  bookId: string;
  page: number;
  rawText: string;
  reflection: string;
  isFavorite: boolean;
  imageDataUrl?: string;
  createdAt: string;
};

type Session = {
  id: string;
  bookId: string;
  minutes: number;
  startedAt: string;
};

type BookForm = {
  title: string;
  author: string;
  category: string;
  isbn: string;
  totalPages: string;
  description: string;
  coverImage: string;
};

type NoteForm = {
  bookId: string;
  page: string;
  rawText: string;
  reflection: string;
  isFavorite: boolean;
  imageDataUrl: string;
};

type AppSection =
  | "search"
  | "shelf"
  | "focus"
  | "notes"
  | "review"
  | "studio";

type BookSearchResult = {
  title: string;
  author: string;
  category: string;
  isbn: string;
  totalPages: number;
  description: string;
  coverImage: string;
  source?: string;
};

type OpenLibrarySearchResponse = {
  docs?: Array<{
    title?: string;
    author_name?: string[];
    isbn?: string[];
    number_of_pages_median?: number;
    cover_i?: number;
    first_sentence?: string | string[];
  }>;
};

const STORAGE_KEY = "smartread-echo-state";
const ECHO_DAYS = [1, 7, 30];
const FOCUS_MINUTES = 25;
const CATEGORY_OPTIONS = ["商業類", "思考類", "文學類"] as const;
const LEVELS = [
  { level: 1, label: "讀者", min: 0, unlock: "建立書櫃、閱讀計時、私人筆記" },
  { level: 2, label: "探索者", min: 120, unlock: "書名快搜、分享卡、收藏管理" },
  { level: 3, label: "思辨家", min: 260, unlock: "回聲複習、主題整理、Notion 匯出" },
  { level: 4, label: "架構師", min: 500, unlock: "完整知識圖譜與長期閱讀節奏" },
] as const;

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

const LOCAL_BOOK_CATALOG: BookSearchResult[] = [
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
  {
    title: "一如既往",
    author: "Morgan Housel",
    category: "商業思維",
    isbn: "9780593332702",
    totalPages: 224,
    description: "從人性與歷史的重複模式，看懂真正不會改變的事情。",
    coverImage:
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
  {
    title: "快思慢想",
    author: "Daniel Kahneman",
    category: "思維決策",
    isbn: "9780374533557",
    totalPages: 512,
    description: "理解直覺與理性如何共同影響判斷與決策。",
    coverImage:
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
  {
    title: "為什麼要睡覺？",
    author: "Matthew Walker",
    category: "健康科學",
    isbn: "9781501144318",
    totalPages: 368,
    description: "從腦科學與健康角度重建你對睡眠的理解。",
    coverImage:
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
  {
    title: "納瓦爾寶典",
    author: "Eric Jorgenson",
    category: "人生策略",
    isbn: "9781544514215",
    totalPages: 242,
    description: "整理納瓦爾對財富、判斷力與人生設計的核心觀點。",
    coverImage:
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
  {
    title: "被討厭的勇氣",
    author: "岸見一郎, 古賀史健",
    category: "心理成長",
    isbn: "9789863570110",
    totalPages: 288,
    description: "以對話形式理解阿德勒心理學與自我課題。",
    coverImage:
      "https://images.unsplash.com/photo-1511108690759-009324a90311?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
  {
    title: "人類大歷史",
    author: "Yuval Noah Harari",
    category: "歷史社會",
    isbn: "9780062316097",
    totalPages: 464,
    description: "從認知革命到現代社會，重新理解人類如何走到今天。",
    coverImage:
      "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
  {
    title: "最高學以致用法",
    author: "Peter C. Brown, Henry L. Roediger III, Mark A. McDaniel",
    category: "學習方法",
    isbn: "9780674729018",
    totalPages: 313,
    description: "用科學方法提升學習效率與長期記憶效果。",
    coverImage:
      "https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=900&q=80",
    source: "SmartRead 推薦書庫",
  },
];

const demoBooks: Book[] = [
  {
    id: "book-atomic",
    title: "原子習慣",
    author: "James Clear",
    category: "習慣養成",
    isbn: "9780735211292",
    totalPages: 320,
    currentPage: 96,
    description: "用微小但可重複的行為設計，建立會自己運轉的生活系統。",
    coverImage:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
  },
  {
    id: "book-thinking",
    title: "思考的框架",
    author: "Shane Parrish",
    category: "思維決策",
    isbn: "9780593719978",
    totalPages: 304,
    currentPage: 38,
    description: "用模型與原則整理決策，讓閱讀最後會回到真實行動。",
    coverImage:
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=80",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
];

const demoNotes: Note[] = [
  {
    id: "note-1",
    bookId: "book-atomic",
    page: 42,
    rawText: "你不會提升到目標的高度，你會跌回系統的水準。",
    reflection: "我需要把閱讀固定綁在晚餐後，而不是期待自己有空才讀。",
    isFavorite: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
  },
  {
    id: "note-2",
    bookId: "book-atomic",
    page: 71,
    rawText: "讓好習慣顯而易見、容易執行、立即有回饋。",
    reflection: "床頭和桌面都應該只留下一本正在讀的書，降低切換成本。",
    isFavorite: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "note-3",
    bookId: "book-thinking",
    page: 16,
    rawText: "好的框架不是替你思考，而是幫你不再遺漏重要問題。",
    reflection: "讀商業書時，我可以固定問自己：它改變了什麼決策方式？",
    isFavorite: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
];

const demoSessions: Session[] = [
  {
    id: "session-1",
    bookId: "book-atomic",
    minutes: 35,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    id: "session-2",
    bookId: "book-thinking",
    minutes: 22,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
  },
];

const sections: Array<{
  id: AppSection;
  title: string;
  short: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: "search",
    title: "找書",
    short: "Book Search",
    description: "搜尋書名並建立新書",
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: "shelf",
    title: "書櫃",
    short: "My Shelf",
    description: "分類、封面與閱讀進度",
    icon: <Library className="h-4 w-4" />,
  },
  {
    id: "focus",
    title: "專注",
    short: "Focus",
    description: "閱讀計時與白噪音",
    icon: <Clock3 className="h-4 w-4" />,
  },
  {
    id: "notes",
    title: "筆記",
    short: "Capture",
    description: "OCR、摘錄與反思",
    icon: <ScanText className="h-4 w-4" />,
  },
  {
    id: "review",
    title: "回聲",
    short: "Echo",
    description: "待複習內容與收藏金句",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "studio",
    title: "輸出",
    short: "Studio",
    description: "分享、匯出與知識圖譜",
    icon: <Share2 className="h-4 w-4" />,
  },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatMinutes(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function levelForInk(inkDrops: number) {
  if (inkDrops >= 500) {
    return { level: 4, label: "架構師" };
  }
  if (inkDrops >= 260) {
    return { level: 3, label: "思辨家" };
  }
  if (inkDrops >= 120) {
    return { level: 2, label: "探索者" };
  }
  return { level: 1, label: "讀者" };
}

function getProgress(book: Book) {
  if (!book.totalPages) {
    return 0;
  }
  return Math.min(100, Math.round((book.currentPage / book.totalPages) * 100));
}

function createPreReadGuide(book: Book) {
  const text = `${book.title} ${book.description}`.toLowerCase();
  const audience = text.includes("習慣")
    ? "適合想把閱讀真的落地成習慣的人。"
    : text.includes("思維") || text.includes("框架")
      ? "適合想提升判斷力與架構思考的人。"
      : "適合想把閱讀從收藏變成內化的人。";

  const questions = [
    "你希望這本書幫你修正哪個正在重複發生的問題？",
    "這次閱讀你最想帶走的一個行動是什麼？",
    "如果最後只能留下三個關鍵詞，會是哪三個？",
  ];

  return { audience, questions };
}

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/[\s:：\-_/.,()（）]/g, "");
}

function includesCategoryHint(haystack: string, hints: string[]) {
  return hints.some((hint) => haystack.includes(normalizeKeyword(hint)));
}

function categorizeBook(input: {
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

function normalizeBook(book: Book): Book {
  return {
    ...book,
    category: categorizeBook(book),
  };
}

function normalizeBookResult(result: BookSearchResult): BookSearchResult {
  return {
    ...result,
    category: categorizeBook(result),
  };
}

function dedupeBookResults(results: BookSearchResult[]) {
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

function searchLocalCatalog(keyword: string) {
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

function buildEchoPrompt(note: Note, book?: Book) {
  const keyword =
    note.reflection.split(/[，。、；：「」\s]/).find(Boolean) || "這個想法";
  return `你上次在《${book?.title ?? "這本書"}》寫下「${keyword}」，現在能舉出一個新的例子嗎？`;
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function computeStreakDays(sessions: Session[]) {
  const uniqueDays = [
    ...new Set(sessions.map((session) => session.startedAt.slice(0, 10))),
  ].sort().reverse();

  if (!uniqueDays.length) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = new Date(`${uniqueDays[index - 1]}T00:00:00`);
    const current = new Date(`${uniqueDays[index]}T00:00:00`);
    const delta =
      (previous.getTime() - current.getTime()) / (24 * 60 * 60 * 1000);

    if (delta === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function createShareText(note: Note, book?: Book) {
  const excerpt = note.rawText.slice(0, 100);
  return `《${book?.title ?? "未命名書籍"}》\n\n「${excerpt}${note.rawText.length > 100 ? "..." : ""}」\n\n${note.reflection || ""}\n\nvia SmartRead Echo`;
}

function buildNotionExport(books: Book[], notes: Note[]) {
  return books
    .map((book) => {
      const relatedNotes = notes.filter((note) => note.bookId === book.id);
      return `# ${book.title}\n作者：${book.author || "未填寫"}\nISBN：${book.isbn || "未填寫"}\n進度：${book.currentPage}/${book.totalPages || "?"}\n\n${relatedNotes
        .map(
          (note) =>
            `## 第 ${note.page || "?"} 頁\n摘錄：${note.rawText}\n心得：${note.reflection || "未填寫"}\n收藏：${note.isFavorite ? "是" : "否"}\n`,
        )
        .join("\n")}`;
    })
    .join("\n\n");
}

function extractConcepts(notes: Note[], booksById: Record<string, Book>) {
  const stopWords = new Set([
    "這個",
    "可以",
    "因為",
    "就是",
    "一個",
    "自己",
    "我們",
    "如果",
    "然後",
    "不是",
    "目前",
    "時候",
    "想法",
    "系統",
  ]);
  const map = new Map<string, { count: number; books: Set<string> }>();

  for (const note of notes) {
    const tokens = `${note.rawText} ${note.reflection}`
      .split(/[，。、；：「」？！\s,.()/]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && !stopWords.has(item));

    for (const token of tokens.slice(0, 16)) {
      const current = map.get(token) ?? { count: 0, books: new Set<string>() };
      current.count += 1;
      const title = booksById[note.bookId]?.title;
      if (title) {
        current.books.add(title);
      }
      map.set(token, current);
    }
  }

  return [...map.entries()]
    .map(([term, info]) => ({
      term,
      count: info.count,
      books: [...info.books],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function AppShell() {
  const [activeSection, setActiveSection] = useState<AppSection>("search");
  const [books, setBooks] = useState<Book[]>(() => demoBooks.map(normalizeBook));
  const [notes, setNotes] = useState<Note[]>(demoNotes);
  const [sessions, setSessions] = useState<Session[]>(demoSessions);
  const [completedEchoes, setCompletedEchoes] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [referenceNow] = useState(() => Date.now());

  const [bookForm, setBookForm] = useState<BookForm>({
    title: "",
    author: "",
    category: "",
    isbn: "",
    totalPages: "",
    description: "",
    coverImage: "",
  });
  const [noteForm, setNoteForm] = useState<NoteForm>({
    bookId: demoBooks[0]?.id ?? "",
    page: "",
    rawText: "",
    reflection: "",
    isFavorite: false,
    imageDataUrl: "",
  });

  const [status, setStatus] = useState("");
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState<BookSearchResult[]>([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [bookSearchMessage, setBookSearchMessage] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("全部");
  const [shelfQuery, setShelfQuery] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [readingBookId, setReadingBookId] = useState(demoBooks[0]?.id ?? "");
  const [selectedBookId, setSelectedBookId] = useState(demoBooks[0]?.id ?? "");
  const [timerSeconds, setTimerSeconds] = useState(FOCUS_MINUTES * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          books: Book[];
          notes: Note[];
          sessions: Session[];
          completedEchoes: string[];
        };
        setBooks(parsed.books.map(normalizeBook));
        setNotes(parsed.notes);
        setSessions(parsed.sessions);
        setCompletedEchoes(parsed.completedEchoes);
        setReadingBookId(parsed.books[0]?.id ?? "");
        setSelectedBookId(parsed.books[0]?.id ?? "");
        setNoteForm((current) => ({
          ...current,
          bookId: parsed.books[0]?.id ?? "",
        }));
      }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        books,
        notes,
        sessions,
        completedEchoes,
      }),
    );
  }, [books, notes, sessions, completedEchoes, hydrated]);

  useEffect(() => {
    if (!timerRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimerSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setTimerRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const booksById = useMemo(
    () => Object.fromEntries(books.map((book) => [book.id, book])),
    [books],
  );

  const inkDrops = useMemo(() => {
    const sessionDrops = sessions.reduce(
      (sum, session) => sum + Math.floor(session.minutes / 5) * 4,
      0,
    );
    const noteDrops = notes.length * 12;
    const reflectionDrops =
      notes.filter((note) => note.reflection.trim().length > 20).length * 10;
    const echoDrops = completedEchoes.length * 15;
    const streakBonus = sessions.length >= 3 ? 25 : 0;
    return sessionDrops + noteDrops + reflectionDrops + echoDrops + streakBonus;
  }, [completedEchoes.length, notes, sessions]);

  const level = levelForInk(inkDrops);
  const currentLevelConfig =
    LEVELS.find((item) => item.level === level.level) ?? LEVELS[0];
  const nextLevelConfig =
    LEVELS.find((item) => item.level === level.level + 1) ?? null;
  const totalReadingMinutes = sessions.reduce(
    (sum, session) => sum + session.minutes,
    0,
  );
  const streakDays = computeStreakDays(sessions);
  const favoriteNotes = notes.filter((note) => note.isFavorite);

  const dueEchoes = useMemo(() => {
    return notes
      .flatMap((note) =>
        ECHO_DAYS.map((day) => {
          const echoKey = `${note.id}-${day}`;
          const dueAt =
            new Date(note.createdAt).getTime() +
            day * 24 * 60 * 60 * 1000;
          if (dueAt > referenceNow || completedEchoes.includes(echoKey)) {
            return null;
          }

          return {
            id: echoKey,
            day,
            note,
            book: booksById[note.bookId],
          };
        }),
      )
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.day - b.day);
  }, [booksById, completedEchoes, notes, referenceNow]);

  const selectedBook =
    books.find((book) => book.id === selectedBookId) ?? books[0] ?? null;
  const readingBook =
    books.find((book) => book.id === readingBookId) ?? books[0] ?? null;
  const readingGuide = readingBook ? createPreReadGuide(readingBook) : null;
  const recentNotes = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recentSessions = sessions.slice(0, 5);
  const conceptGraph = extractConcepts(notes, booksById);
  const currentSection = sections.find(
    (section) => section.id === activeSection,
  )!;
  const bookCategories = ["全部", ...CATEGORY_OPTIONS];
  const normalizedShelfQuery = normalizeKeyword(shelfQuery);
  const filteredBooks =
    selectedCategoryFilter === "全部"
      ? books
      : books.filter((book) => book.category === selectedCategoryFilter);
  const shelfBooks = normalizedShelfQuery
    ? filteredBooks.filter((book) =>
        normalizeKeyword(
          `${book.title}${book.author}${book.category}${book.isbn}`,
        ).includes(normalizedShelfQuery),
      )
    : filteredBooks;
  const averageProgress =
    books.length > 0
      ? Math.round(
          (books.reduce((sum, book) => sum + getProgress(book), 0) / books.length) *
            100,
        ) / 100
      : 0;

  async function searchBooksByTitle(keyword: string) {
    setBookSearchLoading(true);
    setBookSearchMessage("");
    const localResults = searchLocalCatalog(keyword);

    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keyword)}&orderBy=relevance&printType=books&maxResults=8`,
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
            imageLinks?: { thumbnail?: string };
            industryIdentifiers?: Array<{
              type?: string;
              identifier?: string;
            }>;
          };
        }>;
      };

      if (!data.items?.length) {
        throw new Error("google-books-empty");
      }

      const results = data.items.map((item) => {
        const volume = item.volumeInfo ?? {};
        const isbn =
          volume.industryIdentifiers?.find((id) =>
            id.type?.includes("ISBN"),
          )?.identifier ?? "";

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
        });
      });

      const mergedResults = dedupeBookResults([...localResults, ...results]).slice(
        0,
        8,
      );

      setBookSearchResults(mergedResults);
      setBookSearchLoading(false);
      setBookSearchMessage(
        mergedResults.length ? "" : "目前沒有找到相符書籍",
      );
    } catch {
      try {
        const fallbackResponse = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(keyword)}&limit=8`,
        );
        if (!fallbackResponse.ok) {
          throw new Error(`open-library-${fallbackResponse.status}`);
        }

        const fallbackData =
          (await fallbackResponse.json()) as OpenLibrarySearchResponse;

        const results = (fallbackData.docs ?? [])
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
            }),
          );

        const mergedResults = dedupeBookResults([
          ...localResults,
          ...results,
        ]).slice(0, 8);

        setBookSearchResults(mergedResults);
        setBookSearchLoading(false);
        setBookSearchMessage(
          mergedResults.length
            ? "Google 書庫暫時忙碌，已改用備援搜尋"
            : "找不到相符書籍，可直接手動新增",
        );
      } catch {
        setBookSearchResults(localResults);
        setBookSearchLoading(false);
        setBookSearchMessage(
          localResults.length
            ? "外部書庫暫時不可用，已改用內建書單"
            : "書名搜尋暫時失敗，請直接手動新增書籍資料",
        );
      }
    }
  }

  useEffect(() => {
    const keyword = bookSearchQuery.trim();

    const timeoutId = window.setTimeout(() => {
      if (!keyword) {
        setBookSearchResults([]);
        setBookSearchLoading(false);
        setBookSearchMessage("");
        return;
      }
      void searchBooksByTitle(keyword);
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [bookSearchQuery]);

  function applyBookResult(result: BookSearchResult) {
    setBookForm({
      title: result.title,
      author: result.author,
      category: categorizeBook(result),
      isbn: result.isbn,
      totalPages: result.totalPages ? String(result.totalPages) : "",
      description: result.description,
      coverImage: result.coverImage,
    });
    setBookSearchResults([]);
    setBookSearchQuery(result.title);
    setBookSearchMessage("已帶入書籍資料");
    setStatus("已帶入書籍資料");
  }

  function handleAddBook() {
    if (!bookForm.title.trim()) {
      setStatus("請先輸入書名");
      return;
    }

    const nextBook: Book = {
      id: uid("book"),
      title: bookForm.title.trim(),
      author: bookForm.author.trim(),
      category: categorizeBook({
        title: bookForm.title.trim(),
        author: bookForm.author.trim(),
        category: bookForm.category.trim(),
        description: bookForm.description.trim(),
      }),
      isbn: bookForm.isbn.trim(),
      totalPages: Number(bookForm.totalPages || 0),
      currentPage: 0,
      description: bookForm.description.trim(),
      coverImage: bookForm.coverImage.trim(),
      createdAt: new Date().toISOString(),
    };

    setBooks((current) => [nextBook, ...current]);
    setReadingBookId(nextBook.id);
    setSelectedBookId(nextBook.id);
    setNoteForm({
      bookId: nextBook.id,
      page: "",
      rawText: "",
      reflection: "",
      isFavorite: false,
      imageDataUrl: "",
    });
    setBookForm({
      title: "",
      author: "",
      category: "",
      isbn: "",
      totalPages: "",
      description: "",
      coverImage: "",
    });
    setBookSearchQuery("");
    setBookSearchResults([]);
    setBookSearchMessage("");
    setStatus("書籍已加入書櫃");
  }

  function updateProgress(bookId: string, currentPage: number) {
    setBooks((current) =>
      current.map((book) =>
        book.id === bookId
          ? {
              ...book,
              currentPage: Math.max(
                0,
                Math.min(currentPage, book.totalPages || currentPage),
              ),
            }
          : book,
      ),
    );
  }

  async function runOcr(file: File) {
    setStatus("OCR 辨識中，第一次使用會先下載語言模型");
    setNoteForm((current) => ({
      ...current,
      imageDataUrl: URL.createObjectURL(file),
    }));

    try {
      const result = await Tesseract.recognize(file, "chi_tra+eng");
      setNoteForm((current) => ({
        ...current,
        rawText: result.data.text.trim(),
      }));
      setStatus("OCR 完成，請先校對文字");
    } catch {
      setStatus("OCR 失敗，你仍然可以手動貼上摘錄");
    }
  }

  function saveNote() {
    if (!noteForm.bookId || !noteForm.rawText.trim()) {
      setStatus("請先選書並輸入摘錄");
      return;
    }

    const previous = notes.find((note) => note.id === editingNoteId);
    const nextNote: Note = {
      id: editingNoteId ?? uid("note"),
      bookId: noteForm.bookId,
      page: Number(noteForm.page || 0),
      rawText: noteForm.rawText.trim(),
      reflection: noteForm.reflection.trim(),
      isFavorite: noteForm.isFavorite,
      imageDataUrl: noteForm.imageDataUrl,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
    };

    setNotes((current) =>
      editingNoteId
        ? current.map((note) => (note.id === editingNoteId ? nextNote : note))
        : [nextNote, ...current],
    );
    setNoteForm((current) => ({
      ...current,
      page: "",
      rawText: "",
      reflection: "",
      isFavorite: false,
      imageDataUrl: "",
    }));
    setEditingNoteId(null);
    setStatus(editingNoteId ? "筆記已更新" : "筆記已儲存");
  }

  function editNote(note: Note) {
    setEditingNoteId(note.id);
    setActiveSection("notes");
    setReadingBookId(note.bookId);
    setSelectedBookId(note.bookId);
    setNoteForm({
      bookId: note.bookId,
      page: String(note.page || ""),
      rawText: note.rawText,
      reflection: note.reflection,
      isFavorite: note.isFavorite,
      imageDataUrl: note.imageDataUrl ?? "",
    });
    setStatus("已載入筆記");
  }

  function deleteNote(noteId: string) {
    setNotes((current) => current.filter((note) => note.id !== noteId));
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
    }
    setStatus("筆記已刪除");
  }

  function deleteBook(bookId: string) {
    const fallbackBook = books.find((book) => book.id !== bookId) ?? null;

    setBooks((current) => current.filter((book) => book.id !== bookId));
    setNotes((current) => current.filter((note) => note.bookId !== bookId));
    setSessions((current) =>
      current.filter((session) => session.bookId !== bookId),
    );

    if (readingBookId === bookId) {
      setReadingBookId(fallbackBook?.id ?? "");
    }
    if (selectedBookId === bookId) {
      setSelectedBookId(fallbackBook?.id ?? "");
    }
    if (noteForm.bookId === bookId) {
      setNoteForm((current) => ({ ...current, bookId: fallbackBook?.id ?? "" }));
    }
    setStatus("書籍已移出書櫃");
  }

  function completeEcho(echoId: string) {
    setCompletedEchoes((current) => [...current, echoId]);
    setStatus("已完成本次回聲");
  }

  async function shareFavorite(note: Note) {
    const text = createShareText(note, booksById[note.bookId]);

    try {
      if (navigator.share) {
        await navigator.share({
          title: booksById[note.bookId]?.title ?? "SmartRead Echo",
          text,
        });
        setStatus("已開啟分享");
        return;
      }

      await navigator.clipboard.writeText(text);
      setStatus("分享文案已複製");
    } catch {
      setStatus("分享失敗");
    }
  }

  async function downloadShareCard() {
    if (!shareCardRef.current || !favoriteNotes[0]) {
      setStatus("沒有可下載的卡片");
      return;
    }

    try {
      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${booksById[favoriteNotes[0].bookId]?.title ?? "smartread-echo"}-card.png`;
      link.click();
      setStatus("分享卡已下載");
    } catch {
      setStatus("下載失敗");
    }
  }

  async function exportToNotion() {
    const markdown = buildNotionExport(books, notes);
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus("Notion 內容已複製");
    } catch {
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "smartread-echo-notion-export.md";
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Notion 匯出檔已下載");
    }
  }

  async function exportBackup() {
    try {
      const payload = JSON.stringify(
        { books, notes, sessions, completedEchoes },
        null,
        2,
      );
      const blob = new Blob([payload], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "smartread-echo-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setStatus("完整備份已下載");
    } catch {
      setStatus("備份失敗");
    }
  }

  function toggleSound() {
    if (soundOn) {
      noiseRef.current?.stop();
      noiseRef.current = null;
      gainRef.current?.disconnect();
      gainRef.current = null;
      audioContextRef.current?.close();
      audioContextRef.current = null;
      setSoundOn(false);
      return;
    }

    const context = new window.AudioContext();
    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const gainNode = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gainNode.gain.value = 0.018;
    source.connect(gainNode);
    gainNode.connect(context.destination);
    source.start(0);

    audioContextRef.current = context;
    noiseRef.current = source;
    gainRef.current = gainNode;
    setSoundOn(true);
  }

  function finishSession() {
    const elapsed = FOCUS_MINUTES * 60 - timerSeconds;
    const minutes = Math.max(1, Math.round(elapsed / 60));

    if (!readingBookId) {
      setStatus("請先選擇正在閱讀的書");
      return;
    }

    setSessions((current) => [
      {
        id: uid("session"),
        bookId: readingBookId,
        minutes,
        startedAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setTimerSeconds(FOCUS_MINUTES * 60);
    setTimerRunning(false);
    setStatus("本次閱讀已記錄");
  }

  return (
    <div className="app-shell min-h-screen text-[var(--ink-strong)]">
      <main className="mx-auto grid min-h-screen w-full max-w-[1540px] gap-5 px-4 py-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="app-sidebar flex flex-col gap-5 rounded-[2.2rem] p-5 lg:sticky lg:top-6 lg:self-start lg:min-h-[calc(100vh-3rem)]">
          <div className="brand-card">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-bold tracking-[0.22em] text-white/84 uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              SmartRead Echo
            </div>
            <div className="mt-4">
              <div className="font-serif-display text-[1.7rem] leading-tight text-white">
                閱讀控制台
              </div>
              <div className="mt-2 text-sm text-white/72">
                Read. Capture. Recall.
              </div>
            </div>
          </div>

          <div className="sidebar-stats">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.22em] text-white/58 uppercase">
                  Progress
                </div>
                <div className="mt-2 text-3xl font-semibold text-white">{inkDrops}</div>
                <div className="mt-1 text-sm text-white/78">
                  Lv.{level.level} {level.label}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2 text-sm text-white/88">
                {streakDays} 天
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#f8d9a9,#e7ab66,#cf8c4f)]"
                style={{
                  width: `${nextLevelConfig ? ((inkDrops - currentLevelConfig.min) / (nextLevelConfig.min - currentLevelConfig.min)) * 100 : 100}%`,
                }}
              />
            </div>
            <div className="mt-3 text-xs text-white/66">
              {nextLevelConfig
                ? `距離 Lv.${nextLevelConfig.level} 還差 ${Math.max(0, nextLevelConfig.min - inkDrops)} 點`
                : "目前已達最高等級"}
            </div>
          </div>

          <nav className="grid gap-3">
            {sections.map((section) => {
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="sidebar-icon">{section.icon}</span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold text-white">
                      {section.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] tracking-[0.18em] text-white/62 uppercase">
                      {section.short}
                    </span>
                  </span>
                  <ChevronRight className="ml-auto h-4 w-4 text-white/60" />
                </button>
              );
            })}
          </nav>

          <div className="mt-auto grid grid-cols-2 gap-3 rounded-[1.7rem] border border-white/8 bg-white/3 p-4">
            <SidebarMetric label="藏書" value={`${books.length}`} />
            <SidebarMetric label="分鐘" value={`${totalReadingMinutes}`} />
            <SidebarMetric label="回聲" value={`${dueEchoes.length}`} />
            <SidebarMetric label="金句" value={`${favoriteNotes.length}`} />
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-5">
          <header className="glass-panel rounded-[2rem] p-5 md:p-6">
            <div className="workspace-header">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white/72 px-3 py-1 text-xs font-semibold text-[var(--accent-ink)]">
                  {currentSection.icon}
                  {currentSection.short}
                </div>
                <h2 className="mt-3 font-serif-display text-[2.35rem] leading-tight md:text-[3rem]">
                  {currentSection.title}
                </h2>
                <p className="section-note mt-2">
                  {activeSection === "search" && "找書並建立資料"}
                  {activeSection === "shelf" && "整理藏書與閱讀進度"}
                  {activeSection === "focus" && "開始一段專注閱讀"}
                  {activeSection === "notes" && "保存摘錄與想法"}
                  {activeSection === "review" && "處理今日待複習內容"}
                  {activeSection === "studio" && "整理分享與輸出"}
                </p>
              </div>

              <div className="hero-badges">
                <HeroMetric label="平均進度" value={`${averageProgress}%`} />
                <HeroMetric label="連續閱讀" value={`${streakDays} 天`} />
                <HeroMetric label="完成回聲" value={`${completedEchoes.length}`} />
              </div>
            </div>

            {status ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <Check className="h-4 w-4" />
                {status}
              </div>
            ) : null}
          </header>

          <div className="grid gap-3 lg:hidden">
            {sections.map((section) => (
              <button
                key={section.id}
                className={`sidebar-link ${section.id === activeSection ? "sidebar-link-active" : ""}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="sidebar-icon">{section.icon}</span>
                <span className="min-w-0 text-left">
                  <span className="block text-sm font-semibold">{section.title}</span>
                  <span className="block text-[11px] tracking-[0.18em] text-[var(--ink-soft)] uppercase">
                    {section.short}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {activeSection === "search" ? (
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <Panel title="找書加入書櫃" eyebrow="Book Search" icon={<Search className="h-5 w-5" />}>
                <div className="grid gap-4">
                  <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-[var(--paper-strong)] p-4">
                    <Field
                      label="書名搜尋"
                      value={bookSearchQuery}
                      onChange={setBookSearchQuery}
                      placeholder="輸入書名，例如：原子習慣"
                    />
                    {bookSearchLoading ? (
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">搜尋中...</p>
                    ) : null}
                    {!bookSearchLoading && bookSearchMessage ? (
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">{bookSearchMessage}</p>
                    ) : null}
                    {bookSearchResults.length > 0 ? (
                      <div className="mt-4 grid gap-3">
                        {bookSearchResults.map((result) => (
                          <button
                            key={`${result.title}-${result.author}-${result.isbn}`}
                            className="result-row"
                            onClick={() => applyBookResult(result)}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="h-20 w-14 shrink-0 overflow-hidden rounded-[0.9rem] bg-[var(--paper-strong)]">
                                {result.coverImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={result.coverImage}
                                    alt={result.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-semibold">{result.title}</div>
                                <div className="text-sm text-[var(--ink-soft)]">
                                  {result.author || "作者未提供"}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {result.category ? <Tag>{result.category}</Tag> : null}
                                  {result.totalPages ? <Tag>{result.totalPages} 頁</Tag> : null}
                                  {result.source ? <Tag>{result.source}</Tag> : null}
                                </div>
                              </div>
                            </div>
                            <span className="rounded-full border border-[var(--line-soft)] px-3 py-1 text-xs">
                              選擇
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="書名"
                      value={bookForm.title}
                      onChange={(value) =>
                        setBookForm((current) => ({ ...current, title: value }))
                      }
                      placeholder="書名"
                    />
                    <Field
                      label="作者"
                      value={bookForm.author}
                      onChange={(value) =>
                        setBookForm((current) => ({ ...current, author: value }))
                      }
                      placeholder="作者"
                    />
                    <Field
                      label="分類"
                      value={bookForm.category}
                      onChange={(value) =>
                        setBookForm((current) => ({ ...current, category: value }))
                      }
                      placeholder="例如：習慣養成、思維決策"
                    />
                    <Field
                      label="ISBN"
                      value={bookForm.isbn}
                      onChange={(value) =>
                        setBookForm((current) => ({ ...current, isbn: value }))
                      }
                      placeholder="自動帶入或手動填寫"
                    />
                    <Field
                      label="總頁數"
                      value={bookForm.totalPages}
                      onChange={(value) =>
                        setBookForm((current) => ({ ...current, totalPages: value }))
                      }
                      placeholder="320"
                    />
                  </div>

                  <TextAreaField
                    label="書籍摘要"
                    value={bookForm.description}
                    onChange={(value) =>
                      setBookForm((current) => ({ ...current, description: value }))
                    }
                    placeholder="保留這本書最重要的定位"
                    rows={4}
                  />

                  <Field
                    label="封面圖片"
                    value={bookForm.coverImage}
                    onChange={(value) =>
                      setBookForm((current) => ({ ...current, coverImage: value }))
                    }
                    placeholder="https://..."
                  />

                  <button className="button-primary" onClick={handleAddBook}>
                    <Plus className="h-4 w-4" />
                    加入書櫃
                  </button>
                </div>
              </Panel>

              <Panel title="搜尋預覽" eyebrow="Preview" icon={<BookOpen className="h-5 w-5" />}>
                {selectedBook ? (
                  <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="aspect-[3/4] overflow-hidden rounded-[1.8rem] bg-[var(--paper-strong)] shadow-[0_18px_34px_rgba(76,55,24,0.08)]">
                      {selectedBook.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedBook.coverImage}
                          alt={selectedBook.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(140deg,#dbc9b0,#f7efe1)] text-[var(--ink-soft)]">
                          無封面
                        </div>
                      )}
                    </div>
                    <div className="grid gap-4">
                      <div>
                        <h3 className="font-serif-display text-3xl">{selectedBook.title}</h3>
                        <p className="mt-2 text-sm text-[var(--ink-soft)]">
                          {selectedBook.author || "作者未填寫"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedBook.category ? <Tag>{selectedBook.category}</Tag> : null}
                          <Tag>{selectedBook.isbn || "ISBN 未填寫"}</Tag>
                          <Tag>{selectedBook.totalPages || "?"} 頁</Tag>
                        </div>
                      </div>
                      <div className="detail-scroll rounded-[1.4rem] border border-[var(--line-soft)] bg-white/72 p-4 text-sm leading-7 text-[var(--ink-soft)]">
                        {selectedBook.description || "尚未填寫這本書的定位摘要。"}
                      </div>
                      <button
                        className="button-secondary w-fit"
                        onClick={() => setActiveSection("shelf")}
                      >
                        前往書櫃管理
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="先找一本書" body="選擇候選書之後，這裡會顯示完整資訊。" />
                )}
              </Panel>
            </div>
          ) : null}

          {activeSection === "shelf" ? (
            <div className="grid gap-5">
              <Panel title={selectedBook ? selectedBook.title : "我的書櫃"} eyebrow="Shelf" icon={<BookCopy className="h-5 w-5" />}>
                {books.length ? (
                  <div className="shelf-layout">
                    <div className="grid gap-4">
                      <div className="shelf-toolbar">
                        <div>
                          <div className="text-[11px] font-semibold tracking-[0.18em] text-[var(--ink-soft)] uppercase">
                            Categories
                          </div>
                          <div className="mt-3">
                            <Field
                              label="書櫃搜尋"
                              value={shelfQuery}
                              onChange={setShelfQuery}
                              placeholder="搜尋書名、作者或 ISBN"
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {bookCategories.map((category) => (
                              <button
                                key={category}
                                className={`category-pill ${selectedCategoryFilter === category ? "category-pill-active" : ""}`}
                                onClick={() => setSelectedCategoryFilter(category)}
                              >
                                {category}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <ShelfStat label="書籍" value={`${shelfBooks.length}`} />
                          <ShelfStat label="平均" value={`${averageProgress}%`} />
                          <ShelfStat label="收藏" value={`${favoriteNotes.length}`} />
                        </div>
                      </div>
                      {shelfBooks.length ? (
                        <div className="shelf-list">
                          {shelfBooks.map((book) => {
                            const active = selectedBookId === book.id;
                            return (
                              <button
                                key={book.id}
                                className={`shelf-list-item ${active ? "shelf-list-item-active" : ""}`}
                                onClick={() => setSelectedBookId(book.id)}
                              >
                                <div className="shelf-card">
                                  <div className="shelf-list-cover">
                                    {book.coverImage ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={book.coverImage}
                                        alt={book.title}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center bg-[var(--paper-strong)] text-[var(--ink-soft)]">
                                        無封面
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-lg font-semibold">{book.title}</div>
                                    <div className="mt-1 text-sm text-[var(--ink-soft)]">
                                      {book.author || "作者未填寫"}
                                    </div>
                                    <div className="mt-3 flex items-center gap-3">
                                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line-soft)]">
                                        <div
                                          className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-warm))]"
                                          style={{ width: `${getProgress(book)}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-semibold text-[var(--accent-ink)]">
                                        {getProgress(book)}%
                                      </span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {book.category ? <Tag>{book.category}</Tag> : null}
                                      <Tag>{book.totalPages || "?"} 頁</Tag>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState
                          title="找不到符合的書"
                          body="試試其他關鍵字，或切換到不同分類看看。"
                        />
                      )}
                    </div>
                    <div>
                      {selectedBook ? (
                        <div className="app-screen shelf-detail h-full">
                          <div className="app-screen-header">
                            <div className="text-xs text-[var(--ink-soft)]">正在閱讀</div>
                            <div className="font-serif-display text-[2rem] leading-tight">{selectedBook.title}</div>
                          </div>
                          <div className="app-screen-body grid gap-4">
                            <div className="shelf-detail-hero">
                              <div className="shelf-detail-cover">
                                {selectedBook.coverImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={selectedBook.coverImage}
                                    alt={selectedBook.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-[var(--paper-strong)] text-[var(--ink-soft)]">
                                    無封面
                                  </div>
                                )}
                              </div>
                              <div className="grid gap-3">
                                <div className="text-lg font-semibold">{selectedBook.author || "作者未填寫"}</div>
                                <div className="flex flex-wrap gap-2">
                                  {selectedBook.category ? <Tag>{selectedBook.category}</Tag> : null}
                                  <Tag>{selectedBook.isbn || "ISBN 未填寫"}</Tag>
                                  <Tag>{selectedBook.totalPages || "?"} 頁</Tag>
                                </div>
                                <div className="rounded-[1.3rem] bg-[var(--paper-strong)] p-4">
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    <ShelfStat label="目前頁數" value={`${selectedBook.currentPage}`} />
                                    <ShelfStat label="總頁數" value={`${selectedBook.totalPages || "?"}`} />
                                    <ShelfStat label="進度" value={`${getProgress(selectedBook)}%`} />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="rounded-[1.4rem] bg-[var(--paper-strong)] p-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--ink-soft)]">閱讀進度</span>
                                <span className="font-semibold">
                                  {selectedBook.currentPage}/{selectedBook.totalPages || "?"}
                                </span>
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--line-soft)]">
                                <div
                                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-warm))]"
                                  style={{ width: `${getProgress(selectedBook)}%` }}
                                />
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                                <input
                                  type="range"
                                  min={0}
                                  max={selectedBook.totalPages || 100}
                                  value={selectedBook.currentPage}
                                  onChange={(event) =>
                                    updateProgress(
                                      selectedBook.id,
                                      Number(event.target.value),
                                    )
                                  }
                                />
                                <input
                                  className="input"
                                  inputMode="numeric"
                                  value={selectedBook.currentPage}
                                  onChange={(event) =>
                                    updateProgress(
                                      selectedBook.id,
                                      Number(event.target.value || 0),
                                    )
                                  }
                                />
                              </div>
                            </div>
                            <div className="detail-scroll rounded-[1.4rem] border border-[var(--line-soft)] bg-white/72 p-4 text-sm leading-7 text-[var(--ink-soft)]">
                              {selectedBook.description || "尚未填寫這本書的定位摘要。"}
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <button
                                className="button-primary"
                                onClick={() => {
                                  setReadingBookId(selectedBook.id);
                                  setActiveSection("focus");
                                  setStatus("已切換到專注模式");
                                }}
                              >
                                <Clock3 className="h-4 w-4" />
                                開始閱讀
                              </button>
                              <button
                                className="button-secondary"
                                onClick={() => deleteBook(selectedBook.id)}
                              >
                                移出書櫃
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          title="你的書櫃還是空的"
                          body="先到找書頁把第一本書加進來。"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="還沒有書籍"
                    body="建立第一本書之後，這裡會變成你的閱讀主頁。"
                  />
                )}
              </Panel>
            </div>
          ) : null}

          {activeSection === "focus" ? (
            <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <Panel
                title={readingBook ? readingBook.title : "專注模式"}
                eyebrow="Focus Session"
                icon={<Clock3 className="h-5 w-5" />}
              >
                  {readingBook ? (
                    <div className="grid gap-5">
                      <div className="rounded-[1.8rem] bg-[linear-gradient(160deg,rgba(47,40,33,0.96),rgba(96,72,46,0.92))] p-6 text-white shadow-[0_22px_50px_rgba(59,43,20,0.24)]">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs tracking-[0.22em] text-white/64 uppercase">
                              Focus Timer
                            </p>
                            <div className="mt-3 text-6xl font-semibold tracking-tight">
                              {formatMinutes(timerSeconds)}
                            </div>
                          </div>
                          <div className="rounded-[1.3rem] border border-white/14 bg-white/10 px-4 py-3 text-right text-sm text-white/72">
                            <div>{readingBook.author || "作者未填寫"}</div>
                            <div className="mt-1">
                              {readingBook.currentPage}/{readingBook.totalPages || "?"} 頁
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <button
                            className="button-primary border-white/10 bg-white text-[var(--ink-strong)] shadow-none"
                            onClick={() => setTimerRunning((current) => !current)}
                          >
                            {timerRunning ? "暫停" : "開始"}
                          </button>
                          <button
                            className="button-secondary border-white/10 bg-white/10 text-white"
                            onClick={() => {
                              setTimerSeconds(FOCUS_MINUTES * 60);
                              setTimerRunning(false);
                            }}
                          >
                            <TimerReset className="h-4 w-4" />
                            重設
                          </button>
                          <button
                            className="button-secondary border-white/10 bg-white/10 text-white"
                            onClick={finishSession}
                          >
                            <Check className="h-4 w-4" />
                            完成
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <button
                            className="button-secondary border-white/10 bg-white/10 text-white"
                            onClick={toggleSound}
                          >
                            <Waves className="h-4 w-4" />
                            {soundOn ? "關閉白噪音" : "開啟白噪音"}
                          </button>
                          <select
                            className="input border-white/10 bg-white/10 text-white"
                            value={readingBookId}
                            onChange={(event) => {
                              setReadingBookId(event.target.value);
                              setSelectedBookId(event.target.value);
                              setNoteForm((current) => ({
                                ...current,
                                bookId: event.target.value,
                              }));
                            }}
                          >
                            {books.map((book) => (
                              <option key={book.id} value={book.id} className="text-black">
                                {book.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {readingGuide ? (
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-[var(--paper-strong)] p-4">
                            <div className="text-sm font-semibold">適合讀者</div>
                            <div className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                              {readingGuide.audience}
                            </div>
                          </div>
                          <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-[var(--paper-strong)] p-4">
                            <div className="text-sm font-semibold">讀前問題</div>
                            <div className="mt-2 grid gap-2 text-sm leading-7 text-[var(--ink-soft)]">
                              {readingGuide.questions.map((question) => (
                                <div key={question} className="rounded-2xl bg-white/70 px-3 py-2">
                                  {question}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-white/72 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">最近閱讀</div>
                          <div className="text-xs text-[var(--ink-soft)]">
                            {recentSessions.length} 筆
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {recentSessions.map((session) => (
                            <div
                              key={session.id}
                              className="flex items-center justify-between rounded-[1.2rem] bg-white/70 px-4 py-3"
                            >
                              <div>
                                <div className="font-medium">
                                  {booksById[session.bookId]?.title ?? "未命名書籍"}
                                </div>
                                <div className="text-sm text-[var(--ink-soft)]">
                                  {formatDate(session.startedAt)}
                                </div>
                              </div>
                              <div className="text-sm font-semibold">
                                {session.minutes} 分鐘
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="先選一本正在閱讀的書"
                      body="到書籍整理把第一本書加入書櫃，就能開始計時與摘錄。"
                    />
                  )}
              </Panel>

              <Panel
                title="本週閱讀紀錄"
                eyebrow="Recent Sessions"
                icon={<Trophy className="h-5 w-5" />}
              >
                {recentSessions.length ? (
                  <div className="grid gap-3">
                    {recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className="rounded-[1.4rem] border border-[var(--line-soft)] bg-white/72 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold">
                              {booksById[session.bookId]?.title ?? "未命名書籍"}
                            </div>
                            <div className="mt-1 text-sm text-[var(--ink-soft)]">
                              {formatDate(session.startedAt)}
                            </div>
                          </div>
                          <div className="rounded-full bg-[var(--paper-strong)] px-3 py-2 text-sm font-semibold">
                            {session.minutes} 分鐘
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="還沒有閱讀紀錄"
                    body="完成第一個專注時段後，這裡會記錄你的閱讀節奏。"
                  />
                )}
              </Panel>
            </div>
          ) : null}

          {activeSection === "notes" ? (
            <>
              <Panel
                title={editingNoteId ? "編輯筆記" : "新增摘錄"}
                eyebrow="Capture"
                icon={<ScanText className="h-5 w-5" />}
              >
                  <div className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="field-wrap">
                        <label className="field-label">書籍</label>
                        <select
                          className="input"
                          value={noteForm.bookId}
                          onChange={(event) =>
                            setNoteForm((current) => ({
                              ...current,
                              bookId: event.target.value,
                            }))
                          }
                        >
                          {books.map((book) => (
                            <option key={book.id} value={book.id}>
                              {book.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Field
                        label="頁碼"
                        value={noteForm.page}
                        onChange={(value) =>
                          setNoteForm((current) => ({ ...current, page: value }))
                        }
                        placeholder="42"
                      />
                    </div>

                    <div className="rounded-[1.5rem] border border-dashed border-[var(--line-strong)] bg-[var(--paper-strong)] p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold">OCR 採集</div>
                          <div className="mt-1 text-sm text-[var(--ink-soft)]">
                            上傳書頁圖片後，自動帶入摘錄內容。
                          </div>
                        </div>
                        <label className="button-secondary">
                          上傳圖片
                          <input
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void runOcr(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      {noteForm.imageDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={noteForm.imageDataUrl}
                          alt="OCR preview"
                          className="mt-4 h-52 w-full rounded-[1.4rem] object-cover"
                        />
                      ) : null}
                    </div>

                    <TextAreaField
                      label="摘錄"
                      value={noteForm.rawText}
                      onChange={(value) =>
                        setNoteForm((current) => ({ ...current, rawText: value }))
                      }
                      placeholder="貼上或辨識出來的文字"
                      rows={5}
                    />

                    <TextAreaField
                      label="自己的心得"
                      value={noteForm.reflection}
                      onChange={(value) =>
                        setNoteForm((current) => ({ ...current, reflection: value }))
                      }
                      placeholder="這段話改變了你什麼想法？"
                      rows={5}
                    />

                    <button
                      className={`favorite-toggle ${noteForm.isFavorite ? "favorite-toggle-active" : ""}`}
                      onClick={() =>
                        setNoteForm((current) => ({
                          ...current,
                          isFavorite: !current.isFavorite,
                        }))
                      }
                    >
                      <Star className="h-4 w-4" />
                      收藏成金句
                    </button>

                    <div className="flex flex-wrap gap-3">
                      <button className="button-primary" onClick={saveNote}>
                        <Plus className="h-4 w-4" />
                        {editingNoteId ? "更新筆記" : "儲存筆記"}
                      </button>
                      {editingNoteId ? (
                        <button
                          className="button-secondary"
                          onClick={() => {
                            setEditingNoteId(null);
                            setNoteForm((current) => ({
                              ...current,
                              page: "",
                              rawText: "",
                              reflection: "",
                              isFavorite: false,
                              imageDataUrl: "",
                            }));
                            setStatus("已取消編輯");
                          }}
                        >
                          取消
                        </button>
                      ) : null}
                    </div>
                  </div>
              </Panel>

              <Panel
                title="最近筆記"
                eyebrow="Recent Notes"
                icon={<Quote className="h-5 w-5" />}
              >
                {recentNotes.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {recentNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        book={booksById[note.bookId]}
                        onEdit={() => editNote(note)}
                        onDelete={() => deleteNote(note.id)}
                        onShare={() => void shareFavorite(note)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="還沒有摘錄"
                    body="完成第一段摘錄後，這裡會變成你的閱讀記錄牆。"
                  />
                )}
              </Panel>
            </>
          ) : null}

          {activeSection === "review" ? (
            <>
              <Panel
                title="待複習回聲"
                eyebrow="Echo Queue"
                icon={<Brain className="h-5 w-5" />}
              >
                  {dueEchoes.length ? (
                    <div className="grid gap-4">
                      {dueEchoes.map((echo) => (
                        <div key={echo.id} className="echo-card">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-ink)] uppercase">
                                Day {echo.day}
                              </div>
                              <div className="mt-2 text-xl font-semibold">
                                {echo.book?.title ?? "未命名書籍"}
                              </div>
                              <div className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                                {buildEchoPrompt(echo.note, echo.book)}
                              </div>
                            </div>
                            <button
                              className="button-secondary"
                              onClick={() => completeEcho(echo.id)}
                            >
                              完成
                            </button>
                          </div>
                          <div className="mt-4 grid gap-3 rounded-[1.25rem] bg-white/72 p-4 text-sm text-[var(--ink-soft)]">
                            <div>摘錄：{echo.note.rawText}</div>
                            <div>心得：{echo.note.reflection || "尚未補充心得"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="目前沒有待處理回聲"
                      body="新增更多筆記後，系統會在 1、7、30 天後提醒你回想。"
                    />
                  )}
              </Panel>

              <Panel
                title="收藏金句"
                eyebrow="Favorites"
                icon={<Star className="h-5 w-5" />}
              >
                {favoriteNotes.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {favoriteNotes.map((note) => (
                      <div key={note.id} className="rounded-[1.5rem] bg-white/72 p-4">
                        <div className="text-sm text-[var(--ink-soft)]">
                          {booksById[note.bookId]?.title ?? "未命名書籍"}
                        </div>
                        <div className="mt-3 font-serif-display text-2xl leading-[1.7]">
                          {note.rawText}
                        </div>
                        {note.reflection ? (
                          <div className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                            {note.reflection}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className="button-secondary"
                            onClick={() => void shareFavorite(note)}
                          >
                            <Share2 className="h-4 w-4" />
                            分享
                          </button>
                          <button
                            className="button-secondary"
                            onClick={() => editNote(note)}
                          >
                            編輯
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="還沒有收藏金句"
                    body="在筆記頁把重要摘錄標成收藏，這裡就會變成你的精華區。"
                  />
                )}
              </Panel>
            </>
          ) : null}

          {activeSection === "studio" ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
                <Panel
                  title="分享與輸出"
                  eyebrow="Output"
                  icon={<Share2 className="h-5 w-5" />}
                >
                  <div className="grid gap-4">
                    <div
                      ref={shareCardRef}
                      className="overflow-hidden rounded-[1.9rem] bg-[linear-gradient(145deg,#2e251f,#8f6539_58%,#d8a667)] p-6 text-white shadow-[0_25px_60px_rgba(68,44,21,0.26)]"
                    >
                      <div className="text-xs tracking-[0.22em] text-white/64 uppercase">
                        分享卡
                      </div>
                      <div className="mt-4 font-serif-display text-3xl leading-[1.4]">
                        {favoriteNotes[0]?.rawText || "先收藏一段值得反覆回看的句子。"}
                      </div>
                      <div className="mt-6 text-sm text-white/78">
                        {favoriteNotes[0]
                          ? `《${booksById[favoriteNotes[0].bookId]?.title ?? "未命名書籍"}》`
                          : "SmartRead Echo"}
                      </div>
                      <div className="mt-3 text-sm leading-7 text-white/72">
                        {favoriteNotes[0]?.reflection || "把閱讀變成自己的話，才會真正留下來。"}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        className="button-primary"
                        onClick={() =>
                          favoriteNotes[0]
                            ? void shareFavorite(favoriteNotes[0])
                            : setStatus("請先收藏一則金句")
                        }
                      >
                        <Share2 className="h-4 w-4" />
                        系統分享
                      </button>
                      <button className="button-secondary" onClick={downloadShareCard}>
                        <Download className="h-4 w-4" />
                        下載卡片
                      </button>
                      <button className="button-secondary" onClick={exportToNotion}>
                        <GitBranch className="h-4 w-4" />
                        匯出到 Notion
                      </button>
                      <button className="button-secondary" onClick={exportBackup}>
                        <Download className="h-4 w-4" />
                        下載備份
                      </button>
                    </div>
                  </div>
                </Panel>

                <Panel title="升級路線" eyebrow="Levels" icon={<Trophy className="h-5 w-5" />}>
                  <div className="grid gap-3">
                    {LEVELS.map((item) => {
                      const unlocked = inkDrops >= item.min;
                      return (
                        <div
                          key={item.level}
                          className={`flex items-center justify-between rounded-[1.2rem] px-4 py-3 ${
                            unlocked
                              ? "bg-amber-50 text-[var(--ink-strong)]"
                              : "bg-white/70 text-[var(--ink-soft)]"
                          }`}
                        >
                          <div>
                            <div className="font-semibold">
                              Lv.{item.level} {item.label}
                            </div>
                            <div className="text-sm">{item.unlock}</div>
                          </div>
                          <div className="text-xs font-semibold uppercase">
                            {unlocked ? "Unlocked" : `${item.min} Ink`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </div>

              <Panel
                title="知識圖譜"
                eyebrow="Concept Map"
                icon={<GitBranch className="h-5 w-5" />}
              >
                  {conceptGraph.length ? (
                    <div className="grid gap-4">
                      <div className="flex flex-wrap gap-3">
                        {conceptGraph.map((concept, index) => (
                          <div
                            key={concept.term}
                            className="concept-chip"
                            style={{
                              width: `${Math.min(240, 118 + concept.count * 18 + index * 2)}px`,
                            }}
                          >
                            <div className="font-semibold">{concept.term}</div>
                            <div className="mt-1 text-xs text-[var(--ink-soft)]">
                              {concept.count} 次提及
                            </div>
                            <div className="mt-2 text-xs text-[var(--ink-soft)]">
                              {concept.books.join(" · ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="知識圖譜還沒有素材"
                      body="多寫幾則筆記之後，這裡會開始長出你自己的主題地圖。"
                    />
                  )}
              </Panel>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel rounded-[2rem] p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.22em] text-[var(--accent-ink)] uppercase">
            {eyebrow}
          </div>
          <h3 className="mt-2 flex items-center gap-2 font-serif-display text-[1.55rem] leading-tight md:text-[1.8rem]">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--paper-strong)] text-[var(--accent-ink)]">
              {icon}
            </span>
            {title}
          </h3>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <textarea
        className="textarea"
        value={value}
        rows={rows ?? 4}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SidebarMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-kpi rounded-[1.15rem] border border-white/7 bg-white/5 px-3 py-3">
      <span className="text-[11px] tracking-[0.16em] text-white/42 uppercase">{label}</span>
      <span className="text-lg font-semibold text-white">{value}</span>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <div className="text-[11px] tracking-[0.14em] text-[var(--ink-soft)] uppercase">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ShelfStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-[var(--line-soft)] bg-white/80 px-3 py-3 text-left">
      <div className="text-[11px] tracking-[0.14em] text-[var(--ink-soft)] uppercase">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--line-soft)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.8rem] border border-dashed border-[var(--line-strong)] bg-[var(--paper-strong)] px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--accent-ink)] shadow-[0_16px_34px_rgba(70,53,25,0.08)]">
        <BookOpen className="h-6 w-6" />
      </div>
      <div className="mt-4 font-serif-display text-2xl">{title}</div>
      <div className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{body}</div>
    </div>
  );
}

function NoteCard({
  note,
  book,
  onEdit,
  onDelete,
  onShare,
}: {
  note: Note;
  book?: Book;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  return (
    <div className="rounded-[1.7rem] border border-[var(--line-soft)] bg-white/76 p-5 shadow-[0_18px_34px_rgba(77,56,25,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-[var(--ink-soft)]">
            {book?.title ?? "未命名書籍"}
          </div>
          <div className="mt-1 text-xs text-[var(--ink-soft)]">
            第 {note.page || "?"} 頁 · {formatDate(note.createdAt)}
          </div>
        </div>
        {note.isFavorite ? (
          <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            收藏
          </div>
        ) : null}
      </div>

      <div className="mt-4 font-serif-display text-2xl leading-[1.7]">{note.rawText}</div>
      {note.reflection ? (
        <div className="mt-4 rounded-[1.25rem] bg-[var(--paper-strong)] px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
          {note.reflection}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="button-secondary" onClick={onEdit}>
          編輯
        </button>
        <button className="button-secondary" onClick={onDelete}>
          刪除
        </button>
        <button className="button-secondary" onClick={onShare}>
          <Share2 className="h-4 w-4" />
          分享
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  return <AppShell />;
}
