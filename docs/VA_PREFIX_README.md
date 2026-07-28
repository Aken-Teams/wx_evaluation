# 表名前綴 va_

本專案 12 張表在資料庫中的實際名稱皆為 `va_` 前綴，與其它程式的表區隔。

## 若資料庫中「尚未」使用 va_ 前綴（既有表仍為舊名）

請先在 MySQL 中將既有 9 張表**重新命名**為對應的 `va_` 名稱，再執行 `npx prisma db push` 或 migrate：

| 舊表名（若存在） | 新表名（va_ 前綴） |
|------------------|---------------------|
| User | va_User |
| SQMVQMVendor | va_SQMVQMVendor |
| SQMVQMMonthlyReport | va_SQMVQMMonthlyReport |
| SQMVQMAnnualInput | va_SQMVQMAnnualInput |
| OSATVendor | va_OSATVendor |
| OSATMonthlyReport | va_OSATMonthlyReport |
| OSATAnnualInput | va_OSATAnnualInput |
| OSATMonthlyPurchase | va_OSATMonthlyPurchase |
| OSATSupplierMapping | va_OSATSupplierMapping |

範例（在 MySQL 執行）：

```sql
RENAME TABLE User TO va_User;
RENAME TABLE SQMVQMVendor TO va_SQMVQMVendor;
-- ... 其餘類推
```

3 張 AI 表（va_AiUnansweredLog、va_AiUsageLog、va_AiLlmConfig）若尚未建立，執行 `npx prisma db push` 時會自動建立。

## 若已使用 va_ 前綴

直接執行 `npx prisma generate` 與 `npx prisma db push`（或 migrate）即可。
