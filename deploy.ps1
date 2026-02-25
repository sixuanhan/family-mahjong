<# 
.SYNOPSIS
  Automated internet deployment (互联网联机部署)

.DESCRIPTION
  This script automates the full international deployment workflow:
    1. Starts the backend server
    2. Opens a Cloudflare Tunnel to expose the backend
    3. Patches the tunnel URL into the frontend source
    4. Builds the frontend
    5. Deploys to Cloudflare Pages
    6. Restores the original source file on exit

.NOTES
  Prerequisites:
    - pnpm, cloudflared, wrangler installed and on PATH
    - Cloudflare account authenticated (run `wrangler login` once)

  Usage:
    powershell -ExecutionPolicy Bypass -File deploy.ps1
#>

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$HookFile = "src\hooks\useGameConnection.ts"
$BackupFile = "$HookFile.bak"

$ServerJob = $null
$TunnelProcess = $null

function Cleanup {
    Write-Host ""
    Write-Host "Cleaning up..." -ForegroundColor Yellow

    # Restore original source file
    if (Test-Path $BackupFile) {
        Move-Item -Force $BackupFile $HookFile
        Write-Host "   Restored original $HookFile"
    }

    # Stop background jobs/processes
    if ($ServerJob -and $ServerJob.State -eq 'Running') {
        Stop-Job $ServerJob -ErrorAction SilentlyContinue
        Remove-Job $ServerJob -Force -ErrorAction SilentlyContinue
        Write-Host "   Stopped backend server"
    }
    if ($TunnelProcess -and !$TunnelProcess.HasExited) {
        $TunnelProcess.Kill()
        Write-Host "   Stopped cloudflared tunnel"
    }
}

# Register cleanup on Ctrl+C and script exit
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }
trap { Cleanup; break }

try {
    # --- Step 1: Start backend server -----------------------------------------
    Write-Host "Step 1: Starting backend server..." -ForegroundColor Cyan
    $ServerJob = Start-Job -ScriptBlock {
        Set-Location "$using:ScriptDir\server"
        pnpm dev
    }
    Write-Host "   Backend server started (Job $($ServerJob.Id))"
    Start-Sleep -Seconds 3

    if ($ServerJob.State -eq 'Failed') {
        Write-Host "Backend server failed to start. Aborting." -ForegroundColor Red
        Receive-Job $ServerJob
        exit 1
    }

    # --- Step 2: Start Cloudflare Tunnel --------------------------------------
    Write-Host "Step 2: Starting Cloudflare Tunnel..." -ForegroundColor Cyan

    $TunnelLogFile = [System.IO.Path]::GetTempFileName()

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cloudflared"
    $psi.Arguments = "tunnel --url http://localhost:3000"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardOutput = $true
    $psi.CreateNoWindow = $true

    $TunnelProcess = [System.Diagnostics.Process]::Start($psi)

    # cloudflared writes the URL to stderr; collect it asynchronously
    $stderrBuilder = New-Object System.Text.StringBuilder
    $TunnelProcess.ErrorDataReceived.Add({
        param($sender, $e)
        if ($e.Data) { [void]$stderrBuilder.AppendLine($e.Data) }
    }.GetNewClosure())
    # Wrap the StringBuilder so the closure captures a reference
    $stderrRef = $stderrBuilder
    $TunnelProcess.BeginErrorReadLine()
    $TunnelProcess.BeginOutputReadLine()

    Write-Host "   Waiting for tunnel URL..."

    $TunnelUrl = ""
    for ($i = 0; $i -lt 60; $i++) {
        $output = $stderrRef.ToString()
        if ($output -match '(https://[a-zA-Z0-9-]+\.trycloudflare\.com)') {
            $TunnelUrl = $Matches[1]
            break
        }
        Start-Sleep -Seconds 1
    }

    if ([string]::IsNullOrEmpty($TunnelUrl)) {
        Write-Host "Failed to obtain tunnel URL after 60 seconds. Aborting." -ForegroundColor Red
        exit 1
    }

    $TunnelHost = $TunnelUrl -replace '^https://', ''

    Write-Host "   Tunnel URL:  $TunnelUrl"  -ForegroundColor Green
    Write-Host "   Tunnel host: $TunnelHost" -ForegroundColor Green

    # --- Step 3: Patch tunnel URL into frontend source ------------------------
    Write-Host "Step 3: Patching tunnel URL into $HookFile..." -ForegroundColor Cyan

    Copy-Item $HookFile $BackupFile

    $content = Get-Content $HookFile -Raw
    $content = $content -replace "const tunnelUrl = '.*?';", "const tunnelUrl = '$TunnelHost';"
    Set-Content -Path $HookFile -Value $content -NoNewline

    Write-Host "   Patched tunnelUrl = '$TunnelHost'"

    # --- Step 4: Build frontend -----------------------------------------------
    Write-Host "Step 4: Building frontend..." -ForegroundColor Cyan
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
    Write-Host "   Build complete."

    # --- Step 5: Deploy to Cloudflare Pages -----------------------------------
    Write-Host "Step 5: Deploying to Cloudflare Pages..." -ForegroundColor Cyan
    wrangler pages deploy dist --project-name=mahjong
    if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }
    Write-Host "   Deploy complete!"

    # --- Step 6: Restore original source file ---------------------------------
    if (Test-Path $BackupFile) {
        Move-Item -Force $BackupFile $HookFile
        Write-Host "   Restored original $HookFile"
    }

    # --- Done -----------------------------------------------------------------
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backend tunnel: $TunnelUrl" -ForegroundColor Green
    Write-Host ""
    Write-Host "Share the Cloudflare Pages URL above with"
    Write-Host "your friends to play online!"
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server and tunnel."

    # Keep alive so server & tunnel keep running
    while ($true) {
        Start-Sleep -Seconds 5
        if ($ServerJob.State -ne 'Running') {
            Write-Host "Backend server stopped unexpectedly." -ForegroundColor Yellow
            break
        }
        if ($TunnelProcess.HasExited) {
            Write-Host "Cloudflare tunnel stopped unexpectedly." -ForegroundColor Yellow
            break
        }
    }
}
finally {
    Cleanup
}
