jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import { normalizeAdminAppointmentFromGlobal } from './adminAppointment.normalizers';

/** Simula um QueryDocumentSnapshot do Firestore. */
const docComDados = (data: Record<string, unknown>, id = 'appt-1') =>
  ({ id, data: () => data } as any);

const completo = {
  customerUid: 'user-1',
  customerName: 'Ana Silva',
  vehicleType: 'SUV',
  carCategory: 'large',
  serviceLabel: 'Higienização de bancos',
  price: 250,
  startAtMs: 1_784_000_000_000,
  endAtMs: 1_784_005_400_000,
  status: 'in_progress',
  dayKey: '2026-07-15',
};

describe('normalizeAdminAppointmentFromGlobal', () => {
  it('converte um documento completo preservando os valores', () => {
    const res = normalizeAdminAppointmentFromGlobal(docComDados(completo));

    expect(res).toEqual({ id: 'appt-1', ...completo });
  });

  // Sem horário de início o agendamento não tem como ser exibido na agenda,
  // e sem dono não há a quem atribuí-lo. Nos dois casos o documento é
  // descartado em vez de virar um item quebrado na lista.
  it('descarta documento sem startAtMs', () => {
    expect(normalizeAdminAppointmentFromGlobal(docComDados({ customerUid: 'user-1' }))).toBeNull();
  });

  it('descarta documento com startAtMs zero', () => {
    expect(
      normalizeAdminAppointmentFromGlobal(docComDados({ ...completo, startAtMs: 0 })),
    ).toBeNull();
  });

  it('descarta documento com startAtMs não numérico', () => {
    expect(
      normalizeAdminAppointmentFromGlobal(docComDados({ ...completo, startAtMs: 'ontem' })),
    ).toBeNull();
  });

  it('descarta documento sem customerUid', () => {
    expect(
      normalizeAdminAppointmentFromGlobal(docComDados({ startAtMs: 1_784_000_000_000 })),
    ).toBeNull();
  });

  it('aceita startAtMs em texto numérico', () => {
    const res = normalizeAdminAppointmentFromGlobal(
      docComDados({ ...completo, startAtMs: '1784000000000' }),
    );

    expect(res?.startAtMs).toBe(1_784_000_000_000);
  });

  it('usa os padrões quando os campos opcionais faltam', () => {
    const res = normalizeAdminAppointmentFromGlobal(
      docComDados({ customerUid: 'user-1', startAtMs: 1_784_000_000_000 }),
    );

    expect(res).toMatchObject({
      customerName: 'Cliente',
      vehicleType: 'Carro',
      carCategory: null,
      serviceLabel: null,
      price: null,
      endAtMs: undefined,
      status: 'scheduled',
    });
  });

  it('preço e fim só entram se forem numéricos', () => {
    // O Firestore pode devolver o que foi gravado; texto aqui viraria conta
    // errada na tela do dono.
    const res = normalizeAdminAppointmentFromGlobal(
      docComDados({ ...completo, price: '250', endAtMs: 'depois' }),
    );

    expect(res?.price).toBeNull();
    expect(res?.endAtMs).toBeUndefined();
  });

  it('preço zero é um valor válido, não ausência', () => {
    const res = normalizeAdminAppointmentFromGlobal(docComDados({ ...completo, price: 0 }));

    expect(res?.price).toBe(0);
  });

  it('usa o id do documento, não um campo do payload', () => {
    const res = normalizeAdminAppointmentFromGlobal(
      docComDados({ ...completo, id: 'id-falso' }, 'id-real'),
    );

    expect(res?.id).toBe('id-real');
  });
});
