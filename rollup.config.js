import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: {
    file: 'soporte-widget.js',
    format: 'iife',
    name: 'SoporteWidget',
    sourcemap: 'inline',
    globals: {
      'signalr': 'signalR'
    }
  },
  external: ['signalr'],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
      sourceMap: true,
      inlineSources: true
    }),
    terser({
      sourceMap: true,
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: ['console.log']
      },
      output: {
        comments: false
      }
    })
  ]
};
