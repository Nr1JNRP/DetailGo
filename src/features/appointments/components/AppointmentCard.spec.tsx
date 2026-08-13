jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import AppointmentCard from './AppointmentCard';
import type { UserAppointment } from '../domain/appointment.types';

const INICIO = new Date(2026, 6, 15, 14, 30).getTime();

const agendamento = (over: Partial<UserAppointment> = {}): UserAppointment =>
  ({
    id: 'appt-1',
    shopId: 'shop-1',
    vehicleType: 'Carro',
    carCategory: 'Sedan',
    serviceLabel: 'Higienização de bancos',
    price: 250,
    startAtMs: INICIO,
    endAtMs: INICIO + 90 * 60 * 1000,
    durationMin: 90,
    status: 'scheduled',
    dayKey: '2026-07-15',
    ...over,
  } as UserAppointment);

describe('AppointmentCard', () => {
  it('mostra serviço, preço e horário', () => {
    render(<AppointmentCard item={agendamento()} />);

    expect(screen.getByText('Higienização de bancos')).toBeTruthy();
    expect(screen.getByText(/250/)).toBeTruthy();
    expect(screen.getByText(/14:30/)).toBeTruthy();
  });

  it('usa "Serviço" quando o agendamento não tem rótulo', () => {
    // Agendamento antigo ou importado pode não ter o nome do serviço; o card
    // não pode ficar com um espaço vazio no lugar do título.
    render(<AppointmentCard item={agendamento({ serviceLabel: null })} />);

    expect(screen.getByText('Serviço')).toBeTruthy();
  });

  it('detalha a categoria quando o veículo é carro', () => {
    render(<AppointmentCard item={agendamento({ vehicleType: 'Carro', carCategory: 'SUV' })} />);

    expect(screen.getByText('Carro • SUV')).toBeTruthy();
  });

  it('mostra só o tipo quando o carro não tem categoria', () => {
    render(<AppointmentCard item={agendamento({ vehicleType: 'Carro', carCategory: null })} />);

    expect(screen.getByText('Carro')).toBeTruthy();
  });

  it('outros veículos não recebem categoria', () => {
    // Categoria é conceito de carro (porte define preço); moto não usa.
    render(<AppointmentCard item={agendamento({ vehicleType: 'Moto', carCategory: 'SUV' })} />);

    expect(screen.getByText('Moto')).toBeTruthy();
    expect(screen.queryByText(/•\s*SUV/)).toBeNull();
  });

  it.each([
    ['scheduled', 'Agendado'],
    ['in_progress', 'Em andamento'],
    ['done', 'Concluído'],
    ['cancelled', 'Cancelado'],
    ['no_show', 'Não realizado'],
  ] as const)('exibe o rótulo do status %s', (status, rotulo) => {
    render(<AppointmentCard item={agendamento({ status })} />);

    expect(screen.getByText(rotulo)).toBeTruthy();
  });
});
