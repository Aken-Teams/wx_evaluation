﻿﻿﻿﻿﻿﻿﻿﻿param(
    [int[]]$Ports = @(3001, 12017, 12018, 5173, 5174, 3000)
)

Write-Host "🔍 正在检查并关闭占用的端口..."

foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -ne 0) {
                try {
                    $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "⏹️  停止进程 $($process.ProcessName) (PID: $($conn.OwningProcess)) 占用端口 $port"
                        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                    }
                } catch {
                    Write-Host "⚠️  无法停止占用端口 $port 的进程"
                }
            }
        }
    }
}

Write-Host "✅ 端口清理完成"

Write-Host "`n🚀 启动后端服务..."
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd server; npm run dev" -WorkingDirectory $PWD

Start-Sleep -Seconds 3

Write-Host "🚀 启动前端服务..."
Start-Process -FilePath "powershell" -ArgumentList "-Command", "npm run dev" -WorkingDirectory $PWD

Write-Host "`n🎉 服务已启动！"