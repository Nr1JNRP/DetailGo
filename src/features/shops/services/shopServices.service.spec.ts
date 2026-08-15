const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((...args) => ({ type: 'collection', path: args.slice(1).join('/') })),
  doc: jest.fn((...args) => ({ type: 'doc', path: args.slice(1).join('/') })),
  query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
  orderBy: jest.fn((field, dir) => ({ field, dir })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: jest.fn(() => 'ts'),
  writeBatch: jest.fn(() => {
    return {
      set: mockBatchSet,
      commit: mockBatchCommit,
    };
  }),
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
import { CAR_CATEGORIES } from '@features/appointments/domain/appointment.constants';

describe('shopServices.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  describe('normalizeShopService', () => {
    it('retorna null se o nome for vazio ou invalido', () => {
      const docSnap1 = { id: 's1', data: () => ({ name: '' }) } as any;
      const docSnap2 = { id: 's2', data: () => ({ name: 123 }) } as any;
      const docSnap3 = { id: 's3', data: () => ({}) } as any;

      expect(normalizeShopService(docSnap1)).toBeNull();
      expect(normalizeShopService(docSnap2)).toBeNull();
      expect(normalizeShopService(docSnap3)).toBeNull();
    });

    it('normaliza um servico com dados validos', () => {
      const docSnap = {
        id: 's1',
        data: () => ({
          name: '  Polimento  ',
          title: 'Polimento Técnico',
          description: 'Recupera o brilho',
          includes: ['Passo 1', 'Passo 2', 123],
          note: 'Nota especial',
          recommendedFor: ['Carros pretos'],
          durationMin: 90,
          price: 250,
          vehicleTypes: ['Carro'],
          carCategories: ['SUV', 'Hatch'],
          iconKey: 'polish',
          active: true,
          sortOrder: 1,
        }),
      } as any;

      const normalized = normalizeShopService(docSnap);

      expect(normalized).toEqual({
        id: 's1',
        name: 'Polimento',
        title: 'Polimento Técnico',
        description: 'Recupera o brilho',
        includes: ['Passo 1', 'Passo 2'],
        note: 'Nota especial',
        recommendedFor: ['Carros pretos'],
        durationMin: 90,
        price: 250,
        vehicleTypes: ['Carro'],
        carCategories: ['SUV', 'Hatch'],
        iconKey: 'polish',
        active: true,
        sortOrder: 1,
      });
    });

    it('aplica valores padrao quando os campos estao ausentes ou invalidos', () => {
      const docSnap = {
        id: 's2',
        data: () => ({
          name: 'Lavagem',
          title: null,
          description: 123,
          includes: 'invalido',
          note: true,
          recommendedFor: null,
          durationMin: -10,
          price: -50,
          vehicleTypes: 'invalido',
          carCategories: 'invalido',
          iconKey: 'icone-desconhecido',
          active: 'invalido',
          sortOrder: 'invalido',
        }),
      } as any;

      const normalized = normalizeShopService(docSnap);

      expect(normalized).toEqual({
        id: 's2',
        name: 'Lavagem',
        title: 'Lavagem',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30,
        price: 0,
        vehicleTypes: ['Carro', 'Moto'],
        carCategories: [...CAR_CATEGORIES],
        iconKey: 'default',
        active: true,
        sortOrder: 999,
      });
    });

    it('limpa categorias de carro se o servico nao atender Carro', () => {
      const docSnap = {
        id: 's3',
        data: () => ({
          name: 'Lavagem Moto',
          vehicleTypes: ['Moto'],
          carCategories: ['Hatch'],
        }),
      } as any;

      const normalized = normalizeShopService(docSnap);

      expect(normalized?.vehicleTypes).toEqual(['Moto']);
      expect(normalized?.carCategories).toEqual([]);
    });
  });

  describe('serviceSupportsVehicle', () => {
    const service: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
      vehicleTypes: ['Carro', 'Moto'],
      carCategories: ['Hatch'],
    };

    it('retorna false se o tipo de veiculo nao for suportado', () => {
      const motoOnlyService = { vehicleTypes: ['Moto'] as any, carCategories: [] };
      expect(serviceSupportsVehicle(motoOnlyService, 'Carro', 'Hatch')).toBe(false);
    });

    it('retorna true para Moto quando Moto e suportada', () => {
      expect(serviceSupportsVehicle(service, 'Moto', null)).toBe(true);
    });

    it('retorna true para Carro quando a categoria bate', () => {
      expect(serviceSupportsVehicle(service, 'Carro', 'Hatch')).toBe(true);
    });

    it('retorna false para Carro quando a categoria nao bate ou e nula', () => {
      expect(serviceSupportsVehicle(service, 'Carro', 'SUV')).toBe(false);
      expect(serviceSupportsVehicle(service, 'Carro', null)).toBe(false);
    });
  });

  describe('getServiceVehicleSummary', () => {
    it('retorna resumo correto para Moto e Carro com todas as categorias', () => {
      const service: ShopService = {
        id: '1',
        name: 'Completo',
        title: 'Completo',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30,
        price: 100,
        vehicleTypes: ['Moto', 'Carro'],
        carCategories: [...CAR_CATEGORIES],
        iconKey: 'default',
        active: true,
        sortOrder: 0,
      };

      expect(getServiceVehicleSummary(service)).toBe('Moto · Todos os carros');
    });

    it('retorna resumo correto com categorias especificas', () => {
      const service: ShopService = {
        id: '2',
        name: 'Lavagem Picape',
        title: 'Lavagem Picape',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30,
        price: 100,
        vehicleTypes: ['Carro'],
        carCategories: ['SUV', 'Picape cabine dupla'],
        iconKey: 'default',
        active: true,
        sortOrder: 0,
      };

      expect(getServiceVehicleSummary(service)).toBe('SUV, Picape cabine dupla');
    });

    it('retorna Nenhum veiculo se nao houver tipos suportados', () => {
      const service: ShopService = {
        id: '3',
        name: 'Vazio',
        title: 'Vazio',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30,
        price: 100,
        vehicleTypes: [],
        carCategories: [],
        iconKey: 'default',
        active: true,
        sortOrder: 0,
      };

      expect(getServiceVehicleSummary(service)).toBe('Nenhum veículo');
    });
  });

  describe('ensureShopServices', () => {
    it('retorna os servicos existentes se ja cadastrados', async () => {
      const existingDoc = {
        id: 'lavagem',
        data: () => ({
          name: 'Lavagem',
          title: 'Lavagem Especial',
          price: 50,
          vehicleTypes: ['Carro'],
          carCategories: ['Hatch'],
        }),
      };
      mockGetDocs.mockResolvedValueOnce({ docs: [existingDoc] });

      const services = await ensureShopServices('shop-123');

      expect(services).toHaveLength(1);
      expect(services[0].id).toBe('lavagem');
      expect(services[0].title).toBe('Lavagem Especial');
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('cria os servicos padrao em batch se nenhum servico existir', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const services = await ensureShopServices('shop-456');

      expect(mockBatchSet).toHaveBeenCalledTimes(DEFAULT_SHOP_SERVICES.length);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      expect(services).toHaveLength(DEFAULT_SHOP_SERVICES.length);
      expect(services[0].name).toBe(DEFAULT_SHOP_SERVICES[0].name);
    });
  });

  describe('CRUD de servicos', () => {
    it('updateShopService atualiza o documento com updatedAt', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopService('shop-1', 'service-1', { price: 150, active: false });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { type: 'doc', path: 'shops/shop-1/services/service-1' },
        {
          price: 150,
          active: false,
          updatedAt: 'ts',
        },
      );
    });

    it('deleteShopService remove o documento', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await deleteShopService('shop-1', 'service-1');

      expect(mockDeleteDoc).toHaveBeenCalledWith({
        type: 'doc',
        path: 'shops/shop-1/services/service-1',
      });
    });

    it('createShopService cria o documento com timestamps', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const input = DEFAULT_SHOP_SERVICES[0];
      await createShopService('shop-1', 'service-1', input);

      expect(mockSetDoc).toHaveBeenCalledWith(
        { type: 'doc', path: 'shops/shop-1/services/service-1' },
        {
          ...input,
          createdAt: 'ts',
          updatedAt: 'ts',
        },
      );
    });
  });
});
