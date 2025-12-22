/**
 * XML Viewer Component with Syntax Highlighting
 * Used forFormat and highlight XML content shared component
 */

// XML formatting function
export function formatXml(xml: string): string {
  if (!xml) return '';

  try {
    // Remove extra whitespace, but preserve line structure
    let formatted = xml.replace(/>\s+</g, '>\n<');

    const PADDING = '  ';
    let pad = 0;
    const lines: string[] = [];

    formatted.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Handle multiple tags in one line
      const parts = trimmed.split(/(?<=>)(?=<)/);

      parts.forEach((part) => {
        const p = part.trim();
        if (!p) return;

        // Closing tag
        if (p.match(/^<\/[^>]+>$/)) {
          pad = Math.max(0, pad - 1);
          lines.push(PADDING.repeat(pad) + p);
        }
        // Self-closing tag
        else if (p.match(/^<[^>]+\/>$/)) {
          lines.push(PADDING.repeat(pad) + p);
        }
        // Opening and closing on the same line <tag>content</tag>
        else if (p.match(/^<[^\/][^>]*>[^<]+<\/[^>]+>$/)) {
          lines.push(PADDING.repeat(pad) + p);
        }
        // Opening tag
        else if (p.match(/^<[^\/][^>]*>$/)) {
          lines.push(PADDING.repeat(pad) + p);
          pad++;
        }
        // Plain text or other
        else {
          lines.push(PADDING.repeat(pad) + p);
        }
      });
    });

    return lines.join('\n');
  } catch {
    return xml;
  }
}

// Token Type
type TokenType = 'bracket' | 'tag' | 'attr' | 'value' | 'text' | 'equals' | 'quote';

interface Token {
  type: TokenType;
  value: string;
}

// Parse XML as tokens
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Space - treat as text
    if (line[i] === ' ' || line[i] === '\t') {
      let space = '';
      while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
        space += line[i];
        i++;
      }
      tokens.push({ type: 'text', value: space });
      continue;
    }

    // < or </ or />
    if (line[i] === '<') {
      if (line[i + 1] === '/') {
        tokens.push({ type: 'bracket', value: '</' });
        i += 2;
      } else if (line[i + 1] === '?') {
        tokens.push({ type: 'bracket', value: '<?' });
        i += 2;
      } else if (line[i + 1] === '!') {
        tokens.push({ type: 'bracket', value: '<!' });
        i += 2;
      } else {
        tokens.push({ type: 'bracket', value: '<' });
        i++;
      }

      // Read tag name
      let tagName = '';
      while (i < line.length && /[\w:-]/.test(line[i])) {
        tagName += line[i];
        i++;
      }
      if (tagName) {
        tokens.push({ type: 'tag', value: tagName });
      }
      continue;
    }

    // > or /> or ?>
    if (line[i] === '>') {
      tokens.push({ type: 'bracket', value: '>' });
      i++;
      continue;
    }

    if (line[i] === '/' && line[i + 1] === '>') {
      tokens.push({ type: 'bracket', value: '/>' });
      i += 2;
      continue;
    }

    if (line[i] === '?' && line[i + 1] === '>') {
      tokens.push({ type: 'bracket', value: '?>' });
      i += 2;
      continue;
    }

    // = symbol
    if (line[i] === '=') {
      tokens.push({ type: 'equals', value: '=' });
      i++;
      continue;
    }

    // Value within quotes
    if (line[i] === '"') {
      tokens.push({ type: 'quote', value: '"' });
      i++;
      let value = '';
      while (i < line.length && line[i] !== '"') {
        value += line[i];
        i++;
      }
      if (value) {
        tokens.push({ type: 'value', value });
      }
      if (line[i] === '"') {
        tokens.push({ type: 'quote', value: '"' });
        i++;
      }
      continue;
    }

    // Attribute name (Identifier inside tag, outside quotes)
    if (/[\w:-]/.test(line[i])) {
      let name = '';
      while (i < line.length && /[\w:-]/.test(line[i])) {
        name += line[i];
        i++;
      }
      // Check if followed by =，if so, then it'sAttribute name
      if (line[i] === '=') {
        tokens.push({ type: 'attr', value: name });
      } else {
        tokens.push({ type: 'text', value: name });
      }
      continue;
    }

    // Other characters as text
    tokens.push({ type: 'text', value: line[i] });
    i++;
  }

  return tokens;
}

// XML Syntax highlighting component
export function XmlHighlight({ xml }: { xml: string }) {
  const formatted = formatXml(xml);
  const lines = formatted.split('\n');

  return (
    <pre className="xml-content">
      {lines.map((line, lineIndex) => {
        const tokens = tokenizeLine(line);

        return (
          <div key={lineIndex} className="xml-line">
            <span className="xml-line-number">{lineIndex + 1}</span>
            <code className="xml-code">
              {tokens.map((token, tokenIndex) => {
                const className = {
                  bracket: 'xml-bracket',
                  tag: 'xml-tag',
                  attr: 'xml-attr',
                  value: 'xml-value',
                  equals: 'xml-equals',
                  quote: 'xml-quote',
                  text: ''
                }[token.type];

                return className ? (
                  <span key={tokenIndex} className={className}>{token.value}</span>
                ) : (
                  <span key={tokenIndex}>{token.value}</span>
                );
              })}
            </code>
          </div>
        );
      })}
    </pre>
  );
}

// XML styles (inject as global styles)
export const xmlStyles = `
  .xml-content {
    margin: 0;
    padding: 0.5rem 0;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.8125rem;
    line-height: 1.8;
    color: #e2e8f0;
    overflow-x: auto;
    background: transparent;
  }

  .xml-line {
    display: flex;
    padding: 0 1rem;
    min-height: 1.5em;
  }

  .xml-line:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .xml-line-number {
    display: inline-block;
    min-width: 2.5rem;
    padding-right: 1rem;
    text-align: right;
    color: #475569;
    user-select: none;
    flex-shrink: 0;
    border-right: 1px solid #334155;
    margin-right: 1rem;
  }

  .xml-code {
    white-space: pre;
  }

  .xml-bracket {
    color: #94a3b8;
  }

  .xml-tag {
    color: #f472b6;
    font-weight: 500;
  }

  .xml-attr {
    color: #a5b4fc;
  }

  .xml-value {
    color: #86efac;
  }

  .xml-equals {
    color: #94a3b8;
  }

  .xml-quote {
    color: #86efac;
  }
`;
