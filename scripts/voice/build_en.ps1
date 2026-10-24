# まなびのにわ 英語音声ビルド (Windows / PowerShell)
#   .\scripts\voice\build_en.ps1            -> voice/script-en.json から public/audio/en を差分生成
#   .\scripts\voice\build_en.ps1 --force    -> 全再生成
# 追加引数は generate_en.py にそのまま渡す (--script / --out / --voice / --speed / --dry-run ...)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Venv = Join-Path $Root ".venv"
$VenvPy = Join-Path $Venv "Scripts\python.exe"
$Req = Join-Path $PSScriptRoot "requirements-en.txt"

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
    Write-Host "[voice-en] venv 作成: $Venv (python: $py)"
    Invoke-Expression "$py -m venv `"$Venv`""
}

# (generate_en.py は generate.py を import するが、必要なのは numpy / soundfile だけで requirements-en.txt に含まれる)
# requirements が変わったときだけ pip install
$stamp = Join-Path $Venv ".requirements-en.sha1"
$hash = (Get-FileHash $Req -Algorithm SHA1).Hash
if (-not (Test-Path $stamp) -or (Get-Content $stamp -Raw).Trim() -ne $hash) {
    Write-Host "[voice-en] pip install -r requirements-en.txt"
    & $VenvPy -m pip install --disable-pip-version-check -r $Req
    if ($LASTEXITCODE -ne 0) { throw "pip install に失敗" }
    Set-Content -Path $stamp -Value $hash -NoNewline
}

$env:PYTHONUTF8 = "1"
& $VenvPy -I (Join-Path $PSScriptRoot "generate_en.py") @args
exit $LASTEXITCODE
