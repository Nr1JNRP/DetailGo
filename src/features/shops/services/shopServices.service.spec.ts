const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockBatchCommit = jest.fn();
const mockBatchSet = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((_db, ...pathSegments) => pathSegments.join('/')),
  doc: jest.fn((_db, ...pathSegments) => pathSegments.join('/')),
  query: jest.fn(ref => ref),
  orderBy: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: jest.fn(() => ({
    set: mockBatchSet,
    commit: mockBatchCommit,
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
  updateShopService,
  DEFAULT_SHOP_SERVICES,
} from './shopServices.service';
import type { ShopService } from '../domain/shopService.types';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { CAR_CATEGORIES } from '@features/appointments/domain/appointment.constants';

describe('shopServices.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeShopService', () => {
    it('normaliza um documento válido do Firestore', () => {
      const docSnap = {
        id: 'svc-1',
        data: () => ({
          name: '  Lavagem Simples  ',
          title: 'Lavagem Básica',
          description: 'Limpeza rápida',
          includes: ['Shampoo', 'Secagem'],
          note: 'Sem cera',
          recommendedFor: ['Uso diário'],
          durationMin: 45,
          price: 90,
          vehicleTypes: ['Carro', 'Moto'],
          carCategories: ['Hatch', 'Sedan'],
          iconKey: 'wash',
          active: true,
          sortOrder: 2,
        }),
      } as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot;

      const result = normalizeShopService(docSnap);

      expect(result).toEqual({
        id: 'svc-1',
        name: 'Lavagem Simples',
        title: 'Lavagem Básica',
        description: 'Limpeza rápida',
        includes: ['Shampoo', 'Secagem'],
        note: 'Sem cera',
        recommendedFor: ['Uso diário'],
        durationMin: 45,
        price: 90,
        vehicleTypes: ['Carro', 'Moto'],
        carCategories: ['Hatch', 'Sedan'],
        iconKey: 'wash',
        active: true,
        sortOrder: 2,
      });
    });

    it('retorna null quando o nome está ausente ou é apenas espaços em branco', () => {
      const docSnapNoName = {
        id: 'svc-2',
        data: () => ({ name: '   ' }),
      } as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot;

      expect(normalizeShopService(docSnapNoName)).toBeNull();
    });

    it('aplica valores padrão para campos opcionais ou com tipos inválidos', () => {
      const docSnap = {
        id: 'svc-3',
        data: () => ({
          name: 'Serviço Genérico',
          title: 123,
          description: 456,
          includes: 'não é array',
          note: null,
          recommendedFor: [1, 'Atendimento VIP', null],
          durationMin: -10,
          price: 'inválido',
          vehicleTypes: 'inválido',
          carCategories: 'inválido',
          iconKey: 'icone_inexistente',
          active: 'true',
          sortOrder: 'primeiro',
        }),
      } as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot;

      const result = normalizeShopService(docSnap);

      expect(result).toEqual({
        id: 'svc-3',
        name: 'Serviço Genérico',
        title: 'Serviço Genérico',
        description: null,
        includes: [],
        note: null,
        recommendedFor: ['Atendimento VIP'],
        durationMin: 30,
        price: 0,
        vehicleTypes: ['Carro', 'Moto'],
        carCategories: CAR_CATEGORIES,
        iconKey: 'default',
        active: true,
        sortOrder: 999,
      });
    });

    it('limpa a lista carCategories quando vehicleTypes não contém Carro', () => {
      const docSnap = {
        id: 'svc-moto',
        data: () => ({
          name: 'Lavagem Moto',
          vehicleTypes: ['Moto'],
          carCategories: ['Hatch'],
        }),
      } as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot;

      const result = normalizeShopService(docSnap);

      expect(result?.vehicleTypes).toEqual(['Moto']);
      expect(result?.carCategories).toEqual([]);
    });
  });

  describe('serviceSupportsVehicle', () => {
    const service: Pick<ShopService, 'vehicleTypes' | 'carCategories'> = {
      vehicleTypes: ['Carro', 'Moto'],
      carCategories: ['Hatch', 'Sedan'],
    };

    it('retorna false quando o tipo de veículo não é suportado pelo serviço', () => {
      const motoOnlyService = { vehicleTypes: ['Moto'] as const, carCategories: [] };
      expect(serviceSupportsVehicle(motoOnlyService as any, 'Carro', 'Hatch')).toBe(false);
    });

    it('retorna true para Moto sem exigir categoria de carro', () => {
      expect(serviceSupportsVehicle(service, 'Moto', null)).toBe(true);
    });

    it('retorna true para Carro quando a categoria do carro está incluída no serviço', () => {
      expect(serviceSupportsVehicle(service, 'Carro', 'Hatch')).toBe(true);
      expect(serviceSupportsVehicle(service, 'Carro', 'Sedan')).toBe(true);
    });

    it('retorna false para Carro se a categoria for nula ou não estiver na lista do serviço', () => {
      expect(serviceSupportsVehicle(service, 'Carro', null)).toBe(false);
      expect(serviceSupportsVehicle(service, 'Carro', 'SUV')).toBe(false);
    });
  });

  describe('getServiceVehicleSummary', () => {
    it('retorna "Nenhum veículo" se não houver suporte a veículos', () => {
      const service = { vehicleTypes: [], carCategories: [] } as unknown as ShopService;
      expect(getServiceVehicleSummary(service)).toBe('Nenhum veículo');
    });

    it('retorna "Moto" para serviços focados em moto', () => {
      const service = { vehicleTypes: ['Moto'], carCategories: [] } as unknown as ShopService;
      expect(getServiceVehicleSummary(service)).toBe('Moto');
    });

    it('retorna "Todos os carros" se todas as categorias forem aceitas', () => {
      const service = {
        vehicleTypes: ['Carro'],
        carCategories: CAR_CATEGORIES,
      } as unknown as ShopService;

      expect(getServiceVehicleSummary(service)).toBe('Todos os carros');
    });

    it('concatena categorias específicas e múltiplos tipos de veículo com ponto médio', () => {
      const service = {
        vehicleTypes: ['Moto', 'Carro'],
        carCategories: ['Hatch', 'Sedan'],
      } as unknown as ShopService;

      expect(getServiceVehicleSummary(service)).toBe('Moto · Hatch, Sedan');
    });
  });

  describe('ensureShopServices', () => {
    it('retorna serviços existentes sem realizar batch se a loja já possui serviços', async () => {
      const docSnap = {
        id: 'svc-1',
        data: () => ({
          name: 'Lavagem Existente',
          vehicleTypes: ['Carro'],
          carCategories: ['Hatch'],
          durationMin: 30,
          price: 50,
          active: true,
          sortOrder: 0,
        }),
      } as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot;

      mockGetDocs.mockResolvedValueOnce({ docs: [docSnap] });

      const services = await ensureShopServices('shop-123');

      expect(services).toHaveLength(1);
      expect(services[0].id).toBe('svc-1');
      expect(services[0].name).toBe('Lavagem Existente');
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('semeia a loja com os serviços padrão via batch quando a coleção está vazia', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockBatchCommit.mockResolvedValueOnce(undefined);

      const services = await ensureShopServices('shop-456');

      expect(services).toHaveLength(DEFAULT_SHOP_SERVICES.length);
      expect(mockBatchSet).toHaveBeenCalledTimes(DEFAULT_SHOP_SERVICES.length);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);

      // Garante isolamento multi-tenant: path de gravação contém o shopId correto
      const firstSetCall = mockBatchSet.mock.calls[0];
      expect(firstSetCall[0]).toContain('shops/shop-456/services/');
      expect(firstSetCall[1]).toMatchObject({
        name: 'Lavagem',
        createdAt: 'MOCK_TIMESTAMP',
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });
  });

  describe('operações de CRUD no Firestore', () => {
    it('updateShopService atualiza o documento com os novos campos e updatedAt', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopService('shop-789', 'svc-polimento', { price: 250, active: false });

      expect(mockUpdateDoc).toHaveBeenCalledWith('shops/shop-789/services/svc-polimento', {
        price: 250,
        active: false,
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });

    it('deleteShopService exclui o documento do serviço', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await deleteShopService('shop-789', 'svc-express');

      expect(mockDeleteDoc).toHaveBeenCalledWith('shops/shop-789/services/svc-express');
    });

    it('createShopService cria o documento com timestamps', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const newService = DEFAULT_SHOP_SERVICES[0];
      await createShopService('shop-789', 'svc-novo', newService);

      expect(mockSetDoc).toHaveBeenCalledWith('shops/shop-789/services/svc-novo', {
        ...newService,
        createdAt: 'MOCK_TIMESTAMP',
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });
  });
});
