/**
 * XML Viewer Component with Syntax Highlighting
 * 用于格式化并高亮显示 XML 内容的共享组件
 */

// XML 格式化函数
export function formatXml(xml: string): string {
  if (!xml) return '';

  try {
    // 移除多余空白，但保留换行结构
    let formatted = xml.replace(/>\s+</g, '>\n<');

    const PADDING = '  ';
    let pad = 0;
    const lines: string[] = [];

    formatted.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // 处理一行中的多个标签
      const parts = trimmed.split(/(?<=>)(?=<)/);

      parts.forEach((part) => {
        const p = part.trim();
        if (!p) return;

        // 结束标签
        if (p.match(/^<\/[^>]+>$/)) {
          pad = Math.max(0, pad - 1);
          lines.push(PADDING.repeat(pad) + p);
        }
        // 自闭合标签
        else if (p.match(/^<[^>]+\/>$/)) {
          lines.push(PADDING.repeat(pad) + p);
        }
        // 开始和结束在同一行 <tag>content</tag>
        else if (p.match(/^<[^\/][^>]*>[^<]+<\/[^>]+>$/)) {
          lines.push(PADDING.repeat(pad) + p);
        }
        // 开始标签
        else if (p.match(/^<[^\/][^>]*>$/)) {
          lines.push(PADDING.repeat(pad) + p);
          pad++;
        }
        // 纯文本或其他
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

// Token 类型
type TokenType = 'bracket' | 'tag' | 'attr' | 'value' | 'text' | 'equals' | 'quote';

interface Token {
  type: TokenType;
  value: string;
}

// 解析 XML 行为 tokens
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // 空格 - 作为文本处理
    if (line[i] === ' ' || line[i] === '\t') {
      let space = '';
      while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
        space += line[i];
        i++;
      }
      tokens.push({ type: 'text', value: space });
      continue;
    }

    // < 或 </ 或 />
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

      // 读取标签名
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

    // > 或 /> 或 ?>
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

    // = 符号
    if (line[i] === '=') {
      tokens.push({ type: 'equals', value: '=' });
      i++;
      continue;
    }

    // 引号内的值
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

    // 属性名 (在标签内，非引号内的标识符)
    if (/[\w:-]/.test(line[i])) {
      let name = '';
      while (i < line.length && /[\w:-]/.test(line[i])) {
        name += line[i];
        i++;
      }
      // 检查后面是否有 =，如果有则是属性名
      if (line[i] === '=') {
        tokens.push({ type: 'attr', value: name });
      } else {
        tokens.push({ type: 'text', value: name });
      }
      continue;
    }

    // 其他字符作为文本
    tokens.push({ type: 'text', value: line[i] });
    i++;
  }

  return tokens;
}

// XML 语法高亮组件
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

// XML 样式（作为全局样式注入）
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
