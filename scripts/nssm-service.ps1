<#
.SYNOPSIS
  Manage Tavern Vault as a local Windows service using NSSM.

.EXAMPLE
  # Install and start service with default settings (run as Administrator)
  .\scripts\nssm-service.ps1 install

.EXAMPLE
  # Install with custom port, data directory, and explicit nssm path
  .\scripts\nssm-service.ps1 install -Port 8080 -DataDir "D:\MyTavernData" -NssmPath "C:\tools\nssm\nssm.exe"

.EXAMPLE
  # Check status / restart / view logs / uninstall
  .\scripts\nssm-service.ps1 status
  .\scripts\nssm-service.ps1 restart
  .\scripts\nssm-service.ps1 logs
  .\scripts\nssm-service.ps1 uninstall
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('install', 'uninstall', 'remove', 'start', 'stop', 'restart', 'status', 'logs')]
  [string]$Action = 'status',

  [string]$ServiceName = 'TavernVault',
  [int]$Port = 3456,
  [string]$HostAddress = '0.0.0.0',
  [string]$DataDir = '',
  [string]$NssmPath = '',
  [string]$NodePath = '',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ServerEntry = Join-Path $ProjectRoot 'server\src\index.js'
$ClientDistIndex = Join-Path $ProjectRoot 'client\dist\index.html'
$LogsDir = Join-Path $ProjectRoot 'logs'
$StdoutLog = Join-Path $LogsDir 'service-stdout.log'
$StderrLog = Join-Path $LogsDir 'service-stderr.log'

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Admin {
  if (-not (Test-IsAdmin)) {
    Write-Error "操作 '$Action' 需要管理员权限。请以管理员身份运行 PowerShell 后重试。"
    exit 1
  }
}

function Resolve-Nssm {
  if ($NssmPath) {
    if (-not (Test-Path $NssmPath)) {
      Write-Error "未找到指定的 NSSM 可执行文件: $NssmPath"
      exit 1
    }
    return (Resolve-Path $NssmPath).Path
  }

  $cmd = Get-Command nssm -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $candidates = @(
    (Join-Path $ProjectRoot 'nssm.exe'),
    (Join-Path $ProjectRoot 'tools\nssm.exe'),
    (Join-Path $ProjectRoot 'scripts\nssm.exe')
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) {
      return (Resolve-Path $c).Path
    }
  }

  Write-Error @"
未找到 nssm.exe。请先安装 NSSM：
  1) 使用 winget: winget install NSSM.NSSM
  2) 或使用 scoop: scoop install nssm
  3) 或下载 nssm.exe 并将其加入 PATH，或通过 -NssmPath 指定路径
"@
  exit 1
}

function Resolve-Node {
  if ($NodePath) {
    if (-not (Test-Path $NodePath)) {
      Write-Error "未找到指定的 Node.js 可执行文件: $NodePath"
      exit 1
    }
    return (Resolve-Path $NodePath).Path
  }

  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Error "未找到 node.exe，请先安装 Node.js >= 22.5 并确保其在 PATH 中。"
    exit 1
  }
  return $cmd.Source
}

function Invoke-Nssm {
  param(
    [string]$Exe,
    [string[]]$Arguments,
    [switch]$IgnoreError
  )
  & $Exe @Arguments
  if (-not $IgnoreError -and $LASTEXITCODE -ne 0) {
    Write-Error "NSSM 命令执行失败 (exit $LASTEXITCODE): nssm $($Arguments -join ' ')"
    exit $LASTEXITCODE
  }
}

if ($Action -eq 'logs') {
  Write-Host "=== Tavern Vault 日志目录: $LogsDir ===" -ForegroundColor Cyan
  if (Test-Path $StdoutLog) {
    Write-Host "`n--- stdout ($StdoutLog) ---" -ForegroundColor Green
    Get-Content $StdoutLog -Tail 50 -Encoding UTF8
  } else {
    Write-Host "暂无 stdout 日志 ($StdoutLog)" -ForegroundColor Yellow
  }
  if (Test-Path $StderrLog) {
    Write-Host "`n--- stderr ($StderrLog) ---" -ForegroundColor Red
    Get-Content $StderrLog -Tail 50 -Encoding UTF8
  }
  exit 0
}

$nssm = Resolve-Nssm

switch ($Action) {
  'install' {
    Assert-Admin
    $node = Resolve-Node

    if (-not (Test-Path $ServerEntry)) {
      Write-Error "未找到服务端入口文件: $ServerEntry"
      exit 1
    }

    # Check Node.js version >= 22.5
    $nodeVerRaw = (& $node -v).Trim()
    if ($nodeVerRaw -match '^v(\d+)\.(\d+)') {
      $major = [int]$Matches[1]
      $minor = [int]$Matches[2]
      if ($major -lt 22 -or ($major -eq 22 -and $minor -lt 5)) {
        Write-Error "当前 Node.js 版本为 $nodeVerRaw，Tavern Vault 需要 Node.js >= 22.5。"
        exit 1
      }
    }

    # Ensure frontend static assets are built
    if (-not $SkipBuild -and -not (Test-Path $ClientDistIndex)) {
      Write-Host "未检测到前端构建产物，正在执行 npm run build ..." -ForegroundColor Cyan
      Push-Location $ProjectRoot
      try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
          Write-Error "前端构建失败，请先确认已执行 npm run install:all。"
          exit $LASTEXITCODE
        }
      } finally {
        Pop-Location
      }
    }

    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null

    # Remove existing service if already registered
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
      Write-Host "检测到已有服务 '$ServiceName'，正在重新配置..." -ForegroundColor Yellow
      Invoke-Nssm -Exe $nssm -Arguments @('stop', $ServiceName) -IgnoreError
      Invoke-Nssm -Exe $nssm -Arguments @('remove', $ServiceName, 'confirm')
    }

    Write-Host "正在注册 Windows 服务 '$ServiceName' ..." -ForegroundColor Cyan
    $appArgs = "--no-warnings `"$ServerEntry`""
    Invoke-Nssm -Exe $nssm -Arguments @('install', $ServiceName, $node, $appArgs)
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppDirectory', $ProjectRoot)
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'DisplayName', 'Tavern Vault (酒馆档案墙)')
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'Description', 'SillyTavern local archival vault web service')
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'Start', 'SERVICE_AUTO_START')

    # Environment variables
    $envEntries = @(
      'NODE_ENV=production',
      "PORT=$Port",
      "HOST=$HostAddress"
    )
    if ($DataDir) {
      $resolvedDataDir = [System.IO.Path]::GetFullPath($DataDir)
      $envEntries += "VAULT_DATA_DIR=$resolvedDataDir"
    }
    Invoke-Nssm -Exe $nssm -Arguments (@('set', $ServiceName, 'AppEnvironmentExtra') + $envEntries)

    # Logging & rotation (10 MB)
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppStdout', $StdoutLog)
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppStderr', $StderrLog)
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppStdoutCreationDisposition', '4')
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppStderrCreationDisposition', '4')
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppRotateFiles', '1')
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppRotateOnline', '1')
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppRotateBytes', '10485760')

    # Auto-restart on unexpected exit
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppExit', 'Default', 'Restart')
    Invoke-Nssm -Exe $nssm -Arguments @('set', $ServiceName, 'AppThrottle', '5000')

    Write-Host "正在启动服务 '$ServiceName' ..." -ForegroundColor Cyan
    Invoke-Nssm -Exe $nssm -Arguments @('start', $ServiceName)

    Write-Host "`n✓ 服务 '$ServiceName' 已安装并启动（开机自启）" -ForegroundColor Green
    Write-Host "  访问地址: http://localhost:$Port" -ForegroundColor Green
    Write-Host "  日志路径: $LogsDir`n" -ForegroundColor Gray
  }

  { $_ -in 'uninstall', 'remove' } {
    Assert-Admin
    Write-Host "正在停止并卸载服务 '$ServiceName' ..." -ForegroundColor Yellow
    Invoke-Nssm -Exe $nssm -Arguments @('stop', $ServiceName) -IgnoreError
    Invoke-Nssm -Exe $nssm -Arguments @('remove', $ServiceName, 'confirm')
    Write-Host "✓ 服务 '$ServiceName' 已卸载。" -ForegroundColor Green
  }

  'start' {
    Assert-Admin
    Invoke-Nssm -Exe $nssm -Arguments @('start', $ServiceName)
    Write-Host "✓ 服务 '$ServiceName' 已启动。" -ForegroundColor Green
  }

  'stop' {
    Assert-Admin
    Invoke-Nssm -Exe $nssm -Arguments @('stop', $ServiceName)
    Write-Host "✓ 服务 '$ServiceName' 已停止。" -ForegroundColor Green
  }

  'restart' {
    Assert-Admin
    Invoke-Nssm -Exe $nssm -Arguments @('restart', $ServiceName)
    Write-Host "✓ 服务 '$ServiceName' 已重启。" -ForegroundColor Green
  }

  'status' {
    Invoke-Nssm -Exe $nssm -Arguments @('status', $ServiceName) -IgnoreError
  }
}
