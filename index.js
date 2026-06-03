/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Handler de mensagens em background (exigido pelo RNFirebase). O sino in-app
// se atualiza pelo Firestore; o push é exibido pelo próprio sistema, então
// aqui basta um no-op para registrar o handler.
setBackgroundMessageHandler(getMessaging(), async () => {});

// Handler de eventos do notifee em background (toque/dispensa da notificação).
// No-op por enquanto — registrá-lo evita o warning e prepara o tratamento de
// toque na notificação no futuro.
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);
