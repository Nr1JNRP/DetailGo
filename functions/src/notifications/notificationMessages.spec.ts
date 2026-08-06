import { buildServiceDoneBody } from './notificationMessages';

describe('buildServiceDoneBody', () => {
  it('inclui servico e estetica quando ambos existem', () => {
    const body = buildServiceDoneBody({
      serviceLabel: 'Lavagem técnica',
      shopName: 'Estética do Nico',
    });
    expect(body).toBe(
      'Seu serviço de Lavagem técnica foi concluído em Estética do Nico. ' +
        'Aguardamos seu retorno. Obrigado pela preferência!',
    );
  });

  it('usa "Seu serviço" como prefixo (concordancia correta com nome feminino)', () => {
    // "Lavagem" é feminino; o prefixo "Seu serviço" evita "Seu Lavagem".
    const body = buildServiceDoneBody({ serviceLabel: 'Lavagem', shopName: 'X' });
    expect(body.startsWith('Seu serviço de Lavagem')).toBe(true);
    expect(body).not.toContain('Seu Lavagem');
  });

  it('omite a estetica quando o nome esta ausente', () => {
    const body = buildServiceDoneBody({ serviceLabel: 'Polimento', shopName: null });
    expect(body).toBe(
      'Seu serviço de Polimento foi concluído. ' +
        'Aguardamos seu retorno. Obrigado pela preferência!',
    );
    expect(body).not.toContain(' em ');
  });

  it('omite o nome do servico quando ausente, mas mantem a estetica', () => {
    const body = buildServiceDoneBody({ serviceLabel: null, shopName: 'Auto Spa' });
    expect(body).toBe(
      'Seu serviço foi concluído em Auto Spa. ' +
        'Aguardamos seu retorno. Obrigado pela preferência!',
    );
  });

  it('cai no texto generico quando faltam servico e estetica', () => {
    const body = buildServiceDoneBody({ serviceLabel: null, shopName: null });
    expect(body).toBe(
      'Seu serviço foi concluído. Aguardamos seu retorno. Obrigado pela preferência!',
    );
  });

  it('trata strings vazias/espacos como ausentes', () => {
    const body = buildServiceDoneBody({ serviceLabel: '   ', shopName: '  ' });
    expect(body).toBe(
      'Seu serviço foi concluído. Aguardamos seu retorno. Obrigado pela preferência!',
    );
  });
});
