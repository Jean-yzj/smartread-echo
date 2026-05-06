"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import Tesseract from "tesseract.js";
import {
  BookOpen,
  Brain,
  Clock3,
  Download,
  GitBranch,
  Library,
  Plus,
  Quote,
  ScanText,
  Share2,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";

type Book = {
  id: string;
  title: string;
  author: string;
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

type AppSection = "library" | "lab" | "echo";

type BookSearchResult = {
  title: string;
  author: string;
  isbn: string;
  totalPages: number;
  description: string;
  coverImage: string;
};

const STORAGE_KEY = "smartread-echo-state";
const ECHO_DAYS = [1, 7, 30];
const LEVELS = [
  { level: 1, label: "讀者", min: 0, unlock: "建立書櫃、閱讀計時、私人筆記" },
  { level: 2, label: "探索者", min: 120, unlock: "書名快搜、導讀問題、分享卡" },
  { level: 3, label: "思辨家", min: 260, unlock: "回聲複習、主題整理、Notion 匯出" },
  { level: 4, label: "架構師", min: 500, unlock: "完整知識工作流與深度追蹤" },
] as const;

const demoBooks: Book[] = [
  {
    id: "book-atomic",
    title: "原子習慣",
    author: "James Clear",
    isbn: "9780735211292",
    totalPages: 320,
    currentPage: 96,
    description:
      "從行為設計與微小改變切入，幫助讀者建立能長期維持的習慣系統。",
    coverImage:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
  },
];

const demoNotes: Note[] = [
  {
    id: "note-1",
    bookId: "book-atomic",
    page: 42,
    rawText: "你不會提升到目標的高度，你會跌回系統的水準。",
    reflection:
      "我現在的閱讀習慣不是靠意志力，而是靠晚餐後固定坐到書桌前這個系統。",
    isFavorite: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
  },
  {
    id: "note-2",
    bookId: "book-atomic",
    page: 71,
    rawText: "讓好習慣顯而易見、容易執行、立即有回饋。",
    reflection:
      "我可以把目前要讀的書直接放在床頭，而不是放進書櫃深處。",
    isFavorite: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

const demoSessions: Session[] = [
  {
    id: "session-1",
    bookId: "book-atomic",
    minutes: 35,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
];

const sections: Array<{
  id: AppSection;
  title: string;
  icon: React.ReactNode;
}> = [
  {
    id: "library",
    title: "書籍整理",
    icon: <Library className="h-4 w-4" />,
  },
  {
    id: "lab",
    title: "Reading Lab",
    icon: <Clock3 className="h-4 w-4" />,
  },
  {
    id: "echo",
    title: "回聲複習",
    icon: <Brain className="h-4 w-4" />,
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

function createPreReadGuide(book: Book) {
  const text = `${book.title} ${book.description}`.toLowerCase();
  const audience = text.includes("習慣")
    ? "適合正想建立穩定閱讀、工作或生活流程的人。"
    : text.includes("思維") || text.includes("策略")
      ? "適合想提升判斷力、決策品質與架構思考的讀者。"
      : "適合想把閱讀變成可執行行動，而不只停留在摘錄的人。";

  const questions = [
    "你希望這本書幫你解決哪一個正在反覆發生的問題？",
    "讀完這本書後，你最想立刻改變的一個行為是什麼？",
    "如果只能留下 3 條可執行原則，你希望它們是哪些？",
  ];

  return { audience, questions };
}

function buildEchoPrompt(note: Note, book?: Book) {
  const keyword =
    note.reflection.split(/[，。、；：「」\s]/).find(Boolean) || "這個想法";
  return `你上次在《${book?.title ?? "這本書"}》提到「${keyword}」，這週有沒有新的例子或行動可以呼應它？`;
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
      return `# ${book.title}\n作者：${book.author || "未填寫"}\n進度：${book.currentPage}/${book.totalPages || "?"}\n\n${relatedNotes
        .map(
          (note) =>
            `## 第 ${note.page || "?"} 頁\n摘錄：${note.rawText}\n心得：${note.reflection || "未填寫"}\n`,
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
  const [activeSection, setActiveSection] = useState<AppSection>("library");
  const [books, setBooks] = useState<Book[]>(demoBooks);
  const [notes, setNotes] = useState<Note[]>(demoNotes);
  const [sessions, setSessions] = useState<Session[]>(demoSessions);
  const [completedEchoes, setCompletedEchoes] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [bookForm, setBookForm] = useState<BookForm>({
    title: "",
    author: "",
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

  const [isbnStatus, setIsbnStatus] = useState("輸入 ISBN 後可自動帶入書籍資料");
  const [ocrStatus, setOcrStatus] = useState(
    "上傳書頁照片後，系統會在瀏覽器內執行 OCR",
  );
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSearchStatus, setBookSearchStatus] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState<BookSearchResult[]>([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [notionStatus, setNotionStatus] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const [readingBookId, setReadingBookId] = useState(demoBooks[0]?.id ?? "");
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [referenceNow] = useState(() => Date.now());

  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const [soundOn, setSoundOn] = useState(false);

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
        setBooks(parsed.books);
        setNotes(parsed.notes);
        setSessions(parsed.sessions);
        setCompletedEchoes(parsed.completedEchoes);
        setReadingBookId(parsed.books[0]?.id ?? "");
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
  const averageProgress =
    books.length > 0
      ? Math.round(
          (books.reduce(
            (sum, book) =>
              sum + (book.totalPages ? book.currentPage / book.totalPages : 0),
            0,
          ) /
            books.length) *
            100,
        )
      : 0;

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

  const favoriteNotes = notes.filter((note) => note.isFavorite);
  const selectedBook = books.find((book) => book.id === readingBookId) ?? books[0];
  const guide = selectedBook ? createPreReadGuide(selectedBook) : null;
  const recentSessions = sessions.slice(0, 4);
  const conceptGraph = extractConcepts(notes, booksById);
  const currentSection = sections.find(
    (section) => section.id === activeSection,
  )!;

  async function searchBooksByTitle(keyword: string) {
    setBookSearchLoading(true);
    setBookSearchStatus("搜尋中...");

    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(keyword)}&maxResults=6&langRestrict=zh`,
      );
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
        setBookSearchResults([]);
        setBookSearchStatus("找不到結果");
        setBookSearchLoading(false);
        return;
      }

      const results = data.items.map((item) => {
        const volume = item.volumeInfo ?? {};
        const isbn =
          volume.industryIdentifiers?.find((id) =>
            id.type?.includes("ISBN"),
          )?.identifier ?? "";

        return {
          title: volume.title ?? "未命名書籍",
          author: volume.authors?.join(", ") ?? "",
          isbn,
          totalPages: volume.pageCount ?? 0,
          description: volume.description ?? "",
          coverImage:
            volume.imageLinks?.thumbnail?.replace("http://", "https://") ?? "",
        };
      });

      setBookSearchResults(results);
      setBookSearchStatus("");
      setBookSearchLoading(false);
    } catch {
      setBookSearchStatus("搜尋失敗");
      setBookSearchLoading(false);
    }
  }

  useEffect(() => {
    const keyword = bookSearchQuery.trim();

    const timeoutId = window.setTimeout(() => {
      if (!keyword) {
        setBookSearchResults([]);
        setBookSearchStatus("");
        setBookSearchLoading(false);
        return;
      }

      void searchBooksByTitle(keyword);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [bookSearchQuery]);

  function applyBookResult(result: BookSearchResult) {
    setBookForm({
      title: result.title,
      author: result.author,
      isbn: result.isbn,
      totalPages: result.totalPages ? String(result.totalPages) : "",
      description: result.description,
      coverImage: result.coverImage,
    });
    setBookSearchResults([]);
    setBookSearchQuery(result.title);
    setBookSearchStatus("已帶入書籍資料");
    setBookSearchLoading(false);
  }

  function handleAddBook() {
    if (!bookForm.title.trim()) {
      setIsbnStatus("至少需要輸入書名");
      return;
    }

    const nextBook: Book = {
      id: uid("book"),
      title: bookForm.title.trim(),
      author: bookForm.author.trim(),
      isbn: bookForm.isbn.trim(),
      totalPages: Number(bookForm.totalPages || 0),
      currentPage: 0,
      description: bookForm.description.trim(),
      coverImage: bookForm.coverImage.trim(),
      createdAt: new Date().toISOString(),
    };

    setBooks((current) => [nextBook, ...current]);
    setReadingBookId(nextBook.id);
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
      isbn: "",
      totalPages: "",
      description: "",
      coverImage: "",
    });
    setIsbnStatus("書籍已加入書櫃");
    setBookSearchQuery("");
    setBookSearchResults([]);
    setBookSearchStatus("");
    setActiveSection("library");
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
    setOcrStatus("辨識中，第一次使用會先下載語言模型...");
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
      setOcrStatus("OCR 完成，請先校對文字再儲存");
    } catch {
      setOcrStatus("OCR 暫時失敗，仍然可以手動貼上摘錄內容");
    }
  }

  function saveNote() {
    if (!noteForm.bookId || !noteForm.rawText.trim()) {
      setOcrStatus("請先選書，並輸入或辨識出一段文字");
      return;
    }

    const nextNote: Note = {
      id: editingNoteId ?? uid("note"),
      bookId: noteForm.bookId,
      page: Number(noteForm.page || 0),
      rawText: noteForm.rawText.trim(),
      reflection: noteForm.reflection.trim(),
      isFavorite: noteForm.isFavorite,
      imageDataUrl: noteForm.imageDataUrl,
      createdAt:
        notes.find((note) => note.id === editingNoteId)?.createdAt ??
        new Date().toISOString(),
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
    setOcrStatus(editingNoteId ? "筆記已更新" : "筆記已儲存");
  }

  function editNote(note: Note) {
    setEditingNoteId(note.id);
    setNoteForm({
      bookId: note.bookId,
      page: String(note.page || ""),
      rawText: note.rawText,
      reflection: note.reflection,
      isFavorite: note.isFavorite,
      imageDataUrl: note.imageDataUrl ?? "",
    });
    setActiveSection("lab");
  }

  function deleteNote(noteId: string) {
    setNotes((current) => current.filter((note) => note.id !== noteId));
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
    }
  }

  function deleteBook(bookId: string) {
    setBooks((current) => current.filter((book) => book.id !== bookId));
    setNotes((current) => current.filter((note) => note.bookId !== bookId));
    setSessions((current) =>
      current.filter((session) => session.bookId !== bookId),
    );
    if (readingBookId === bookId) {
      const fallback = books.find((book) => book.id !== bookId);
      setReadingBookId(fallback?.id ?? "");
    }
  }

  function completeEcho(echoId: string) {
    setCompletedEchoes((current) => [...current, echoId]);
  }

  async function shareFavorite(note: Note) {
    const text = createShareText(note, booksById[note.bookId]);

    try {
      if (navigator.share) {
        await navigator.share({
          title: booksById[note.bookId]?.title ?? "SmartRead Echo",
          text,
        });
        setShareStatus("已開啟分享");
        return;
      }

      await navigator.clipboard.writeText(text);
      setShareStatus("分享文案已複製");
    } catch {
      setShareStatus("分享失敗");
    }
  }

  async function downloadShareCard() {
    if (!shareCardRef.current || !favoriteNotes[0]) {
      setShareStatus("沒有可下載的卡片");
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
      setShareStatus("卡片已下載");
    } catch {
      setShareStatus("下載失敗");
    }
  }

  async function exportToNotion() {
    const markdown = buildNotionExport(books, notes);
    try {
      await navigator.clipboard.writeText(markdown);
      setNotionStatus("Notion 匯入內容已複製");
    } catch {
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "smartread-echo-notion-export.md";
      link.click();
      URL.revokeObjectURL(url);
      setNotionStatus("已下載 Notion 匯入檔");
    }
  }

  async function exportBackup() {
    const payload = JSON.stringify(
      { books, notes, sessions, completedEchoes },
      null,
      2,
    );

    try {
      const blob = new Blob([payload], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "smartread-echo-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setBackupStatus("備份已下載");
    } catch {
      setBackupStatus("備份失敗");
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
    const elapsed = 25 * 60 - timerSeconds;
    const minutes = Math.max(1, Math.round(elapsed / 60));

    if (!readingBookId) {
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
    setTimerSeconds(25 * 60);
    setTimerRunning(false);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(199,144,88,0.18),_transparent_28%),linear-gradient(180deg,#f7efe2_0%,#f4f0ea_40%,#e7e3dc_100%)] text-stone-900">
      <main className="mx-auto grid min-h-screen w-full max-w-[1600px] gap-5 px-4 py-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="rounded-[2rem] border border-white/60 bg-[#fdfaf4]/92 p-5 shadow-[0_24px_80px_rgba(72,44,18,0.12)] backdrop-blur lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex h-full flex-col">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-950/10 bg-white/70 px-3 py-1 text-xs font-medium tracking-[0.24em] text-amber-950/70 uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                SmartRead Echo
              </div>
              <div>
                <h1 className="text-3xl leading-tight font-semibold">
                  SmartRead Echo
                </h1>
              </div>
            </div>

            <nav className="mt-6 grid gap-3">
              {sections.map((section) => {
                const active = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    className={`app-nav-item ${active ? "app-nav-item-active" : ""}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <span className="app-nav-icon">{section.icon}</span>
                    <span className="min-w-0 text-left">
                      <span className="block text-sm font-semibold">{section.title}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 grid gap-3 rounded-[1.6rem] border border-stone-200/80 bg-[linear-gradient(145deg,#fffdfa,#efe2cf)] p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs tracking-[0.24em] text-stone-500 uppercase">
                    Ink Drops
                  </p>
                  <div className="mt-2 text-3xl font-semibold">{inkDrops}</div>
                </div>
                <div className="rounded-2xl bg-stone-900 px-3 py-2 text-xs text-stone-50">
                  Lv.{level.level} {level.label}
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8d5b2b,#c48c53,#e0b37b)]"
                  style={{ width: `${Math.min(100, (inkDrops / 500) * 100)}%` }}
                />
              </div>
              <div className="grid gap-2 text-sm text-stone-600">
                <span>{books.length} 本書</span>
                <span>{totalReadingMinutes} 分鐘閱讀</span>
                <span>{dueEchoes.length} 則待複習回聲</span>
              </div>
            </div>

            <div className="mt-auto hidden rounded-[1.5rem] border border-stone-200 bg-white/70 p-4 lg:block">
                <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <Trophy className="h-4 w-4" />
                  今日總覽
                </div>
              <div className="mt-4 grid gap-3">
                <MetricMini label="平均進度" value={`${averageProgress}%`} />
                <MetricMini label="收藏金句" value={`${favoriteNotes.length} 則`} />
                <MetricMini label="連續閱讀" value={`${streakDays} 天`} />
                <MetricMini
                  label="回聲完成"
                  value={`${completedEchoes.length} 次`}
                />
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-5">
          <div className="rounded-[2rem] border border-white/60 bg-[#fcfaf6]/90 p-5 shadow-[0_18px_50px_rgba(72,44,18,0.08)] md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                  {currentSection.icon}
                  {currentSection.title}
                </div>
                <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
                  {currentSection.title}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                <MetricMini label="書櫃藏書" value={`${books.length} 本`} />
                <MetricMini label="閱讀總時數" value={`${totalReadingMinutes} 分`} />
                <MetricMini label="待回聲" value={`${dueEchoes.length} 則`} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:hidden">
            {sections.map((section) => (
              <button
                key={section.id}
                className={`app-nav-item ${section.id === activeSection ? "app-nav-item-active" : ""}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="app-nav-icon">{section.icon}</span>
                <span className="min-w-0 text-left">
                  <span className="block text-sm font-semibold">{section.title}</span>
                </span>
              </button>
            ))}
          </div>

          {activeSection === "library" && (
            <>
              <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
                <Panel
                  title="新增書籍"
                  icon={<Plus className="h-5 w-5" />}
                >
                  <div className="mb-4 rounded-[1.5rem] border border-stone-200 bg-white/85 p-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <Field
                        label="書名查找"
                        value={bookSearchQuery}
                        onChange={setBookSearchQuery}
                        placeholder="輸入書名，例如：原子習慣"
                      />
                    </div>
                    {bookSearchLoading ? (
                      <p className="mt-3 text-sm text-stone-600">搜尋中...</p>
                    ) : bookSearchStatus ? (
                      <p className="mt-3 text-sm text-stone-600">{bookSearchStatus}</p>
                    ) : null}
                    {bookSearchResults.length > 0 ? (
                      <div className="mt-4 grid gap-3">
                        {bookSearchResults.map((result) => (
                          <button
                            key={`${result.title}-${result.author}-${result.isbn}`}
                            className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-stone-200 bg-stone-50/90 px-4 py-3 text-left"
                            onClick={() => applyBookResult(result)}
                          >
                            <span>
                              <span className="block font-medium">{result.title}</span>
                              <span className="block text-sm text-stone-500">
                                {result.author || "作者未提供"}
                              </span>
                            </span>
                            <span className="text-sm text-stone-500">選擇</span>
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
                      placeholder="例如：原子習慣"
                    />
                    <Field
                      label="作者"
                      value={bookForm.author}
                      onChange={(value) =>
                        setBookForm((current) => ({ ...current, author: value }))
                      }
                      placeholder="作者名稱"
                    />
                    <Field
                      label="ISBN"
                      value={bookForm.isbn}
                      onChange={(value) =>
                        setBookForm((current) => ({ ...current, isbn: value }))
                      }
                      placeholder="選填"
                    />
                    <Field
                      label="總頁數"
                      value={bookForm.totalPages}
                      onChange={(value) =>
                        setBookForm((current) => ({
                          ...current,
                          totalPages: value,
                        }))
                      }
                      placeholder="320"
                      inputMode="numeric"
                    />
                    <Field
                      label="封面網址"
                      value={bookForm.coverImage}
                      onChange={(value) =>
                        setBookForm((current) => ({
                          ...current,
                          coverImage: value,
                        }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                  <label className="mt-3 block text-sm font-medium text-stone-700">
                    書籍簡介
                    <textarea
                      className="textarea mt-2"
                      value={bookForm.description}
                      onChange={(event) =>
                        setBookForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="提供公開簡介後，系統會用它生成讀前導讀。"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button className="button-primary" onClick={handleAddBook}>
                      <Plus className="h-4 w-4" />
                      加入書櫃
                    </button>
                    {isbnStatus ? (
                      <p className="text-sm text-stone-600">{isbnStatus}</p>
                    ) : null}
                  </div>
                </Panel>

                <Panel
                  title="收藏亮點"
                  icon={<Quote className="h-5 w-5" />}
                >
                  {favoriteNotes[0] ? (
                    <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
                      <div
                        ref={shareCardRef}
                        className="rounded-[1.75rem] bg-[linear-gradient(135deg,#2b2118,#7c5735_45%,#d5a26a)] p-6 text-stone-50 shadow-[0_30px_60px_rgba(52,31,12,0.28)]"
                      >
                        <p className="text-sm tracking-[0.24em] text-stone-200 uppercase">
                          SmartRead Echo Card
                        </p>
                        <p className="mt-6 text-2xl leading-10 font-semibold">
                          “{favoriteNotes[0].rawText.slice(0, 100)}
                          {favoriteNotes[0].rawText.length > 100 ? "..." : ""}”
                        </p>
                        <p className="mt-6 text-sm leading-7 text-stone-200">
                          {favoriteNotes[0].reflection ||
                            "這則金句尚未補上個人心得。"}
                        </p>
                        <div className="mt-8 flex items-center justify-between text-sm text-stone-200">
                          <span>{booksById[favoriteNotes[0].bookId]?.title}</span>
                          <span>@SmartRead Echo</span>
                        </div>
                      </div>
                      <div className="space-y-3 rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                        <button
                          className="button-primary w-full"
                          onClick={() => shareFavorite(favoriteNotes[0])}
                        >
                          <Share2 className="h-4 w-4" />
                          分享
                        </button>
                        <button
                          className="button-secondary w-full"
                          onClick={downloadShareCard}
                        >
                          <Download className="h-4 w-4" />
                          下載卡片
                        </button>
                        <button
                          className="button-secondary w-full"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              createShareText(
                                favoriteNotes[0],
                                booksById[favoriteNotes[0].bookId],
                              ),
                            )
                          }
                        >
                          <Download className="h-4 w-4" />
                          複製文案
                        </button>
                        {shareStatus ? (
                          <div className="rounded-[1.1rem] bg-stone-100 p-3 text-sm text-stone-700">
                            {shareStatus}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/70 p-6 text-sm text-stone-600">
                      先把一則筆記標記為金句收藏，這裡就會顯示分享卡預覽。
                    </div>
                  )}
                </Panel>
              </div>

              <Panel
                title="我的書櫃"
                icon={<BookOpen className="h-5 w-5" />}
              >
                <div className="grid gap-4">
                  {books.map((book) => {
                    const progress = book.totalPages
                      ? Math.round((book.currentPage / book.totalPages) * 100)
                      : 0;

                    return (
                      <article
                        key={book.id}
                        className="grid gap-4 rounded-[1.5rem] border border-stone-200 bg-white/85 p-4 md:grid-cols-[110px_1fr]"
                      >
                        <div
                          className="h-40 rounded-[1.1rem] bg-cover bg-center"
                          style={{
                            backgroundImage: `linear-gradient(180deg,rgba(25,20,16,0.1),rgba(25,20,16,0.45)), url(${book.coverImage || "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80"})`,
                          }}
                        />
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-xl font-semibold">
                                {book.title}
                              </h3>
                              <p className="text-sm text-stone-600">
                                {book.author || "作者未填寫"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <div className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                                {progress}% 已讀
                              </div>
                              <button
                                className="button-secondary"
                                onClick={() => {
                                  setReadingBookId(book.id);
                                  setActiveSection("lab");
                                }}
                              >
                                前往 Reading Lab
                              </button>
                              <button
                                className="button-secondary"
                                onClick={() => deleteBook(book.id)}
                              >
                                刪除
                              </button>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-sm leading-7 text-stone-600">
                            {book.description || "尚未提供簡介。"}
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              className="input max-w-28"
                              type="number"
                              min={0}
                              max={book.totalPages || undefined}
                              value={book.currentPage}
                              onChange={(event) =>
                                updateProgress(book.id, Number(event.target.value))
                              }
                            />
                            <span className="text-sm text-stone-500">
                              / {book.totalPages || "?"} 頁
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#7b4f27,#b5773d,#d5aa73)]"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </Panel>
            </>
          )}

          {activeSection === "lab" && (
            <>
              <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
                <Panel
                  title="Focus Timer"
                  icon={<Clock3 className="h-5 w-5" />}
                >
                  <label className="text-sm font-medium text-stone-700">
                    本次閱讀書籍
                    <select
                      className="input mt-2"
                      value={readingBookId}
                      onChange={(event) => setReadingBookId(event.target.value)}
                    >
                      {books.map((book) => (
                        <option key={book.id} value={book.id}>
                          {book.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-6 text-center">
                    <p className="text-sm tracking-[0.24em] text-stone-500 uppercase">
                      Focus Timer
                    </p>
                    <div className="mt-3 text-6xl font-semibold tracking-tight">
                      {formatMinutes(timerSeconds)}
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[15, 25, 45].map((minutes) => (
                      <button
                        key={minutes}
                        className="button-secondary"
                        onClick={() => {
                          setTimerSeconds(minutes * 60);
                          setTimerRunning(false);
                        }}
                      >
                        {minutes} 分
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="button-primary"
                      onClick={() => setTimerRunning((current) => !current)}
                    >
                      {timerRunning ? "暫停" : "開始閱讀"}
                    </button>
                    <button className="button-secondary" onClick={toggleSound}>
                      {soundOn ? "關閉白噪音" : "開啟白噪音"}
                    </button>
                    <button className="button-secondary" onClick={finishSession}>
                      完成本次閱讀
                    </button>
                  </div>
                </Panel>

                <Panel
                  title="AI 讀前導讀"
                  icon={<Sparkles className="h-5 w-5" />}
                >
                  {guide && selectedBook ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-2xl font-semibold">
                          {selectedBook.title}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-stone-700">
                          {guide.audience}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] bg-[linear-gradient(180deg,#fffef9,#f7ebd8)] p-4">
                        <p className="text-sm tracking-[0.2em] text-stone-500 uppercase">
                          閱讀前可以先想
                        </p>
                        <ol className="mt-3 space-y-3 text-sm leading-7 text-stone-700">
                          {guide.questions.map((question) => (
                            <li key={question} className="flex gap-3">
                              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs text-white">
                                ?
                              </span>
                              <span>{question}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-600">
                      先建立至少一本書，這裡就會出現導讀內容。
                    </p>
                  )}
                </Panel>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
                <Panel
                  title="OCR 採集與筆記工作台"
                  icon={<ScanText className="h-5 w-5" />}
                >
                  <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                      <label className="text-sm font-medium text-stone-700">
                        綁定書籍
                        <select
                          className="input mt-2"
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
                      </label>
                      <label className="mt-4 block text-sm font-medium text-stone-700">
                        書頁照片
                        <input
                          className="mt-2 block w-full text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-stone-900 file:px-4 file:py-2 file:text-sm file:text-white"
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
                      {noteForm.imageDataUrl ? (
                        <div
                          className="mt-4 h-48 rounded-[1.25rem] bg-cover bg-center"
                          style={{ backgroundImage: `url(${noteForm.imageDataUrl})` }}
                        />
                      ) : (
                        <div className="mt-4 flex h-48 items-center justify-center rounded-[1.25rem] border border-dashed border-stone-300 text-sm text-stone-500">
                          尚未選擇圖片
                        </div>
                      )}
                      <p className="mt-3 text-sm leading-6 text-stone-500">
                        {ocrStatus}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field
                          label="頁碼"
                          value={noteForm.page}
                          onChange={(value) =>
                            setNoteForm((current) => ({
                              ...current,
                              page: value,
                            }))
                          }
                          placeholder="42"
                          inputMode="numeric"
                        />
                        <label className="mt-7 flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={noteForm.isFavorite}
                            onChange={(event) =>
                              setNoteForm((current) => ({
                                ...current,
                                isFavorite: event.target.checked,
                              }))
                            }
                          />
                          標記為金句收藏
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-stone-700">
                        OCR 摘錄
                        <textarea
                          className="textarea mt-2 min-h-40"
                          value={noteForm.rawText}
                          onChange={(event) =>
                            setNoteForm((current) => ({
                              ...current,
                              rawText: event.target.value,
                            }))
                          }
                          placeholder="OCR 辨識結果會出現在這裡，你也可以自行修正。"
                        />
                      </label>
                      <label className="block text-sm font-medium text-stone-700">
                        我的心得 / Echo Context
                        <textarea
                          className="textarea mt-2 min-h-32"
                          value={noteForm.reflection}
                          onChange={(event) =>
                            setNoteForm((current) => ({
                              ...current,
                              reflection: event.target.value,
                            }))
                          }
                          placeholder="這段文字對你有什麼意義？之後 Echo 會優先用這裡來提問。"
                        />
                      </label>
                      <button className="button-primary" onClick={saveNote}>
                        <Plus className="h-4 w-4" />
                        {editingNoteId ? "更新筆記" : "儲存私人筆記"}
                      </button>
                    </div>
                  </div>
                </Panel>

                <Panel title="最近閱讀與筆記" icon={<Trophy className="h-5 w-5" />}>
                  <div className="grid gap-3">
                    {recentSessions.map((session) => (
                      <article
                        key={session.id}
                        className="rounded-[1.4rem] border border-stone-200 bg-white/80 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {booksById[session.bookId]?.title || "未命名書籍"}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">
                              {formatDate(session.startedAt)}
                            </p>
                          </div>
                          <div className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                            {session.minutes} 分
                          </div>
                        </div>
                      </article>
                    ))}
                    {notes.slice(0, 4).map((note) => (
                      <article
                        key={note.id}
                        className="rounded-[1.4rem] border border-stone-200 bg-white/80 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {booksById[note.bookId]?.title || "未命名書籍"}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">
                              第 {note.page || "?"} 頁
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="button-secondary"
                              onClick={() => editNote(note)}
                            >
                              編輯
                            </button>
                            <button
                              className="button-secondary"
                              onClick={() => deleteNote(note.id)}
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-stone-700">{note.rawText}</p>
                      </article>
                    ))}
                  </div>
                </Panel>
              </div>
            </>
          )}

          {activeSection === "echo" && (
            <>
              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <Panel
                  title="到期回聲"
                  icon={<Brain className="h-5 w-5" />}
                >
                  <div className="space-y-4">
                    {dueEchoes.length > 0 ? (
                      dueEchoes.map((echo) => (
                        <article
                          key={echo.id}
                          className="rounded-[1.5rem] border border-amber-950/10 bg-[linear-gradient(180deg,#fffdfa,#f7efdf)] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm tracking-[0.2em] text-stone-500 uppercase">
                                Day {echo.day} Echo
                              </p>
                              <h3 className="mt-1 text-lg font-semibold">
                                {echo.book?.title ?? "未命名書籍"}
                              </h3>
                            </div>
                            <button
                              className="button-secondary"
                              onClick={() => completeEcho(echo.id)}
                            >
                              標記已回應
                            </button>
                          </div>
                          <p className="mt-3 text-sm leading-7 text-stone-700">
                            {buildEchoPrompt(echo.note, echo.book)}
                          </p>
                          <div className="mt-3 rounded-[1.1rem] bg-white/80 p-3 text-sm text-stone-600">
                            <span className="font-medium text-stone-800">
                              你的原始心得：
                            </span>{" "}
                            {echo.note.reflection || echo.note.rawText}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/70 p-6 text-sm leading-7 text-stone-600">
                        目前沒有到期的回聲複習。新增筆記後，系統會自動在第 1、7、30
                        天產生複習節點。
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel
                  title="回聲儀表板"
                  icon={<Star className="h-5 w-5" />}
                >
                  <div className="grid gap-4">
                    <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                        <Trophy className="h-4 w-4" />
                        複習表現
                      </div>
                      <ul className="mt-4 space-y-3 text-sm text-stone-600">
                        <li>已收藏金句：{favoriteNotes.length} 則</li>
                        <li>平均閱讀進度：{averageProgress}%</li>
                        <li>完成回聲節點：{completedEchoes.length} 次</li>
                        <li>累積閱讀場次：{sessions.length} 次</li>
                        <li>連續閱讀：{streakDays} 天</li>
                      </ul>
                    </div>

                    <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                        <Quote className="h-4 w-4" />
                        筆記整理
                      </div>
                      <div className="mt-4 grid gap-3">
                        {notes.slice(0, 4).map((note) => (
                          <div
                            key={note.id}
                            className="rounded-[1.1rem] bg-stone-100 p-4 text-sm text-stone-700"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">
                                {booksById[note.bookId]?.title}
                              </span>
                              <span className="text-xs text-stone-500">
                                第 {note.page || "?"} 頁
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2">{note.rawText}</p>
                            {note.reflection ? (
                              <p className="mt-2 text-stone-500">{note.reflection}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                        <Download className="h-4 w-4" />
                        匯出
                      </div>
                      <div className="mt-4 grid gap-3">
                        <button className="button-primary" onClick={exportToNotion}>
                          <Download className="h-4 w-4" />
                          匯出到 Notion
                        </button>
                        <button className="button-secondary" onClick={exportBackup}>
                          <Download className="h-4 w-4" />
                          下載完整備份
                        </button>
                        {notionStatus ? (
                          <div className="rounded-[1.1rem] bg-stone-100 p-3 text-sm text-stone-700">
                            {notionStatus}
                          </div>
                        ) : null}
                        {backupStatus ? (
                          <div className="rounded-[1.1rem] bg-stone-100 p-3 text-sm text-stone-700">
                            {backupStatus}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                        <Trophy className="h-4 w-4" />
                        升級進度
                      </div>
                      <div className="mt-4 grid gap-3">
                        {LEVELS.map((tier) => {
                          const active = tier.level === level.level;
                          const unlocked = level.level >= tier.level;
                          return (
                            <div
                              key={tier.level}
                              className={`rounded-[1.1rem] border px-4 py-3 ${
                                active
                                  ? "border-amber-700/30 bg-amber-50"
                                  : unlocked
                                    ? "border-stone-200 bg-stone-50"
                                    : "border-stone-200 bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">
                                  Lv.{tier.level} {tier.label}
                                </span>
                                <span className="text-xs text-stone-500">
                                  {tier.min}+ Ink
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-stone-600">
                                {tier.unlock}
                              </p>
                            </div>
                          );
                        })}
                        <div className="rounded-[1.1rem] bg-stone-100 p-3 text-sm text-stone-700">
                          {nextLevelConfig
                            ? `距離下一級還差 ${Math.max(0, nextLevelConfig.min - inkDrops)} Ink Drops`
                            : `已達最高等級，當前解鎖：${currentLevelConfig.unlock}`}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                        <GitBranch className="h-4 w-4" />
                        知識圖譜分析
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {conceptGraph.map((concept) => (
                          <div
                            key={concept.term}
                            className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
                          >
                            {concept.term} · {concept.count}
                          </div>
                        ))}
                      </div>
                      {conceptGraph[0] ? (
                        <div className="mt-4 rounded-[1.1rem] bg-stone-100 p-3 text-sm text-stone-700">
                          最近最常出現的主題：{conceptGraph[0].term}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Panel>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/60 bg-[#fcfaf6]/90 p-5 shadow-[0_18px_50px_rgba(72,44,18,0.08)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold">
            {icon}
            {title}
          </div>
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
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="text-sm font-medium text-stone-700">
      {label}
      <input
        className="input mt-2"
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-stone-200 bg-white/80 px-4 py-3">
      <p className="text-xs tracking-[0.2em] text-stone-500 uppercase">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

export default function Home() {
  return <AppShell />;
}
