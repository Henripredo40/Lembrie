# Como reativar o Lembriê

As pastas `node_modules` e `dist` foram removidas para liberar espaço. O código, imagens, configurações e dependências registradas continuam no projeto.

## Abrir o app localmente no navegador

1. Instale Node.js (inclui npm), se ainda não estiver instalado.
2. Abra o PowerShell na pasta `mobile` deste projeto.
3. Execute:

   ```powershell
   npm ci
   npx expo start --web
   ```

4. Abra no navegador o endereço local mostrado pelo Expo, normalmente `http://localhost:8081`.

O arquivo `.env` local foi preservado. Para login e dados, a API também precisa estar rodando; consulte as instruções de inicialização do servidor no README da raiz. A URL `localhost` funciona neste computador, não como endereço público para outros aparelhos.

## Recriar a versão web compilada

Na pasta `mobile`, execute:

```powershell
npm ci
npm run build:web
```

Isso recria `dist`. Para abrir o site pela internet/Google, publique essa versão em um serviço de hospedagem com a API configurada. Apagar a pasta local `dist` não apaga uma publicação que já esteja hospedada.

## Android

Na pasta `mobile`, execute `npm ci` e siga o fluxo de build Android configurado para o projeto. O Bluetooth BLE exige o app Android nativo; a versão aberta no navegador não envia dados à ESP32 por BLE.
