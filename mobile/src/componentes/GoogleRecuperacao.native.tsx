import React, { useEffect } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { cores } from '../tema';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleRecuperacao({ aoReceberToken, aoFalhar, carregando = false }) {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  const clientId = Platform.OS === 'android' ? androidClientId : Platform.OS === 'ios' ? iosClientId : webClientId;
  const configurado = Boolean(webClientId && clientId);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId || 'CLIENT_ID_NAO_CONFIGURADO',
    androidClientId: androidClientId || 'CLIENT_ID_NAO_CONFIGURADO',
    iosClientId: iosClientId || 'CLIENT_ID_NAO_CONFIGURADO',
    scopes: ['openid', 'email', 'profile'],
    selectAccount: true,
  }, { scheme: 'lembre', path: 'auth/google' });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.authentication?.idToken || response.params?.id_token;
      if (idToken) aoReceberToken(idToken);
      else aoFalhar('O Google não retornou um token de identidade. Tente novamente.');
    } else if (response.type === 'error') {
      aoFalhar('Não foi possível confirmar sua conta Google. Tente novamente.');
    }
  }, [response, aoReceberToken, aoFalhar]);

  if (!configurado) {
    return <Text style={{ color: cores.textoSuave, fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 12 }}>
      A recuperação com Google precisa dos IDs OAuth do aplicativo.
    </Text>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!request || carregando}
      onPress={() => promptAsync()}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: '#D8DCE5',
        backgroundColor: pressed ? '#F3F4F7' : '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        opacity: !request || carregando ? 0.55 : 1,
      })}
    >
      <Text style={{ color: cores.texto, fontSize: 13, fontWeight: '800' }}>Continuar com Google</Text>
    </Pressable>
  );
}
