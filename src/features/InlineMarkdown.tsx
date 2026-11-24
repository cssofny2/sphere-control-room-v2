import { useMemo } from 'react';
import { parseInlineFormatting } from './changelog';

/** Renders inline markdown (`code` and **bold**) as safe React elements. */
export function InlineFormattedText({ text }: { text: string }) {
  const tokens = useMemo(() => parseInlineFormatting(text), [text]);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.kind === 'code') {
          return (
            <code key={i} className="changelog-inline-code">
              {tok.value}
            </code>
          );
        }
        if (tok.kind === 'strong') {
          return (
            <strong key={i} className="font-semibold text-zinc-100">
              {tok.value}
            </strong>
          );
        }
        return <span key={i}>{tok.value}</span>;
      })}
    </>
  );
}
