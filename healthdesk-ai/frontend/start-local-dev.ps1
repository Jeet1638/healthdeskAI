Set-Location -LiteralPath $PSScriptRoot
npm.cmd run dev
Write-Host "Frontend server stopped. Press Enter to close this window."
[void][System.Console]::ReadLine()
