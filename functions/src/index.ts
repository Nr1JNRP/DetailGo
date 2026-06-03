import * as admin from 'firebase-admin';

admin.initializeApp();

export { createPixCharge } from './payment/createPixCharge';
export { mercadoPagoWebhook } from './payment/mercadoPagoWebhook';
export { checkTrialExpiry } from './scheduled/checkTrialExpiry';
export { checkSubscriptionExpiry } from './scheduled/checkSubscriptionExpiry';
export { geocode, reverseGeocode } from './geo/geocode';
export { onAppointmentCreated } from './notifications/onAppointmentCreated';
