export function formatarData(valor) {
  if (!valor) return 'Ainda sem registros';

  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? String(valor)
    : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
