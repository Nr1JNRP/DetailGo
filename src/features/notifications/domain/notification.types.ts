export type AppNotificationType = 'appointment_created' | 'appointment_reminder';

export type AppNotification = {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  appointmentId?: string;
  customerName?: string;
  serviceLabel?: string;
  startAtMs?: number | null;
  read: boolean;
  createdAtMs: number;
};
