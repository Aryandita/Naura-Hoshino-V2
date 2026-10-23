param([Parameter(ValueFromRemainingArguments = $true)]$args)
$engine = Join-Path (Split-Path -Parent $PSScriptRoot) "engine\run.mjs"
node $engine @args
