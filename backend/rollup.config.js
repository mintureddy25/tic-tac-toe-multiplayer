import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

// Custom plugin to strip 'export' keywords from output
// Nakama's goja runtime doesn't support ES modules
function stripExports() {
  return {
    name: 'strip-exports',
    renderChunk(code) {
      return code.replace(/^export /gm, '');
    }
  };
}

export default {
  input: 'src/main.ts',
  output: {
    file: 'build/index.js',
    format: 'es',
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
    stripExports(),
  ],
};
