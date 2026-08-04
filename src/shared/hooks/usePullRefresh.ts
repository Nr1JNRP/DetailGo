import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import { useAppTheme } from '@shared/theme';

/**
 * Pull-to-refresh padronizado (mesmo comportamento e cor em todas as telas).
 *
 * Retorna:
 * - `refreshControl`: elemento já com as cores do tema — passe direto no
 *   `refreshControl` da FlatList/SectionList/ScrollView.
 * - `tick`: contador que muda a cada refresh — use em `extraData` da lista para
 *   as linhas recomputarem o estado derivado do tempo (ex.: "vencido").
 * - `refreshing` / `onRefresh`: caso precise controlar manualmente.
 *
 * `onRefreshAction` é opcional: telas com listener ao vivo (onSnapshot) só
 * precisam recomputar o tempo; telas com fetch manual passam o refetch aqui.
 */
export function usePullRefresh(onRefreshAction?: () => void | Promise<void>) {
  const { colors: D } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTick(t => t + 1);
    try {
      await onRefreshAction?.();
    } finally {
      // pequeno atraso para o spinner ser percebido mesmo quando não há fetch
      setTimeout(() => setRefreshing(false), 600);
    }
  }, [onRefreshAction]);

  const refreshControl = React.createElement(RefreshControl, {
    refreshing,
    onRefresh,
    tintColor: D.primary,
    colors: [D.primary],
    progressBackgroundColor: D.surface,
  });

  return { refreshing, onRefresh, tick, refreshControl };
}
