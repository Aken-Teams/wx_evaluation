import type { ReactNode } from 'react';

/** 行内标记：**粗体** *斜体* `代码` */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) {
      nodes.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith('`')) {
      nodes.push(
        <code key={key++} style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4, fontSize: '0.92em' }}>
          {t.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key++}>{t.slice(1, -1)}</em>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isUl = (l: string) => /^\s*[-*]\s+/.test(l);
const isOl = (l: string) => /^\s*\d+[.)]\s+/.test(l);
const isH = (l: string) => /^#{1,3}\s+/.test(l);

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
    const h = line.match(/^(#{1,3})\s+(.*)$/);
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
    while (i < lines.length && (lines[i] ?? '').trim() && !isUl(lines[i] ?? '') && !isOl(lines[i] ?? '') && !isH(lines[i] ?? '')) {
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
