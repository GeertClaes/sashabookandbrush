// Book search, queues, the featured board, and filling the book editor.
// Filtering is pure. Rendering reads the search box and writes list HTML.
import { escapeHtml } from "./admin-format.js";
import { sortByOrderThenTitle } from "./admin-lists.js";

export const BOOK_QUEUES = [
  "currently-reading",
  "featured",
  "five-star-no-note",
  "no-note",
  "missing-isbn",
];

export function defaultQueueId(books) {
  return books.some((book) => book.status === "currently-reading")
    ? "currently-reading"
    : "five-star-no-note";
}

export function searchQuery() {
  return (document.querySelector("[data-search]")?.value || "").trim().toLowerCase();
}

export function countQueue(books, id) {
  if (id === "currently-reading")
    return books.filter((book) => book.status === "currently-reading").length;
  if (id === "featured") return books.filter((book) => book.featured).length;
  if (id === "five-star-no-note")
    return books.filter((book) => book.rating === 5 && !String(book.note || "").trim()).length;
  if (id === "no-note") return books.filter((book) => !String(book.note || "").trim()).length;
  if (id === "missing-isbn") return books.filter((book) => !book.isbn && !book.isbn10).length;
  return 0;
}

export function filterQueue(books, queue, query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (q.length >= 2) {
    return books.filter((book) =>
      `${book.title} ${book.author} ${book.slug}`.toLowerCase().includes(q),
    );
  }
  if (queue === "currently-reading")
    return books.filter((book) => book.status === "currently-reading");
  if (queue === "featured") return sortByOrderThenTitle(books.filter((book) => book.featured));
  if (queue === "five-star-no-note") {
    return books.filter((book) => book.rating === 5 && !String(book.note || "").trim());
  }
  if (queue === "no-note") return books.filter((book) => !String(book.note || "").trim());
  if (queue === "missing-isbn") return books.filter((book) => !book.isbn && !book.isbn10);
  return [];
}

export function featuredBooks(books) {
  return sortByOrderThenTitle(books.filter((book) => book.featured));
}

export function nextQueuedBook(books, queue, currentBook) {
  if (!currentBook) return null;
  const list = filterQueue(books, queue, searchQuery());
  const index = list.findIndex((book) => book.slug === currentBook.slug);
  if (index < 0) return list[0] || null;
  return list[index + 1] || null;
}

function bookRow(book, selected) {
  const badges = [];
  if (book.rating > 0) badges.push(`${book.rating}★`);
  badges.push(String(book.note || "").trim() ? "Note" : "No note");
  if (book.featured) badges.push("Home");
  if (!book.isbn && !book.isbn10) badges.push("No ISBN");
  const badgeHtml = badges
    .map((label) => {
      const accent = label === "No note" || label === "No ISBN";
      return `<span class="${accent ? "text-accent" : "text-muted-foreground"}">${escapeHtml(label)}</span>`;
    })
    .join(" · ");
  const cover = book.coverUrl
    ? `<img src="${escapeHtml(book.coverUrl)}" alt="" class="h-14 w-9 shrink-0 rounded object-cover bg-muted" />`
    : `<span class="h-14 w-9 shrink-0 rounded bg-muted"></span>`;
  const ring = selected ? "border-primary bg-muted" : "border-border hover:border-primary";
  return `<li><button type="button" class="flex w-full items-start gap-3 rounded-lg border px-2 py-2 text-left ${ring}" data-slug="${escapeHtml(book.slug)}">${cover}<span class="min-w-0 flex-1"><span class="font-medium text-foreground">${escapeHtml(book.title)}</span><span class="mt-0.5 block text-xs text-muted-foreground">${escapeHtml(book.author)}</span><span class="mt-1 block text-xs">${badgeHtml}</span></span></button></li>`;
}

export function paintBookQueue({ books, queue }) {
  const query = searchQuery();
  document.querySelectorAll("[data-queue]").forEach((button) => {
    const on = button.dataset.queue === queue && query.length < 2;
    button.setAttribute("aria-selected", on ? "true" : "false");
    button.classList.toggle("border-accent", on);
    button.classList.toggle("text-foreground", on);
    button.classList.toggle("border-transparent", !on);
    button.classList.toggle("text-muted-foreground", !on);
  });
  document.querySelectorAll("[data-queue-n]").forEach((el) => {
    el.textContent = String(countQueue(books, el.getAttribute("data-queue-n") || ""));
  });
}

export function paintNextButton(books, queue, currentBook) {
  const button = document.querySelector("[data-book-next]");
  if (!button) return;
  const next = nextQueuedBook(books, queue, currentBook);
  button.classList.toggle("hidden", !next);
  if (next) button.textContent = "Next →";
}

export function renderBookQueue({ results, books, queue, currentBook }) {
  if (!results) return;
  paintBookQueue({ books, queue });
  const matches = filterQueue(books, queue, searchQuery());
  const q = searchQuery();
  const searching = q.length >= 2;
  const cap = searching || queue === "no-note" ? 40 : matches.length;
  const shown = matches.slice(0, cap);
  const count = document.querySelector("[data-queue-count]");
  if (count) {
    if (searching) {
      count.textContent =
        shown.length < matches.length
          ? `${shown.length} of ${matches.length} matches`
          : `${matches.length} match${matches.length === 1 ? "" : "es"}`;
    } else {
      count.textContent =
        shown.length < matches.length
          ? `Showing ${shown.length} of ${matches.length}`
          : `${matches.length} book${matches.length === 1 ? "" : "s"}`;
    }
  }
  results.innerHTML = shown.length
    ? shown.map((book) => bookRow(book, currentBook?.slug === book.slug)).join("")
    : `<li class="px-1 py-6 text-center text-muted-foreground">${searching ? "No titles match." : "Nothing in this list."}</li>`;
  paintNextButton(books, queue, currentBook);
}

export function renderFeaturedBoard(books) {
  const list = document.querySelector("[data-featured-board]");
  const count = document.querySelector("[data-featured-count]");
  const featured = featuredBooks(books);
  if (count) {
    count.textContent =
      featured.length > 8
        ? `Featured ${featured.length} / target 6–8 — maybe rotate one off before adding.`
        : `Featured ${featured.length} / target 6–8`;
  }
  if (!list) return;
  if (!featured.length) {
    list.innerHTML = `<li class="text-muted-foreground">No featured books yet.</li>`;
    return;
  }
  list.innerHTML = featured
    .map((book, index) => {
      const cover = book.coverUrl
        ? `<img src="${escapeHtml(book.coverUrl)}" alt="" class="h-10 w-7 shrink-0 rounded object-cover bg-muted" />`
        : `<span class="h-10 w-7 shrink-0 rounded bg-muted"></span>`;
      return `<li class="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5" data-featured-slug="${escapeHtml(book.slug)}">${cover}<span class="w-4 text-xs text-muted-foreground">${index + 1}</span><button type="button" class="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground" data-featured-open>${escapeHtml(book.title)}</button><button type="button" class="rounded border border-border px-2 py-1 text-xs" data-featured-up ${index === 0 ? "disabled" : ""}>↑</button><button type="button" class="rounded border border-border px-2 py-1 text-xs" data-featured-down ${index === featured.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="rounded border border-border px-2 py-1 text-xs" data-featured-off>Remove</button></li>`;
    })
    .join("");
}

export function fillBookEditor(book, options, deps) {
  const {
    currentBook,
    setCurrentBook,
    confirmLeave,
    bookEditor,
    displayUrl,
    resetDrop,
    updateBuyPreview,
    updateNoteCount,
    bookFormState,
    setBookSnapshot,
    renderQueue,
    syncUrl,
  } = deps;
  if (currentBook && currentBook.slug !== book.slug && !confirmLeave()) return;
  setCurrentBook(book);
  bookEditor?.classList.remove("hidden");
  document.querySelector("[data-book-empty]")?.classList.add("hidden");
  const heading = document.querySelector("[data-book-heading]");
  if (heading) heading.textContent = book.title;
  document.querySelector("[data-book-title]").value = book.title;
  document.querySelector("[data-book-author]").value = book.author;
  document.querySelector("[data-book-genre]").value =
    book.genre === "Read" || book.genre === "Currently reading" ? "" : book.genre;
  document.querySelector("[data-book-note]").value = book.note || "";
  document.querySelector("[data-book-featured]").checked = book.featured;
  document.querySelector("[data-book-isbn]").value = book.isbn || "";
  document.querySelector("[data-book-isbn10]").value = book.isbn10 || "";
  document.querySelector("[data-book-bookshop]").value = displayUrl(book.bookshop);
  document.querySelector("[data-book-amazon]").value = displayUrl(book.amazon);
  const view = document.querySelector("[data-book-view]");
  if (view) view.href = `/books/${book.slug}`;
  const bits = [];
  if (book.rating) bits.push(`${book.rating}★ on Goodreads`);
  if (book.status === "currently-reading") bits.push("Currently reading");
  else if (book.dateRead) bits.push(`Read ${book.dateRead}`);
  document.querySelector("[data-book-meta]").textContent = bits.join(" · ");
  resetDrop(
    "book",
    book.coverUrl || "",
    book.cover ? `Current cover: ${book.cover}. Drop a new photo to replace it.` : "",
  );
  updateBuyPreview();
  updateNoteCount();
  setBookSnapshot(bookFormState());
  renderQueue();
  if (!options.skipUrl) syncUrl();
  if (window.matchMedia("(max-width: 1023px)").matches) {
    bookEditor?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
