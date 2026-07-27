# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.1.0](https://github.com/jnrpalma/DetailGo/compare/v1.0.1...v1.1.0) (2026-07-27)

### ♻️ Refatorações

- **state:** consolida leitura de users/{uid} num unico listener ([ddfd136](https://github.com/jnrpalma/DetailGo/commit/ddfd1362a3671f36c010d2cae894211e8c712df5))
- **state:** migra sessao e tema para zustand ([37d33a5](https://github.com/jnrpalma/DetailGo/commit/37d33a5382ce81df6887ec878b3a251cceb92497))

### ⚡ Melhorias de performance

- **admin:** conta semana anterior via agregacao (count) ([208241a](https://github.com/jnrpalma/DetailGo/commit/208241ac3d22890eac6f78f220c64c5de03f5fc6))
- **historico:** virtualiza a lista de meses e memoiza as linhas ([1ce3303](https://github.com/jnrpalma/DetailGo/commit/1ce3303ab23ed6841401a74bc10fdd0114ce5017))
- **telas:** memoiza linhas de lista p/ evitar re-render no tick ([b474c2e](https://github.com/jnrpalma/DetailGo/commit/b474c2eb87741c59ee783fbf68854becd79ad155))
- **telas:** pausa os listeners de tela fora de foco ([6e34605](https://github.com/jnrpalma/DetailGo/commit/6e346051d8b3d9eeefe31d987a24fcf9ad382acd))

### 📝 Documentação

- adiciona logo do projeto ([add0c78](https://github.com/jnrpalma/DetailGo/commit/add0c785156a1bb09a1bebb51e98974c1da7293d))
- ajusta logo do README no padrão po-angular ([64c0639](https://github.com/jnrpalma/DetailGo/commit/64c0639445b4e19ebf86607d6a70489591e632e4))
- melhora README com logo, sumário e guia de uso ([fff0348](https://github.com/jnrpalma/DetailGo/commit/fff0348efd99a79765a37cbcf00bab42eb89dd8f))

### 🔧 Build e configuração

- **android:** troca o package do app para com.jnrpalma.detailgo ([8815603](https://github.com/jnrpalma/DetailGo/commit/8815603f96f418c05cca29cf6cdff7e9a674b028))
- **ci:** ajusta configuracao do renovate ([59a9f4c](https://github.com/jnrpalma/DetailGo/commit/59a9f4c7a8e1003d71c8bdc08ddad802c2354816))
- **ci:** commitlint ignora commits de bot (renovate) ([04459a1](https://github.com/jnrpalma/DetailGo/commit/04459a1849ef3c1d13440a39303670c4283abcaf)), closes [#67](https://github.com/jnrpalma/DetailGo/issues/67)
- **ci:** renovate para de auto-atualizar o nucleo react/rn ([c870c93](https://github.com/jnrpalma/DetailGo/commit/c870c9366066038d9cb823fdfd37ce0eaae890ae)), closes [#63](https://github.com/jnrpalma/DetailGo/issues/63)
- **ci:** renovate segura tambem o toolchain @react-native/\* ([96d85f0](https://github.com/jnrpalma/DetailGo/commit/96d85f02d1314fd2650564bd29eccf60d0362698)), closes [#64](https://github.com/jnrpalma/DetailGo/issues/64)
- **gitignore:** ignora metro.log e metro.err.log ([234857f](https://github.com/jnrpalma/DetailGo/commit/234857fc2a92570757fbaa8bcc1e4ff3a3377d54))
- **gitignore:** ignora os logs locais do metro ([965296c](https://github.com/jnrpalma/DetailGo/commit/965296c898d13f6e4072ef905899fdd0b73ce5ee))
- **gitignore:** remove entradas duplicadas de metro.log ([b779fba](https://github.com/jnrpalma/DetailGo/commit/b779fba250d41fd03aa0fa72856b44eb67ac88e8))

### 🐛 Correções de bugs

- **admin:** baixa de agendamento com feedback e sem travar offline ([045f227](https://github.com/jnrpalma/DetailGo/commit/045f22770bf19d4097ce27264bbc06bf6c217eab))
- **admin:** melhora card da agenda e alinha botao criar servico ([6cdfc06](https://github.com/jnrpalma/DetailGo/commit/6cdfc0691e488d85475cbbc802b9a6453177cf08))
- **notifications:** registra token push mesmo sem permissao ([2876ca8](https://github.com/jnrpalma/DetailGo/commit/2876ca843cfe7341ffb89a4a00a92c3960860359))
- **seguranca:** corta cancelamento no horario e fecha rules multi-tenant ([22de0b9](https://github.com/jnrpalma/DetailGo/commit/22de0b9cc29357e5006672a0d58095e9defe32ee))

### ✅ Testes

- **auth:** adiciona base de testes e cobre a tela de login ([670c362](https://github.com/jnrpalma/DetailGo/commit/670c3623a29a9fddfdd4e931d2311c45fcdecae0))
- **rules:** adiciona suite das firestore rules no emulador e no ci ([956381f](https://github.com/jnrpalma/DetailGo/commit/956381f6ab28c2da2ca3e0c546d6eecd13aa4dbe))

### ✨ Novas funcionalidades

- **admin:** exibe badge premium para owner com assinatura ativa ([2513037](https://github.com/jnrpalma/DetailGo/commit/25130371d173b218fa51c3e48879276c9065c930))
- **agendamento:** avisa o owner quando o cliente cancela ([bc64713](https://github.com/jnrpalma/DetailGo/commit/bc647130b78d9055f4afc0f3478994fded393750))
- **appointments:** agendamento vencido vira nao realizado no cliente ([d393c0d](https://github.com/jnrpalma/DetailGo/commit/d393c0d01461a06e01a394e7a99dd1b41c8bd796))
- **appointments:** cancelamento livre, lembrete 5min e sync de status ([2dc08f4](https://github.com/jnrpalma/DetailGo/commit/2dc08f48efbf8bddd968d7761857801b23cbb69d))
- **assets:** atualiza icones forward ([b15feae](https://github.com/jnrpalma/DetailGo/commit/b15feae7d6cc126ba09450ed18b99de688ba6c1d))
- **assinatura:** define o preco de lancamento do plano ([b5b6914](https://github.com/jnrpalma/DetailGo/commit/b5b6914dd92101e8b114cefa0ac0e25c956b5fd3))
- **ci:** adiciona renovate e codeql ([ce22695](https://github.com/jnrpalma/DetailGo/commit/ce226953dfdc197a3c1b46e364308298befafa86))
- **crashlytics:** adiciona monitoramento de crashes e error boundary ([a9864ed](https://github.com/jnrpalma/DetailGo/commit/a9864edb7b1f6545ac2be99edb9e6d5d1de956ef))
- **notifications:** lembrete de agendamento proximo para o cliente ([0eced1f](https://github.com/jnrpalma/DetailGo/commit/0eced1f6cd0570ec15d355374ffd53dc9c9a3e86))
- **notifications:** notifica cliente quando o servico e concluido ([b7b97db](https://github.com/jnrpalma/DetailGo/commit/b7b97db9f37ab700f621cb25e6d714bc0da97433))
- **notifications:** notifica owner ao receber novo agendamento ([e002697](https://github.com/jnrpalma/DetailGo/commit/e002697008c3b64405c30e631feeba4e02be7837))
- **perfil:** foto de perfil vai pro firebase storage (sai o base64) ([f09bc90](https://github.com/jnrpalma/DetailGo/commit/f09bc90aa7a45d151466dadab691f20aed3ad2d0))
- **release:** ajusta identidade e assinatura ([d0e233a](https://github.com/jnrpalma/DetailGo/commit/d0e233aaaa2df2557e97d606777e62b9986568ec))
- **scheduling:** owner controla horarios, capacidade e duracao ([ac35372](https://github.com/jnrpalma/DetailGo/commit/ac35372b2148bc513172871578e781b4726168f5))
- **subscription:** ajusta ciclo mensal ([5b6c64f](https://github.com/jnrpalma/DetailGo/commit/5b6c64f4c5ff3f62b9b54d68a28a077543791394))
- **ui:** animacoes de entrada e modais na identidade do app ([0916c13](https://github.com/jnrpalma/DetailGo/commit/0916c13b76e19b84660278e065a65c07d9727935))
- **ui:** padroniza modais do owner ([0515d8c](https://github.com/jnrpalma/DetailGo/commit/0515d8c44f3d9177a5e2a663fcc462383972605f))

### [1.0.1](https://github.com/jnrpalma/DetailGo/compare/v1.0.0...v1.0.1) (2026-05-28)

### 🔧 Build e configuração

- **apk:** adiciona script de geracao ([ac0037c](https://github.com/jnrpalma/DetailGo/commit/ac0037c0b1d12c11f727cece3233ad79d9e011b5))
- **ci:** amplia checks do github ([02081ef](https://github.com/jnrpalma/DetailGo/commit/02081efe24f187eb90b396c2c4fd66e79e059fb5))
- **deps:** atualiza package-lock apos redesign auth screens ([61f910d](https://github.com/jnrpalma/DetailGo/commit/61f910dc662327d1ad0c6e55d9f72b4305d4624d))
- **deps:** sincroniza package-lock com dependencias atuais ([eb1a69d](https://github.com/jnrpalma/DetailGo/commit/eb1a69da4198e2ac0ab8df0a443018b2a07c9d76))

### ♻️ Refatorações

- **architecture:** standardize feature imports ([dd8915f](https://github.com/jnrpalma/DetailGo/commit/dd8915f9db5ee4bb8e4e7825add5ff9b1a7927a2))
- **arquitetura:** melhora organizacao do projeto ([e216417](https://github.com/jnrpalma/DetailGo/commit/e216417eb175f2bb86e92d30db6adefb8189a3e6))
- **theme:** centraliza paletas de cores em colors.ts ([a0795bd](https://github.com/jnrpalma/DetailGo/commit/a0795bded2f2d754741ed607bba42369f0dd101c))

### ✅ Testes

- **jest:** estabiliza renderizacao do app ([aa8206e](https://github.com/jnrpalma/DetailGo/commit/aa8206ecd8348fa84827def7fe2cc72bcc2a31bb))

### 🐛 Correções de bugs

- **admindashboard:** ajusta fluxo card admin ([3f0944c](https://github.com/jnrpalma/DetailGo/commit/3f0944c64be0348a9e5bb11dfdaab00bff166926))
- **dashboard:** ajusta layout card serviços ([035bc75](https://github.com/jnrpalma/DetailGo/commit/035bc75367e25464ea8af8249f04ba1d422dc4d8))
- **dashboard:** corrige duração do próximo agendamento ([23c4a3d](https://github.com/jnrpalma/DetailGo/commit/23c4a3d196f854b395f1b3801ac19eca3d3ffb67))
- **lint:** remove shopid nao usado em rootnavigator ([0b5e139](https://github.com/jnrpalma/DetailGo/commit/0b5e139d21111ac2254d60dbbb158dea8e4d0232))
- **profile:** corrige upload de avatar na apk ([bbecf63](https://github.com/jnrpalma/DetailGo/commit/bbecf63ed50d16731d9e903bf25dba8225b48417))
- **shops:** corrige geocoding, seguranca e cadastro de estetica ([78d9318](https://github.com/jnrpalma/DetailGo/commit/78d9318d4ca470b36f3f3166d35e15c838ce914b))
- **tsconfig:** update path aliases ([f9e22c6](https://github.com/jnrpalma/DetailGo/commit/f9e22c657ed2bd592076d2059d66eebbf6da4181))

### ✨ Novas funcionalidades

- **admin:** padroniza dashboard com perfil foto e drawer ([2b34745](https://github.com/jnrpalma/DetailGo/commit/2b34745207ebd12e1f5fa2f8d7be46350fc4cbc9))
- **admin:** redesenha historico para tema garage dark ([119c89b](https://github.com/jnrpalma/DetailGo/commit/119c89bfd52d45a119eba1cd2c13f8a100a986f4))
- **admin:** redesenha home e adiciona logout nas configuracoes ([227c9b7](https://github.com/jnrpalma/DetailGo/commit/227c9b7f613a41338112f2e5eb69a4ed1801445e))
- **admin:** redesign gerenciar loja, dias de atendimento e fonte inter ([66dba3a](https://github.com/jnrpalma/DetailGo/commit/66dba3a282362caf72b7bfa4ddd553a94190e770))
- **app:** atualiza icone e nome do app ([8abee4f](https://github.com/jnrpalma/DetailGo/commit/8abee4f54af7684d215efb31ee5a647e850c5c78))
- **appointment:** redesign da tela de agendar no padrao dark ([697a5c4](https://github.com/jnrpalma/DetailGo/commit/697a5c45b441e3a9eece32fd942305b96021adff))
- **appointments:** restringe estetica por dia ([cbe2cc6](https://github.com/jnrpalma/DetailGo/commit/cbe2cc6131f54230ce6deffe67401b0a259ebc06))
- **auth:** redesign login e register para tema garage dark ([637776a](https://github.com/jnrpalma/DetailGo/commit/637776a50f39e2ae5eb05bb914f76257eb599d25)), closes [#0B0D0](https://github.com/jnrpalma/DetailGo/issues/0B0D0) [#D4FF3](https://github.com/jnrpalma/DetailGo/issues/D4FF3) [#191D20](https://github.com/jnrpalma/DetailGo/issues/191D20)
- **cliente:** adiciona tema claro ([e90c5f6](https://github.com/jnrpalma/DetailGo/commit/e90c5f6711bfc248159fbed8ca095851456d888f))
- **cliente:** melhora tipografia das telas ([214d233](https://github.com/jnrpalma/DetailGo/commit/214d233c03ea4717a18be59451e3319cb34e0049))
- **cliente:** redesenha histórico e vínculo da estética ([8d283f6](https://github.com/jnrpalma/DetailGo/commit/8d283f67ca13477ec84b98a512e30743c9461958))
- **cliente:** redesenha tela de agendamentos ([03aa7d3](https://github.com/jnrpalma/DetailGo/commit/03aa7d3321bac39cbfa0323ba2645deeda238fd7))
- **dashboard:** ajusta card de agendamento do cliente ([49b9264](https://github.com/jnrpalma/DetailGo/commit/49b92644749369945497d121c21d35db47317d88))
- **dashboard:** ajusta no-show e telas do cliente ([74783cd](https://github.com/jnrpalma/DetailGo/commit/74783cd6e8bcd3b897e88814a17d47c12b1de7e0))
- **dashboard:** ajusta rodape e proximos servicos ([ff86436](https://github.com/jnrpalma/DetailGo/commit/ff86436973d2c5ecf4e3abd179b499e5e51d41ea))
- **dashboard:** badge de status no card proximos servicos ([aef909e](https://github.com/jnrpalma/DetailGo/commit/aef909e791a33a3cebf9309c7da311daeea7f4fd))
- **dashboard:** redesenha home do cliente ([773ab29](https://github.com/jnrpalma/DetailGo/commit/773ab29b96936d4d4b88f07decd64187c9028bdb))
- **dashboard:** redesign cliente para tema garage dark ([aeaa11e](https://github.com/jnrpalma/DetailGo/commit/aeaa11efb089076a625e7d934f69a650b503b8e9))
- **login:** ajusta visual da tela cliente ([a1d26d6](https://github.com/jnrpalma/DetailGo/commit/a1d26d6daed2a7c341c195f47d283df5be580104))
- **login:** ajuste telas de login para ambos ([e45ce59](https://github.com/jnrpalma/DetailGo/commit/e45ce59462a4ba71147bb41a6d6798c90081f518))
- **login:** substitui grid por curva de pista de corrida no hero ([5db36dc](https://github.com/jnrpalma/DetailGo/commit/5db36dcf5dd80128a4b9764a33205f77fb05d062))
- **map:** marketplace com mapa de estéticas e trial de 7 dias ([7748ac1](https://github.com/jnrpalma/DetailGo/commit/7748ac17ffcaf6203cb4fedfa2db5562eeec8ee8))
- **profile:** redesenha perfil do cliente ([1c1920f](https://github.com/jnrpalma/DetailGo/commit/1c1920f19ee6ee904aa2fc44fb864a70fa4446fb))
- **shop-profile:** fluxo de descoberta e agendamento por estetica ([18ca2e3](https://github.com/jnrpalma/DetailGo/commit/18ca2e3b290a39b3008343e0d77b86a8f966309e))
- **shop-services:** adiciona servicos configuraveis ([5517d33](https://github.com/jnrpalma/DetailGo/commit/5517d33217432e7223c6403760fff8218925567b))
- **shops:** permite gerenciar serviços da estética ([e4b1149](https://github.com/jnrpalma/DetailGo/commit/e4b1149583f49aba41327458f72d62660fe5bad1))
- **shops:** remove convites e configurar veiculos por servico ([1522881](https://github.com/jnrpalma/DetailGo/commit/152288164a8c4a3450bd6a63b351e48e9f13dbd4))
- **splash:** redesenha splash e badge do login ([6f5040c](https://github.com/jnrpalma/DetailGo/commit/6f5040c436bc120184e58bd3fd787e55ff35346e))
- **ui:** adiciona tema claro ([643e396](https://github.com/jnrpalma/DetailGo/commit/643e39693ffa6c441f054666215f075be75cf294))
- **ui:** padroniza perfis e headers ([d93628a](https://github.com/jnrpalma/DetailGo/commit/d93628ac6aeb4e6aaded38d94ac26313c771f597))
- **ui:** padroniza tipografia inter ([6691965](https://github.com/jnrpalma/DetailGo/commit/66919650c2f03f02d346c1af73eedd74821cb16c))

## 1.0.0 (2026-04-29)

### ✨ Novas funcionalidades

- (teste) ([44ea74d](https://github.com/jnrpalma/DetailGo/commit/44ea74d6bf4c8e23ade04d96546b370dc03a6d83))
- (teste5) ([b683dbd](https://github.com/jnrpalma/DetailGo/commit/b683dbdbde8544bd64c5673bea4feffbb5495ec9))
- (testeMoney) ([7ca1836](https://github.com/jnrpalma/DetailGo/commit/7ca1836fe67fa7d62881fa5b7783fc88b91eb5d2))
- (testepay) ([a2cfcf3](https://github.com/jnrpalma/DetailGo/commit/a2cfcf3368ec5b5a82719a7957e5d3ce0adfd19e))
- **addinfos:** add infos de pagamento ([dbdd22f](https://github.com/jnrpalma/DetailGo/commit/dbdd22ffe0eea524af3f3db5b08fe4726043447e))
- **adminhistory:** cria historico de agendamentos ([bfe365e](https://github.com/jnrpalma/DetailGo/commit/bfe365eb7129868050d30f1c319e1866061089b6))
- **adminScreeen:** ajusta tela de admin ([4c0339f](https://github.com/jnrpalma/DetailGo/commit/4c0339f35571544c6c1ff9c41d79b41c121c429c))
- **agendamentos:** ajusta layout ([14430b5](https://github.com/jnrpalma/DetailGo/commit/14430b57c4e8f2c3815f6204bbb790a4dc909ff7))
- **agendamentos:** ajusta valor, modal de detalhes ([9a1598a](https://github.com/jnrpalma/DetailGo/commit/9a1598a6a7b04b68bf64787bbb37c761f8155c11))
- **apooonitments:** agendamentos usuarios ([46d6802](https://github.com/jnrpalma/DetailGo/commit/46d68021a29ba206a659ea560f0ed7421785b7fa))
- **appointsments:** cria novo layout ([453f19d](https://github.com/jnrpalma/DetailGo/commit/453f19d1fdcbc4a7a4523e7bf48bc0dc114a47e4))
- **appontment:** ajusta screen ([4f3355f](https://github.com/jnrpalma/DetailGo/commit/4f3355f05f8d4f7f298043eb1871193045418f22))
- **appontments:** cria agendamentos mais limpo ([d82f125](https://github.com/jnrpalma/DetailGo/commit/d82f125476337b2c08bdfbcf9a490586042b46e1))
- **appts:** logo adicionado ([c2b8057](https://github.com/jnrpalma/DetailGo/commit/c2b80575dd8c9d127b40cfa96818d0b3ca6a817e))
- **dashboard:** adiciona gestão de agendamentos para admin ([4daf505](https://github.com/jnrpalma/DetailGo/commit/4daf5056a23c7a1765cac23bfd603948a2c32ad6))
- **dashboardadin:** cria novo estilo de agendamentos admin ([608c29f](https://github.com/jnrpalma/DetailGo/commit/608c29f3d62cf35a07fc7912350b9da7637cc790))
- **dashboard:** ajuta range de datas ([3b7ad77](https://github.com/jnrpalma/DetailGo/commit/3b7ad7702ff6adcaec7eaadaf878b37eace8b439))
- **dashboard:** cria logica de agendamentos dia ([98ff769](https://github.com/jnrpalma/DetailGo/commit/98ff769012683132c203049c623a29a9863217a8))
- **dashboard:** screen de perfil historico ([31f427e](https://github.com/jnrpalma/DetailGo/commit/31f427e4f58c920cb2eefe0d1b3f18cef97b79c5))
- **historyagendamentos:** cria range de agendamentos ([d8a90c2](https://github.com/jnrpalma/DetailGo/commit/d8a90c2cba9f4651a78034a3f751c7885188c71a))
- **history:** ajusta em logica de carregamento ([85766e6](https://github.com/jnrpalma/DetailGo/commit/85766e663053da019e8092c5f0c9cf72210541c6))
- **historyScreen:** ajusta layout ([1240de5](https://github.com/jnrpalma/DetailGo/commit/1240de5e34683775fc54219981a6f961a0a2036c))
- **index:** cria index para appointments e dashboard ([00efa63](https://github.com/jnrpalma/DetailGo/commit/00efa6377cca0ecd7959515b36301691048425c7))
- **login:** edita camada de login ([a63aac4](https://github.com/jnrpalma/DetailGo/commit/a63aac4962053827b45e6d56680c0ae06ec98948))
- **onboarding:** cliente cria conta sem codigo, vincula a estetica depois ([aa58eb7](https://github.com/jnrpalma/DetailGo/commit/aa58eb7893f05a0aad10d9009b7b186e245fc25a))
- **payments:** integração Mercado Pago PIX com Cloud Functions ([beac697](https://github.com/jnrpalma/DetailGo/commit/beac6970148b714b3eaedab928a17b464e437124))
- **profile:** add campos ([eff2d82](https://github.com/jnrpalma/DetailGo/commit/eff2d828f7879128e8220ce3a440707620ff85f4))
- **profile:** cria tela de perfil com regra de alteracao de email ([bc32a74](https://github.com/jnrpalma/DetailGo/commit/bc32a74e418c3db06294d4208d7c7714eb1e624b))
- **profile:** teste sms firebase ([78c3dfd](https://github.com/jnrpalma/DetailGo/commit/78c3dfdc6b5a4086d0e52841884d38591144821c))
- **refatora-telas:** refatora telas ([1b56ecc](https://github.com/jnrpalma/DetailGo/commit/1b56ecca15062f0b489360f2f4a60e4069ba323e))
- **saas:** implementa Fase 1 - multi-tenancy foundation ([84ab7d8](https://github.com/jnrpalma/DetailGo/commit/84ab7d826be5f650911211cb46a5392e036feae6))
- **saas:** implementa Fase 2 - AdminManageScreen com código de convite e configurações ([dba8eb6](https://github.com/jnrpalma/DetailGo/commit/dba8eb6346c26de8229217dcca976ec2f6aa7ae8))
- **saas:** implementa Fase 3 - sistema de assinatura com trial de 14 dias ([51b9121](https://github.com/jnrpalma/DetailGo/commit/51b9121f1ff75ed7693bf59cac139d100f5eb1c1))
- **script:** ajustar script de apk ([f1ec6c0](https://github.com/jnrpalma/DetailGo/commit/f1ec6c0f807988b6b6a0e899d3d8d2b648371c00))
- **script:** cria script de apk ([fda3174](https://github.com/jnrpalma/DetailGo/commit/fda31741c12a5778bc5a6e7373d8aab379a314dd))

### ♻️ Refatorações

- **appointments:** ajusta codigo ([0d22ab9](https://github.com/jnrpalma/DetailGo/commit/0d22ab994fdac0e466e1f9d16d6940e8142e02b2))
- **appontment:** reafatora codigo ([8d0bf55](https://github.com/jnrpalma/DetailGo/commit/8d0bf5550e16956afbd3a779134001e7c9c5bac1))
- **dashboard-appontments:** refatora codigo para boas praticas ([f81745f](https://github.com/jnrpalma/DetailGo/commit/f81745fd07ad1843da3eb05083edbc29e0626543))
- reorganização de arquitetura e nomenclatura ([0af3d51](https://github.com/jnrpalma/DetailGo/commit/0af3d5187e3dfca6c9f50b4cef3addd1a925319f))
- **screens:** ajusta codigos ([cac35c0](https://github.com/jnrpalma/DetailGo/commit/cac35c0e1b7dec2c8349961472aee8b6857f67bc))
- **src:** aplica formatacao prettier em todos os arquivos ([eb41127](https://github.com/jnrpalma/DetailGo/commit/eb41127ec9642c68589c516ae8b6a0c5f78e8cc0))
- **utils:** centraliza logica duplicada em shared/utils ([8b5e8e2](https://github.com/jnrpalma/DetailGo/commit/8b5e8e2855a429bd6d1eedbdded29f46fc4ed0ad))

### 🐛 Correções de bugs

- (teste) ([1ba41a3](https://github.com/jnrpalma/DetailGo/commit/1ba41a389901eae35637b30f266d93eda28d89d0))
- (teste4) ([2f8daa5](https://github.com/jnrpalma/DetailGo/commit/2f8daa5bd5cf30a0affc0135c4fba832fd6d6333))
- (teste8) ([06f5984](https://github.com/jnrpalma/DetailGo/commit/06f5984e414f79cbeff7159a821603dbbb7d23da))
- **admin:** ajusta AdminDashboardScreen ([ca4adca](https://github.com/jnrpalma/DetailGo/commit/ca4adca619163eab7a65150024ff7d153589a3b3))
- **admindashboar:** ajusta tela de acordo com padrao ([608cc2b](https://github.com/jnrpalma/DetailGo/commit/608cc2bb3710aa05dc942e003e2be0c17312b001))
- **admin:** remove verificação de role antiga e atualiza labels ([46af9b8](https://github.com/jnrpalma/DetailGo/commit/46af9b840f0782d4934d63ddb9496a98d0c4d94d))
- **apk:** ajusta apk para compartilhamento ([252b402](https://github.com/jnrpalma/DetailGo/commit/252b4025d39574fe8feab3866c482cbd993e7e53))
- **ci:** corrige erros de typescript no ci ([e2081ee](https://github.com/jnrpalma/DetailGo/commit/e2081eeb0dcddeb358e82d14fd622c114a610653))
- **ci:** remove worktree do git index e corrige checkout ([97cc776](https://github.com/jnrpalma/DetailGo/commit/97cc776dc241da9afb5f54d50847671f8f653f46))
- **components:** reafatoração de codigo ([7b89101](https://github.com/jnrpalma/DetailGo/commit/7b891013823d3928f17b81189b1ee19bb1b50c49))
- **dashboard:** ajusta agendamento passado ([840624c](https://github.com/jnrpalma/DetailGo/commit/840624c1ec57e97b762d3826bea8d542fcb1a3f4))
- **dashboard:** ajusta lista de agendamentos ([c67c198](https://github.com/jnrpalma/DetailGo/commit/c67c198e7586d46dd610c9a51ac0fa9e4cc2a363))
- **dashboard:** resolve loading infinito quando shopId e nulo ([569a3b7](https://github.com/jnrpalma/DetailGo/commit/569a3b78beeb1bb3af284e957f116785852ba7c2))
- **functions:** migra para firebase-functions v2 API ([072a73c](https://github.com/jnrpalma/DetailGo/commit/072a73c40170531e23b1971f8f073e011dcf2950))
- **history:** ajusta filtro de indice firebase ([1ec0c8d](https://github.com/jnrpalma/DetailGo/commit/1ec0c8da728fe50562d4cd640326e8f9499fb9d0))
- **refactor:** faz refatoração ([21ef86b](https://github.com/jnrpalma/DetailGo/commit/21ef86b3b9e262a321fc385320859b9ad0ead1b8))
- **refactory:** ajusta codigo ([3721c28](https://github.com/jnrpalma/DetailGo/commit/3721c282fab5aa8f6b9e77da8d2ee1c3923e6bd7))
- **register:** corrige navegação pós-cadastro e exibe código de convite ([1441101](https://github.com/jnrpalma/DetailGo/commit/14411012d04ce3c40aab035098d4c3cb261c096e))
- **tsconfig:** remove ignoredeprecations invalido no ci ([2091d04](https://github.com/jnrpalma/DetailGo/commit/2091d043f9960587b7de5817788cb910580a0921))

### 🔧 Build e configuração

- **ci:** configura pipeline de qualidade e releases ([bbab884](https://github.com/jnrpalma/DetailGo/commit/bbab884cd573d3d9765b0e4e0bf82f87868be5ac))
- **deps:** atualiza package-lock com lint-staged e standard-version ([fa04057](https://github.com/jnrpalma/DetailGo/commit/fa04057072eee0507791a09a8a8456da24ed8852))
- **deps:** sincroniza package-lock.json com dependencias atuais ([2b15de7](https://github.com/jnrpalma/DetailGo/commit/2b15de76f21a78b33a40f1de560a0aa612c48696))
- **husky:** adiciona validação de mensagem de commit ([13c3d07](https://github.com/jnrpalma/DetailGo/commit/13c3d079ecc9f69d016c1e7e2303f9d379afc4fa))
- **versionrc:** corrige url do changelog e remove host duplicado ([5073f64](https://github.com/jnrpalma/DetailGo/commit/5073f64bdac9d21f1771fa2175f9887c3694aebd))

# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

<!-- O conteúdo abaixo é gerado automaticamente pelo standard-version -->
<!-- Execute: npm run release:dry para visualizar sem commitar -->
