# SmartRead Echo PRD

## 1. Product Summary

**SmartRead Echo** is a reading companion focused on knowledge retention rather than simple note capture. The product helps users turn book reading into long-term memory through:

- OCR-based private excerpt capture
- AI-generated pre-reading guidance
- post-reading reflection prompts
- spaced-repetition "Echo" reminders
- gamified progression and unlocks

The product's core promise is:

> We do not try to store the book for the user. We help the user remember what they personally learned from the book.

---

## 2. Product Goals

### Primary goals

- Increase reading completion rate
- Increase note-taking frequency during reading
- Improve long-term recall of personally captured ideas
- Build a habit loop around daily reading

### Non-goals

- Do not build a public quote library
- Do not store or reconstruct entire books
- Do not provide unauthorized full-text search across copyrighted books
- Do not replace ebook reader products

---

## 3. Target Users

### Core users

- Heavy readers of nonfiction
- Students and self-learners
- Knowledge workers who read to apply ideas
- Readers already using Notion, Readwise, or manual note systems

### User pain points

- "I read a lot, but forget most of it."
- "I underline things, but never revisit them."
- "My notes are scattered across notebooks, screenshots, and apps."
- "I need motivation to keep reading consistently."

---

## 4. Core Value Proposition

SmartRead Echo combines three loops:

1. **Capture loop**: scan, save, reflect
2. **Memory loop**: revisit, answer, connect
3. **Motivation loop**: earn, unlock, streak

The moat is not OCR alone or AI alone, but the combination of:

- private user-generated note capture
- memory-aware prompt timing
- personalized follow-up based on the user's own reflections

---

## 5. Recommended Technical Stack

| Layer | Recommended Tech | Rationale |
| :--- | :--- | :--- |
| Mobile app | React Native with Expo | Fast cross-platform delivery, camera support, notifications, audio, OTA updates |
| Backend | Supabase | Auth, Postgres, storage, edge functions, row-level security |
| AI layer | OpenAI API or Gemini API | Summary, prompting, guided Q&A, semantic extraction |
| OCR | Google Cloud Vision API | Strong Traditional Chinese OCR support |
| Book metadata | Google Books API | ISBN lookup, title, author, cover, description |
| Push notifications | Expo Notifications or OneSignal | Echo reminder delivery |
| Analytics | PostHog or Amplitude | Habit loop and retention analysis |

---

## 6. Functional Modules

### 6.1 Book Management

#### Features

- Scan ISBN barcode
- Auto-fetch title, author, cover, publisher, description
- Manual book creation fallback
- Track current page and reading percentage
- Estimate time remaining based on reading speed

#### MVP scope

- ISBN scan
- Manual add/edit/delete
- Book detail page
- Reading progress update

#### Edge cases

- ISBN not found in Google Books
- Multiple editions returned
- Missing cover image
- Books without ISBN

---

### 6.2 OCR Capture and Private Notes

#### Features

- Capture book page image
- OCR text extraction
- Let user trim, edit, and confirm OCR result before saving
- Add reflection or personal takeaway
- Mark note as favorite or key quote

#### Product rule

The OCR result is a user-private study artifact. It must not be publicly exposed by default.

#### Legal guardrails

- Limit OCR capture to user-initiated scans only
- No bulk import of book pages
- No continuous scanning mode for full-book digitization
- No public feed for raw OCR text
- Share cards must limit quoted text length and include source attribution

#### MVP scope

- Single-page capture
- OCR result review screen
- Save note with reflection

#### Future scope

- multi-image batch capture
- handwriting support
- smart excerpt grouping

---

### 6.3 Reading Lab

#### Features

- Focus timer
- Ambient sound options
- Reading session history
- AI pre-reading guide
- AI post-reading reflection prompts

#### AI pre-reading guide

Inputs:

- public book metadata
- public description or preview text

Outputs:

- "Who this book is for"
- 3 pre-reading questions
- optional reading strategy suggestion

#### AI post-reading reflection

Inputs:

- user's notes only
- user's prior reflections only

Outputs:

- recall prompts
- synthesis questions
- application questions

#### Hard constraint

The AI must not invent or quote internal book passages unless they exist in the user's own saved notes.

---

### 6.4 Echo Reminder System

#### Purpose

Use spaced repetition to help users revisit their own captured ideas.

#### Reminder cadence

- Day 1
- Day 7
- Day 30

#### Reminder content logic

- Select note from user-owned notes only
- Extract concepts, themes, or unresolved questions
- Generate reflection prompt in natural language

Example:

> Last time you noted "systems thinking" in this book. What new example of it have you noticed this week?

#### Rules

- Never send raw long OCR text in notifications
- Prefer short prompts and deep links into the app
- Allow user snooze, skip, and frequency settings

#### MVP scope

- fixed spaced repetition schedule
- one prompt per reminder
- push notification with deep link

#### Future scope

- adaptive scheduling based on response behavior
- note difficulty rating
- personalized interval tuning

---

### 6.5 Gamification and Unlocks

#### Currency

**Ink Drops** are earned by:

- daily reading
- creating notes
- writing reflections
- completing Echo prompts
- maintaining streaks

#### Levels

- **Lv.1 Reader**: basic reading and note capture
- **Lv.2 Explorer**: unlock AI pre-reading guide
- **Lv.3 Thinker**: unlock AI Q&A on personal notes
- **Lv.4 Architect**: unlock Notion sync and knowledge graph views

#### Product psychology goals

- reward frequency early
- reduce cold-start drop-off
- make AI features feel earned
- encourage reflection rather than passive accumulation

#### Risk to avoid

Do not over-optimize for vanity metrics like note count alone. Rewards should favor meaningful behaviors such as reflection and review completion.

---

### 6.6 Social Sharing

#### Features

- Generate aesthetic share card
- Include book cover, short quote, and personal reflection
- Export story-sized and feed-friendly formats
- Suggest Threads caption copy

#### Copyright controls

- limit OCR-derived shared quote to 100 characters
- require source metadata on card
- do not allow export of full OCR block

#### MVP scope

- 1 card template
- 9:16 story export
- plain caption suggestion

---

### 6.7 Integrations

#### Notion sync

Available at Lv.4:

- sync book metadata
- sync user reflections
- sync favorite notes

#### Design principle

Only sync user-created or user-confirmed content. Do not sync raw unreviewed OCR by default.

---

## 7. User Stories

### MVP user stories

- As a reader, I want to scan a book ISBN so I do not need to enter metadata manually.
- As a reader, I want to photograph a page and save the OCR text to my private notes.
- As a reader, I want to add my own reflection to an OCR note so the note becomes personally meaningful.
- As a reader, I want to track reading progress so I can see momentum.
- As a reader, I want to receive reminders about my saved notes later so I remember what I learned.
- As a reader, I want small rewards for reading consistently so I stay motivated.

### Phase 2 user stories

- As a reader, I want AI to suggest questions before I start reading.
- As a reader, I want AI to ask me follow-up questions based on my own notes.
- As a reader, I want to export a beautiful share card from a favorite note.

---

## 8. Detailed MVP Scope

### In scope

- Email or OAuth login
- Book CRUD
- ISBN lookup
- reading progress updates
- OCR capture and note save
- reflection input
- favorite note tagging
- focus timer
- basic Ink Drops
- fixed Echo reminders
- push notifications

### Out of scope

- Public social feed
- full-text book ingestion
- multi-user collaboration
- marketplace or creator economy features
- advanced semantic graph visualization

---

## 9. Success Metrics

### Activation

- percentage of new users who add first book
- percentage of new users who save first note within 24 hours

### Engagement

- average reading sessions per week
- notes saved per active user
- reflections written per active user
- Echo reminder open rate

### Retention

- D7 retention
- D30 retention
- percentage of users completing at least one reminder cycle

### Quality

- OCR correction rate
- AI prompt usefulness rating
- notification dismiss vs respond rate

---

## 10. Legal, Privacy, and Security Requirements

### IP compliance principles

- All long-term recall content must come from user-generated or user-confirmed content
- AI outputs must rely on public metadata or user notes
- The system must not reconstruct full books from OCR snippets

### Security requirements

- Encrypt notes at rest where feasible
- Enforce row-level security in Supabase
- Use signed URLs for private image storage
- Log AI access to note content for auditability
- Allow user deletion and data export

### Privacy UX requirements

- Clearly state that OCR captures are private by default
- Explain what data is sent to AI providers
- Let users opt out of AI processing for notes

---

## 11. System Architecture

### Client

- React Native app
- camera, notifications, local cache, audio playback

### Backend

- Supabase Postgres
- Supabase Storage for captured images
- Supabase Auth
- Edge Functions for:
  - OCR request proxy
  - AI prompt generation
  - reminder scheduling
  - integration sync jobs

### Third-party services

- Google Books API
- Google Cloud Vision API
- OpenAI API or Gemini API

### Architecture principles

- Keep OCR and AI keys server-side only
- Do not call premium APIs directly from mobile client
- Maintain audit logs for OCR and AI jobs

---

## 12. Suggested Data Model

The original schema is a good start, but the engineering team will likely need a few more tables to support notifications, reading sessions, and AI logs.

```sql
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    author TEXT,
    isbn TEXT,
    cover_image TEXT,
    publisher TEXT,
    description TEXT,
    total_pages INTEGER,
    current_page INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    raw_ocr_text TEXT,
    reflection TEXT,
    is_favorite BOOLEAN DEFAULT false,
    source_page INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    book_id UUID REFERENCES books(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    ambient_sound TEXT
);

CREATE TABLE gamification_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    ink_drops INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE echo_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE ai_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
    book_id UUID REFERENCES books(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    input_summary JSONB,
    output_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 13. API and Service Boundaries

### Mobile app to backend

- `POST /books/isbn-lookup`
- `POST /books`
- `PATCH /books/:id/progress`
- `POST /notes/ocr`
- `POST /notes`
- `POST /reading-sessions/start`
- `POST /reading-sessions/end`
- `POST /echo/:id/complete`
- `POST /ai/pre-reading-guide`
- `POST /ai/note-question`

### Backend responsibilities

- validate ownership
- redact oversized OCR content if needed
- enforce share limits
- mediate all AI and OCR provider calls

---

## 14. Notification Logic

### Initial strategy

- Create Echo review jobs when a note is created
- Schedule 3 records immediately for day 1, day 7, day 30
- Send short push copy only
- Deep link user to the note reflection screen

### If user responds

- award Ink Drops
- store completed timestamp
- optionally generate one follow-up question

### If user ignores

- mark skipped or expired
- do not spam retries without user setting

---

## 15. Engineering Risks and Mitigations

### Risk 1: OCR quality on Traditional Chinese

Mitigation:

- use server-side OCR provider abstraction
- allow user review and correction before save
- log OCR confidence where possible

### Risk 2: AI hallucination or over-quoting

Mitigation:

- prompt strictly from public metadata and user notes
- add content filters for long direct quotes
- log prompt source classes

### Risk 3: Notification fatigue

Mitigation:

- start with low-frequency fixed cadence
- add snooze and mute controls early

### Risk 4: Gamification feels shallow

Mitigation:

- reward reflection depth and review completion, not only page count
- keep early unlocks achievable

### Risk 5: Legal ambiguity around OCR use

Mitigation:

- keep content private by default
- add sharing length limits
- prohibit public raw OCR browsing

---

## 16. Delivery Roadmap

### Phase 1: MVP foundation (4 weeks)

- Supabase project setup
- auth and row-level security
- book CRUD
- Google Books integration
- OCR capture flow
- note storage

### Phase 2: Guided reading experience (3 weeks)

- focus timer
- ambient sound
- AI pre-reading guide
- note reflection UX improvements

### Phase 3: Retention engine (3 weeks)

- Echo scheduling
- push notifications
- Ink Drops and level system
- reminder completion flow

### Phase 4: Sharing and ecosystem (2 weeks)

- share card generator
- Threads/IG export
- Notion integration

---

## 17. Recommended Build Order for Engineers

1. Set up Supabase schema, RLS, and storage policies
2. Implement auth and book management
3. Implement OCR capture and note confirmation flow
4. Add reading sessions and timer
5. Add Echo scheduling and push delivery
6. Add gamification triggers
7. Add AI guidance and Q&A
8. Add share card generation and Notion sync

---

## 18. Prompt Guardrails for AI Features

### Pre-reading prompt guardrail

- Only use public book metadata and description
- Do not claim knowledge of full book contents unless provided by approved public sources

### Note reflection prompt guardrail

- Use only user note text and user reflection
- Do not generate long direct quotes
- Ask reflective or applicative questions, not factual recall of unseen pages

### Share content guardrail

- Enforce quote length limits before generation
- Always attach source fields when quote text is present

---

## 19. Final Recommendation

This product is strongest when positioned as a **private memory companion for readers**, not as a content extraction tool. The engineering team should optimize for:

- fast capture
- safe private storage
- high-quality reminder timing
- reflective AI interactions

If tradeoffs emerge, prioritize the **Echo loop** over purely decorative features. The core retention experience is the true differentiator.
