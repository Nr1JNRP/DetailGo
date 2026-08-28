import { computeSubscription, GRACE_DAYS } from './shop.store';
import type { ShopDoc } from './shop.store';

const DIA_MS = 24 * 60 * 60 * 1000;
const AGORA = new Date(2026, 7, 27, 12, 0, 0).getTime();

/** Timestamp do Firestore só precisa do toMillis para esta regra. */
const ts = (ms: number) => ({ toMillis: () => ms });

const loja = (over: Partial<ShopDoc> = {}): ShopDoc =>
  ({ id: 'shop-1', subscriptionStatus: 'active', ...over } as ShopDoc);

describe('computeSubscription', () => {
  it('sem loja, bloqueado', () => {
    expect(computeSubscription(null, AGORA)).toEqual({
      isSubscriptionActive: false,
      trialDaysLeft: 0,
      isInGrace: false,
    });
  });

  describe('período de teste', () => {
    it('libera enquanto houver dias', () => {
      const shop = loja({ subscriptionStatus: 'trial', trialEndsAt: ts(AGORA + 3 * DIA_MS) });

      expect(computeSubscription(shop, AGORA)).toMatchObject({
        isSubscriptionActive: true,
        trialDaysLeft: 3,
      });
    });

    it('bloqueia quando acaba', () => {
      const shop = loja({ subscriptionStatus: 'trial', trialEndsAt: ts(AGORA - 1) });

      expect(computeSubscription(shop, AGORA)).toMatchObject({
        isSubscriptionActive: false,
        trialDaysLeft: 0,
      });
    });

    // O trial não tem carência: quem nunca pagou não tem o que renovar.
    it('não entra em carência', () => {
      const shop = loja({ subscriptionStatus: 'trial', trialEndsAt: ts(AGORA - DIA_MS) });

      expect(computeSubscription(shop, AGORA).isInGrace).toBe(false);
    });
  });

  describe('assinatura paga', () => {
    it('dentro do prazo, ativo e sem aviso', () => {
      const shop = loja({ activeUntil: ts(AGORA + DIA_MS) });

      expect(computeSubscription(shop, AGORA)).toEqual({
        isSubscriptionActive: true,
        trialDaysLeft: 0,
        isInGrace: false,
      });
    });

    // O que a carência protege: o dono continua trabalhando enquanto o Asaas
    // retenta o cartão.
    it('vencida há um dia, ainda entra — com aviso', () => {
      const shop = loja({ activeUntil: ts(AGORA - DIA_MS) });

      expect(computeSubscription(shop, AGORA)).toEqual({
        isSubscriptionActive: true,
        trialDaysLeft: 0,
        isInGrace: true,
      });
    });

    it('no último instante da carência ainda entra', () => {
      const shop = loja({ activeUntil: ts(AGORA - GRACE_DAYS * DIA_MS) });

      expect(computeSubscription(shop, AGORA)).toMatchObject({
        isSubscriptionActive: true,
        isInGrace: true,
      });
    });

    it('um segundo depois da carência, bloqueia', () => {
      const shop = loja({ activeUntil: ts(AGORA - GRACE_DAYS * DIA_MS - 1000) });

      expect(computeSubscription(shop, AGORA)).toEqual({
        isSubscriptionActive: false,
        trialDaysLeft: 0,
        isInGrace: false,
      });
    });

    // Sem activeUntil o acesso não pode ficar aberto por omissão.
    it('sem data de validade, bloqueia', () => {
      expect(computeSubscription(loja(), AGORA).isSubscriptionActive).toBe(false);
    });
  });

  it('status inativo bloqueia mesmo com data válida', () => {
    const shop = loja({ subscriptionStatus: 'inactive', activeUntil: ts(AGORA + 30 * DIA_MS) });

    expect(computeSubscription(shop, AGORA).isSubscriptionActive).toBe(false);
  });
});
