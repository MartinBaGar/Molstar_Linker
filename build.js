import esbuild from 'esbuild';
const entryPoints = ['src/background.ts','src/content.ts','src/sandbox.ts',
                     'src/viewer.ts','src/popup.ts','src/options.ts'];
esbuild.build({ entryPoints, bundle: true, outdir: 'dist', platform: 'browser' });
