# まなびのにわ 音声ビルド (Windows / PowerShell)
#   npm run voice:build            -> public/audio を差分生成
#   npm run voice:build -- --force -> 全再生成
# 追加引数は generate.py にそのまま渡す (--script / --out / --speed / --half-tone / --voice-scale / --dry-run ...)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Venv = Join-Path $Root ".venv"
$VenvPy = Join-Path $Venv "Scripts\python.exe"
$Req = Join-Path $PSScriptRoot "requirements.txt"

function Find-Python {
    foreach ($c in @("py -3.12", "python", "python3")) {
        $parts = $c.Split(" ")
        $cmd = Get-Command $parts[0] -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source -notmatch "WindowsApps") {
            try { & $parts[0] $parts[1..($parts.Length)] --version *> $null; if ($LASTEXITCODE -eq 0) { return $c } } catch {}
        }
    }
    $fallback = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
    if (Test-Path $fallback) { return "`"$fallback`"" }
    throw "Python 3.12 が見つかりません"
}

if (-not (Test-Path $VenvPy)) {
    $py = Find-Python
    Write-Host "[voice] venv 作成: $Venv (python: $py)"
    Invoke-Expression "$py -m venv `"$Venv`""
}

# requirements が変わったときだけ pip install
$stamp = Join-Path $Venv ".requirements.sha1"
$hash = (Get-FileHash $Req -Algorithm SHA1).Hash
if (-not (Test-Path $stamp) -or (Get-Content $stamp -Raw).Trim() -ne $hash) {
    Write-Host "[voice] pip install -r requirements.txt"
    & $VenvPy -m pip install --disable-pip-version-check -r $Req
    if ($LASTEXITCODE -ne 0) { throw "pip install に失敗" }
    Set-Content -Path $stamp -Value $hash -NoNewline
}

$env:PYTHONUTF8 = "1"
& $VenvPy -I (Join-Path $PSScriptRoot "generate.py") @args
exit $LASTEXITCODE
