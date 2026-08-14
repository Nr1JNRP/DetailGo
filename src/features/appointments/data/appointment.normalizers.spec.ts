jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import {
  normalizeUserAppointmentFromSubcollection,
  normalizeUserAppointmentFromGlobal,
} from './appointment.normalizers';

/** Simula um QueryDocumentSnapshot do Firestore. */
const docComDados = (data: Record<string, unknown>, id = 'appt-1') =>
  ({ id, data: () => data } as any);

const INICIO = 1_784_000_000_000;
const FIM = INICIO + 90 * 60 * 1000;

// As duas fontes guardam o horário em campos diferentes: a subcoleção do
// cliente usa whenMs, o documento do shop usa startAtMs.
const daSubcolecao = {
  whenMs: INICIO,
  shopId: 'shop-1',
  vehicleType: 'SUV',
  carCategory: 'large',
  serviceLabel: 'Polimento',
  price: 350,
  endAtMs: FIM,
  durationMin: 90,
  status: 'done',
  dayKey: '2026-07-15',
};

const doGlobal = { ...daSubcolecao, startAtMs: INICIO, whenMs: undefined };

describe('normalizeUserAppointmentFromSubcollection', () => {
  it('converte um documento completo', () => {
    const res = normalizeUserAppointmentFromSubcollection(docComDados(daSubcolecao));

    expect(res).toMatchObject({
      id: 'appt-1',
      shopId: 'shop-1',
      startAtMs: INICIO,
      endAtMs: FIM,
      durationMin: 90,
      status: 'done',
    });
  });

  it('descarta documento sem whenMs', () => {
    expect(normalizeUserAppointmentFromSubcollection(docComDados({ shopId: 'shop-1' }))).toBeNull();
  });

  it('descarta whenMs em texto — aqui não há conversão', () => {
    // Diferente do documento global, este campo precisa ser numérico de fato.
    expect(
      normalizeUserAppointmentFromSubcollection(
        docComDados({ ...daSubcolecao, whenMs: '1784000000000' }),
      ),
    ).toBeNull();
  });

  it('aceita whenMs zero como horário válido', () => {
    // Zero é uma data legítima (epoch) e a checagem é de tipo, não de valor.
    const res = normalizeUserAppointmentFromSubcollection(
      docComDados({ ...daSubcolecao, whenMs: 0 }),
    );

    expect(res?.startAtMs).toBe(0);
  });
});

describe('normalizeUserAppointmentFromGlobal', () => {
  it('converte um documento completo', () => {
    const res = normalizeUserAppointmentFromGlobal(docComDados(doGlobal));

    expect(res).toMatchObject({ id: 'appt-1', startAtMs: INICIO, status: 'done' });
  });

  it('descarta documento sem startAtMs', () => {
    expect(normalizeUserAppointmentFromGlobal(docComDados({ shopId: 'shop-1' }))).toBeNull();
  });

  it('descarta startAtMs zero', () => {
    expect(
      normalizeUserAppointmentFromGlobal(docComDados({ ...doGlobal, startAtMs: 0 })),
    ).toBeNull();
  });

  it('aceita startAtMs em texto numérico', () => {
    const res = normalizeUserAppointmentFromGlobal(
      docComDados({ ...doGlobal, startAtMs: String(INICIO) }),
    );

    expect(res?.startAtMs).toBe(INICIO);
  });
});

// As regras abaixo valem para as duas funções — rodam contra ambas para
// garantir que a normalização não divirja entre as fontes.
describe.each([
  ['subcoleção', normalizeUserAppointmentFromSubcollection, daSubcolecao],
  ['global', normalizeUserAppointmentFromGlobal, doGlobal],
] as const)('regras comuns (%s)', (_nome, normalize, completo) => {
  it('usa os padrões quando os campos opcionais faltam', () => {
    const minimo =
      'whenMs' in completo && completo.whenMs != null ? { whenMs: INICIO } : { startAtMs: INICIO };

    const res = normalize(docComDados(minimo));

    expect(res).toMatchObject({
      shopId: null,
      vehicleType: 'Carro',
      carCategory: null,
      serviceLabel: null,
      price: null,
      endAtMs: undefined,
      durationMin: undefined,
      status: 'scheduled',
    });
  });

  it('shopId só entra se for texto', () => {
    expect(normalize(docComDados({ ...completo, shopId: 123 }))?.shopId).toBeNull();
  });

  it('preço só entra se for numérico', () => {
    expect(normalize(docComDados({ ...completo, price: '350' }))?.price).toBeNull();
    expect(normalize(docComDados({ ...completo, price: 0 }))?.price).toBe(0);
  });

  it('status desconhecido vira scheduled', () => {
    // Protege a UI de um status gravado errado ou de uma versão futura do app.
    expect(normalize(docComDados({ ...completo, status: 'pendente' }))?.status).toBe('scheduled');
    expect(normalize(docComDados({ ...completo, status: undefined }))?.status).toBe('scheduled');
  });

  it.each(['scheduled', 'in_progress', 'done', 'no_show', 'cancelled'] as const)(
    'preserva o status válido %s',
    status => {
      expect(normalize(docComDados({ ...completo, status }))?.status).toBe(status);
    },
  );

  it('calcula a duração a partir do fim quando ela não foi gravada', () => {
    const res = normalize(docComDados({ ...completo, durationMin: undefined }));

    expect(res?.durationMin).toBe(90);
  });

  it('sem fim e sem duração, ambos ficam indefinidos', () => {
    const res = normalize(docComDados({ ...completo, durationMin: undefined, endAtMs: undefined }));

    expect(res?.endAtMs).toBeUndefined();
    expect(res?.durationMin).toBeUndefined();
  });

  it('duração gravada tem precedência sobre o cálculo', () => {
    // Se o serviço durou diferente do previsto, vale o que foi registrado.
    const res = normalize(docComDados({ ...completo, durationMin: 120 }));

    expect(res?.durationMin).toBe(120);
  });
});
