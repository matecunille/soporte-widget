import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.js',
  output: {
    file:  'soporte-widget.min.js',
    format: 'iife',
    name: 'SoporteWidget',
    plugins: [terser({
      compress: {
        drop_console: false,
        drop_debugger: true
      },
      output: {
        comments: false
      }
    })]
  }
};