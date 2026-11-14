import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { enviarResumoPerimetroParaLambrie } from '../telas/TelaBluetooth';

const NOME_TAREFA = 'lembre-perimetro-saida';
const CHAVE_MONITORAMENTO = '@lembre/perimetro-monitoramento';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type MonitoramentoPerimetro = {
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  items: string[];
  bleId?: string;
  dentro: boolean;
  ativo: boolean;
};

async function lerMonitoramento(): Promise<MonitoramentoPerimetro | null> {
  const salvo = await AsyncStorage.getItem(CHAVE_MONITORAMENTO);
  if (!salvo) return null;
  try {
    return JSON.parse(salvo) as MonitoramentoPerimetro;
  } catch {
    return null;
  }
}

async function salvarMonitoramento(monitoramento: MonitoramentoPerimetro) {
  await AsyncStorage.setItem(CHAVE_MONITORAMENTO, JSON.stringify(monitoramento));
}

if (!TaskManager.isTaskDefined(NOME_TAREFA)) {
  TaskManager.defineTask(NOME_TAREFA, async ({ data, error }) => {
    if (error || !data) return;
    const evento = data as { eventType?: Location.GeofencingEventType; region?: Location.LocationRegion };
    const monitoramento = await lerMonitoramento();
    if (!monitoramento?.ativo || evento.region?.identifier !== 'lembre-casa') return;

    if (evento.eventType === Location.GeofencingEventType.Enter) {
      monitoramento.dentro = true;
      await salvarMonitoramento(monitoramento);
      return;
    }
    if (evento.eventType !== Location.GeofencingEventType.Exit || !monitoramento.dentro) return;

    monitoramento.dentro = false;
    await salvarMonitoramento(monitoramento);
    const itens = monitoramento.items;
    const resumo = {
      destination: monitoramento.nome,
      items: itens,
      updatedAt: Date.now(),
      alert: true,
    };
    const texto = itens.length
      ? `Confira os itens do checklist: ${itens.join(', ')}.`
      : 'Você saiu do perímetro salvo. Não há itens marcados para lembrar.';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Atenção: você saiu de ${monitoramento.nome}`,
        body: texto,
        data: { tipo: 'saida_perimetro', destination: monitoramento.nome, items: itens },
      },
      trigger: null,
    }).catch(() => {});

    await enviarResumoPerimetroParaLambrie(resumo, monitoramento.bleId).catch(() => false);
  });
}

export async function iniciarPerimetroEmSegundoPlano(dados: {
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  items: string[];
  bleId?: string;
}) {
  if (Platform.OS === 'web') throw new Error('O aviso em segundo plano está disponível no aplicativo instalado no celular.');
  if (Location.isBackgroundLocationAvailableAsync && !(await Location.isBackgroundLocationAvailableAsync())) {
    throw new Error('Este celular não permite acompanhar localização em segundo plano.');
  }
  const primeiroPlano = await Location.requestForegroundPermissionsAsync();
  if (primeiroPlano.status !== 'granted') throw new Error('Permita a localização para ativar o aviso.');
  const segundoPlano = await Location.requestBackgroundPermissionsAsync();
  if (segundoPlano.status !== 'granted') {
    throw new Error('Permita localização o tempo todo nas configurações do celular para receber o aviso em segundo plano.');
  }
  const notificações = await Notifications.requestPermissionsAsync();
  const permissãoDeNotificação = notificações as unknown as { granted?: boolean; status?: string };
  if (permissãoDeNotificação.granted !== true && permissãoDeNotificação.status !== 'granted') {
    throw new Error('Permita notificações para receber o aviso ao sair do perímetro.');
  }
  if (Location.hasServicesEnabledAsync && !(await Location.hasServicesEnabledAsync())) {
    throw new Error('Ative o GPS do celular para acompanhar o perímetro.');
  }
  await Notifications.setNotificationChannelAsync('lembre-perimetro', {
    name: 'Avisos de perímetro',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
  });
  const posição = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const latitudeAtual = posição.coords.latitude;
  const longitudeAtual = posição.coords.longitude;
  const radianos = (graus: number) => graus * Math.PI / 180;
  const diferençaLatitude = radianos(latitudeAtual - dados.latitude);
  const diferençaLongitude = radianos(longitudeAtual - dados.longitude);
  const a = Math.sin(diferençaLatitude / 2) ** 2
    + Math.cos(radianos(dados.latitude)) * Math.cos(radianos(latitudeAtual))
    * Math.sin(diferençaLongitude / 2) ** 2;
  const distância = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const monitoramento: MonitoramentoPerimetro = {
    ...dados,
    dentro: distância <= dados.raio,
    ativo: true,
  };
  await salvarMonitoramento(monitoramento);
  try {
    await Location.startGeofencingAsync(NOME_TAREFA, [{
      identifier: 'lembre-casa',
      latitude: dados.latitude,
      longitude: dados.longitude,
      radius: dados.raio,
      notifyOnEnter: true,
      notifyOnExit: true,
      state: monitoramento.dentro ? Location.GeofencingRegionState.Inside : Location.GeofencingRegionState.Outside,
    }]);
  } catch (falha) {
    await salvarMonitoramento({ ...monitoramento, ativo: false });
    throw falha;
  }
}

export async function pararPerimetroEmSegundoPlano() {
  if (await Location.hasStartedGeofencingAsync(NOME_TAREFA)) {
    await Location.stopGeofencingAsync(NOME_TAREFA);
  }
  const monitoramento = await lerMonitoramento();
  if (monitoramento) await salvarMonitoramento({ ...monitoramento, ativo: false });
}

export async function atualizarItensDoPerimetro(items: string[]) {
  const monitoramento = await lerMonitoramento();
  if (monitoramento?.ativo) await salvarMonitoramento({ ...monitoramento, items });
}

export async function perimetroEmSegundoPlanoAtivo() {
  return Location.hasStartedGeofencingAsync(NOME_TAREFA).catch(() => false);
}
