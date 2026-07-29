import { Tag } from 'antd';
import { gradeColor } from '../theme';
import type { Grade } from '../types';

export function GradeTag({ grade }: { grade: Grade | null }) {
  if (!grade) return <Tag color="default">—</Tag>;
  return (
    <Tag color={gradeColor[grade]} style={{ fontWeight: 600, minWidth: 28, textAlign: 'center' }}>
      {grade}
    </Tag>
  );
}
