import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, jest, test } from '@jest/globals';
import TelaAcessoSeguranca from './TelaAcessoSeguranca';
import TelaAssistente from './TelaAssistente';
import TelaAutenticacao from './TelaAutenticacao';
import TelaBluetooth from './TelaBluetooth';
import TelaConfiguracoes from './TelaConfiguracoes';
import TelaHistorico from './TelaHistorico';
import TelaInicio from './TelaInicio';
import TelaMapaRotina from './TelaMapaRotina';
import TelaObjetos from './TelaObjetos';
import TelaPerfil from './TelaPerfil';
import TelaSaida from './TelaSaida';

jest.mock('../componentes/GoogleRecuperacao', () => ({ __esModule: true, default: () => null }));
jest.mock('../componentes/MapaLibre', () => ({ __esModule: true, default: () => null }));

const apiPadrao = async () => [];
const notificar = jest.fn();

describe('telas principais do Lembriê', () => {
  test('Autenticação mostra entrada e permite alternar para cadastro', async () => {
    const tela = await render(<TelaAutenticacao entrar={jest.fn()} cadastrar={jest.fn()} recuperarSenha={jest.fn()} recuperarSenhaGoogle={jest.fn()} carregando={false} />);
    expect(tela.getByText(/Seus itens importantes/)).toBeTruthy();
    await fireEvent.press(tela.getByRole('tab', { name: 'Criar conta' }));
    expect(tela.getByLabelText('Seu nome')).toBeTruthy();
  });

  test('Configurações mostra preferências e ações de conta', async () => {
    const tela = await render(<TelaConfiguracoes perfil={{ name: 'Ana', email: 'ana@example.com' }} configuracoes={{ preventive_alerts: true }} salvarConfiguracoes={jest.fn()} abrirPerfil={jest.fn()} salvando={false} saindo={false} sairDaConta={jest.fn()} />);
    expect(tela.getByText('Configurações')).toBeTruthy();
    expect(tela.getByText('Lembretes preventivos')).toBeTruthy();
    expect(tela.getByText('Sair da conta')).toBeTruthy();
  });

  test('Histórico apresenta atividade e estado vazio', async () => {
    const vazio = await render(<TelaHistorico eventos={[]} />);
    expect(vazio.getByText('Ainda não há atividades')).toBeTruthy();
    await vazio.unmount();
    const preenchido = await render(<TelaHistorico eventos={[{ id: 1, type: 'locate', message: 'Chaveiro localizado', created_at: '2026-11-12T10:00:00Z' }]} />);
    expect(preenchido.getByText('Chaveiro localizado')).toBeTruthy();
  });

  test('Início apresenta a saudação e permite abrir o Bluetooth', async () => {
    const abrirTela = jest.fn();
    const tela = await render(<TelaInicio perfil={{ name: 'Ana' }} seguranca={null} objetos={[]} busca="" definirBusca={jest.fn()} abrirTela={abrirTela} atualizar={jest.fn()} atualizando={false} erroConexao="" mostrarAlertas={false} api={apiPadrao} rotinaAtiva={false} />);
    expect(tela.getByText('Vamos cuidar do que importa?')).toBeTruthy();
    await fireEvent.press(tela.getByRole('button', { name: 'Ver detalhes do último login' }));
    expect(abrirTela).toHaveBeenCalledWith('acesso');
  });

  test('Objetos mostra o formulário de cadastro', async () => {
    const tela = await render(<TelaObjetos objetos={[]} definirObjetos={jest.fn()} api={apiPadrao} notificar={notificar} />);
    expect(tela.getByText('Meus objetos')).toBeTruthy();
  });

  test('Perfil mostra os dados recebidos', async () => {
    const tela = await render(<TelaPerfil perfil={{ id: 1, name: 'Ana Silva', email: 'ana@example.com' }} salvarPerfil={jest.fn()} solicitarVerificacaoEmail={jest.fn()} alterarSenha={jest.fn()} recuperarSenha={jest.fn()} notificar={notificar} />);
    expect(tela.getByText('Meu perfil')).toBeTruthy();
    expect(tela.getByDisplayValue('Ana Silva')).toBeTruthy();
    expect(tela.getByDisplayValue('ana@example.com')).toBeTruthy();
  });

  test('Acesso e segurança exibe sessão registrada', async () => {
    const seguranca = { last_login: null, sessions: [] };
    const api = jest.fn(async () => seguranca);
    const tela = await render(<TelaAcessoSeguranca api={api} segurancaInicial={seguranca} />);
    expect(tela.getByText('Acesso e segurança')).toBeTruthy();
    expect(tela.getByText('Nenhuma sessão detalhada ainda')).toBeTruthy();
  });

  test('Assistente apresenta perguntas rápidas', async () => {
    const tela = await render(<TelaAssistente api={apiPadrao} />);
    expect(tela.getByText('Converse com Lembriê')).toBeTruthy();
    expect(tela.getByText('Como cadastro um objeto?')).toBeTruthy();
  });

  test('Bluetooth apresenta instruções sem dispositivo associado', async () => {
    const tela = await render(<TelaBluetooth objetos={[]} definirObjetos={jest.fn()} api={apiPadrao} notificar={notificar} abrirObjetos={jest.fn()} />);
    expect(tela.getByText('Bluetooth')).toBeTruthy();
    expect(tela.getByText('Como conectar')).toBeTruthy();
  });

  test('Mapa e rotina abre busca de locais', async () => {
    const tela = await render(<TelaMapaRotina api={apiPadrao} rotinaAtiva={false} abrirObjetos={jest.fn()} notificar={notificar} atualizarDados={jest.fn()} />);
    expect(tela.getByText('Mapa e rotina')).toBeTruthy();
  });

  test('Antes de sair explica a lista vazia', async () => {
    const tela = await render(<TelaSaida objetos={[]} api={apiPadrao} notificar={notificar} atualizarDados={jest.fn()} somenteEssenciais={false} salvarResumo={async () => {}} />);
    expect(tela.getByText('Antes de sair')).toBeTruthy();
    expect(tela.getByText('Adicione seus objetos primeiro')).toBeTruthy();
  });
});
