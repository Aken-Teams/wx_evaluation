<#
  db-tunnel.ps1 — 開/關 連到 vendor_assessment 資料庫的 SSH 跳板通道

  ⚠️ 本檔不含任何機密，可安全上傳。主機/帳號/密碼放在 .env.tunnel（已被 .gitignore 忽略）。
     首次使用：複製 .env.tunnel.example 成 .env.tunnel 並填入真實值。

  用法:
    .\db-tunnel.ps1            # 啟動通道 (預設)
    .\db-tunnel.ps1 start
    .\db-tunnel.ps1 stop       # 關閉通道
    .\db-tunnel.ps1 status     # 查看狀態
    .\db-tunnel.ps1 restart    # 重啟

  啟動後，本機用以下連線字串即可連到遠端 DB：
    DATABASE_URL=mysql://vendor_rw:123456@127.0.0.1:<LocalPort>/vendor_assessment

  原理: 本機 127.0.0.1:LocalPort ──ssh(-L)──> 跳板機 ──> 內網 DB。
        cloudflared 走 ~/.ssh/config 的 ProxyCommand。
#>

param(
  [ValidateSet('start', 'stop', 'status', 'restart')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---------------- 讀取 .env.tunnel ----------------
function Import-DotEnv {
  param([string]$Path)
  $result = @{}
  if (-not (Test-Path $Path)) { return $result }
  # 明確以 UTF-8 讀取，避免 PowerShell 5.1 用系統編碼(Big5)誤解中文註解而黏行
  $lines = [System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8)
  foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $idx = $t.IndexOf('=')
    if ($idx -lt 1) { continue }
    $k = $t.Substring(0, $idx).Trim()
    $v = $t.Substring($idx + 1).Trim().Trim('"').Trim("'")
    $result[$k] = $v
  }
  return $result
}

$EnvFile = Join-Path $ScriptDir '.env.tunnel'
if (-not (Test-Path $EnvFile)) {
  Write-Host "找不到 .env.tunnel。請先複製範例並填入設定：" -ForegroundColor Red
  Write-Host "  copy .env.tunnel.example .env.tunnel" -ForegroundColor Yellow
  exit 1
}
$cfg = Import-DotEnv $EnvFile

$JumpHost    = $cfg['TUNNEL_JUMP_HOST']
$SshUser     = $cfg['TUNNEL_SSH_USER']
$SshPassword = $cfg['TUNNEL_SSH_PASSWORD']
$DbHost      = $cfg['TUNNEL_DB_HOST']
$DbPort      = [int]($cfg['TUNNEL_DB_PORT'])
$LocalPort   = [int]($cfg['TUNNEL_LOCAL_PORT'])

if (-not $JumpHost -or -not $SshUser -or -not $SshPassword -or -not $DbHost) {
  Write-Host ".env.tunnel 設定不完整，請檢查 TUNNEL_* 欄位。" -ForegroundColor Red
  exit 1
}

$PidFile = Join-Path $env:TEMP 'wx_db_tunnel.pid'
$AskPass = Join-Path $env:TEMP 'wx_db_askpass.cmd'
$LogFile = Join-Path $env:TEMP 'wx_db_tunnel.log'

function Get-TunnelProcess {
  if (-not (Test-Path $PidFile)) { return $null }
  $tunnelPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if (-not $tunnelPid) { return $null }
  $p = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -eq 'ssh') { return $p }
  return $null
}

function Test-PortListening {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Show-Status {
  $p = Get-TunnelProcess
  $listening = Test-PortListening $LocalPort
  if ($p -and $listening) {
    Write-Host "● 通道運作中" -ForegroundColor Green
    Write-Host "  SSH PID    : $($p.Id)"
    Write-Host "  本機連線點 : 127.0.0.1:$LocalPort  ->  $DbHost`:$DbPort (經 $JumpHost)"
    Write-Host "  連線字串   : mysql://vendor_rw:***@127.0.0.1:$LocalPort/vendor_assessment"
  }
  elseif ($p -and -not $listening) {
    Write-Host "▲ SSH 進程存在但埠未監聽 (可能正在連線或已失敗，見 log)" -ForegroundColor Yellow
    Write-Host "  log: $LogFile"
  }
  else {
    Write-Host "○ 通道未啟動" -ForegroundColor DarkGray
  }
}

function Stop-Tunnel {
  $p = Get-TunnelProcess
  if ($p) {
    Stop-Process -Id $p.Id -Force
    Write-Host "已關閉通道 (PID $($p.Id))" -ForegroundColor Yellow
  }
  else {
    Write-Host "沒有運作中的通道" -ForegroundColor DarkGray
  }
  Remove-Item $PidFile -ErrorAction SilentlyContinue
}

function Start-Tunnel {
  if (Get-TunnelProcess) {
    Write-Host "通道已在運作中，略過啟動。" -ForegroundColor DarkGray
    Show-Status
    return
  }
  if (Test-PortListening $LocalPort) {
    Write-Host "本機埠 $LocalPort 已被其他程式佔用，請改用別的 TUNNEL_LOCAL_PORT。" -ForegroundColor Red
    return
  }

  # 產生 askpass 腳本 (供 ssh 非互動式取得密碼)
  "@echo off`r`necho $SshPassword" | Set-Content -Path $AskPass -Encoding Ascii

  $env:SSH_ASKPASS         = $AskPass
  $env:SSH_ASKPASS_REQUIRE = 'force'
  $env:DISPLAY             = 'localhost:0'

  $sshArgs = @(
    '-N',
    '-L', "127.0.0.1:$LocalPort`:$DbHost`:$DbPort",
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'PreferredAuthentications=password',
    '-o', 'PubkeyAuthentication=no',
    '-o', 'NumberOfPasswordPrompts=1',
    "$SshUser@$JumpHost"
  )

  Write-Host "啟動通道中 (127.0.0.1:$LocalPort -> $DbHost`:$DbPort)..." -ForegroundColor Cyan
  $proc = Start-Process -FilePath 'ssh.exe' -ArgumentList $sshArgs `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardError $LogFile
  $proc.Id | Set-Content -Path $PidFile

  $ok = $false
  foreach ($i in 1..40) {
    Start-Sleep -Milliseconds 500
    if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) { break }
    if (Test-PortListening $LocalPort) { $ok = $true; break }
  }

  if ($ok) {
    Write-Host "✅ 通道已建立。" -ForegroundColor Green
    Show-Status
  }
  else {
    Write-Host "❌ 通道啟動失敗。" -ForegroundColor Red
    if (Test-Path $LogFile) { Write-Host "--- ssh 錯誤 ---"; Get-Content $LogFile | Select-Object -Last 10 }
    Stop-Tunnel
  }
}

switch ($Action) {
  'start'   { Start-Tunnel }
  'stop'    { Stop-Tunnel }
  'status'  { Show-Status }
  'restart' { Stop-Tunnel; Start-Sleep -Seconds 1; Start-Tunnel }
}
