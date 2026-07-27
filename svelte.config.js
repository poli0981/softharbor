// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// Explicit so vite-plugin-svelte stops falling back to defaults with a warning
// (and so `svelte-check`/editors resolve the same preprocessor as the build).
import { vitePreprocess } from '@astrojs/svelte';

export default {
  preprocess: vitePreprocess(),
};
