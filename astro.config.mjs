// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Actions でビルドするときは、deploy.yml が SITE と BASE を渡す。
// ローカル（npm run dev）では base は "/" のまま。
export default defineConfig({
  site: process.env.SITE,
  base: process.env.BASE || '/',
});
