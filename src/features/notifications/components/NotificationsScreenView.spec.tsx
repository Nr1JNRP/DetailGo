import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import NotificationsScreenView from './NotificationsScreenView';
import type { AppNotification } from '../domain/notification.types';

// Navegação: o header usa goBack e o FadeInUp usa useIsFocused.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useIsFocused: () => true,
}));

const item = (id: string): AppNotification => ({
  id,
  type: 'appointment_done',
  title: 'Serviço concluído',
  body: 'Seu serviço de Lavagem foi concluído.',
  startAtMs: null,
  read: true,
  createdAtMs: Date.now(),
});

describe('NotificationsScreenView — limpar todas', () => {
  it('mostra o botão de limpar quando há itens e onClearAll é fornecido', () => {
    const { getByTestId } = render(
      <NotificationsScreenView
        items={[item('1'), item('2')]}
        loading={false}
        subtitle="Seus lembretes"
        onClearAll={jest.fn()}
      />,
    );
    expect(getByTestId('clear-all-notifications')).toBeTruthy();
  });

  it('chama onClearAll ao tocar no botão', () => {
    const onClearAll = jest.fn();
    const { getByTestId } = render(
      <NotificationsScreenView
        items={[item('1')]}
        loading={false}
        subtitle="Seus lembretes"
        onClearAll={onClearAll}
      />,
    );
    fireEvent.press(getByTestId('clear-all-notifications'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('não mostra o botão quando a lista está vazia', () => {
    const { queryByTestId } = render(
      <NotificationsScreenView
        items={[]}
        loading={false}
        subtitle="Seus lembretes"
        onClearAll={jest.fn()}
      />,
    );
    expect(queryByTestId('clear-all-notifications')).toBeNull();
  });

  it('não mostra o botão quando onClearAll não é fornecido', () => {
    const { queryByTestId } = render(
      <NotificationsScreenView items={[item('1')]} loading={false} subtitle="Seus lembretes" />,
    );
    expect(queryByTestId('clear-all-notifications')).toBeNull();
  });
});
