import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var vendorChunk = function (id) {
    var normalizedId = id.replace(/\\/g, '/');
    if (!normalizedId.includes('/node_modules/'))
        return undefined;
    if (/\/node_modules\/(react|react-dom|scheduler|react-router-dom|@remix-run\/router)\//.test(normalizedId))
        return 'vendor-react';
    if (/\/node_modules\/@supabase\//.test(normalizedId))
        return 'vendor-supabase';
    if (/\/node_modules\/posthog-js\//.test(normalizedId))
        return 'vendor-analytics';
    return undefined;
};
export default defineConfig({
    plugins: [react()],
    build: { rollupOptions: { output: { manualChunks: vendorChunk } } },
});
