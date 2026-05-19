# DetailGo

Aplicativo mobile de agendamentos para estéticas/barbearias. Plataforma SaaS multi-tenant onde cada estabelecimento é um `shop` independente.

## Stack

- **React Native** + Expo (mobile)
- **Firebase** — Firestore (banco), Auth, Cloud Functions
- **TypeScript** (strict)
- **React Navigation** — Native Stack
- **MercadoPago** — pagamento via Pix
- **Lucide React Native** — ícones

## Arquitetura

### Multi-tenant

- Cada estabelecimento é um documento em `shops/{shopId}`
- **Toda query no Firestore deve ser filtrada por `shopId`** — nunca buscar dados sem escopo de shop
- Owner cria o shop no cadastro e recebe um `inviteCode` para compartilhar com clientes
- Customer entra no shop usando o `inviteCode`

### Roles

```
UserRole = 'owner' | 'customer'
```

- `owner` → acessa painel admin (AdminDashboard, AdminManage, AdminHistory)
- `customer` → acessa painel de agendamentos (Dashboard, Appointment, MyAppointments, History)
- Verificação via `isOwner()` / `isCustomer()` de `@features/auth/utils/roles.ts`

### Subscription (owner)

- Trial: 14 dias gratuitos após cadastro (`trialEndsAt`)
- Pago: geração de Pix via Cloud Function `createPixCharge`
- `isSubscriptionActive` controlado pelo `ShopContext`
- Owner sem assinatura ativa → redirecionado para `SubscriptionScreen`
- Preço atual: R$ 89,00/mês (em DEV está R$ 0,01 — alterar antes do lançamento)

## Estrutura de Pastas

```
src/
  app/              → tipos globais (RootStackParamList)
  navigation/       → RootNavigator
  features/
    auth/           → login, registro, AuthContext, roles
    shops/          → ShopContext, shop.service, shopServices.service, joinShop.service
    appointments/   → agendamentos (customer)
    admin/          → painel do owner
    dashboard/      → tela inicial do customer
    profile/        → perfil do usuário
    settings/       → configurações do shop (owner)
    subscription/   → tela de assinatura (owner)
  shared/
    components/     → componentes reutilizáveis (Input, SelectModal, SplashScreen)
    constants/      → app.constants (UI tokens)
    hooks/          → useFirestoreCache, useForm
    theme/          → colors, typography, spacing, radii, borders, surfaces
    utils/          → firebase.utils, date.utils, format.utils, string.utils, validation.utils
functions/
  src/
    index.ts        → entry point das Cloud Functions
    payment/        → createPixCharge, mercadoPagoWebhook
```

## Convenções de Código

### Estrutura por feature

Cada feature segue o padrão:

```
features/{nome}/
  components/   → componentes visuais da feature
  context/      → contextos React (se houver)
  data/         → repositórios e normalizers do Firestore
  domain/       → types, constants, helpers, pricing, rules
  hooks/        → hooks customizados
  screens/      → telas navegáveis
  services/     → lógica de negócio / acesso ao Firestore
  utils/        → utilitários específicos da feature
  index.ts      → exports públicos da feature
```

### Imports com alias

```ts
@app/        → src/app/
@features/   → src/features/
@shared/     → src/shared/
```

### Serviços e Firestore

- **Nunca acessar Firestore diretamente nas screens** — sempre via service
- Services retornam `{ ok: true, data }` ou `{ ok: false, message, code? }`
- Normalizers ficam em `data/*.normalizers.ts` — convertem documentos Firestore em tipos TypeScript

### Tema

```ts
import { useAppTheme } from '@shared/theme';
const { colors: D, isLight } = useAppTheme();
```

- Usar sempre `D.primary`, `D.bg`, `D.text`, etc — nunca cores hardcoded
- Estilos criados com `useMemo(() => createStyles(D), [D])` para reagir ao tema

## Coleções Firestore

```
shops/{shopId}
  settings/config          → ShopSettings (openHour, closeHour, slotStepMin, parallelCapacity)
  appointments/{appointmentId}  → agendamentos globais do shop
  services/{serviceId}     → serviços oferecidos

users/{uid}
  appointments/{id}        → subcoleção de agendamentos do customer (para listagem rápida)
```

## Status de Agendamento

```ts
AppointmentStatus = 'scheduled' | 'in_progress' | 'done' | 'cancelled' | 'no_show';
```

- `scheduled` → agendado, aguardando
- `in_progress` → em atendimento
- `done` → concluído
- `cancelled` → cancelado pelo cliente
- `no_show` → cliente não compareceu

## Configurações Padrão do Shop

```ts
openHour: 8;
closeHour: 18;
slotStepMin: 30; // slots de 30 minutos
parallelCapacity: 2; // atendimentos simultâneos
```

## Navegação (RootNavigator)

```
Não logado       → Login, Register
Owner + trial/ativo → AdminDashboard, AdminManage, AdminHistory, AdminProfile
Owner + sem assinatura → Subscription
Customer        → Dashboard, Appointment, MyAppointments, History, Profile
```

## Regras de Negócio Importantes

- Agendamento só pode ser cancelado se ainda não expirou (`startAtMs > now`)
- `no_show` tem grace period (`NO_SHOW_GRACE_MS`) antes de ser marcado automaticamente
- Customer pode reagendar após `no_show`
- Slots de disponibilidade calculados por `availability.service.ts` respeitando `parallelCapacity`
- Preço do serviço vem de `appointment.pricing.ts`

## Cloud Functions

- `createPixCharge` — gera cobrança Pix via MercadoPago (requer `idToken` no header)
- `mercadoPagoWebhook` — webhook para confirmar pagamento e ativar assinatura
- URL base: `https://us-central1-magic-auto.cloudfunctions.net/`

## Mensagens e UI

- Mensagens de erro e UI **sempre em português**
- Textos de validação e alertas em português
- Datas no formato brasileiro (`dd/MM/yyyy`, `HH:mm`)
