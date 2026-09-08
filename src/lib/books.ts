export function bookHref(id: string) {
  return `/books/${id}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonthYear(value?: string) {
  if (!value) return "";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

export function formatFullDate(value?: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return formatMonthYear(value);
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function reviewExcerpt(note: string, length = 160) {
  const compact = note.replace(/\s+/g, " ").trim();
  if (compact.length <= length) return compact;
  return `${compact.slice(0, length).trim()}…`;
}

export function pageLength(pages: number) {
  if (pages < 200) return { label: "A slim one", bars: 1 };
  if (pages < 280) return { label: "A one-sitting read", bars: 2 };
  if (pages < 360) return { label: "A solid sit", bars: 3 };
  if (pages < 480) return { label: "A long soak", bars: 4 };
  return { label: "A doorstop", bars: 5 };
}

export function rereadLabel(count: number) {
  if (count === 2) return "Read twice";
  if (count === 3) return "A third time through";
  return `Read ${count} times`;
}
