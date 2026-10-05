import { rolldown } from 'rolldown';
import { fileURLToPath } from 'node:url';

// Bundle the real pure TS modules into memory, with no generated test files.
export async function loadTypeScript(url) {
  const bundle = await rolldown({ input: fileURLToPath(url) });
  try {
    const { output } = await bundle.generate({ format: 'esm' });
    const chunk = output.find(item => item.type === 'chunk' && item.isEntry);
    if (!chunk) throw new Error('Missing test module.');
    return await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  } finally {
    await bundle.close();
  }
}
