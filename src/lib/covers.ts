import type { ImageMetadata } from "astro";

const modules = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/covers/*.{jpg,jpeg,png,webp}",
  { eager: true },
);

export function coverModule(cover?: string): ImageMetadata | undefined {
  const filename = String(cover || "").split("/").pop() || "";
  if (!filename) return undefined;
  const match = Object.entries(modules).find(([key]) => key.endsWith(`/${filename}`));
  return match?.[1].default;
}
