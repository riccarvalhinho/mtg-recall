import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_DELAY, HOLD_INTERVAL, createHoldRepeat } from './holdRepeat';

describe('createHoldRepeat', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('um toque conta uma vez, logo', () => {
    const tick = vi.fn();
    createHoldRepeat(tick).press();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('não repete antes do tempo de espera', () => {
    const tick = vi.fn();
    createHoldRepeat(tick).press();
    vi.advanceTimersByTime(HOLD_DELAY - 1);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('com o dedo em baixo, repete ao ritmo combinado', () => {
    const tick = vi.fn();
    createHoldRepeat(tick).press();
    vi.advanceTimersByTime(HOLD_DELAY);
    expect(tick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(HOLD_INTERVAL * 3);
    expect(tick).toHaveBeenCalledTimes(5);
  });

  it('levantar o dedo pára a repetição', () => {
    const tick = vi.fn();
    const hold = createHoldRepeat(tick);
    hold.press();
    vi.advanceTimersByTime(HOLD_DELAY + HOLD_INTERVAL * 2);
    const counted = tick.mock.calls.length;

    hold.release();
    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(counted);
  });

  it('tocar depressa conta um por toque e nunca começa a repetir', () => {
    const tick = vi.fn();
    const hold = createHoldRepeat(tick);

    for (let i = 0; i < 8; i++) {
      hold.press();
      vi.advanceTimersByTime(40);
      hold.release();
      vi.advanceTimersByTime(40);
    }

    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(8);
  });

  // ─── A regressão ────────────────────────────────────────────────────────────

  it('dois press sem release pelo meio não deixam nada a correr para trás', () => {
    // Este é o bug: a tocar depressa chegavam dois `onPressIn` seguidos, o segundo escrevia por
    // cima do temporizador do primeiro, e o primeiro ficava sem dono. Disparava, criava uma
    // repetição, e nenhum toque a seguir a conseguia parar — a vida descia sozinha.
    const tick = vi.fn();
    const hold = createHoldRepeat(tick);

    hold.press();
    vi.advanceTimersByTime(30);
    hold.press();
    hold.release();

    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('muitos press sem um único release ficam num temporizador só', () => {
    const tick = vi.fn();
    const hold = createHoldRepeat(tick);

    for (let i = 0; i < 6; i++) {
      hold.press();
      vi.advanceTimersByTime(30);
    }
    hold.release();

    vi.advanceTimersByTime(10_000);
    // Seis toques, seis contagens, e nada a correr depois de levantar o dedo.
    expect(tick).toHaveBeenCalledTimes(6);
  });

  it('release a mais não rebenta nem conta nada', () => {
    const tick = vi.fn();
    const hold = createHoldRepeat(tick);
    hold.release();
    hold.release();
    vi.advanceTimersByTime(10_000);
    expect(tick).not.toHaveBeenCalled();
  });

  it('depois de um release, um press novo volta a funcionar por inteiro', () => {
    const tick = vi.fn();
    const hold = createHoldRepeat(tick);

    hold.press();
    hold.press();
    hold.release();
    vi.advanceTimersByTime(10_000);
    tick.mockClear();

    hold.press();
    vi.advanceTimersByTime(HOLD_DELAY + HOLD_INTERVAL);
    expect(tick).toHaveBeenCalledTimes(3);
  });
});
