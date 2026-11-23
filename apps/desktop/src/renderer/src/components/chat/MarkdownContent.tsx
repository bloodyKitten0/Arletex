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
  // Pre-process math delimiters: convert \[ ... \] to $$ ... $$, and \( ... \) to $ ... $
  const processedContent = useMemo(() => {
    if (!content) return '';
    return content
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `\n$$\n${math.trim()}\n$$\n`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => `$${math.trim()}$`);
  }, [content]);

  return (
    <div
      className={`markdown-body ${isUser ? 'user-markdown' : 'assistant-markdown'}`}
      style={{
        fontSize: '15px',
        lineHeight: '1.65',
        color: isUser ? 'var(--human-text-primary, #ffffff)' : '#ede9e3',
        wordBreak: 'break-word',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
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
