module.exports = {
  // Tipos do padrão PO-UI mapeados para o CHANGELOG
  types: [
    { type: 'feat', section: '✨ Novas funcionalidades' },
    { type: 'fix', section: '🐛 Correções de bugs' },
    { type: 'perf', section: '⚡ Melhorias de performance' },
    { type: 'refactor', section: '♻️ Refatorações' },
    { type: 'docs', section: '📝 Documentação' },
    { type: 'build', section: '🔧 Build e configuração' },
    { type: 'test', section: '✅ Testes' },
    // chore e style não aparecem no CHANGELOG
    { type: 'chore', hidden: true },
    { type: 'style', hidden: true },
    { type: 'ci', hidden: true },
  ],

  // Prefixo da tag (v1.0.0)
  tagPrefix: 'v',

  // Mensagem do commit de release. O padrão do standard-version é
  // "chore(release): ..." — mas o commitlint do projeto rejeita `chore`.
  // Usamos `build` (permitido pelo type-enum) para o hook não barrar.
  releaseCommitMessageFormat: 'build(release): {{currentTag}}',

  // URLs diretas do repositório (sem {{host}} para evitar duplicação)
  commitUrlFormat: 'https://github.com/jnrpalma/DetailGo/commit/{{hash}}',
  compareUrlFormat:
    'https://github.com/jnrpalma/DetailGo/compare/{{previousTag}}...{{currentTag}}',
  issueUrlFormat: 'https://github.com/jnrpalma/DetailGo/issues/{{id}}',
  userUrlFormat: 'https://github.com/{{user}}',

  // Arquivo de changelog
  infile: 'CHANGELOG.md',

  // Não faz push automático (segurança: você controla o que sobe)
  skip: {
    push: true,
  },
};
