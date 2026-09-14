/**
 * Tocar para um, manter para muitos.
 *
 * Um ataque de 12 não se conta com doze toques, e por isso as zonas do contador de vida repetem
 * enquanto o dedo estiver em baixo. Isto é a máquina de estados dessa repetição, fora do écran para
 * poder ser testada — o primeiro feitio disto tinha um erro que só aparecia a tocar depressa, e um
 * teste apanha-o em 20 ms enquanto uma mesa demora um torneio.
 *
 * **A invariante que segura tudo: existe no máximo UM temporizador vivo de cada vez.**
 *
 * O erro original foi exactamente perdê-la. `press` armava um `setTimeout` sem parar o anterior,
 * e dois toques rápidos podem dar dois `onPressIn` sem um `onPressOut` pelo meio — dois dedos, ou
 * um toque que aterra antes de o outro levantar. O segundo escrevia por cima do id do primeiro, o
 * primeiro ficava **órfão**, e quando disparava criava uma repetição que já ninguém conseguia
 * parar: descontava vida sozinha para sempre.
 *
 * Duas redes, porque uma só não chega:
 *
 * 1. `press` começa sempre por `release`. Nunca há dois temporizadores armados ao mesmo tempo.
 * 2. Cada passo confirma que o dedo ainda está em baixo antes de contar. Mesmo que um temporizador
 *    escapasse, morria no passo seguinte em vez de ficar a correr.
 *
 * É um `setTimeout` que se volta a marcar, e não um `setInterval`, de propósito: com um id só, e
 * sempre o mais recente, não há forma de haver um id que ninguém guarda.
 */

/** Quanto tempo o dedo tem de ficar em baixo antes de a repetição começar. */
export const HOLD_DELAY = 420;

/** O ritmo da repetição, depois de começar. */
export const HOLD_INTERVAL = 90;

export interface HoldRepeat {
  /** O dedo tocou: conta uma vez já, e começa a repetir se ficar em baixo. */
  press: () => void;
  /** O dedo saiu — ou o écran fechou-se, ou o toque foi cancelado. Pára tudo. */
  release: () => void;
}

export function createHoldRepeat(
  tick: () => void,
  delay: number = HOLD_DELAY,
  interval: number = HOLD_INTERVAL,
): HoldRepeat {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let holding = false;

  function release() {
    holding = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function press() {
    // Rede 1: parar antes de armar. Sem isto, um `onPressIn` a seguir a outro deixava para trás um
    // temporizador que ninguém podia travar.
    release();
    holding = true;
    tick();

    const step = () => {
      // Rede 2: o dedo pode ter saído entre marcar e disparar.
      if (!holding) return;
      tick();
      timer = setTimeout(step, interval);
    };

    timer = setTimeout(step, delay);
  }

  return { press, release };
}
