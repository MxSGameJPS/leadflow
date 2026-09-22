# ============================================================
# LeadFlow - Inicialização automática
# Docker Desktop + Google Maps Scraper + Next.js
# ============================================================

$ErrorActionPreference = "Stop"

# O projeto será sempre a pasta onde este script está
$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "          INICIANDO LEADFLOW" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# FUNÇÃO: Verifica se Docker Engine está funcionando
# ------------------------------------------------------------

function Test-DockerEngine {

    try {

        $serverVersion = docker version `
            --format "{{.Server.Version}}" `
            2>$null

        if ($LASTEXITCODE -eq 0 -and $serverVersion) {
            return $true
        }

    }
    catch {
    }

    return $false
}


# ------------------------------------------------------------
# FUNÇÃO: Localiza Docker Desktop
# ------------------------------------------------------------

function Find-DockerDesktop {

    $possiblePaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker Desktop.exe"
    )

    foreach ($path in $possiblePaths) {

        if ($path -and (Test-Path $path)) {
            return @{
                Type = "exe"
                Value = $path
            }
        }
    }

    # Procura no menu iniciar / aplicativos registrados
    try {

        $app = Get-StartApps |
        Where-Object {
            $_.Name -like "*Docker Desktop*"
        } |
        Select-Object -First 1

        if ($app) {

            return @{
                Type = "app"
                Value = $app.AppID
            }
        }

    }
    catch {
    }

    # Procura no registro do Windows
    $registryPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )

    foreach ($registry in $registryPaths) {

        try {

            $docker = Get-ItemProperty $registry -ErrorAction SilentlyContinue |
            Where-Object {
                $_.DisplayName -like "*Docker Desktop*"
            } |
            Select-Object -First 1

            if ($docker) {

                if ($docker.InstallLocation) {

                    $exe = Join-Path $docker.InstallLocation "Docker Desktop.exe"

                    if (Test-Path $exe) {

                        return @{
                            Type = "exe"
                            Value = $exe
                        }
                    }
                }
            }

        }
        catch {
        }
    }

    return $null
}


# ------------------------------------------------------------
# 1. Verifica comando Docker
# ------------------------------------------------------------

Write-Host "[1/5] Verificando Docker..." -ForegroundColor Yellow

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue

if (-not $dockerCommand) {

    Write-Host ""
    Write-Host "[ERRO] Comando docker nao encontrado." -ForegroundColor Red
    Write-Host ""
    Write-Host "Docker Desktop precisa estar instalado."
    Write-Host ""

    Read-Host "Pressione ENTER para sair"
    exit 1
}

Write-Host "[OK] Docker CLI encontrado:" -ForegroundColor Green
Write-Host "     $($dockerCommand.Source)" -ForegroundColor DarkGray


# ------------------------------------------------------------
# 2. Inicia Docker Desktop se necessário
# ------------------------------------------------------------

if (Test-DockerEngine) {

    Write-Host "[OK] Docker Engine ja esta funcionando." -ForegroundColor Green

}
else {

    Write-Host ""
    Write-Host "[2/5] Docker Engine parado." -ForegroundColor Yellow
    Write-Host "Procurando Docker Desktop..." -ForegroundColor Yellow

    $dockerDesktop = Find-DockerDesktop

    if (-not $dockerDesktop) {

        Write-Host ""
        Write-Host "[ERRO] Docker Desktop esta instalado, mas nao consegui localizar o aplicativo." -ForegroundColor Red
        Write-Host ""
        Write-Host "Execute este comando e me envie o resultado:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host 'Get-StartApps | Where-Object { $_.Name -like "*Docker*" }' -ForegroundColor Cyan
        Write-Host ""

        Read-Host "Pressione ENTER para sair"
        exit 1
    }


    if ($dockerDesktop.Type -eq "exe") {

        Write-Host ""
        Write-Host "Docker Desktop encontrado:" -ForegroundColor Green
        Write-Host $dockerDesktop.Value -ForegroundColor DarkGray

        Start-Process $dockerDesktop.Value

    }
    elseif ($dockerDesktop.Type -eq "app") {

        Write-Host ""
        Write-Host "Docker Desktop encontrado no Menu Iniciar." -ForegroundColor Green

        Start-Process "shell:AppsFolder\$($dockerDesktop.Value)"
    }


    # --------------------------------------------------------
    # Aguarda Docker Engine
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "Aguardando Docker Engine iniciar..." -ForegroundColor Yellow

    $dockerReady = $false

    for ($i = 1; $i -le 90; $i++) {

        if (Test-DockerEngine) {

            $dockerReady = $true
            break
        }

        Write-Host "." -NoNewline -ForegroundColor DarkGray

        Start-Sleep -Seconds 2
    }

    Write-Host ""

    if (-not $dockerReady) {

        Write-Host ""
        Write-Host "[ERRO] Docker Desktop abriu, mas o Engine nao ficou pronto." -ForegroundColor Red
        Write-Host ""
        Write-Host "Abra o Docker Desktop e veja se existe alguma mensagem de erro."
        Write-Host ""

        Read-Host "Pressione ENTER para sair"
        exit 1
    }

    Write-Host "[OK] Docker Engine pronto." -ForegroundColor Green
}


# ------------------------------------------------------------
# 3. Abre pasta do LeadFlow
# ------------------------------------------------------------

Write-Host ""
Write-Host "[3/5] Verificando LeadFlow..." -ForegroundColor Yellow

if (-not (Test-Path $ProjectPath)) {

    Write-Host "[ERRO] Pasta do projeto nao encontrada." -ForegroundColor Red
    Read-Host "Pressione ENTER para sair"
    exit 1
}

Set-Location $ProjectPath

Write-Host "Projeto:" -ForegroundColor DarkGray
Write-Host $ProjectPath -ForegroundColor DarkGray

if (-not (Test-Path ".\package.json")) {

    Write-Host ""
    Write-Host "[ERRO] package.json nao encontrado." -ForegroundColor Red
    Write-Host "O script precisa ficar na raiz do LeadFlow."

    Read-Host "Pressione ENTER para sair"
    exit 1
}

if (-not (Test-Path ".\docker-compose.yml")) {

    Write-Host ""
    Write-Host "[ERRO] docker-compose.yml nao encontrado." -ForegroundColor Red

    Read-Host "Pressione ENTER para sair"
    exit 1
}

Write-Host "[OK] LeadFlow encontrado." -ForegroundColor Green


# ------------------------------------------------------------
# 4. Inicia Google Maps Scraper
# ------------------------------------------------------------

Write-Host ""
Write-Host "[4/5] Iniciando Google Maps Scraper..." -ForegroundColor Yellow

try {

    docker compose up -d google-maps-scraper

    if ($LASTEXITCODE -ne 0) {
        throw "docker compose retornou erro."
    }

}
catch {

    Write-Host ""
    Write-Host "[ERRO] Nao foi possivel iniciar o scraper." -ForegroundColor Red
    Write-Host $_

    Read-Host "Pressione ENTER para sair"
    exit 1
}

Write-Host "[OK] Container iniciado." -ForegroundColor Green


# ------------------------------------------------------------
# Aguarda API do scraper
# ------------------------------------------------------------

Write-Host ""
Write-Host "Aguardando API do Google Maps Scraper..." -ForegroundColor Yellow

$scraperReady = $false

for ($i = 1; $i -le 45; $i++) {

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

    Write-Host "[OK] Google Maps Scraper online." -ForegroundColor Green
    Write-Host "     http://127.0.0.1:8080" -ForegroundColor DarkGray

}
else {

    Write-Host ""
    Write-Host "[AVISO] Container iniciou, mas a API ainda nao respondeu." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Logs:"
    Write-Host "docker compose logs -f google-maps-scraper" -ForegroundColor Cyan
}


# ------------------------------------------------------------
# 5. Status
# ------------------------------------------------------------

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "             LEADFLOW PRONTO" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

docker compose ps google-maps-scraper

Write-Host ""
Write-Host "Docker Engine : OK" -ForegroundColor Green

if ($scraperReady) {
    Write-Host "Maps Scraper  : OK" -ForegroundColor Green
}
else {
    Write-Host "Maps Scraper  : VERIFICAR" -ForegroundColor Yellow
}

Write-Host "LeadFlow      : INICIANDO" -ForegroundColor Cyan

Write-Host ""
Write-Host "[5/5] Iniciando Next.js..." -ForegroundColor Yellow
Write-Host ""
Write-Host "CTRL + C encerra o servidor Next.js."
Write-Host ""


# ------------------------------------------------------------
# Inicia LeadFlow
# ------------------------------------------------------------

npm run dev