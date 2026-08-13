const mockSetDoc = jest.fn();
const mockDoc = jest.fn((...args: any[]) => {
  if (args.length === 1 && typeof args[0] === 'object') {
    return {
      id: 'generated-shop-id',
      path: `${args[0].path}/generated-shop-id`,
    };
  }
  const path = args.slice(1).join('/');
  return {
    id: args[args.length - 1],
    path,
  };
});

const mockCollection = jest.fn((...args: any[]) => {
  return {
    path: args.slice(1).join('/') || args[0],
  };
});

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: (...args: any[]) => mockDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
  Timestamp: {
    fromMillis: (ms: number) => ({
      seconds: Math.floor(ms / 1000),
      nanoseconds: 0,
      ms,
    }),
  },
}));

const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateProfile = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockCurrentUser = { uid: 'user-123', email: 'test@test.com' };

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: mockCurrentUser,
  })),
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
}));

jest.mock('@shared/utils/firebase.utils', () => ({
  mapFirebaseAuthError: jest.fn((code, fallback) => `mapped-${code || fallback}`),
}));

jest.mock('@shared/utils/geo.utils', () => ({
  generateGeohash: jest.fn((lat, lng) => `geohash-${lat}-${lng}`),
}));

import { signIn, register, signOutUser, getCurrentUser, subscribeAuth } from './auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    it('deve autenticar o usuário com sucesso', async () => {
      const mockUser = { uid: 'user-123', email: 'test@test.com' };
      const mockCredential = { user: mockUser };
      mockSignInWithEmailAndPassword.mockResolvedValueOnce(mockCredential);

      const result = await signIn('test@test.com', '123456');

      expect(result).toEqual({
        ok: true,
        user: mockUser,
        cred: mockCredential,
      });
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object),
        'test@test.com',
        '123456',
      );
    });

    it('deve retornar erro formatado caso a autenticação falhe', async () => {
      const mockError = { code: 'auth/wrong-password' };
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(mockError);

      const result = await signIn('test@test.com', 'wrong-pass');

      expect(result).toEqual({
        ok: false,
        message: 'mapped-auth/wrong-password',
        code: 'auth/wrong-password',
      });
    });
  });

  describe('register', () => {
    const customerInput = {
      firstName: 'Ana',
      lastName: 'Silva',
      email: 'ana@test.com',
      phone: '11999998888',
      password: 'password123',
      role: 'customer' as const,
    };

    const ownerInput = {
      firstName: 'Bruno',
      lastName: 'Dono',
      email: 'bruno@test.com',
      phone: '11988887777',
      password: 'password123',
      role: 'owner' as const,
      shopName: 'Tirac Auto Detail',
      shopLocation: {
        lat: -23.5505,
        lng: -46.6333,
        address: 'Praça da Sé, São Paulo',
        city: 'São Paulo - SP',
        geohash: 'original-geohash',
      },
    };

    it('deve registrar um novo cliente com sucesso', async () => {
      const mockUser = { uid: 'customer-uid', email: 'ana@test.com' };
      const mockCredential = { user: mockUser };
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce(mockCredential);
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await register(customerInput);

      expect(result).toEqual({
        ok: true,
        user: mockUser,
        cred: mockCredential,
      });
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object),
        'ana@test.com',
        'password123',
      );
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: 'Ana Silva',
      });
      // Verifica escrita do documento do usuário
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'customer-uid' }),
        {
          uid: 'customer-uid',
          firstName: 'Ana',
          lastName: 'Silva',
          email: 'ana@test.com',
          phone: '11999998888',
          role: 'customer',
          shopId: null,
          createdAt: 'mock-server-timestamp',
        },
        { merge: true },
      );
    });

    it('deve registrar um novo dono e criar seu shop e configurações', async () => {
      const mockUser = { uid: 'owner-uid', email: 'bruno@test.com' };
      const mockCredential = { user: mockUser };
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce(mockCredential);
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      mockSetDoc.mockResolvedValue(undefined); // Múltiplas chamadas

      const result = await register(ownerInput);

      expect(result).toEqual({
        ok: true,
        user: mockUser,
        cred: mockCredential,
      });

      // 1. Criação do Shop
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'generated-shop-id' }),
        expect.objectContaining({
          name: 'Tirac Auto Detail',
          ownerId: 'owner-uid',
          subscriptionStatus: 'trial',
          trialEndsAt: expect.objectContaining({ ms: expect.any(Number) }),
          isVisibleOnMap: true,
          location: {
            lat: -23.5505,
            lng: -46.6333,
            address: 'Praça da Sé, São Paulo',
            city: 'São Paulo - SP',
            geohash: 'geohash--23.5505--46.6333',
          },
          geohash: 'geohash--23.5505--46.6333',
        }),
      );

      // 2. Configurações padrão do Shop (settings/config)
      // Espelha SHOP_SETTINGS_DEFAULTS: se um campo novo entrar lá e não chegar
      // aqui, este teste quebra — que é exatamente o que queremos.
      expect(mockSetDoc).toHaveBeenCalledWith(expect.objectContaining({ id: 'config' }), {
        openHour: 8,
        closeHour: 18,
        parallelCapacity: 2,
        workingDays: ['seg', 'ter', 'qua', 'qui', 'sex'],
        slotStepMin: 30,
        minNoticeMin: 15,
        createdAt: 'mock-server-timestamp',
        updatedAt: 'mock-server-timestamp',
      });

      // 3. Vinculação do Usuário ao Shop
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'owner-uid' }),
        {
          uid: 'owner-uid',
          firstName: 'Bruno',
          lastName: 'Dono',
          email: 'bruno@test.com',
          phone: '11988887777',
          role: 'owner',
          shopId: 'generated-shop-id',
          createdAt: 'mock-server-timestamp',
        },
        { merge: true },
      );
    });

    it('deve usar valores padrão para o shop caso nome e localização não sejam fornecidos', async () => {
      const mockUser = { uid: 'owner-uid', email: 'bruno@test.com' };
      const mockCredential = { user: mockUser };
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce(mockCredential);
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      mockSetDoc.mockResolvedValue(undefined);

      const ownerInputNoShopDetails = {
        ...ownerInput,
        shopName: undefined,
        shopLocation: undefined,
      };

      await register(ownerInputNoShopDetails);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'generated-shop-id' }),
        expect.objectContaining({
          name: 'Minha Estética',
          location: null,
          geohash: null,
        }),
      );
    });

    it('deve retornar erro formatado caso o registro falhe', async () => {
      const mockError = { code: 'auth/email-already-in-use' };
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(mockError);

      const result = await register(customerInput);

      expect(result).toEqual({
        ok: false,
        message: 'mapped-auth/email-already-in-use',
        code: 'auth/email-already-in-use',
      });
    });
  });

  describe('signOutUser', () => {
    it('deve deslogar o usuário chamando signOut', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);

      await signOutUser();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('deve retornar o usuário logado atual', () => {
      const user = getCurrentUser();
      expect(user).toEqual(mockCurrentUser);
    });
  });

  describe('subscribeAuth', () => {
    it('deve assinar a mudança no estado de autenticação', () => {
      const callback = jest.fn();
      mockOnAuthStateChanged.mockReturnValueOnce('unsubscribe-fn');

      const unsubscribe = subscribeAuth(callback);

      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(expect.any(Object), callback);
      expect(unsubscribe).toBe('unsubscribe-fn');
    });
  });
});
