/*
 * Bundelt src/app.js + three.js + jsPDF tot één klassiek script (app.bundle.js).
 * Klassiek script i.p.v. een ES-module, zodat index.html ook rechtstreeks vanaf
 * de schijf (file://) werkt, zonder webserver en zonder internet.
 *
 *   npm install && npm run build
 */
import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/app.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020', 'safari14'],
  minify: true,
  legalComments: 'none',
  outfile: 'app.bundle.js',
  logLevel: 'info'
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/app.js …');
} else {
  await esbuild.build(options);
}
