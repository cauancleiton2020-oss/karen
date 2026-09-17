# run-local.ps1 - instala Node (via winget) se necessário e inicia o projeto
# Execute no PowerShell (recomendo: executar como Administrador para winget)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $projectRoot

Write-Host "Projeto: $projectRoot"

# Checa Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node não encontrado."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Tentando instalar Node LTS via winget... (pode pedir permissão de admin)"
        winget install --id OpenJS.NodeJS.LTS -e --silent
        Start-Sleep -Seconds 2
    } else {
        Write-Host "winget não disponível. Instale Node manualmente: https://nodejs.org/"
        exit 1
    }
} else {
    Write-Host "Node encontrado: $(node -v)"
}

# Verifica npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm não encontrado. Verifique instalação do Node e reinicie o terminal."
    exit 1
} else {
    Write-Host "npm encontrado: $(npm -v)"
}

Write-Host "Instalando dependências (npm install)..."
npm install

# Copia .env.example para .env se necessário
if (Test-Path .env) {
    Write-Host ".env já existe"
} elseif (Test-Path .env.example) {
    Copy-Item .env.example .env
    Write-Host "Copiado .env.example para .env"
} else {
    Write-Host "Nenhum .env.example encontrado. Crie .env manualmente se necessário."
}

Write-Host "Iniciando servidor (npm start)..."
npm start
