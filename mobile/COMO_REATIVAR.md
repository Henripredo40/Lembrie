# Abrir o app localmente

Requisitos: Node.js, npm e Docker Desktop.

1. Na raiz do projeto, inicie API e banco: `docker compose up --build`.
2. No PowerShell, abra `mobile` e execute:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   npm ci
   npx expo start --web
   ```

3. Abra no navegador o endereço mostrado pelo Expo.

Para gerar o site web, use `npm run build:web`. Para iniciar a API e o banco, veja o README da raiz. Bluetooth físico requer o app Android/iOS nativo.
