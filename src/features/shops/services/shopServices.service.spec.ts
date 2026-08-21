const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();
const mockDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockServerTimestamp = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
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
import type { ShopService, ShopServiceInput } from '../domain/shopService.types';
import { CAR_CATEGORIES, VEHICLE_TYPES } from '@features/appointments/domain/appointment.constants';

describe('shopServices.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServerTimestamp.mockReturnValue('MOCK_TIMESTAMP');
  });

  describe('normalizeShopService', () => {
    it('retorna null se o documento não tiver nome válido', () => {
      const docSnap = {
        id: 's1',
        data: () => ({ name: '   ' }),
      } as any;

      expect(normalizeShopService(docSnap)).toBeNull();
    });

    it('normaliza campos incompletos e aplica os valores padrão', () => {
      const docSnap = {
        id: 's1',
        data: () => ({
          name: '  Lavagem Simples  ',
          // omitindo title, description, includes, durationMin, price, iconKey, active, etc.
        }),
      } as any;

      const result = normalizeShopService(docSnap);

      expect(result).toEqual({
        id: 's1',
        name: 'Lavagem Simples',
        title: 'Lavagem Simples',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30, // fallback quando < 0 ou ausente
        price: 0, // fallback quando ausente
        vehicleTypes: [...VEHICLE_TYPES],
        carCategories: [...CAR_CATEGORIES],
        iconKey: 'default', // fallback para iconKey inválido
        active: true,
        sortOrder: 999,
      });
    });

    it('reconhece ícones válidos e ajusta carCategories de acordo com vehicleTypes', () => {
      const docSnap = {
        id: 's2',
        data: () => ({
          name: 'Troca de Óleo Moto',
          iconKey: 'engine',
          vehicleTypes: ['Moto'],
          carCategories: ['Hatch', 'Sedan'], // deve virar [] porque não é Carro
          durationMin: 45,
          price: 150,
          active: false,
          sortOrder: 2,
        }),
      } as any;

      const result = normalizeShopService(docSnap);

      expect(result).toEqual({
        id: 's2',
        name: 'Troca de Óleo Moto',
        title: 'Troca de Óleo Moto',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 45,
        price: 150,
        vehicleTypes: ['Moto'],
        carCategories: [],
        iconKey: 'engine',
        active: false,
        sortOrder: 2,
      });
    });
  });

  describe('serviceSupportsVehicle', () => {
    const carAndMotoService: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
      vehicleTypes: ['Carro', 'Moto'],
      carCategories: ['Hatch', 'Sedan'],
    };

    const motoOnlyService: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
      vehicleTypes: ['Moto'],
      carCategories: [],
    };

    it('retorna false se o tipo de veículo não for suportado', () => {
      expect(serviceSupportsVehicle(motoOnlyService, 'Carro', 'Hatch')).toBe(false);
    });

    it('retorna true para Moto quando o serviço atende Moto', () => {
      expect(serviceSupportsVehicle(carAndMotoService, 'Moto', null)).toBe(true);
      expect(serviceSupportsVehicle(motoOnlyService, 'Moto', null)).toBe(true);
    });

    it('retorna true para Carro apenas se a categoria do carro estiver na lista do serviço', () => {
      expect(serviceSupportsVehicle(carAndMotoService, 'Carro', 'Hatch')).toBe(true);
      expect(serviceSupportsVehicle(carAndMotoService, 'Carro', 'SUV')).toBe(false);
      expect(serviceSupportsVehicle(carAndMotoService, 'Carro', null)).toBe(false);
    });
  });

  describe('getServiceVehicleSummary', () => {
    it('retorna "Nenhum veículo" se vehicleTypes for vazio', () => {
      const service = { vehicleTypes: [], carCategories: [] } as any;
      expect(getServiceVehicleSummary(service)).toBe('Nenhum veículo');
    });

    it('retorna "Moto" para serviços exclusivos de Moto', () => {
      const service = { vehicleTypes: ['Moto'], carCategories: [] } as any;
      expect(getServiceVehicleSummary(service)).toBe('Moto');
    });

    it('retorna "Todos os carros" quando atende todas as categorias de carro', () => {
      const service = {
        vehicleTypes: ['Carro'],
        carCategories: [...CAR_CATEGORIES],
      } as any;
      expect(getServiceVehicleSummary(service)).toBe('Todos os carros');
    });

    it('lista as categorias específicas de carro e combina com Moto', () => {
      const service = {
        vehicleTypes: ['Moto', 'Carro'],
        carCategories: ['Hatch', 'SUV'],
      } as any;
      expect(getServiceVehicleSummary(service)).toBe('Moto · Hatch, SUV');
    });
  });

  describe('Firestore queries and references', () => {
    it('shopServicesRef aponta para a coleção correta', () => {
      mockCollection.mockReturnValue({ path: 'shops/shop-1/services' });
      const ref = shopServicesRef('shop-1');
      expect(mockCollection).toHaveBeenCalledWith({}, 'shops', 'shop-1', 'services');
      expect(ref).toEqual({ path: 'shops/shop-1/services' });
    });

    it('shopServicesQuery ordena por sortOrder asc', () => {
      mockCollection.mockReturnValue('COLL_REF');
      mockOrderBy.mockReturnValue('ORDER_BY_CLAUSE');
      mockQuery.mockReturnValue('QUERY_REF');

      const q = shopServicesQuery('shop-1');

      expect(mockOrderBy).toHaveBeenCalledWith('sortOrder', 'asc');
      expect(mockQuery).toHaveBeenCalledWith('COLL_REF', 'ORDER_BY_CLAUSE');
      expect(q).toBe('QUERY_REF');
    });
  });

  describe('ensureShopServices', () => {
    it('retorna os serviços existentes se já estiverem cadastrados', async () => {
      const existingDoc = {
        id: 'wash',
        data: () => ({ name: 'Lavagem Especial', sortOrder: 1 }),
      };
      mockGetDocs.mockResolvedValueOnce({ docs: [existingDoc] });

      const services = await ensureShopServices('shop-100');

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('Lavagem Especial');
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    it('inicializa os serviços padrão com writeBatch se não houver nenhum', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const batchSetMock = jest.fn();
      const batchCommitMock = jest.fn().mockResolvedValueOnce(undefined);
      mockWriteBatch.mockReturnValue({
        set: batchSetMock,
        commit: batchCommitMock,
      });

      const services = await ensureShopServices('shop-200');

      expect(services).toHaveLength(DEFAULT_SHOP_SERVICES.length);
      expect(mockWriteBatch).toHaveBeenCalled();
      expect(batchSetMock).toHaveBeenCalledTimes(DEFAULT_SHOP_SERVICES.length);
      expect(batchCommitMock).toHaveBeenCalled();
      expect(services[0].id).toBe('lavagem');
    });
  });

  describe('CRUD de serviços', () => {
    it('createShopService salva o serviço com datas de criação/atualização', async () => {
      mockDoc.mockReturnValue({ path: 'shops/s1/services/srv1' });
      mockSetDoc.mockResolvedValueOnce(undefined);

      const input: ShopServiceInput = {
        name: 'Higienização Ar',
        title: 'Higienização de Ar-condicionado',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30,
        price: 90,
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch'],
        iconKey: 'express',
        active: true,
        sortOrder: 10,
      };

      await createShopService('s1', 'srv1', input);

      expect(mockDoc).toHaveBeenCalledWith({}, 'shops', 's1', 'services', 'srv1');
      expect(mockSetDoc).toHaveBeenCalledWith(
        { path: 'shops/s1/services/srv1' },
        {
          ...input,
          createdAt: 'MOCK_TIMESTAMP',
          updatedAt: 'MOCK_TIMESTAMP',
        },
      );
    });

    it('updateShopService atualiza campos parciais com updatedAt', async () => {
      mockDoc.mockReturnValue({ path: 'shops/s1/services/srv1' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopService('s1', 'srv1', { price: 120, active: false });

      expect(mockDoc).toHaveBeenCalledWith({}, 'shops', 's1', 'services', 'srv1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { path: 'shops/s1/services/srv1' },
        {
          price: 120,
          active: false,
          updatedAt: 'MOCK_TIMESTAMP',
        },
      );
    });

    it('deleteShopService remove o documento do Firestore', async () => {
      mockDoc.mockReturnValue({ path: 'shops/s1/services/srv1' });
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await deleteShopService('s1', 'srv1');

      expect(mockDoc).toHaveBeenCalledWith({}, 'shops', 's1', 'services', 'srv1');
      expect(mockDeleteDoc).toHaveBeenCalledWith({ path: 'shops/s1/services/srv1' });
    });
  });
});
