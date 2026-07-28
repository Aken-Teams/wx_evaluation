import React, { useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Box, Paper, Typography } from '@mui/material';

interface TrendChartProps {
  data: Array<{
    year?: number;
    month?: number;
    vendorName?: string;
    assessmentScore?: number | null;
    考核得分?: number | null;
    考核分數?: number | null;
    [key: string]: any;
  }>;
  title?: string;
  dataKey?: string;
  onDownload?: (imageDataUrl: string) => void;
}

const TrendChart: React.FC<TrendChartProps> = ({
  data,
  title = '趨勢圖',
  dataKey = 'assessmentScore',
  onDownload,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const hasScore = (item: any) => {
    const score = item[dataKey] ?? item.考核得分 ?? item.考核分數;
    return score !== null && score !== undefined;
  };

  // 判斷是否為「單一月份、多供應商」排名（X 軸應為供應商名稱）
  const uniquePeriods = new Set(
    data.filter(d => d.year != null && d.month != null).map(d => `${d.year}-${d.month}`)
  );
  const hasVendorName = data.some(d => d.vendorName != null && String(d.vendorName).trim() !== '');
  const isRankingByVendor = uniquePeriods.size <= 1 && hasVendorName && data.filter(hasScore).length > 0;

  if (isRankingByVendor) {
    // 單一月份排名：X 軸 = 供應商名稱，長條圖
    const chartData = data
      .filter(hasScore)
      .map(item => {
        const score = item[dataKey] ?? item.考核得分 ?? item.考核分數;
        return {
          name: item.vendorName || '未命名',
          score: typeof score === 'number' ? score : parseFloat(score) || 0,
        };
      });
    chartData.sort((a, b) => b.score - a.score);

    if (chartData.length === 0) {
      return (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            沒有可用的數據用於繪製圖表
          </Typography>
        </Paper>
      );
    }

    return (
      <Box ref={chartRef} sx={{ mt: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
            {title}
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                label={{ value: '分數', angle: -90, position: 'insideLeft' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                formatter={(value: any) => [value?.toFixed(2) ?? value, '考核得分']}
                labelFormatter={(label) => `供應商: ${label}`}
              />
              <Legend />
              <Bar dataKey="score" fill="#1976d2" name="考核得分" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Box>
    );
  }

  // 多時間點趨勢：X 軸 = 年月，折線圖
  const chartData = data
    .filter(hasScore)
    .map(item => {
      const score = item[dataKey] ?? item.考核得分 ?? item.考核分數;
      const period = `${item.year}年${item.month}月`;
      return {
        period,
        label: period,
        score: typeof score === 'number' ? score : parseFloat(score) || 0,
        year: item.year,
        month: item.month,
      };
    })
    .sort((a, b) => {
      const seqA = (a.year ?? 0) * 12 + (a.month ?? 0);
      const seqB = (b.year ?? 0) * 12 + (b.month ?? 0);
      return seqA - seqB;
    });

  // 下載圖表為圖片（如果需要，可以通過外部按鈕觸發）
  // 這個功能現在由 AIChatBot 組件處理

  if (chartData.length === 0) {
    return (
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          沒有可用的數據用於繪製趨勢圖
        </Typography>
      </Paper>
    );
  }

  return (
    <Box ref={chartRef} sx={{ mt: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              label={{ value: '分數', angle: -90, position: 'insideLeft' }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(value: any) => [value?.toFixed(2) || value, '考核得分']}
              labelFormatter={(label) => `時間: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#1976d2"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="考核得分"
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>
    </Box>
  );
};

export default TrendChart;

