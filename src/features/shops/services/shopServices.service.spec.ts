const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockCollection = jest.fn((..._args: unknown[]) => 'collectionRef');
const mockDoc = jest.fn((..._args: unknown[]) => 'docRef');
const mockQuery = jest.fn((..._args: unknown[]) => 'queryRef');
const mockOrderBy = jest.fn((..._args: unknown[]) => 'orderByRef');

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (db: unknown, ...pathSegments: string[]) => mockCollection(db, ...pathSegments),
  doc: (db: unknown, ...pathSegments: string[]) => mockDoc(db, ...pathSegments),
  getDocs: (queryRef: unknown) => mockGetDocs(queryRef),
  setDoc: (docRef: unknown, data: unknown) => mockSetDoc(docRef, data),
  updateDoc: (docRef: unknown, data: unknown) => mockUpdateDoc(docRef, data),
  deleteDoc: (docRef: unknown) => mockDeleteDoc(docRef),
  writeBatch: (db: unknown) => mockWriteBatch(db),
  query: (collectionRef: unknown, ...queryConstraints: unknown[]) =>
    mockQuery(collectionRef, ...queryConstraints),
  orderBy: (fieldPath: string, directionStr?: string) => mockOrderBy(fieldPath, directionStr),
  serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
}));

import {
  normalizeShopService,
  serviceSupportsVehicle,
  getServiceVehicleSummary,
  ensureShopServices,
  updateShopService,
  deleteShopService,
  createShopService,
  shopServicesRef,
  shopServicesQuery,
  DEFAULT_SHOP_SERVICES,
} from './shopServices.service';
import type { ShopService } from '../domain/shopService.types';
import { CAR_CATEGORIES } from '@features/appointments/domain/appointment.constants';

describe('shopServices.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeShopService', () => {
    it('retorna null se o nome for vazio ou contiver apenas espaços', () => {
      const docSnap = {
        id: 'service-1',
        data: () => ({ name: '   ' }),
      } as any;

      expect(normalizeShopService(docSnap)).toBeNull();
    });

    it('normaliza um documento completo corretamente', () => {
      const rawData = {
        name: ' Lavagem Completa ',
        title: 'Lavagem Especial',
        description: 'Descrição do serviço',
        includes: ['Item 1', 123, 'Item 2'], // filtra não-strings
        note: 'Observação importante',
        recommendedFor: ['Carros novos', null, 'Pré-venda'],
        durationMin: 45,
        price: 100,
        vehicleTypes: ['Carro', 'TipoInvalido'],
        carCategories: ['Hatch', 'SUV', 'CategoriaInvalida'],
        iconKey: 'wash',
        active: false,
        sortOrder: 5,
      };

      const docSnap = {
        id: 'service-1',
        data: () => rawData,
      } as any;

      const result = normalizeShopService(docSnap);

      expect(result).toEqual({
        id: 'service-1',
        name: 'Lavagem Completa',
        title: 'Lavagem Especial',
        description: 'Descrição do serviço',
        includes: ['Item 1', 'Item 2'],
        note: 'Observação importante',
        recommendedFor: ['Carros novos', 'Pré-venda'],
        durationMin: 45,
        price: 100,
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch', 'SUV'],
        iconKey: 'wash',
        active: false,
        sortOrder: 5,
      });
    });

    it('aplica valores padrão quando campos opcionais/inválidos são fornecidos', () => {
      const rawData = {
        name: 'Polimento',
        durationMin: -10,
        price: -50,
        vehicleTypes: 'não-é-array',
        carCategories: 'não-é-array',
        iconKey: 'chave-invalida',
        active: 'não-é-booleano',
        sortOrder: 'não-é-numero',
      };

      const docSnap = {
        id: 'service-2',
        data: () => rawData,
      } as any;

      const result = normalizeShopService(docSnap);

      expect(result).toEqual({
        id: 'service-2',
        name: 'Polimento',
        title: 'Polimento',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30, // padrão para min <= 0
        price: 0, // padrão para price < 0
        vehicleTypes: ['Carro', 'Moto'],
        carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
        iconKey: 'default',
        active: true,
        sortOrder: 999,
      });
    });

    it('retorna carCategories vazio se vehicleTypes não incluir Carro', () => {
      const rawData = {
        name: 'Lavagem Moto',
        vehicleTypes: ['Moto'],
        carCategories: ['Hatch'],
      };

      const docSnap = {
        id: 'service-3',
        data: () => rawData,
      } as any;

      const result = normalizeShopService(docSnap);

      expect(result?.carCategories).toEqual([]);
    });
  });

  describe('serviceSupportsVehicle', () => {
    const service: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
      vehicleTypes: ['Carro', 'Moto'],
      carCategories: ['Hatch', 'SUV'],
    };

    it('retorna false se o tipo de veículo não for suportado pelo serviço', () => {
      const bikeService: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch'],
      };
      expect(serviceSupportsVehicle(bikeService, 'Moto', null)).toBe(false);
    });

    it('retorna true para Moto quando Moto é suportado', () => {
      expect(serviceSupportsVehicle(service, 'Moto', null)).toBe(true);
    });

    it('retorna true para Carro com categoria de carro suportada', () => {
      expect(serviceSupportsVehicle(service, 'Carro', 'Hatch')).toBe(true);
      expect(serviceSupportsVehicle(service, 'Carro', 'SUV')).toBe(true);
    });

    it('retorna false para Carro com categoria não suportada ou nula', () => {
      expect(serviceSupportsVehicle(service, 'Carro', 'Sedan')).toBe(false);
      expect(serviceSupportsVehicle(service, 'Carro', null)).toBe(false);
    });
  });

  describe('getServiceVehicleSummary', () => {
    it('retorna resumo correto com Moto e Todos os carros', () => {
      const service = {
        vehicleTypes: ['Moto', 'Carro'],
        carCategories: [...CAR_CATEGORIES],
      } as unknown as ShopService;

      expect(getServiceVehicleSummary(service)).toBe('Moto · Todos os carros');
    });

    it('retorna resumo correto com apenas Moto', () => {
      const service = {
        vehicleTypes: ['Moto'],
        carCategories: [],
      } as unknown as ShopService;

      expect(getServiceVehicleSummary(service)).toBe('Moto');
    });

    it('retorna resumo correto com categorias específicas de Carro', () => {
      const service = {
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch', 'SUV'],
      } as unknown as ShopService;

      expect(getServiceVehicleSummary(service)).toBe('Hatch, SUV');
    });

    it('retorna Nenhum veículo quando vehicleTypes é vazio', () => {
      const service = {
        vehicleTypes: [],
        carCategories: [],
      } as unknown as ShopService;

      expect(getServiceVehicleSummary(service)).toBe('Nenhum veículo');
    });
  });

  describe('Firestore queries e modificações', () => {
    const shopId = 'shop-123';

    it('shopServicesRef e shopServicesQuery constroem referências Firestore corretamente', () => {
      mockCollection.mockReturnValue('collectionRef');
      mockQuery.mockReturnValue('queryRef');

      expect(shopServicesRef(shopId)).toBe('collectionRef');
      expect(shopServicesQuery(shopId)).toBe('queryRef');
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'shops', shopId, 'services');
      expect(mockOrderBy).toHaveBeenCalledWith('sortOrder', 'asc');
    });

    describe('ensureShopServices', () => {
      it('retorna os serviços existentes se a subcoleção não estiver vazia', async () => {
        const existingDoc = {
          id: 'lavagem',
          data: () => ({ name: 'Lavagem Simples', sortOrder: 0 }),
        };
        mockGetDocs.mockResolvedValueOnce({ docs: [existingDoc] });

        const result = await ensureShopServices(shopId);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('lavagem');
        expect(result[0].name).toBe('Lavagem Simples');
        expect(mockWriteBatch).not.toHaveBeenCalled();
      });

      it('cria os serviços padrão em batch quando a subcoleção estiver vazia', async () => {
        mockGetDocs.mockResolvedValueOnce({ docs: [] });
        const mockBatchSet = jest.fn();
        const mockBatchCommit = jest.fn().mockResolvedValueOnce(undefined);
        mockWriteBatch.mockReturnValueOnce({
          set: mockBatchSet,
          commit: mockBatchCommit,
        });

        const result = await ensureShopServices(shopId);

        expect(result).toHaveLength(DEFAULT_SHOP_SERVICES.length);
        expect(mockBatchSet).toHaveBeenCalledTimes(DEFAULT_SHOP_SERVICES.length);
        expect(mockBatchCommit).toHaveBeenCalled();
      });
    });

    describe('updateShopService', () => {
      it('chama updateDoc com os dados e timestamp de atualização', async () => {
        const serviceId = 'service-1';
        const updates = { price: 150, title: 'Novo Título' };

        await updateShopService(shopId, serviceId, updates);

        expect(mockUpdateDoc).toHaveBeenCalledWith(
          'docRef',
          expect.objectContaining({
            price: 150,
            title: 'Novo Título',
            updatedAt: 'MOCK_TIMESTAMP',
          }),
        );
      });
    });

    describe('deleteShopService', () => {
      it('chama deleteDoc no documento correspondente', async () => {
        const serviceId = 'service-1';

        await deleteShopService(shopId, serviceId);

        expect(mockDeleteDoc).toHaveBeenCalledWith('docRef');
      });
    });

    describe('createShopService', () => {
      it('chama setDoc com o novo serviço e timestamps', async () => {
        const serviceId = 'novo-servico';
        const newInput = DEFAULT_SHOP_SERVICES[0];

        await createShopService(shopId, serviceId, newInput);

        expect(mockSetDoc).toHaveBeenCalledWith(
          'docRef',
          expect.objectContaining({
            ...newInput,
            createdAt: 'MOCK_TIMESTAMP',
            updatedAt: 'MOCK_TIMESTAMP',
          }),
        );
      });
    });
  });
});
