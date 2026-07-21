<p align="center">
  <a href="https://github.com/Nr1JNRP/DetailGo">
    <img width="250" src="docs/detailgo-logo.png" alt="Logo do DetailGo" />
  </a>
</p>

<h1 align="center">🚗 DetailGo</h1>

<div align="center">

Plataforma mobile de gestão e agendamento para estética automotiva, construída em React Native.

![React Native](https://img.shields.io/badge/React%20Native-0.7x-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Backend-orange?style=flat-square&logo=firebase)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

</div>

---

## 📑 Sumário

- [Sobre o projeto](#-sobre-o-projeto)
- [Proposta](#-proposta)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias utilizadas](#️-tecnologias-utilizadas)
- [Arquitetura](#-arquitetura)
- [Backend](#-backend)
- [Como executar](#️-como-executar)
- [Roadmap](#️-roadmap)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)
- [Autor](#-autor)

---

## 📱 Sobre o projeto

O **DetailGo** é um SaaS mobile voltado para o mercado de estética automotiva. A proposta central é unir, em um só aplicativo, a rotina de quem presta o serviço e a experiência de quem contrata, eliminando trocas de mensagens soltas e planilhas para organizar horários.

Com ele, estéticas automotivas ganham uma central única para cadastrar seus serviços, montar a agenda e acompanhar clientes, enquanto os clientes finais conseguem agendar, consultar horários e gerenciar seus próprios atendimentos direto do celular.

## 🚀 Proposta

O aplicativo trabalha com dois perfis de uso:

### 🧑‍💼 Empresas (estéticas automotivas)
- Cadastro da estética
- Gestão dos serviços oferecidos
- Controle de agenda e atendimentos
- Organização da carteira de clientes
- Acompanhamento operacional do negócio

### 🚘 Clientes
- Cadastro e login
- Agendamento de serviços
- Consulta de horários disponíveis
- Gerenciamento dos próprios agendamentos
- Experiência de atendimento simplificada e digital

## ✨ Funcionalidades

| Funcionalidade | Descrição |
| --- | --- |
| 📅 Agendamento | Marcação de serviços integrada à agenda da estética |
| 👤 Autenticação | Login e cadastro de usuários |
| 🧑‍💼 Gestão de clientes | Organização de clientes e atendimentos |
| 📊 Controle de agenda | Visão consolidada dos horários da estética |
| 🔄 Fluxo integrado | Comunicação direta entre cliente e empresa |
| 🔔 Notificações | Lembretes de agendamento (em evolução) |

## 🛠️ Tecnologias utilizadas

Este projeto foi construído com:

- [React Native](https://reactnative.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [React Navigation](https://reactnavigation.org/)
- [Firebase](https://firebase.google.com/) (Authentication, Firestore e Storage)

## 🧱 Arquitetura

A estrutura de pastas principal do app segue o padrão abaixo:

```
src/
├── components/
├── screens/
├── services/
├── navigation/
└── utils/
```

## 🔐 Backend

O DetailGo utiliza o **Firebase** como backend (BaaS), através dos seguintes recursos:

- **Authentication** — autenticação de usuários
- **Firestore** — banco de dados em tempo real
- **Storage** — armazenamento de arquivos e imagens

## ▶️ Como executar

### Pré-requisitos

Antes de começar, tenha instalado em sua máquina:

- [Node.js](https://nodejs.org/) (LTS)
- [React Native CLI](https://reactnative.dev/docs/environment-setup)
- Android Studio (para rodar no Android) e/ou Xcode (para rodar no iOS)

### Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/Nr1JNRP/DetailGo.git
cd DetailGo
npm install
```

Para o ambiente iOS, instale também os pods:

```bash
cd ios
bundle install
bundle exec pod install
```

### Executando o projeto

```bash
# Android
npm run android

# iOS
npm run ios
```

> É necessário configurar as credenciais do Firebase (`google-services.json` e/ou `GoogleService-Info.plist`) para que a autenticação e o backend funcionem corretamente.

## 🗺️ Roadmap

- [ ] Notificações push (OneSignal ou FCM)
- [ ] Multi-tenant (SaaS completo)
- [ ] Dashboard web administrativo
- [ ] Integração com pagamentos
- [ ] Controle de planos e assinaturas

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir uma issue relatando bugs ou sugestões, ou enviar um pull request com melhorias.

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👨‍💻 Autor

**Jorge N. Ribeiro**
Front-end Developer | Angular | React Native

[GitHub](https://github.com/Nr1JNRP)
