import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, jest, test } from '@jest/globals';
import CartaoObjeto from './CartaoObjeto';

describe('CartaoObjeto', () => {
  test('mostra os dados e o selo de item essencial', async () => {
    const tela = await render(<CartaoObjeto objeto={{ id: 4, name: 'Chaves de casa', category: 'Chaves', essential: true }} />);
    expect(tela.getByText('Chaves de casa')).toBeTruthy();
    expect(tela.getByText('ESSENCIAL')).toBeTruthy();
    expect(tela.queryByText('Sem dispositivo Bluetooth associado')).toBeNull();
  });

  test('disponibiliza ações de editar e remover', async () => {
    const aoEditar = jest.fn();
    const aoRemover = jest.fn();
    const tela = await render(<CartaoObjeto objeto={{ id: 7, name: 'Mochila', category: 'Viagem' }} aoEditar={aoEditar} aoRemover={aoRemover} />);
    fireEvent.press(tela.getByRole('button', { name: 'Editar Mochila' }));
    fireEvent.press(tela.getByRole('button', { name: 'Remover Mochila' }));
    expect(aoEditar).toHaveBeenCalledTimes(1);
    expect(aoRemover).toHaveBeenCalledTimes(1);
  });
});
