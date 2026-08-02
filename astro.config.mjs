// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://24klabs.ai',
  output: 'static',
  integrations: [sitemap()],
});
