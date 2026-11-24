import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownContentProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, isUser = false }) => {
  // Pre-process math delimiters: convert \[ ... \] to $$ ... $$, \( ... \) to $ ... $,
  // and auto-wrap standalone formulas / mathematical tokens so KaTeX renders cleanly
  const processedContent = useMemo(() => {
    if (!content) return '';

    // 1. Standardize display and inline delimiters
    let text = content
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `\n$$\n${math.trim()}\n$$\n`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => `$${math.trim()}$`);

    // 2. Normalize single-line display math: "$$ formula $$" -> "\n$$\nformula\n$$\n"
    text = text.replace(/^\$\$\s*([^\$\n]+?)\s*\$\$$/gm, (_m, math) => `\n$$\n${math.trim()}\n$$\n`);

    // 3. Normalize opening "$$ formula" on same line without closing -> "$$\nformula"
    text = text.replace(/^\$\$\s*([^\$\n]+)$/gm, (_m, math) => `$$\n${math.trim()}`);

    // 4. Process line-by-line for standalone equations and bare LaTeX tokens
    const lines = text.split('\n');
    let inCodeBlock = false;
    let inMathBlock = false;

    const processedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        return line;
      }
      if (inCodeBlock) return line;

      // Track $$ blocks
      const dollarCount = (trimmed.match(/\$\$/g) || []).length;
      if (dollarCount % 2 === 1) {
        inMathBlock = !inMathBlock;
        return line;
      }
      if (inMathBlock) return line;

      // Check if a line is a standalone equation missing $$ delimiters
      const isStandaloneEquation =
        !trimmed.startsWith('$') &&
        !trimmed.endsWith('$') &&
        (
          /^(?:[a-zA-Z0-9_{}\\]+\s*=\s*)?\\frac\{/.test(trimmed) ||
          /^(?:\\frac|\\partial|\\sum|\\int|\\prod|\\lim)\b/.test(trimmed) ||
          /^[a-zA-Z_][a-zA-Z0-9_{}^()]*\s*=\s*.*(?:\\frac|\\ln|\\exp|\\lambda|\\sigma|\\gamma|\\Sigma|\\approx).*$/.test(trimmed)
        ) &&
        !/[a-zA-Z]{5,}\s+[a-zA-Z]{5,}\s+[a-zA-Z]{5,}/.test(trimmed); // not regular English sentences

      if (isStandaloneEquation) {
        return `\n$$\n${trimmed}\n$$\n`;
      }

      // Convert common unescaped inline symbols in prose (e.g. \lambda_I, \sigma_a^X, \phi_0, t_{\text{max}})
      if (!line.includes('$')) {
        return line.replace(
          /(^|[\s(])(\\[a-zA-Z]+(?:_[a-zA-Z0-9{}]+|\^[a-zA-Z0-9{}]+)+(?:[\^a-zA-Z0-9{}_]*))($|[\s),.:;!?])/g,
          '$1$$$2$$$3',
        );
      }

      return line;
    });

    let result = processedLines.join('\n');

    // 5. Auto-close unclosed $$ blocks (essential for live token streaming & interrupted turns)
    const displayDollarMatches = result.match(/\$\$/g) || [];
    if (displayDollarMatches.length % 2 !== 0) {
      result += '\n$$\n';
    }

    return result;
  }, [content]);

  return (
    <div
      className={`markdown-body ${isUser ? 'user-markdown' : 'assistant-markdown'}`}
      style={{
        fontSize: '15px',
        lineHeight: '1.65',
        color: isUser ? 'var(--human-text-primary, #ffffff)' : '#ede9e3',
        wordBreak: 'break-word',
        letterSpacing: 'normal',
      }}
    >
      <style>{`
        .markdown-body {
          letter-spacing: normal !important;
        }
        .markdown-body .katex {
          line-height: 1.2 !important;
          letter-spacing: normal !important;
          font-size: 1.05em;
          text-rendering: auto;
          color: inherit;
        }
        .markdown-body .katex * {
          letter-spacing: normal !important;
        }
        .markdown-body .katex-display {
          margin: 1.25em 0 !important;
          padding: 16px 20px !important;
          background: #090c10 !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          text-align: center !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45) !important;
        }
        .markdown-body .katex-display > .katex {
          text-align: center !important;
          display: inline-block !important;
          white-space: nowrap !important;
          color: inherit;
        }
        .markdown-body .katex-display .katex-html {
          overflow-x: auto;
          overflow-y: hidden;
          padding: 4px 0;
          color: inherit;
        }
        /* Suppress empty placeholder cards if KaTeX produces empty output */
        .markdown-body .katex-display:empty,
        .markdown-body .katex-display:has(.katex-html:empty) {
          display: none !important;
        }
        .markdown-body .katex-error {
          color: #e07a5f !important;
          background: rgba(224, 122, 95, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 10px 0', lineHeight: 1.65 }}>{children}</p>,
          h1: ({ children }) => (
            <h1
              style={{
                fontSize: '18px',
                fontWeight: 700,
                margin: '14px 0 8px 0',
                color: 'var(--human-accent-warm, #e07a5f)',
              }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 600,
                margin: '12px 0 6px 0',
                color: 'var(--human-accent-warm, #e07a5f)',
              }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '10px 0 4px 0', color: '#f4a261' }}>
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: '6px 0 10px 20px', padding: 0, listStyleType: 'disc' }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: '6px 0 10px 20px', padding: 0, listStyleType: 'decimal' }}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li style={{ marginBottom: '4px', lineHeight: 1.6 }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: '3px solid var(--human-accent-warm, #e07a5f)',
                paddingLeft: '12px',
                margin: '8px 0',
                color: 'rgba(255,255,255,0.7)',
                fontStyle: 'italic',
              }}
            >
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.09)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.88em',
                    fontFamily: 'monospace',
                    color: '#f4a261',
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre
                style={{
                  backgroundColor: 'rgba(15, 20, 25, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  overflowX: 'auto',
                  fontSize: '13px',
                  margin: '10px 0',
                }}
              >
                <code className={className} style={{ fontFamily: 'monospace' }} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '10px 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th
              style={{
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '6px 10px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                textAlign: 'left',
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px' }}>
              {children}
            </td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
