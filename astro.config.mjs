import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://sashabookandbrush.com",
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/admin"),
      namespaces: { news: false, xhtml: false, video: false },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
