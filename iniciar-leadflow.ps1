# ============================================================
# LeadFlow - Inicialização automática
# Docker Desktop + Google Maps Scraper + Next.js
# ============================================================

$ErrorActionPreference = "Stop"

$ProjectPath = "C:\Users\marys\Downloads\leads\leadflow"
$DockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$DockerBin = "C:\Program Files\Docker\Docker\resources\bin"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "          INICIANDO LEADFLOW" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 1. Verifica Docker
# ------------------------------------------------------------

if (Test-Path $DockerBin) {
    if ($env:Path -notlike "*$DockerBin*") {
        $env:Path += ";$DockerBin"
    }
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue

if (-not $dockerCommand) {
    Write-Host "Docker nao encontrado." -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale o Docker Desktop antes de continuar."
    Write-Host "Esperado em:"
    Write-Host $DockerDesktop
    Write-Host ""
    Read-Host "Pressione ENTER para sair"
    exit 1
}

Write-Host "[OK] Docker encontrado." -ForegroundColor Green


# ------------------------------------------------------------
# 2. Abre Docker Desktop se ainda nao estiver rodando
# ------------------------------------------------------------

$dockerRunning = $false

try {
    docker info *> $null

    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
    }
}
catch {
    $dockerRunning = $false
}

if (-not $dockerRunning) {

    Write-Host ""
    Write-Host "[1/4] Iniciando Docker Desktop..." -ForegroundColor Yellow

    if (-not (Test-Path $DockerDesktop)) {
        Write-Host "Docker Desktop nao encontrado em:" -ForegroundColor Red
        Write-Host $DockerDesktop
        Read-Host "Pressione ENTER para sair"
        exit 1
    }

    Start-Process $DockerDesktop

    Write-Host "Aguardando Docker ficar pronto..." -ForegroundColor Yellow

    $maxAttempts = 90
    $attempt = 0

    while ($attempt -lt $maxAttempts) {

        Start-Sleep -Seconds 2

        try {
            docker info *> $null

            if ($LASTEXITCODE -eq 0) {
                $dockerRunning = $true
                break
            }
        }
        catch {
        }

        $attempt++

        Write-Host "." -NoNewline -ForegroundColor DarkGray
    }

    Write-Host ""

    if (-not $dockerRunning) {
        Write-Host "Docker demorou demais para iniciar." -ForegroundColor Red
        Write-Host "Abra o Docker Desktop manualmente e tente novamente."
        Read-Host "Pressione ENTER para sair"
        exit 1
    }
}

Write-Host "[OK] Docker Desktop pronto." -ForegroundColor Green


# ------------------------------------------------------------
# 3. Entra no projeto
# ------------------------------------------------------------

Write-Host ""
Write-Host "[2/4] Abrindo projeto LeadFlow..." -ForegroundColor Yellow

if (-not (Test-Path $ProjectPath)) {
    Write-Host "Projeto nao encontrado:" -ForegroundColor Red
    Write-Host $ProjectPath
    Read-Host "Pressione ENTER para sair"
    exit 1
}

Set-Location $ProjectPath

if (-not (Test-Path ".\package.json")) {
    Write-Host "package.json nao encontrado." -ForegroundColor Red
    Read-Host "Pressione ENTER para sair"
    exit 1
}

Write-Host "[OK] Projeto encontrado." -ForegroundColor Green


# ------------------------------------------------------------
# 4. Sobe Google Maps Scraper
# ------------------------------------------------------------

Write-Host ""
Write-Host "[3/4] Subindo Google Maps Scraper..." -ForegroundColor Yellow

try {

    docker compose up -d google-maps-scraper

    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao subir container."
    }

}
catch {

    Write-Host ""
    Write-Host "Erro ao iniciar Google Maps Scraper." -ForegroundColor Red
    Write-Host $_
    Read-Host "Pressione ENTER para sair"
    exit 1
}

Write-Host "[OK] Container iniciado." -ForegroundColor Green


# ------------------------------------------------------------
# 5. Espera API do scraper responder
# ------------------------------------------------------------

Write-Host ""
Write-Host "[4/4] Aguardando API do scraper..." -ForegroundColor Yellow

$scraperReady = $false
$maxScraperAttempts = 30

for ($i = 1; $i -le $maxScraperAttempts; $i++) {

    try {

        $response = Invoke-WebRequest `
            -Uri "http://127.0.0.1:8080/api/v1/jobs" `
            -UseBasicParsing `
            -TimeoutSec 3

        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            $scraperReady = $true
            break
        }

    }
    catch {
    }

    Write-Host "." -NoNewline -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}

Write-Host ""

if ($scraperReady) {

    Write-Host "[OK] Google Maps Scraper respondendo na porta 8080." -ForegroundColor Green

}
else {

    Write-Host "[AVISO] Container iniciou, mas a API ainda nao respondeu." -ForegroundColor Yellow
    Write-Host "O LeadFlow sera iniciado mesmo assim."
    Write-Host ""
    Write-Host "Para conferir logs:"
    Write-Host "npm run scraper:logs" -ForegroundColor Cyan
}


# ------------------------------------------------------------
# Status
# ------------------------------------------------------------

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "             TUDO PRONTO" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

Write-Host ""
Write-Host "Docker:        OK" -ForegroundColor Green
Write-Host "Maps Scraper:  iniciado" -ForegroundColor Green
Write-Host "API Scraper:   http://127.0.0.1:8080"
Write-Host "LeadFlow:      iniciando..."
Write-Host ""

docker compose ps google-maps-scraper

Write-Host ""
Write-Host "Iniciando Next.js..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Para encerrar o LeadFlow: CTRL + C"
Write-Host ""


# ------------------------------------------------------------
# Inicia LeadFlow
# ------------------------------------------------------------

npm run dev