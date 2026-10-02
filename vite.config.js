import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isUserSite = repositoryName?.endsWith('.github.io');

export default defineConfig({
  // GitHub Pages project sites live under /<repository-name>/.
  // Keep root-relative paths during local development and for user sites.
  base: repositoryName && !isUserSite ? `/${repositoryName}/` : '/',
});
