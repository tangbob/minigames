# ── minigames 前端现发(8770) 重启脚本 · 杀完自拉并等探活 ──
# 用法:
#   powershell -NoProfile -ExecutionPolicy Bypass -File server\restart-web-win.ps1
# 为什么要它: 手机壳(capacitor server.url)和 PC 壳都从 https://minigames.zhinengtai.xyz 取前端,
#   该域名经 cloudflared 隧道落到本机 8770。8770 没了 = 手机端白屏、PC 壳退回包内 dist。
# 注意: 只重启本仓的「前端现发」, 不碰任何别的项目的端口。
param([int]$WaitReadySec = 45)
$ErrorActionPreference = "Continue"

$Root = if ($env:MINIGAMES_ROOT) { $env:MINIGAMES_ROOT } else { "D:\projects\minigames" }
$Port = if ($env:MINIGAMES_SERVE_PORT) { [int]$env:MINIGAMES_SERVE_PORT } else { 8770 }
$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "restart-web.log"

function Say($m) {
  $line = "[{0}] [minigames-web] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
  Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
  Write-Output $line
}

# 探活: /health 必须回 ok:true 且 project=minigames (别的项目占了同端口也不算 up)。
# 先清空默认代理: 本机常驻 Clash 系统代理, 走代理探 localhost 会假阴性。
[System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy
function Test-MgWeb {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:${Port}/health" -TimeoutSec 3 -UseBasicParsing
    $j = $r.Content | ConvertFrom-Json
    return ($r.StatusCode -eq 200 -and $j.ok -eq $true -and $j.project -eq "minigames")
  } catch { return $false }
}

if (Test-MgWeb) { Say "already up on $Port"; exit 0 }

# 杀掉占用端口的旧进程 (只杀监听本端口的那一个, 不按映像名/通配符杀)
$holder = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($holder) {
  Say "killing stale listener pid=$holder"
  try { Stop-Process -Id $holder -Force -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Seconds 1
}

$dist = Join-Path $Root "dist\index.html"
if (-not (Test-Path -LiteralPath $dist)) {
  Say "dist/index.html 不存在, 先在该检出跑 npm run build —— 本脚本不自作主张构建"
  exit 2
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$node = if ($nodeCmd) { $nodeCmd.Source } else { "C:\Program Files\nodejs\node.exe" }
$serve = Join-Path $Root "tools\serve-web.mjs"
if (-not (Test-Path -LiteralPath $serve)) { Say "缺 $serve"; exit 2 }

# 无窗口 + 脱离调用方 job: 经 WMI 创建进程, 再套 run_hidden.vbs 的 windowStyle=0, 一个窗都不弹。
# 🔴 vbs 把 -nowait 之后的参数用空格拼回一条命令, 路径里不能有空格 → node 与脚本都走 8.3 短路径。
$fso = New-Object -ComObject Scripting.FileSystemObject
$nodeExe = if ($node -match '\.exe$' -and (Test-Path -LiteralPath $node)) {
  try { $fso.GetFile($node).ShortPath } catch { $node }
} else { "C:\PROGRA~1\nodejs\node.exe" }
$serveShort = try { $fso.GetFile($serve).ShortPath } catch { $serve }
$vbs = Join-Path $Root "server\run_hidden.vbs"
$vbsShort = try { $fso.GetFile($vbs).ShortPath } catch { $vbs }
$inner = $nodeExe + ' ' + $serveShort
$wmiCmd = if (Test-Path -LiteralPath $vbs) { 'wscript.exe //B "' + $vbsShort + '" -nowait ' + $inner } else { $inner }
try {
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $wmiCmd } -ErrorAction Stop
  if ($r.ReturnValue -ne 0) { Say "WMI 拉起失败 ReturnValue=$($r.ReturnValue)"; exit 3 }
  Say "launched serve-web on $Port via WMI pid=$($r.ProcessId)"
} catch {
  Say "WMI 拉起异常: $($_.Exception.Message)"
  exit 3
}

$deadline = (Get-Date).AddSeconds($WaitReadySec)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 700
  if (Test-MgWeb) { Say "up on $Port (verified /health)"; exit 0 }
}
Say "起不来: ${WaitReadySec}s 内没探到 /health"
exit 3