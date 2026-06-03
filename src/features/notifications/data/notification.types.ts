export type ShopNotificationType = 'appointment_created';

export type ShopNotification = {
  id: string;
  type: ShopNotificationType;
  title: string;
  body: string;
  appointmentId?: string;
  customerName?: string;
  serviceLabel?: string;
  startAtMs?: number | null;
  read: boolean;
  createdAtMs: number;
};
