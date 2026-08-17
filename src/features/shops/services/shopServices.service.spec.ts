const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn(() => ({
  set: mockBatchSet,
  commit: mockBatchCommit,
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((...args: unknown[]) => ({ type: 'collection', args })),
  doc: jest.fn((...args: unknown[]) => ({ type: 'doc', args })),
  query: jest.fn((...args: unknown[]) => ({ type: 'query', args })),
  orderBy: jest.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: () => mockWriteBatch(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

import {
  serviceSupportsVehicle,
  getServiceVehicleSummary,
  normalizeShopService,
  ensureShopServices,
  updateShopService,
  deleteShopService,
  createShopService,
  DEFAULT_SHOP_SERVICES,
} from './shopServices.service';
import type { ShopService } from '../domain/shopService.types';

function makeDocSnap(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  } as any;
}

describe('shopServices.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('serviceSupportsVehicle', () => {
    it('retorna true para Moto quando o serviço atende Moto', () => {
      const service = { vehicleTypes: ['Moto' as const], carCategories: [] };
      expect(serviceSupportsVehicle(service, 'Moto', null)).toBe(true);
    });

    it('retorna false para Moto quando o serviço não atende Moto', () => {
      const service = { vehicleTypes: ['Carro' as const], carCategories: ['Hatch' as const] };
      expect(serviceSupportsVehicle(service, 'Moto', null)).toBe(false);
    });

    it('retorna true para Carro quando o serviço atende Carro e a categoria do carro', () => {
      const service = {
        vehicleTypes: ['Carro' as const],
        carCategories: ['Hatch' as const, 'Sedan' as const],
      };
      expect(serviceSupportsVehicle(service, 'Carro', 'Hatch')).toBe(true);
    });

    it('retorna false para Carro quando a categoria não é suportada pelo serviço', () => {
      const service = { vehicleTypes: ['Carro' as const], carCategories: ['Hatch' as const] };
      expect(serviceSupportsVehicle(service, 'Carro', 'SUV')).toBe(false);
    });

    it('retorna false para Carro se nenhuma categoria for informada', () => {
      const service = { vehicleTypes: ['Carro' as const], carCategories: ['Hatch' as const] };
      expect(serviceSupportsVehicle(service, 'Carro', null)).toBe(false);
    });
  });

  describe('getServiceVehicleSummary', () => {
    it('retorna resumo correto para serviço que atende Moto e todos os Carros', () => {
      const service: ShopService = {
        id: 's1',
        name: 'Lavagem',
        title: 'Lavagem completa',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30,
        price: 50,
        vehicleTypes: ['Moto', 'Carro'],
        carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
        iconKey: 'wash',
        active: true,
        sortOrder: 1,
      };
      expect(getServiceVehicleSummary(service)).toBe('Moto · Todos os carros');
    });

    it('retorna resumo das categorias específicas quando nem todas são atendidas', () => {
      const service: ShopService = {
        id: 's2',
        name: 'Polimento',
        title: 'Polimento',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 60,
        price: 100,
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch', 'Sedan'],
        iconKey: 'polish',
        active: true,
        sortOrder: 2,
      };
      expect(getServiceVehicleSummary(service)).toBe('Hatch, Sedan');
    });

    it('retorna Nenhum veículo quando a lista de vehicleTypes for vazia', () => {
      const service: ShopService = {
        id: 's3',
        name: 'Inativo',
        title: 'Inativo',
        description: null,
        includes: [],
        note: null,
        recommendedFor: [],
        durationMin: 30,
        price: 0,
        vehicleTypes: [],
        carCategories: [],
        iconKey: 'default',
        active: false,
        sortOrder: 3,
      };
      expect(getServiceVehicleSummary(service)).toBe('Nenhum veículo');
    });
  });

  describe('normalizeShopService', () => {
    it('retorna null se o nome for inválido ou em branco', () => {
      expect(normalizeShopService(makeDocSnap('s1', { name: '   ' }))).toBeNull();
      expect(normalizeShopService(makeDocSnap('s2', { name: 123 }))).toBeNull();
    });

    it('normaliza corretamente um documento válido', () => {
      const doc = makeDocSnap('s1', {
        name: ' Lavagem Geral ',
        title: 'Lavagem Especial',
        description: 'Descrição aqui',
        includes: ['Ext', 'Int', 123],
        note: 'Nota especial',
        recommendedFor: ['Uso diário'],
        durationMin: 45,
        price: 90,
        vehicleTypes: ['Carro', 'Invalido'],
        carCategories: ['Hatch', 'Invalido'],
        iconKey: 'wash',
        active: true,
        sortOrder: 2,
      });

      const normalized = normalizeShopService(doc);
      expect(normalized).toEqual({
        id: 's1',
        name: 'Lavagem Geral',
        title: 'Lavagem Especial',
        description: 'Descrição aqui',
        includes: ['Ext', 'Int'],
        note: 'Nota especial',
        recommendedFor: ['Uso diário'],
        durationMin: 45,
        price: 90,
        vehicleTypes: ['Carro'],
        carCategories: ['Hatch'],
        iconKey: 'wash',
        active: true,
        sortOrder: 2,
      });
    });

    it('usa valores padrão quando campos opcionais/numéricos forem inválidos', () => {
      const doc = makeDocSnap('s2', {
        name: 'Polimento',
        durationMin: -10,
        price: -50,
        iconKey: 'icone-inexistente',
        active: 'nao-booleano',
        sortOrder: 'nao-numero',
      });

      const normalized = normalizeShopService(doc);
      expect(normalized).toEqual({
        id: 's2',
        name: 'Polimento',
        title: 'Polimento',
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

    it('limpa carCategories se vehicleTypes não contiver Carro', () => {
      const doc = makeDocSnap('s3', {
        name: 'Serviço Moto',
        vehicleTypes: ['Moto'],
        carCategories: ['Hatch'],
      });

      const normalized = normalizeShopService(doc);
      expect(normalized?.carCategories).toEqual([]);
    });
  });

  describe('ensureShopServices', () => {
    it('retorna os serviços existentes quando a loja já tem serviços no Firestore', async () => {
      const existingDoc = makeDocSnap('s1', {
        name: 'Lavagem',
        durationMin: 30,
        price: 50,
      });
      mockGetDocs.mockResolvedValueOnce({ docs: [existingDoc] });

      const services = await ensureShopServices('shop-123');

      expect(services).toHaveLength(1);
      expect(services[0].id).toBe('s1');
      expect(services[0].name).toBe('Lavagem');
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    it('inicializa com DEFAULT_SHOP_SERVICES se a loja não possuir serviços', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockBatchCommit.mockResolvedValueOnce(undefined);

      const services = await ensureShopServices('shop-456');

      expect(mockWriteBatch).toHaveBeenCalled();
      expect(mockBatchSet).toHaveBeenCalledTimes(DEFAULT_SHOP_SERVICES.length);
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(services).toHaveLength(DEFAULT_SHOP_SERVICES.length);
      expect(services[0].name).toBe(DEFAULT_SHOP_SERVICES[0].name);
    });
  });

  describe('operações de escrita (updateShopService, deleteShopService, createShopService)', () => {
    it('updateShopService atualiza o documento com updatedAt', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopService('shop-1', 'service-1', { price: 150 });

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
        price: 150,
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });

    it('deleteShopService exclui o documento', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await deleteShopService('shop-1', 'service-1');

      expect(mockDeleteDoc).toHaveBeenCalledWith(expect.anything());
    });

    it('createShopService cria o documento com timestamps', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const input = DEFAULT_SHOP_SERVICES[0];
      await createShopService('shop-1', 'service-new', input);

      expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), {
        ...input,
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });
});
