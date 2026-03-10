const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    },
};

const sharedBuildOptions = {
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin],
};

async function main() {
    fs.mkdirSync(path.join(__dirname, 'dist', 'worker'), { recursive: true });

    const extCtx = await esbuild.context({
        ...sharedBuildOptions,
        entryPoints: ['src/extension.ts'],
        outfile: 'dist/extension.js',
        external: ['vscode'],
    });

    const workerCtx = await esbuild.context({
        ...sharedBuildOptions,
        entryPoints: ['src/worker/formatWorker.ts'],
        outfile: 'dist/worker/formatWorker.js',
    });

    if (watch) {
        await Promise.all([extCtx.watch(), workerCtx.watch()]);
    } else {
        await extCtx.rebuild();
        await workerCtx.rebuild();
        await extCtx.dispose();
        await workerCtx.dispose();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
