$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker não encontrado. Instale e abra o Docker Desktop e tente novamente.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js/npm não encontrado. Instale o Node.js e tente novamente.'
}

docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  throw 'Não foi possível iniciar o banco e a API. Confira se o Docker Desktop está aberto.'
}

$aplicativo = Join-Path $raiz 'aplicativo'
$envAplicativo = Join-Path $aplicativo '.env'
if (-not (Test-Path -LiteralPath $envAplicativo)) {
  Copy-Item -LiteralPath (Join-Path $aplicativo '.env.example') -Destination $envAplicativo
}

Push-Location $aplicativo
try {
  if (-not (Test-Path -LiteralPath (Join-Path $aplicativo 'node_modules'))) {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar as dependências do app.' }
  }
  npx expo start --web
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o app web.' }
}
finally {
  Pop-Location
}
