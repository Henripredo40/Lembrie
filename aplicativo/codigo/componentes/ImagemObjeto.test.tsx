import { render } from '@testing-library/react-native';
import { describe, expect, test } from '@jest/globals';
import ImagemObjeto from './ImagemObjeto';

describe('ImagemObjeto', () => {
  test('usa a ilustração local e descreve o objeto para acessibilidade', async () => {
    const tela = await render(<ImagemObjeto nome="Chave reserva" categoria="Chaves" />);
    expect(tela.getByLabelText('Ilustração de Chave reserva')).toBeTruthy();
  });

  test('mostra a foto quando existe imagem remota', async () => {
    const tela = await render(<ImagemObjeto nome="Mochila" imagemUri="https://exemplo.test/mochila.jpg" />);
    expect(tela.getByLabelText('Foto de Mochila')).toBeTruthy();
  });
});
