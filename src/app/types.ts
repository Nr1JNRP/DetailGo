export type RootStackParamList = {
  // AUTH
  Login: undefined;
  Register: undefined;

  // SUBSCRIPTION
  Subscription: undefined;
  SubscriptionRenew: undefined;
  SubscriptionDetail: undefined;

  // USER
  Map: undefined;
  ShopProfile: { shopId: string };
  Dashboard: undefined;
  Appointment:
    | {
        shopId?: string; // opcional — quando vem de ShopProfile, agenda nesse shop
      }
    | undefined;
  MyAppointments: undefined;
  History: undefined;
  Profile: undefined;
  Notifications: undefined;

  // ADMIN
  AdminDashboard: undefined;
  AdminManage: undefined;
  AdminHistory: undefined;
  AdminProfile: undefined;
  AdminNotifications: undefined;
};
