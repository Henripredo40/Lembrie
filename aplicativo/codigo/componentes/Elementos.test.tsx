import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, jest, test } from '@jest/globals';
import { Aviso, Botao, CampoTexto, EstadoVazio, TituloSecao } from './Elementos';

describe('componentes reutilizáveis', () => {
  test('Botao dispara a ação e respeita o estado desativado', async () => {
    const aoPressionar = jest.fn();
    const tela = await render(<Botao título="Salvar" aoPressionar={aoPressionar} />);
    await fireEvent.press(tela.getByRole('button', { name: 'Salvar' }));
    expect(aoPressionar).toHaveBeenCalledTimes(1);

    await tela.rerender(<Botao título="Salvar" aoPressionar={aoPressionar} desativado />);
    expect(tela.getByRole('button', { name: 'Salvar' }).props.accessibilityState.disabled).toBe(true);
  });

  test('Botao comunica carregamento e bloqueia novo toque', async () => {
    const aoPressionar = jest.fn();
    const tela = await render(<Botao título="Entrar" aoPressionar={aoPressionar} carregando />);
    await fireEvent.press(tela.getByRole('button', { name: 'Entrar' }));
    expect(aoPressionar).not.toHaveBeenCalled();
    expect(tela.getByRole('button', { name: 'Entrar' }).props.accessibilityState.busy).toBe(true);
  });

  test('CampoTexto expõe rótulo, valor e erro', async () => {
    const tela = await render(<CampoTexto rótulo="E-mail" value="teste@exemplo.com" erro="E-mail inválido" />);
    expect(tela.getByLabelText('E-mail').props.value).toBe('teste@exemplo.com');
    expect(tela.getByText('E-mail inválido')).toBeTruthy();
  });

  test('TituloSecao chama a ação opcional', async () => {
    const aoPressionar = jest.fn();
    const tela = await render(<TituloSecao título="OBJETOS" ação="Ver todos" aoPressionar={aoPressionar} />);
    await fireEvent.press(tela.getByRole('button', { name: 'Ver todos' }));
    expect(aoPressionar).toHaveBeenCalledTimes(1);
  });

  test('EstadoVazio apresenta explicação e ação', async () => {
    const aoPressionar = jest.fn();
    const tela = await render(<EstadoVazio título="Sem objetos" texto="Cadastre um para começar." ação="Cadastrar" aoPressionar={aoPressionar} />);
    expect(tela.getByText('Cadastre um para começar.')).toBeTruthy();
    await fireEvent.press(tela.getByRole('button', { name: 'Cadastrar' }));
    expect(aoPressionar).toHaveBeenCalledTimes(1);
  });

  test('Aviso exibe a mensagem recebida', async () => {
    const tela = await render(<Aviso texto="Verifique sua conexão." tom="erro" />);
    expect(tela.getByText('Verifique sua conexão.')).toBeTruthy();
  });
});
