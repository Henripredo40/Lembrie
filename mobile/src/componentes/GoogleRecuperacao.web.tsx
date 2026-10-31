import React, { useEffect, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import { cores } from '../tema';

type GoogleCredential = { credential?: string };
type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (response: GoogleCredential) => void; auto_select?: boolean }) => void;
  renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string; shape: string; width: number }) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } };
  }
}

let carregamentoGoogle: Promise<void> | null = null;

function carregarGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (carregamentoGoogle) return carregamentoGoogle;

  carregamentoGoogle = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      document.head.appendChild(script);
    }

    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Não foi possível carregar o acesso do Google.')), { once: true });
  });
  return carregamentoGoogle;
}

export default function GoogleRecuperacao({ aoReceberToken, aoFalhar, carregando = false }: {
  aoReceberToken: (token: string) => void;
  aoFalhar: (mensagem: string) => void;
  carregando?: boolean;
}) {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const elementoBotao = useRef<any>(null);
  const receberToken = useRef(aoReceberToken);
  const reportarFalha = useRef(aoFalhar);
  receberToken.current = aoReceberToken;
  reportarFalha.current = aoFalhar;

  useEffect(() => {
    if (Platform.OS !== 'web' || !webClientId || !elementoBotao.current) return;
    let ativo = true;
    carregarGoogleIdentityServices()
      .then(() => {
        if (!ativo || !elementoBotao.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: webClientId,
          auto_select: false,
          callback: resposta => {
            if (resposta.credential) receberToken.current(resposta.credential);
            else reportarFalha.current('O Google não retornou um token de identidade. Tente novamente.');
          },
        });
        window.google.accounts.id.renderButton(elementoBotao.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 300,
        });
      })
      .catch(() => reportarFalha.current('Não foi possível carregar o acesso do Google. Confira sua conexão e tente novamente.'));

    return () => { ativo = false; };
  }, [webClientId]);

  if (!webClientId) {
    return <Text style={{ color: cores.textoSuave, fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 12 }}>
      A recuperação com Google precisa do ID OAuth web do aplicativo.
    </Text>;
  }

  return <View ref={elementoBotao} accessibilityLabel={carregando ? 'Aguarde a recuperação da senha' : 'Continuar com Google'} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12, opacity: carregando ? 0.55 : 1 }} />;
}
