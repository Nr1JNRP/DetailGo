import * as admin from 'firebase-admin';

admin.initializeApp();

// MercadoPago: sai quando a tela passar a usar o Asaas. Mantido até lá para o
// app não ficar chamando function inexistente.
export { createPixCharge } from './payment/createPixCharge';
export { mercadoPagoWebhook } from './payment/mercadoPagoWebhook';

export { createAsaasCheckout } from './payment/createAsaasCheckout';
export { asaasWebhook } from './payment/asaasWebhook';
export { checkTrialExpiry } from './scheduled/checkTrialExpiry';
export { checkSubscriptionExpiry } from './scheduled/checkSubscriptionExpiry';
export { geocode, reverseGeocode } from './geo/geocode';
export { onAppointmentCreated } from './notifications/onAppointmentCreated';
export { sendAppointmentReminders } from './notifications/sendAppointmentReminders';
export { notifyExpiredAppointments } from './notifications/notifyExpiredAppointments';
export { onAppointmentStatusChanged } from './appointments/onAppointmentStatusChanged';
