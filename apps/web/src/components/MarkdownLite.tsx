import type { CSSProperties, ReactNode } from 'react';

// 粗体=重点，用淡黄底 highlight 呈现
const hlStyle: CSSProperties = { background: '#fef08a', padding: '0 3px', borderRadius: 3, fontWeight: 600 };

/** 行内标记：**粗体(黄底重点)** __粗体__ *斜体* `代码` [文字](链接) */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) {
      nodes.push(<strong key={key++} style={hlStyle}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith('__')) {
      nodes.push(<strong key={key++} style={hlStyle}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith('`')) {
      nodes.push(
        <code key={key++} style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4, fontSize: '0.92em' }}>
          {t.slice(1, -1)}
        </code>,
      );
    } else if (t.startsWith('[')) {
      const mm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      nodes.push(
        <a key={key++} href={mm?.[2]} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
          {mm?.[1]}
        </a>,
      );
    } else {
      nodes.push(<em key={key++}>{t.slice(1, -1)}</em>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isHr = (l: string) => /^\s*([-*_])\1{2,}\s*$/.test(l);
// 整行斜体（* … *，全行仅一对星号）——避免被误判为项目符号
const isWholeEmph = (l: string) => /^\s*\*\s+.*\*\s*$/.test(l) && (l.match(/\*/g) || []).length === 2;
const isUl = (l: string) => /^\s*[-*]\s+/.test(l) && !isWholeEmph(l);
const isOl = (l: string) => /^\s*\d+[.)]\s+/.test(l);
const isH = (l: string) => /^#{1,6}\s+/.test(l);

// Markdown 表格
const splitRow = (l: string): string[] =>
  l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isTableRow = (l: string) => l.includes('|') && /\|/.test(l.trim());
const isTableSep = (l: string) => {
  if (!l.includes('|')) return false;
  const cells = splitRow(l);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
};
const thStyle: CSSProperties = { border: '1px solid #cbd5e1', padding: '4px 8px', background: '#f1f5f9', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' };
const tdStyle: CSSProperties = { border: '1px solid #e2e8f0', padding: '4px 8px', whiteSpace: 'nowrap' };

/** 轻量 Markdown 渲染（零依赖），够用于 AI 助手输出：标题 / 粗斜体 / 行内码 / 有序无序列表 / 段落。 */
export function MarkdownLite({ text }: { text: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i++;
      continue;
    }
    if (isHr(line)) {
      blocks.push(<hr key={key++} style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />);
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const size = (h[1] ?? '').length === 1 ? 16 : (h[1] ?? '').length === 2 ? 15 : 14;
      blocks.push(
        <div key={key++} style={{ fontWeight: 700, fontSize: size, margin: '6px 0 2px' }}>
          {renderInline(h[2] ?? '')}
        </div>,
      );
      i++;
      continue;
    }
    // 表格：当前行是 | ... |，且下一行是分隔行 | :--- | :--- |
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1] ?? '')) {
      const header = splitRow(line);
      i += 2; // 跳过表头 + 分隔行
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i] ?? '') && !isTableSep(lines[i] ?? '') && (lines[i] ?? '').trim()) {
        rows.push(splitRow(lines[i] ?? ''));
        i++;
      }
      blocks.push(
        <div key={key++} style={{ overflowX: 'auto', margin: '6px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {header.map((h2, hi) => (
                  <th key={hi} style={thStyle}>
                    {renderInline(h2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {header.map((_, ci) => (
                    <td key={ci} style={tdStyle}>
                      {renderInline(r[ci] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (isUl(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && isUl(lines[i] ?? '')) {
        items.push(<li key={items.length}>{renderInline((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''))}</li>);
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: '4px 0', paddingInlineStart: 18 }}>
          {items}
        </ul>,
      );
      continue;
    }
    if (isOl(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && isOl(lines[i] ?? '')) {
        items.push(<li key={items.length}>{renderInline((lines[i] ?? '').replace(/^\s*\d+[.)]\s+/, ''))}</li>);
        i++;
      }
      blocks.push(
        <ol key={key++} style={{ margin: '4px 0', paddingInlineStart: 20 }}>
          {items}
        </ol>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && (lines[i] ?? '').trim() && !isUl(lines[i] ?? '') && !isOl(lines[i] ?? '') && !isH(lines[i] ?? '') && !isHr(lines[i] ?? '')) {
      para.push(lines[i] ?? '');
      i++;
    }
    blocks.push(
      <p key={key++} style={{ margin: '4px 0' }}>
        {para.map((l, idx) => (
          <span key={idx}>
            {renderInline(l)}
            {idx < para.length - 1 && <br />}
          </span>
        ))}
      </p>,
    );
  }
  return <div style={{ lineHeight: 1.6 }}>{blocks}</div>;
}
