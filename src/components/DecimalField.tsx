import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TextField } from '@mui/material';

interface DecimalFieldProps {
  value: number | null | undefined;
  onCommit: (value: number) => void;      // 提交數值（已 clamp；失焦時另做吸附/格式化）
  min?: number;
  max?: number;
  disabled?: boolean;
  width?: number;
  snap?: number;                          // 失焦時吸附到此步進的整數倍（如 0.5）；不設則不吸附
  decimals?: number;                      // 顯示/失焦格式化的小數位數；不設則採最簡表示
  emptyDefault?: number;                  // 清空後失焦時回填的預設值；不設則還原為原值
}

const fmt = (v: number, decimals?: number) =>
  decimals != null ? v.toFixed(decimals) : String(v);

// 受控小數輸入框：以本地文字狀態承接自然輸入（含中間態如 "99." 與清空），
// 編輯中不被外部值覆蓋，失焦時再吸附步進、夾在範圍內並格式化。
const DecimalField: React.FC<DecimalFieldProps> = ({
  value, onCommit, min = 0, max = 100, disabled, width = 80, snap, decimals, emptyDefault,
}) => {
  const toText = useCallback(
    (v: number | null | undefined) => (v === null || v === undefined ? '' : fmt(v, decimals)),
    [decimals]
  );
  const [text, setText] = useState<string>(toText(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;   // 編輯中不覆蓋使用者輸入
    setText(toText(value));
  }, [value, toText]);

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;   // 僅允許數字與單一小數點
    setText(raw);
    if (raw === '') return;                                // 編輯中允許暫時空白，不立即提交
    const v = parseFloat(raw);
    if (isNaN(v)) return;                                  // 如僅輸入 "."，保留文字暫不提交
    onCommit(clamp(v));
  }, [onCommit, clamp]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    e.target.select();
  }, []);

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    const v = parseFloat(text);
    if (text === '' || isNaN(v)) {
      if (emptyDefault !== undefined) { setText(fmt(emptyDefault, decimals)); onCommit(emptyDefault); }
      else setText(toText(value));
      return;
    }
    let out = clamp(v);
    if (snap != null && snap > 0) out = Math.round(out / snap) * snap;
    out = Math.round(out * 1000) / 1000;                  // 去除浮點誤差
    setText(fmt(out, decimals));
    onCommit(out);
  }, [text, emptyDefault, decimals, clamp, snap, onCommit, toText, value]);

  return (
    <TextField
      variant="outlined"
      size="small"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      inputProps={{ inputMode: 'decimal', style: { textAlign: 'center', width } }}
    />
  );
};

export default React.memo(DecimalField);
