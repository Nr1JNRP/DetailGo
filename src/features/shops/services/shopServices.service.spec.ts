const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: jest.fn(() => ({
    set: (...args: unknown[]) => mockBatchSet(...args),
    commit: (...args: unknown[]) => mockBatchCommit(...args),
  })),
  serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
}));

import {
  createShopService,
  deleteShopService,
  ensureShopServices,
  getServiceVehicleSummary,
  normalizeShopService,
  serviceSupportsVehicle,
  shopServicesQuery,
  shopServicesRef,
  updateShopService,
  DEFAULT_SHOP_SERVICES,
} from './shopServices.service';
import type { ShopServiceInput } from '../domain/shopService.types';

function createMockDocSnap(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  } as any;
}

describe('shopServices.service', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockUpdateDoc.mockReset();
    mockDeleteDoc.mockReset();
    mockBatchSet.mockReset();
    mockBatchCommit.mockReset();
    mockDoc.mockReset();
    mockCollection.mockReset();
    mockQuery.mockReset();
    mockOrderBy.mockReset();
  });

  describe('serviceSupportsVehicle', () => {
    it('retorna false se o tipo de veículo não é suportado pelo serviço', () => {
      const service = { vehicleTypes: ['Carro'] as any, carCategories: ['Hatch'] as any };
      expect(serviceSupportsVehicle(service, 'Moto', null)).toBe(false);
    });

    it('retorna true para Moto quando Moto está em vehicleTypes', () => {
      const service = { vehicleTypes: ['Moto'] as any, carCategories: [] };
      expect(serviceSupportsVehicle(service, 'Moto', null)).toBe(true);
    });

    it('retorna false para Carro quando a categoria não é informada ou não bate', () => {
      const service = { vehicleTypes: ['Carro'] as any, carCategories: ['Hatch', 'Sedan'] as any };
      expect(serviceSupportsVehicle(service, 'Carro', null)).toBe(false);
      expect(serviceSupportsVehicle(service, 'Carro', 'SUV')).toBe(false);
    });

    it('retorna true para Carro quando a categoria é suportada pelo serviço', () => {
      const service = { vehicleTypes: ['Carro'] as any, carCategories: ['Hatch', 'SUV'] as any };
      expect(serviceSupportsVehicle(service, 'Carro', 'SUV')).toBe(true);
    });
  });

  describe('getServiceVehicleSummary', () => {
    it('retorna "Nenhum veículo" quando vehicleTypes é vazio', () => {
      const service = { vehicleTypes: [], carCategories: [] } as any;
      expect(getServiceVehicleSummary(service)).toBe('Nenhum veículo');
    });

    it('retorna resumo para Moto apenas', () => {
      const service = { vehicleTypes: ['Moto'], carCategories: [] } as any;
      expect(getServiceVehicleSummary(service)).toBe('Moto');
    });

    it('retorna "Todos os carros" quando atende todas as categorias', () => {
      const service = {
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
      } as any;
      expect(getServiceVehicleSummary(service)).toBe('Todos os carros');
    });

    it('lista as categorias específicas quando não atende todas', () => {
      const service = {
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch', 'SUV'],
      } as any;
      expect(getServiceVehicleSummary(service)).toBe('Hatch, SUV');
    });

    it('combina Moto e Carro no resumo', () => {
      const service = {
        vehicleTypes: ['Moto', 'Carro'],
        carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
      } as any;
      expect(getServiceVehicleSummary(service)).toBe('Moto · Todos os carros');
    });
  });

  describe('normalizeShopService', () => {
    it('retorna null se o serviço não tiver nome válido', () => {
      expect(normalizeShopService(createMockDocSnap('s1', {}))).toBeNull();
      expect(normalizeShopService(createMockDocSnap('s1', { name: '   ' }))).toBeNull();
      expect(normalizeShopService(createMockDocSnap('s1', { name: 123 }))).toBeNull();
    });

    it('normaliza corretamente um documento completo do Firestore', () => {
      const data = {
        name: 'Lavagem Completa',
        title: 'Título Customizado',
        description: 'Descrição do serviço',
        includes: ['Item 1', 123, 'Item 2'], // filtra não-strings
        note: 'Observação',
        recommendedFor: ['Recomendação 1'],
        durationMin: 45,
        price: 100,
        vehicleTypes: ['Carro', 'Inválido'],
        carCategories: ['Hatch', 'Inexistente'],
        iconKey: 'wash',
        active: false,
        sortOrder: 2,
      };

      const normalized = normalizeShopService(createMockDocSnap('s1', data));

      expect(normalized).toEqual({
        id: 's1',
        name: 'Lavagem Completa',
        title: 'Título Customizado',
        description: 'Descrição do serviço',
        includes: ['Item 1', 'Item 2'],
        note: 'Observação',
        recommendedFor: ['Recomendação 1'],
        durationMin: 45,
        price: 100,
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch'],
        iconKey: 'wash',
        active: false,
        sortOrder: 2,
      });
    });

    it('usa valores padrão quando os campos numéricos ou enums forem inválidos', () => {
      const data = {
        name: 'Serviço Básico',
        durationMin: -10,
        price: -50,
        iconKey: 'icone-invalido',
        vehicleTypes: 'não-é-array',
        carCategories: 'não-é-array',
        active: 'não-é-boolean',
        sortOrder: 'não-é-number',
      };

      const normalized = normalizeShopService(createMockDocSnap('s2', data));

      expect(normalized).toEqual({
        id: 's2',
        name: 'Serviço Básico',
        title: 'Serviço Básico',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30,
        price: 0,
        vehicleTypes: ['Carro', 'Moto'],
        carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
        iconKey: 'default',
        active: true,
        sortOrder: 999,
      });
    });

    it('reseta carCategories para vazio se vehicleTypes não contiver Carro', () => {
      const data = {
        name: 'Apenas Moto',
        vehicleTypes: ['Moto'],
        carCategories: ['Hatch', 'SUV'],
      };

      const normalized = normalizeShopService(createMockDocSnap('s3', data));

      expect(normalized?.vehicleTypes).toEqual(['Moto']);
      expect(normalized?.carCategories).toEqual([]);
    });
  });

  describe('ensureShopServices', () => {
    it('retorna os serviços existentes caso a estética já possua cadastrados', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          createMockDocSnap('s1', {
            name: 'Lavagem',
            durationMin: 30,
            price: 80,
            sortOrder: 0,
          }),
        ],
      });

      const services = await ensureShopServices('shop-1');

      expect(services).toHaveLength(1);
      expect(services[0].id).toBe('s1');
      expect(services[0].name).toBe('Lavagem');
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('semeia os serviços padrão via batch quando a estética não tem nenhum serviço', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockBatchCommit.mockResolvedValueOnce(undefined);

      const services = await ensureShopServices('shop-empty');

      expect(mockBatchSet).toHaveBeenCalledTimes(DEFAULT_SHOP_SERVICES.length);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);

      expect(services).toHaveLength(DEFAULT_SHOP_SERVICES.length);
      expect(services[0].name).toBe(DEFAULT_SHOP_SERVICES[0].name);
      expect(services[0].id).toBe('lavagem');
    });
  });

  describe('shopServicesRef e shopServicesQuery', () => {
    it('constrói a referência e a query de coleção com orderBy', () => {
      mockCollection.mockReturnValue('COLL_REF');
      mockOrderBy.mockReturnValue('ORDER_BY');

      shopServicesRef('shop-9');
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'shops', 'shop-9', 'services');

      shopServicesQuery('shop-9');
      expect(mockQuery).toHaveBeenCalledWith('COLL_REF', 'ORDER_BY');
    });
  });

  describe('CRUD de serviços da loja', () => {
    it('createShopService grava no Firestore no caminho correto', async () => {
      const input: ShopServiceInput = {
        name: 'Higienização',
        title: 'Higienização Interna',
        description: 'Limpeza de estofados',
        includes: ['Bancos'],
        note: 'Nota',
        recommendedFor: ['Uso geral'],
        durationMin: 60,
        price: 150,
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch'],
        iconKey: 'wash',
        active: true,
        sortOrder: 1,
      };

      const mockDocRef = { id: 'serv-1' };
      mockDoc.mockReturnValue(mockDocRef);
      mockSetDoc.mockResolvedValueOnce(undefined);

      await createShopService('shop-1', 'serv-1', input);

      expect(mockDoc).toHaveBeenCalledWith(
        expect.anything(),
        'shops',
        'shop-1',
        'services',
        'serv-1',
      );
      expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
        ...input,
        createdAt: 'MOCK_TIMESTAMP',
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });

    it('updateShopService atualiza dados do serviço no Firestore', async () => {
      const mockDocRef = { id: 'serv-1' };
      mockDoc.mockReturnValue(mockDocRef);
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopService('shop-1', 'serv-1', { price: 200, active: false });

      expect(mockDoc).toHaveBeenCalledWith(
        expect.anything(),
        'shops',
        'shop-1',
        'services',
        'serv-1',
      );
      expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, {
        price: 200,
        active: false,
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });

    it('deleteShopService remove o serviço do Firestore', async () => {
      const mockDocRef = { id: 'serv-1' };
      mockDoc.mockReturnValue(mockDocRef);
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await deleteShopService('shop-1', 'serv-1');

      expect(mockDoc).toHaveBeenCalledWith(
        expect.anything(),
        'shops',
        'shop-1',
        'services',
        'serv-1',
      );
      expect(mockDeleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });
});
