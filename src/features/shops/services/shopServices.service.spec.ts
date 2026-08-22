const mockGetFirestore = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();
const mockServerTimestamp = jest.fn(() => 'MOCK_TIMESTAMP');
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWriteBatch = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => mockGetFirestore()),
  collection: jest.fn((...args: any[]) => mockCollection(...args)),
  doc: jest.fn((...args: any[]) => mockDoc(...args)),
  getDocs: jest.fn((...args: any[]) => mockGetDocs(...args)),
  query: jest.fn((...args: any[]) => mockQuery(...args)),
  orderBy: jest.fn((...args: any[]) => mockOrderBy(...args)),
  serverTimestamp: jest.fn(() => mockServerTimestamp()),
  setDoc: jest.fn((...args: any[]) => mockSetDoc(...args)),
  updateDoc: jest.fn((...args: any[]) => mockUpdateDoc(...args)),
  deleteDoc: jest.fn((...args: any[]) => mockDeleteDoc(...args)),
  writeBatch: jest.fn((...args: any[]) => mockWriteBatch(...args)),
}));

import {
  normalizeShopService,
  serviceSupportsVehicle,
  getServiceVehicleSummary,
  ensureShopServices,
  updateShopService,
  deleteShopService,
  createShopService,
  DEFAULT_SHOP_SERVICES,
} from './shopServices.service';
import type { ShopService } from '../domain/shopService.types';

describe('shopServices.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeShopService', () => {
    it('normaliza um documento válido do Firestore', () => {
      const mockDocSnap = {
        id: 'service-1',
        data: () => ({
          name: 'Lavagem Completa',
          title: 'Lavagem Especial',
          description: 'Limpeza geral',
          includes: ['Item 1', 123, null, 'Item 2'],
          note: 'Atenção',
          recommendedFor: ['Recomendação 1'],
          durationMin: 45,
          price: 90,
          vehicleTypes: ['Carro', 'Moto', 'Invalido'],
          carCategories: ['SUV', 'Sedan'],
          iconKey: 'wash',
          active: true,
          sortOrder: 1,
        }),
      } as any;

      const result = normalizeShopService(mockDocSnap);

      expect(result).toEqual({
        id: 'service-1',
        name: 'Lavagem Completa',
        title: 'Lavagem Especial',
        description: 'Limpeza geral',
        includes: ['Item 1', 'Item 2'],
        note: 'Atenção',
        recommendedFor: ['Recomendação 1'],
        durationMin: 45,
        price: 90,
        vehicleTypes: ['Carro', 'Moto'],
        carCategories: ['SUV', 'Sedan'],
        iconKey: 'wash',
        active: true,
        sortOrder: 1,
      });
    });

    it('retorna null se o nome for vazio ou não for string', () => {
      const mockDocSnapNoName = {
        id: 'service-2',
        data: () => ({ name: '   ' }),
      } as any;

      expect(normalizeShopService(mockDocSnapNoName)).toBeNull();

      const mockDocSnapInvalidName = {
        id: 'service-3',
        data: () => ({ name: 123 }),
      } as any;

      expect(normalizeShopService(mockDocSnapInvalidName)).toBeNull();
    });

    it('aplica fallbacks para campos ausentes ou inválidos', () => {
      const mockDocSnap = {
        id: 'service-fallback',
        data: () => ({
          name: 'Serviço Simples',
          title: null,
          description: 123,
          includes: 'não é array',
          note: 99,
          recommendedFor: null,
          durationMin: -10,
          price: -5,
          vehicleTypes: 'invalido',
          carCategories: 'invalido',
          iconKey: 'icone-inexistente',
          active: 'não é bool',
          sortOrder: 'abc',
        }),
      } as any;

      const result = normalizeShopService(mockDocSnap);

      expect(result).toEqual({
        id: 'service-fallback',
        name: 'Serviço Simples',
        title: 'Serviço Simples',
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

    it('limpa categorias de carro se vehicleTypes não contiver Carro', () => {
      const mockDocSnap = {
        id: 'service-moto-only',
        data: () => ({
          name: 'Lavagem Moto',
          vehicleTypes: ['Moto'],
          carCategories: ['SUV', 'Sedan'],
        }),
      } as any;

      const result = normalizeShopService(mockDocSnap);
      expect(result?.carCategories).toEqual([]);
    });
  });

  describe('serviceSupportsVehicle', () => {
    const baseService: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
      vehicleTypes: ['Carro', 'Moto'],
      carCategories: ['SUV', 'Sedan'],
    };

    it('retorna false se o tipo de veículo não for suportado', () => {
      const motoOnly: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
        vehicleTypes: ['Moto'],
        carCategories: [],
      };
      expect(serviceSupportsVehicle(motoOnly, 'Carro', 'SUV')).toBe(false);
    });

    it('retorna true para Moto se o tipo Moto for suportado', () => {
      expect(serviceSupportsVehicle(baseService, 'Moto', null)).toBe(true);
    });

    it('valida categoria para Carro corretamente', () => {
      expect(serviceSupportsVehicle(baseService, 'Carro', 'SUV')).toBe(true);
      expect(serviceSupportsVehicle(baseService, 'Carro', 'Hatch')).toBe(false);
      expect(serviceSupportsVehicle(baseService, 'Carro', null)).toBe(false);
    });
  });

  describe('getServiceVehicleSummary', () => {
    it('retorna "Nenhum veículo" se vehicleTypes estiver vazio', () => {
      const service = { vehicleTypes: [], carCategories: [] } as any;
      expect(getServiceVehicleSummary(service)).toBe('Nenhum veículo');
    });

    it('retorna formato para Moto e Todos os carros', () => {
      const service = {
        vehicleTypes: ['Moto', 'Carro'],
        carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
      } as any;
      expect(getServiceVehicleSummary(service)).toBe('Moto · Todos os carros');
    });

    it('retorna formato para categorias específicas de carro', () => {
      const service = {
        vehicleTypes: ['Carro'],
        carCategories: ['SUV', 'Picape cabine dupla'],
      } as any;
      expect(getServiceVehicleSummary(service)).toBe('SUV, Picape cabine dupla');
    });
  });

  describe('ensureShopServices', () => {
    it('retorna serviços existentes se o Firestore já possuir registros', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'service-existente',
            data: () => ({
              name: 'Serviço Existente',
              sortOrder: 1,
            }),
          },
        ],
      });

      const services = await ensureShopServices('shop-1');

      expect(services.length).toBe(1);
      expect(services[0].id).toBe('service-existente');
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    it('inicializa serviços padrão em batch quando a loja não tem serviços', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const mockBatchSet = jest.fn();
      const mockBatchCommit = jest.fn().mockResolvedValueOnce(undefined);
      mockWriteBatch.mockReturnValueOnce({
        set: mockBatchSet,
        commit: mockBatchCommit,
      });

      const services = await ensureShopServices('shop-1');

      expect(mockWriteBatch).toHaveBeenCalled();
      expect(mockBatchSet).toHaveBeenCalledTimes(DEFAULT_SHOP_SERVICES.length);
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(services.length).toBe(DEFAULT_SHOP_SERVICES.length);
      expect(services[0].id).toBe('lavagem');
    });
  });

  describe('updateShopService', () => {
    it('atualiza documento com os campos informados e updatedAt', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopService('shop-1', 'service-1', {
        name: 'Nome Atualizado',
        price: 150,
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(undefined, {
        name: 'Nome Atualizado',
        price: 150,
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });
  });

  describe('deleteShopService', () => {
    it('remove o documento do serviço', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await deleteShopService('shop-1', 'service-1');

      expect(mockDeleteDoc).toHaveBeenCalledWith(undefined);
    });
  });

  describe('createShopService', () => {
    it('cria novo documento de serviço com createdAt e updatedAt', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const inputService = DEFAULT_SHOP_SERVICES[0];
      await createShopService('shop-1', 'service-novo', inputService);

      expect(mockSetDoc).toHaveBeenCalledWith(undefined, {
        ...inputService,
        createdAt: 'MOCK_TIMESTAMP',
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });
  });
});
