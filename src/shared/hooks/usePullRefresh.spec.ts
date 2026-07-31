import { renderHook, act } from '@testing-library/react-native';

import { usePullRefresh } from './usePullRefresh';

describe('usePullRefresh', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('começa sem refreshing e com tick 0', () => {
    const { result } = renderHook(() => usePullRefresh());
    expect(result.current.refreshing).toBe(false);
    expect(result.current.tick).toBe(0);
  });

  it('ao dar refresh liga o spinner, incrementa o tick e chama a ação', async () => {
    const action = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullRefresh(action));

    await act(async () => {
      result.current.onRefresh();
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.tick).toBe(1);
    expect(result.current.refreshing).toBe(true);
  });

  it('desliga o spinner após o atraso', async () => {
    const { result } = renderHook(() => usePullRefresh());

    await act(async () => {
      result.current.onRefresh();
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.refreshing).toBe(false);
  });

  it('funciona sem ação (telas com listener ao vivo) — só recomputa o tick', async () => {
    const { result } = renderHook(() => usePullRefresh());

    await act(async () => {
      result.current.onRefresh();
    });

    expect(result.current.tick).toBe(1);
  });
});
