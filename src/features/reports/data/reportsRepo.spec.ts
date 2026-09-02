const mockGetDocs = jest.fn();
const mockDb = {};

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => mockDb,
  collection: (_db: unknown, ...caminho: string[]) => ({ tipo: 'collection', caminho }),
  query: (ref: unknown, ...clausulas: unknown[]) => ({ ref, clausulas }),
  where: (campo: string, op: string, valor: unknown) => ({ tipo: 'where', campo, op, valor }),
  orderBy: (campo: string) => ({ tipo: 'orderBy', campo }),
  limit: (n: number) => ({ tipo: 'limit', n }),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

const mockNormalizar = jest.fn();
jest.mock('@features/admin', () => ({
  normalizeAdminAppointmentFromGlobal: (d: unknown) => mockNormalizar(d),
}));

import { buscarConcluidosDoMes } from './reportsRepo';

const LIMITES = {
  inicioMs: new Date(2026, 7, 1).getTime(),
  fimMs: new Date(2026, 8, 1).getTime(),
};

function consultaFeita() {
  return mockGetDocs.mock.calls[0][0] as {
    ref: { caminho: string[] };
    clausulas: Array<Record<string, unknown>>;
  };
}

describe('buscarConcluidosDoMes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('lê os agendamentos da loja', async () => {
    await buscarConcluidosDoMes('shop-1', LIMITES);

    expect(consultaFeita().ref.caminho).toEqual(['shops', 'shop-1', 'appointments']);
  });

  // Esta é a forma exata que o índice composto status+startAtMs atende. Mudar
  // a consulta sem mudar o índice devolve failed-precondition em produção.
  it('filtra por concluídos dentro do mês, com o fim exclusivo', async () => {
    await buscarConcluidosDoMes('shop-1', LIMITES);

    const wheres = consultaFeita().clausulas.filter(c => c.tipo === 'where');

    expect(wheres).toEqual([
      { tipo: 'where', campo: 'status', op: '==', valor: 'done' },
      { tipo: 'where', campo: 'startAtMs', op: '>=', valor: LIMITES.inicioMs },
      { tipo: 'where', campo: 'startAtMs', op: '<', valor: LIMITES.fimMs },
    ]);
  });

  it('ordena por data e limita o volume', async () => {
    await buscarConcluidosDoMes('shop-1', LIMITES);

    const clausulas = consultaFeita().clausulas;

    expect(clausulas).toContainEqual({ tipo: 'orderBy', campo: 'startAtMs' });
    expect(clausulas).toContainEqual({ tipo: 'limit', n: 2000 });
  });

  it('normaliza cada documento', async () => {
    mockGetDocs.mockResolvedValue({ docs: ['doc-a', 'doc-b'] });
    mockNormalizar.mockImplementation(d => ({ id: d }));

    await expect(buscarConcluidosDoMes('shop-1', LIMITES)).resolves.toEqual([
      { id: 'doc-a' },
      { id: 'doc-b' },
    ]);
  });

  // Documento sem startAtMs ou sem cliente volta null do normalizador. Deixá-lo
  // passar quebraria as somas mais adiante.
  it('descarta documento que o normalizador rejeita', async () => {
    mockGetDocs.mockResolvedValue({ docs: ['bom', 'ruim'] });
    mockNormalizar.mockImplementation(d => (d === 'bom' ? { id: 'bom' } : null));

    await expect(buscarConcluidosDoMes('shop-1', LIMITES)).resolves.toEqual([{ id: 'bom' }]);
  });

  it('propaga a falha da consulta', async () => {
    mockGetDocs.mockRejectedValue(new Error('permission-denied'));

    await expect(buscarConcluidosDoMes('shop-1', LIMITES)).rejects.toThrow('permission-denied');
  });
});
