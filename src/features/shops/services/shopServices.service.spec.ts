const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();

const batchSetMock = jest.fn();
const batchCommitMock = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  serverTimestamp: jest.fn(() => 'ts'),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import {
  DEFAULT_SHOP_SERVICES,
  createShopService,
  deleteShopService,
  ensureShopServices,
  getServiceVehicleSummary,
  normalizeShopService,
  serviceSupportsVehicle,
  updateShopService,
} from './shopServices.service';
import type { ShopService } from '../domain/shopService.types';

describe('shopServices.service', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockUpdateDoc.mockReset();
    mockDeleteDoc.mockReset();
    mockSetDoc.mockReset();
    mockWriteBatch.mockReset();
    mockDoc.mockReset();
    mockCollection.mockReset();
    mockQuery.mockReset();
    mockOrderBy.mockReset();
    batchSetMock.mockReset();
    batchCommitMock.mockReset();

    mockWriteBatch.mockReturnValue({
      set: batchSetMock,
      commit: batchCommitMock,
    });
  });

  describe('normalizeShopService', () => {
    it('normaliza um documento válido corretamente', () => {
      const mockDocSnap = {
        id: 'serv-1',
        data: () => ({
          name: '  Lavagem Detalhada  ',
          title: 'Lavagem Completa',
          description: 'Limpeza profunda',
          includes: ['Rodas', 'Chassi', 'Motor'],
          note: 'Atenção especial nos detalhes',
          recommendedFor: ['Carros de luxo'],
          durationMin: 90,
          price: 150,
          vehicleTypes: ['Carro'],
          carCategories: ['SUV', 'Picape cabine dupla'],
          iconKey: 'wash',
          active: true,
          sortOrder: 1,
        }),
      } as any;

      const service = normalizeShopService(mockDocSnap);

      expect(service).toEqual({
        id: 'serv-1',
        name: 'Lavagem Detalhada',
        title: 'Lavagem Completa',
        description: 'Limpeza profunda',
        includes: ['Rodas', 'Chassi', 'Motor'],
        note: 'Atenção especial nos detalhes',
        recommendedFor: ['Carros de luxo'],
        durationMin: 90,
        price: 150,
        vehicleTypes: ['Carro'],
        carCategories: ['SUV', 'Picape cabine dupla'],
        iconKey: 'wash',
        active: true,
        sortOrder: 1,
      });
    });

    it('retorna null se o nome do serviço for vazio ou inválido', () => {
      const mockDocSnap = {
        id: 'serv-invalid',
        data: () => ({
          name: '   ',
        }),
      } as any;

      expect(normalizeShopService(mockDocSnap)).toBeNull();
    });

    it('aplica valores padrão para campos opcionais ou inválidos', () => {
      const mockDocSnap = {
        id: 'serv-defaults',
        data: () => ({
          name: 'Polimento',
          includes: ['Item 1', 123, null],
          recommendedFor: ['Uso geral', false],
          durationMin: -10,
          price: 'inválido',
          vehicleTypes: ['Invalido'],
          carCategories: ['Invalido'],
          iconKey: 'desconhecido',
          active: 'nao-booleano',
          sortOrder: 'invalido',
        }),
      } as any;

      const service = normalizeShopService(mockDocSnap);

      expect(service).toEqual({
        id: 'serv-defaults',
        name: 'Polimento',
        title: 'Polimento',
        description: null,
        includes: ['Item 1'],
        note: null,
        recommendedFor: ['Uso geral'],
        durationMin: 30,
        price: 0,
        vehicleTypes: ['Carro', 'Moto'],
        carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
        iconKey: 'default',
        active: true,
        sortOrder: 999,
      });
    });

    it('limpa carCategories se vehicleTypes não incluir Carro', () => {
      const mockDocSnap = {
        id: 'serv-moto-only',
        data: () => ({
          name: 'Lavagem Moto',
          vehicleTypes: ['Moto'],
          carCategories: ['SUV'],
        }),
      } as any;

      const service = normalizeShopService(mockDocSnap);

      expect(service?.vehicleTypes).toEqual(['Moto']);
      expect(service?.carCategories).toEqual([]);
    });
  });

  describe('serviceSupportsVehicle', () => {
    const service: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
      vehicleTypes: ['Carro', 'Moto'],
      carCategories: ['Hatch', 'Sedan'],
    };

    it('retorna false se o tipo de veículo não for suportado pelo serviço', () => {
      const motoOnlyService = { vehicleTypes: ['Moto'] as any, carCategories: [] as any };
      expect(serviceSupportsVehicle(motoOnlyService, 'Carro', 'Hatch')).toBe(false);
    });

    it('retorna true para Moto se Moto estiver nos tipos suportados', () => {
      expect(serviceSupportsVehicle(service, 'Moto', null)).toBe(true);
    });

    it('retorna true para Carro se a categoria for suportada', () => {
      expect(serviceSupportsVehicle(service, 'Carro', 'Hatch')).toBe(true);
      expect(serviceSupportsVehicle(service, 'Carro', 'Sedan')).toBe(true);
    });

    it('retorna false para Carro se a categoria não for suportada ou for nula', () => {
      expect(serviceSupportsVehicle(service, 'Carro', 'SUV')).toBe(false);
      expect(serviceSupportsVehicle(service, 'Carro', null)).toBe(false);
    });
  });

  describe('getServiceVehicleSummary', () => {
    it('resume serviço exclusivo para moto', () => {
      const service = { vehicleTypes: ['Moto'], carCategories: [] } as unknown as ShopService;
      expect(getServiceVehicleSummary(service)).toBe('Moto');
    });

    it('resume serviço para todos os carros', () => {
      const service = {
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
      } as unknown as ShopService;
      expect(getServiceVehicleSummary(service)).toBe('Todos os carros');
    });

    it('resume serviço para categorias específicas de carro', () => {
      const service = {
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch', 'Sedan'],
      } as unknown as ShopService;
      expect(getServiceVehicleSummary(service)).toBe('Hatch, Sedan');
    });

    it('resume serviço para Moto e Carro combinados', () => {
      const service = {
        vehicleTypes: ['Moto', 'Carro'],
        carCategories: ['Hatch'],
      } as unknown as ShopService;
      expect(getServiceVehicleSummary(service)).toBe('Moto · Hatch');
    });

    it('retorna texto padrão se nenhum veículo for suportado', () => {
      const service = { vehicleTypes: [], carCategories: [] } as unknown as ShopService;
      expect(getServiceVehicleSummary(service)).toBe('Nenhum veículo');
    });
  });

  describe('ensureShopServices', () => {
    it('retorna serviços existentes se já houver cadastrados na loja', async () => {
      const existingDoc = {
        id: 'lavagem-1',
        data: () => ({
          name: 'Lavagem Simples',
          durationMin: 30,
          price: 50,
          vehicleTypes: ['Carro'],
          carCategories: ['Hatch'],
          iconKey: 'wash',
          active: true,
          sortOrder: 0,
        }),
      };

      mockGetDocs.mockResolvedValueOnce({
        docs: [existingDoc],
      });

      const services = await ensureShopServices('shop-1');

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('Lavagem Simples');
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    it('cria os serviços padrão em batch se a loja não tiver nenhum serviço', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      batchCommitMock.mockResolvedValueOnce(undefined);

      const services = await ensureShopServices('shop-1');

      expect(services).toHaveLength(DEFAULT_SHOP_SERVICES.length);
      expect(batchSetMock).toHaveBeenCalledTimes(DEFAULT_SHOP_SERVICES.length);
      expect(batchCommitMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('operações de mutação (create, update, delete)', () => {
    it('createShopService salva o serviço no Firestore', async () => {
      mockDoc.mockReturnValueOnce({ path: 'shops/shop-1/services/serv-1' });
      mockSetDoc.mockResolvedValueOnce(undefined);

      await createShopService('shop-1', 'serv-1', DEFAULT_SHOP_SERVICES[0]);

      expect(mockDoc).toHaveBeenCalledWith(
        expect.anything(),
        'shops',
        'shop-1',
        'services',
        'serv-1',
      );
      expect(mockSetDoc).toHaveBeenCalledWith(
        { path: 'shops/shop-1/services/serv-1' },
        {
          ...DEFAULT_SHOP_SERVICES[0],
          createdAt: 'ts',
          updatedAt: 'ts',
        },
      );
    });

    it('updateShopService atualiza os campos informados no Firestore', async () => {
      mockDoc.mockReturnValueOnce({ path: 'shops/shop-1/services/serv-1' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopService('shop-1', 'serv-1', { price: 100, active: false });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { path: 'shops/shop-1/services/serv-1' },
        {
          price: 100,
          active: false,
          updatedAt: 'ts',
        },
      );
    });

    it('deleteShopService remove o serviço no Firestore', async () => {
      mockDoc.mockReturnValueOnce({ path: 'shops/shop-1/services/serv-1' });
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await deleteShopService('shop-1', 'serv-1');

      expect(mockDeleteDoc).toHaveBeenCalledWith({ path: 'shops/shop-1/services/serv-1' });
    });
  });
});
