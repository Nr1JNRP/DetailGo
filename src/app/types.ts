export type RootStackParamList = {
  // AUTH
  Login: undefined;
  Register: undefined;

  // SUBSCRIPTION
  Subscription: undefined;

  // USER
  Map: undefined;
  Dashboard: undefined;
  Appointment:
    | {
        mode?: 'reschedule';
        originalAppointmentId?: string;
        vehicleType?: 'Carro' | 'Moto';
        carCategory?: 'Hatch' | 'Sedan' | 'SUV' | 'Picape cabine dupla' | null;
        serviceLabel?: string | null;
        isExpired?: boolean;
      }
    | undefined;
  MyAppointments: undefined;
  History: undefined;
  Profile: undefined;

  // ADMIN
  AdminDashboard: undefined;
  AdminManage: undefined;
  AdminHistory: undefined;
  AdminProfile: undefined;
};
