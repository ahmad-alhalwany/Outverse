# Register a Windows Scheduled Task that generates Cosonova's AI daily challenge
# once per day. Run from an elevated or normal PowerShell:
#
#   cd "H:\project\Outverse - Copy\backend"
#   powershell -ExecutionPolicy Bypass -File .\scripts\register-daily-challenge-task.ps1
#
# Default local time: 06:00. Override:
#   .\scripts\register-daily-challenge-task.ps1 -Hour 7 -Minute 0 -Lang en

param(
  [int]$Hour = 6,
  [int]$Minute = 0,
  [ValidateSet('en', 'ar')]$Lang = 'en',
  [string]$TaskName = 'CosonovaGenerateDailyChallenge'
)

$ErrorActionPreference = 'Stop'
$BackendRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $BackendRoot 'venv\Scripts\python.exe'
if (-not (Test-Path $Python)) {
  throw "Python venv not found at $Python — create/activate venv first."
}

$action = New-ScheduledTaskAction `
  -Execute $Python `
  -Argument "manage.py generate_daily_challenge --lang $Lang" `
  -WorkingDirectory $BackendRoot

$trigger = New-ScheduledTaskTrigger -Daily -At (Get-Date -Hour $Hour -Minute $Minute -Second 0)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Generate Cosonova Lab daily challenge via NVIDIA/AI at ${Hour}:$('{0:D2}' -f $Minute) local time" `
  -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered for every day at $('{0:D2}' -f $Hour):$('{0:D2}' -f $Minute) (lang=$Lang)."
Write-Host "Test now:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Remove:     Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
