param(
    [switch]$System,
    [switch]$Social
)

$ErrorActionPreference = "Stop"
$Venv = Join-Path $env:USERPROFILE ".leadflow-intent-venv"
$Python = Join-Path $Venv "Scripts\python.exe"
$AgentReach = Join-Path $Venv "Scripts\agent-reach.exe"
$Scrapling = Join-Path $Venv "Scripts\scrapling.exe"

Write-Host ""
Write-Host "LeadFlow Intent Engine - setup local" -ForegroundColor Cyan
Write-Host "Ambiente isolado: $Venv" -ForegroundColor DarkGray

if (-not (Test-Path $Python)) {
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if (-not $launcher) { throw "Python Launcher (py) não encontrado. Instale Python 3.11+ e tente novamente." }
    & py -3 -m venv $Venv
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar o ambiente Python do Intent Engine." }
}

& $Python -m pip install --upgrade pip
& $Python -m pip install "https://github.com/Panniantong/agent-reach/archive/main.zip" "scrapling[fetchers]"
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar Agent-Reach/Scrapling no ambiente local." }

if (Test-Path $Scrapling) {
    & $Scrapling install
    if ($LASTEXITCODE -ne 0) { Write-Host "[AVISO] Scrapling foi instalado, mas o runtime de navegador não terminou de instalar." -ForegroundColor Yellow }
}

if ($System) {
    Write-Host "Configurando dependências base do Agent-Reach..." -ForegroundColor Yellow
    & $AgentReach install --env=local --system
} else {
    Write-Host "Executando apenas a checagem segura do Agent-Reach..." -ForegroundColor Yellow
    & $AgentReach install --env=local
}

if ($Social) {
    if (-not $System) { throw "-Social exige -System porque instala conectores adicionais." }
    Write-Host "Instalando conectores sociais suportados pelo Agent-Reach..." -ForegroundColor Yellow
    & $AgentReach install --env=local --system --channels=opencli,twitter,reddit,facebook
}

Write-Host ""
Write-Host "Diagnóstico Agent-Reach:" -ForegroundColor Cyan
& $AgentReach doctor
Write-Host ""
Write-Host "Setup concluído. O LeadFlow detecta automaticamente este ambiente." -ForegroundColor Green
Write-Host "Para Web/Exa completo, execute npm run intent:setup:full se você ainda rodou apenas.o modo seguro." -ForegroundColor DarkGray
Write-Host "Para fontes sociais, execute o script explicitamente com -System -Social e conclua logins no navegador quando solicitado." -ForegroundColor DarkGray
