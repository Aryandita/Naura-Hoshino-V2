<#
.SYNOPSIS
    Ralph Loop Runner untuk Windows PowerShell (Naura Hoshino V2)
.DESCRIPTION
    Menjalankan pengecekan status, navigasi user story berikutnya,
    dan menandai progres penyelesaian PRD secara deterministik.
.EXAMPLE
    .\scripts\ralph\ralph.ps1 -Status
    .\scripts\ralph\ralph.ps1 -Next
    .\scripts\ralph\ralph.ps1 -Pass US-001
#>

param(
    [switch]$Status,
    [switch]$Next,
    [string]$Pass,
    [switch]$Init
)

$scriptPath = Join-Path $PSScriptRoot "ralph.js"

if ($Init) {
    node $scriptPath --init
} elseif ($Next) {
    node $scriptPath --next
} elseif ($Pass) {
    node $scriptPath --pass $Pass
} else {
    node $scriptPath --status
}
