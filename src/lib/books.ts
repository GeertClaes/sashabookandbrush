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
