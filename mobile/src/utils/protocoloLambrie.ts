import type { ResumoSaidaBluetooth } from './resumoSaidaBluetooth';

const CARACTERES_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function codificarBase64(bytes: number[]) {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    texto += CARACTERES_BASE64[a >> 2];
    texto += CARACTERES_BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    texto += b === undefined ? '=' : CARACTERES_BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    texto += c === undefined ? '=' : CARACTERES_BASE64[c & 63];
  }
  return texto;
}

export function criarPacotesResumoLambrie(resumo: ResumoSaidaBluetooth, tamanhoPacote = 18) {
  const json = JSON.stringify({
    destination: resumo.destination || 'Saida',
    items: resumo.items.join(', ') || 'Todos os essenciais conferidos',
  }) + '\n';
  const bytes = Array.from(unescape(encodeURIComponent(json)), (caractere) => caractere.charCodeAt(0));
  const pacotes: string[] = [];
  for (let início = 0; início < bytes.length; início += tamanhoPacote) {
    pacotes.push(codificarBase64(bytes.slice(início, início + tamanhoPacote)));
  }
  return pacotes;
}
