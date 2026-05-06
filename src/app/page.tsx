"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import {
  BookOpen,
  Brain,
  Clock3,
  Layers3,
  Library,
  Lock,
  Plus,
  Quote,
  ScanText,
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

const STORAGE_KEY = "smartread-echo-state";
const ECHO_DAYS = [1, 7, 30];

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
  const keyword = note.reflection.split(/[，。、；：「」\s]/).find(Boolean) || "這個想法";
  return `你上次在《${book?.title ?? "這本書"}》提到「${keyword}」，這週有沒有新的例子或行動可以呼應它？`;
}

function AppShell() {
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
  const [ocrStatus, setOcrStatus] = useState("上傳書頁照片後，系統會在瀏覽器內執行 OCR");
  const [readingBookId, setReadingBookId] = useState(demoBooks[0]?.id ?? "");
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [referenceNow] = useState(() => Date.now());

  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
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
      JSON.stringify({ books, notes, sessions, completedEchoes }),
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
    const sessionDrops = sessions.reduce((sum, session) => sum + Math.floor(session.minutes / 5) * 4, 0);
    const noteDrops = notes.length * 12;
    const reflectionDrops = notes.filter((note) => note.reflection.trim().length > 20).length * 10;
    const echoDrops = completedEchoes.length * 15;
    const streakBonus = sessions.length >= 3 ? 25 : 0;
    return sessionDrops + noteDrops + reflectionDrops + echoDrops + streakBonus;
  }, [completedEchoes.length, notes, sessions]);

  const level = levelForInk(inkDrops);

  const totalReadingMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const averageProgress =
    books.length > 0
      ? Math.round(
          books.reduce((sum, book) => sum + (book.totalPages ? book.currentPage / book.totalPages : 0), 0) /
            books.length *
            100,
        )
      : 0;

  const dueEchoes = useMemo(() => {
    return notes
      .flatMap((note) =>
        ECHO_DAYS.map((day) => {
          const echoKey = `${note.id}-${day}`;
          const dueAt = new Date(note.createdAt).getTime() + day * 24 * 60 * 60 * 1000;
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

  async function lookupIsbn() {
    if (!bookForm.isbn.trim()) {
      setIsbnStatus("請先輸入 ISBN");
      return;
    }

    setIsbnStatus("查詢中...");

    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(bookForm.isbn.trim())}`,
      );
      const data = (await response.json()) as {
        items?: Array<{
          volumeInfo?: {
            title?: string;
            authors?: string[];
            description?: string;
            pageCount?: number;
            imageLinks?: { thumbnail?: string };
          };
        }>;
      };
      const volume = data.items?.[0]?.volumeInfo;

      if (!volume) {
        setIsbnStatus("找不到這本書，仍然可以手動建立");
        return;
      }

      setBookForm((current) => ({
        ...current,
        title: volume.title ?? current.title,
        author: volume.authors?.join(", ") ?? current.author,
        description: volume.description ?? current.description,
        totalPages: volume.pageCount ? String(volume.pageCount) : current.totalPages,
        coverImage: volume.imageLinks?.thumbnail?.replace("http://", "https://") ?? current.coverImage,
      }));
      setIsbnStatus("已從 Google Books 帶入資料");
    } catch {
      setIsbnStatus("查詢失敗，請稍後再試或直接手動輸入");
    }
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
  }

  function updateProgress(bookId: string, currentPage: number) {
    setBooks((current) =>
      current.map((book) =>
        book.id === bookId
          ? {
              ...book,
              currentPage: Math.max(0, Math.min(currentPage, book.totalPages || currentPage)),
            }
          : book,
      ),
    );
  }

  async function runOcr(file: File) {
    setOcrStatus("辨識中，第一次使用會先下載語言模型...");
    setNoteForm((current) => ({ ...current, imageDataUrl: URL.createObjectURL(file) }));

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
      id: uid("note"),
      bookId: noteForm.bookId,
      page: Number(noteForm.page || 0),
      rawText: noteForm.rawText.trim(),
      reflection: noteForm.reflection.trim(),
      isFavorite: noteForm.isFavorite,
      imageDataUrl: noteForm.imageDataUrl,
      createdAt: new Date().toISOString(),
    };

    setNotes((current) => [nextNote, ...current]);
    setNoteForm((current) => ({
      ...current,
      page: "",
      rawText: "",
      reflection: "",
      isFavorite: false,
      imageDataUrl: "",
    }));
    setOcrStatus("筆記已進入你的私有回聲資料庫");
  }

  function completeEcho(echoId: string) {
    setCompletedEchoes((current) => [...current, echoId]);
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
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 md:px-8 lg:px-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-[#fdfaf4]/90 p-6 shadow-[0_24px_80px_rgba(72,44,18,0.12)] backdrop-blur md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-950/10 bg-white/70 px-3 py-1 text-xs font-medium tracking-[0.24em] text-amber-950/70 uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                SmartRead Echo MVP
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl">
                  把讀過的內容，變成會回來找你的記憶。
                </h1>
                <p className="max-w-2xl text-base leading-8 text-stone-700 md:text-lg">
                  這是一個可在一天內交付的 SmartRead Echo MVP。它已經把書籍管理、OCR 摘錄、回聲複習、
                  閱讀計時與遊戲化獎勵串成同一條使用流程，並以本地私有資料為核心，避免版權風險。
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard
                  icon={<Library className="h-4 w-4" />}
                  label="書櫃藏書"
                  value={`${books.length} 本`}
                  helper="支援 ISBN 自動帶入"
                />
                <MetricCard
                  icon={<Clock3 className="h-4 w-4" />}
                  label="累積閱讀"
                  value={`${totalReadingMinutes} 分鐘`}
                  helper="MVP 先以本地紀錄"
                />
                <MetricCard
                  icon={<Brain className="h-4 w-4" />}
                  label="待回聲複習"
                  value={`${dueEchoes.length} 則`}
                  helper="1 / 7 / 30 天節奏"
                />
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-stone-200/80 bg-[linear-gradient(145deg,#fffdfa,#efe2cf)] p-5 shadow-inner">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm tracking-[0.24em] text-stone-500 uppercase">Ink Drops</p>
                  <h2 className="mt-2 text-4xl font-semibold">{inkDrops}</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    Lv.{level.level} {level.label}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-900 px-3 py-2 text-sm text-stone-50">
                  專屬數位閱讀艙
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8d5b2b,#c48c53,#e0b37b)]"
                  style={{ width: `${Math.min(100, (inkDrops / 500) * 100)}%` }}
                />
              </div>
              <div className="mt-5 grid gap-3">
                <UnlockCard
                  unlocked
                  title="Lv.1 讀者"
                  description="書籍建立、閱讀進度、OCR 私人摘錄"
                />
                <UnlockCard
                  unlocked={level.level >= 2}
                  title="Lv.2 探索者"
                  description="AI 讀前導讀與 3 個預設思考問題"
                />
                <UnlockCard
                  unlocked={level.level >= 3}
                  title="Lv.3 思辨家"
                  description="依照你的筆記進行回聲提問"
                />
                <UnlockCard
                  unlocked={level.level >= 4}
                  title="Lv.4 架構師"
                  description="Notion 同步與知識圖譜"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel
            title="書籍管理"
            icon={<BookOpen className="h-5 w-5" />}
            description="可手動建立，也可先輸入 ISBN 後自動帶入公開資料。"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="ISBN"
                value={bookForm.isbn}
                onChange={(value) => setBookForm((current) => ({ ...current, isbn: value }))}
                placeholder="978..."
              />
              <div className="flex items-end">
                <button className="button-secondary w-full" onClick={lookupIsbn}>
                  透過 Google Books 查詢
                </button>
              </div>
              <Field
                label="書名"
                value={bookForm.title}
                onChange={(value) => setBookForm((current) => ({ ...current, title: value }))}
                placeholder="例如：原子習慣"
              />
              <Field
                label="作者"
                value={bookForm.author}
                onChange={(value) => setBookForm((current) => ({ ...current, author: value }))}
                placeholder="作者名稱"
              />
              <Field
                label="總頁數"
                value={bookForm.totalPages}
                onChange={(value) => setBookForm((current) => ({ ...current, totalPages: value }))}
                placeholder="320"
                inputMode="numeric"
              />
              <Field
                label="封面網址"
                value={bookForm.coverImage}
                onChange={(value) => setBookForm((current) => ({ ...current, coverImage: value }))}
                placeholder="https://..."
              />
            </div>
            <label className="mt-3 block text-sm font-medium text-stone-700">
              書籍簡介
              <textarea
                className="textarea mt-2"
                value={bookForm.description}
                onChange={(event) =>
                  setBookForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="提供公開簡介後，系統會用它生成讀前導讀。"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="button-primary" onClick={handleAddBook}>
                <Plus className="h-4 w-4" />
                加入書櫃
              </button>
              <p className="text-sm text-stone-600">{isbnStatus}</p>
            </div>

            <div className="mt-6 grid gap-4">
              {books.map((book) => {
                const progress = book.totalPages ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
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
                          <h3 className="text-xl font-semibold">{book.title}</h3>
                          <p className="text-sm text-stone-600">{book.author || "作者未填寫"}</p>
                        </div>
                        <div className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                          {progress}% 已讀
                        </div>
                      </div>
                      <p className="line-clamp-2 text-sm leading-7 text-stone-600">{book.description || "尚未提供簡介。"}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          className="input max-w-28"
                          type="number"
                          min={0}
                          max={book.totalPages || undefined}
                          value={book.currentPage}
                          onChange={(event) => updateProgress(book.id, Number(event.target.value))}
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

          <Panel
            title="Reading Lab"
            icon={<Clock3 className="h-5 w-5" />}
            description="專注計時、白噪音與 AI 讀前引導整合在同一頁。"
          >
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
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
                  <p className="text-sm tracking-[0.24em] text-stone-500 uppercase">Focus Timer</p>
                  <div className="mt-3 text-6xl font-semibold tracking-tight">{formatMinutes(timerSeconds)}</div>
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
                  <button className="button-primary" onClick={() => setTimerRunning((current) => !current)}>
                    {timerRunning ? "暫停" : "開始閱讀"}
                  </button>
                  <button className="button-secondary" onClick={toggleSound}>
                    {soundOn ? "關閉白噪音" : "開啟白噪音"}
                  </button>
                  <button className="button-secondary" onClick={finishSession}>
                    完成本次閱讀
                  </button>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-500">
                  白噪音由瀏覽器即時生成，不需額外音檔。完成閱讀後會轉為 Ink Drops。
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-stone-200 bg-[linear-gradient(180deg,#fffef9,#f7ebd8)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                  <Sparkles className="h-4 w-4" />
                  AI 讀前導讀
                </div>
                {guide && selectedBook ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold">{selectedBook.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-stone-700">{guide.audience}</p>
                    </div>
                    <div className="rounded-[1.25rem] bg-white/80 p-4">
                      <p className="text-sm tracking-[0.2em] text-stone-500 uppercase">閱讀前可以先想</p>
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
                    <div className="rounded-[1.25rem] border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-600">
                      這個 MVP 的 AI 導讀先使用公開簡介與本地規則生成，之後可無痛替換為 OpenAI 或 Gemini API。
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-stone-600">先建立至少一本書，這裡就會出現導讀內容。</p>
                )}
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel
            title="OCR 採集與筆記"
            icon={<ScanText className="h-5 w-5" />}
            description="所有摘錄都先進入私有筆記欄，分享時再做長度限制。"
          >
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                <label className="text-sm font-medium text-stone-700">
                  綁定書籍
                  <select
                    className="input mt-2"
                    value={noteForm.bookId}
                    onChange={(event) => setNoteForm((current) => ({ ...current, bookId: event.target.value }))}
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
                <p className="mt-3 text-sm leading-6 text-stone-500">{ocrStatus}</p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label="頁碼"
                    value={noteForm.page}
                    onChange={(value) => setNoteForm((current) => ({ ...current, page: value }))}
                    placeholder="42"
                    inputMode="numeric"
                  />
                  <label className="mt-7 flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={noteForm.isFavorite}
                      onChange={(event) =>
                        setNoteForm((current) => ({ ...current, isFavorite: event.target.checked }))
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
                      setNoteForm((current) => ({ ...current, rawText: event.target.value }))
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
                      setNoteForm((current) => ({ ...current, reflection: event.target.value }))
                    }
                    placeholder="這段文字對你有什麼意義？之後 Echo 會優先用這裡來提問。"
                  />
                </label>
                <button className="button-primary" onClick={saveNote}>
                  <Plus className="h-4 w-4" />
                  儲存私人筆記
                </button>
              </div>
            </div>
          </Panel>

          <Panel
            title="Echo 回聲複習"
            icon={<Brain className="h-5 w-5" />}
            description="提醒內容只來自使用者自己的摘錄與心得，不重建書本全文。"
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
                        <p className="text-sm tracking-[0.2em] text-stone-500 uppercase">Day {echo.day} Echo</p>
                        <h3 className="mt-1 text-lg font-semibold">{echo.book?.title ?? "未命名書籍"}</h3>
                      </div>
                      <button className="button-secondary" onClick={() => completeEcho(echo.id)}>
                        標記已回應
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-700">{buildEchoPrompt(echo.note, echo.book)}</p>
                    <div className="mt-3 rounded-[1.1rem] bg-white/80 p-3 text-sm text-stone-600">
                      <span className="font-medium text-stone-800">你的原始心得：</span> {echo.note.reflection || echo.note.rawText}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/70 p-6 text-sm leading-7 text-stone-600">
                  目前沒有到期的回聲複習。新增筆記後，系統會自動在第 1、7、30 天產生複習節點。
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <Trophy className="h-4 w-4" />
                    遊戲化狀態
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-stone-600">
                    <li>已收藏金句：{favoriteNotes.length} 則</li>
                    <li>平均閱讀進度：{averageProgress}% </li>
                    <li>完成回聲節點：{completedEchoes.length} 次</li>
                    <li>累積閱讀場次：{sessions.length} 次</li>
                  </ul>
                </div>

                <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <Layers3 className="h-4 w-4" />
                    合規守則
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-stone-600">
                    <li>提醒內容只使用使用者自行建立或確認過的資料。</li>
                    <li>原始 OCR 文字預設不公開，也不做全文瀏覽。</li>
                    <li>後續分享卡會限制引用長度並標注來源。</li>
                  </ul>
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel
            title="分享卡與品牌展示"
            icon={<Quote className="h-5 w-5" />}
            description="先提供可視化預覽，下一步可接 html-to-image 或社群匯出流程。"
          >
            {favoriteNotes[0] ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
                <div className="rounded-[1.75rem] bg-[linear-gradient(135deg,#2b2118,#7c5735_45%,#d5a26a)] p-6 text-stone-50 shadow-[0_30px_60px_rgba(52,31,12,0.28)]">
                  <p className="text-sm tracking-[0.24em] text-stone-200 uppercase">SmartRead Echo Card</p>
                  <p className="mt-6 text-2xl leading-10 font-semibold">
                    “{favoriteNotes[0].rawText.slice(0, 100)}{favoriteNotes[0].rawText.length > 100 ? "..." : ""}”
                  </p>
                  <p className="mt-6 text-sm leading-7 text-stone-200">
                    {favoriteNotes[0].reflection || "這則金句尚未補上個人心得。"}
                  </p>
                  <div className="mt-8 flex items-center justify-between text-sm text-stone-200">
                    <span>{booksById[favoriteNotes[0].bookId]?.title}</span>
                    <span>@SmartRead Echo</span>
                  </div>
                </div>
                <div className="space-y-3 rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
                  <h3 className="text-lg font-semibold">匯出策略</h3>
                  <p className="text-sm leading-7 text-stone-600">
                    目前已完成視覺分享卡預覽。若要進一步支援 Instagram Stories 與 Threads，一個很輕量的下一步是加入
                    `html-to-image` 下載 PNG，再根據平台切換比例模板。
                  </p>
                  <div className="rounded-[1.1rem] bg-stone-100 p-3 text-sm text-stone-700">
                    OCR 文字分享上限：100 字內，並附上書名來源。
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/70 p-6 text-sm text-stone-600">
                先把一則筆記標記為金句收藏，這裡就會自動生成分享卡預覽。
              </div>
            )}
          </Panel>

          <Panel
            title="進階能力"
            icon={<Star className="h-5 w-5" />}
            description="示範權限解鎖節奏，保留未來與外部服務接軌空間。"
          >
            <div className="grid gap-4">
              <FutureCard
                title="與作者對話"
                enabled={level.level >= 3}
                description="以你的摘錄與心得為上下文，生成延伸追問與思辨路線。"
              />
              <FutureCard
                title="Notion 自動同步"
                enabled={level.level >= 4}
                description="同步書籍資料、金句收藏與個人反思到指定資料庫。"
              />
              <FutureCard
                title="知識圖譜分析"
                enabled={false}
                description="把不同書籍裡反覆出現的概念串成個人主題地圖。"
              />
            </div>
          </Panel>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-stone-200/80 bg-white/85 p-4">
      <div className="flex items-center gap-2 text-sm text-stone-600">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <p className="mt-2 text-sm text-stone-500">{helper}</p>
    </div>
  );
}

function UnlockCard({
  unlocked,
  title,
  description,
}: {
  unlocked: boolean;
  title: string;
  description: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[1.15rem] border px-4 py-3 ${
        unlocked
          ? "border-amber-800/20 bg-white/75 text-stone-800"
          : "border-stone-200 bg-stone-100/70 text-stone-500"
      }`}
    >
      {unlocked ? <Star className="mt-0.5 h-4 w-4" /> : <Lock className="mt-0.5 h-4 w-4" />}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm">{description}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
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
          <p className="mt-2 text-sm leading-7 text-stone-600">{description}</p>
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

function FutureCard({
  title,
  enabled,
  description,
}: {
  title: string;
  enabled: boolean;
  description: string;
}) {
  return (
    <article
      className={`rounded-[1.5rem] border p-4 ${
        enabled ? "border-amber-900/20 bg-white/85" : "border-stone-200 bg-stone-100/80"
      }`}
    >
      <div className="flex items-center gap-2">
        {enabled ? <Star className="h-4 w-4 text-amber-800" /> : <Lock className="h-4 w-4 text-stone-500" />}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-7 text-stone-600">{description}</p>
    </article>
  );
}

export default function Home() {
  return <AppShell />;
}
