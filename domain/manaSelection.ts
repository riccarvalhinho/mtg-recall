/**
 * O selector de cores de três estados, sem interface.
 *
 * O selector que existe no registo de match — um toque põe a cor como principal, dois como splash,
 * três limpa — é a única forma de escrever cores na app, e o deck usa exactamente o mesmo. O que
 * estava lá dentro do écran era conversão de estado: `ManaSelection` (o que vai para o ficheiro)
 * para três estados por pip (o que o dedo manipula) e de volta.
 *
 * Vive aqui porque é puro e porque é o género de código que se parte em silêncio: trocar `main` por
 * `splash` numa conversão destas não rebenta nada, só grava o deck errado. Ver CLAUDE.md §
 * Convenções.
 */
import type { ManaColor, ManaSelection } from '../types';

/** 0: desligada · 1: cor principal · 2: splash. */
export type ManaState = 0 | 1 | 2;

/** A ordem WUBRG, que é a ordem canónica em Magic e a que o selector mostra. */
export const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

export type ManaStates = Record<ManaColor, ManaState>;

/** Nenhuma cor escolhida. */
export function emptyManaStates(): ManaStates {
  return { W: 0, U: 0, B: 0, R: 0, G: 0 };
}

/** Uma selecção já gravada, de volta aos três estados por pip. */
export function manaStatesFrom(selection: ManaSelection | undefined): ManaStates {
  const states = emptyManaStates();
  if (!selection) return states;
  for (const color of selection.main) states[color] = 1;
  // O splash vem depois de propósito: uma cor repetida nas duas listas é um ficheiro estragado, e
  // tratá-la como splash perde menos informação do que a perder de vista.
  for (const color of selection.splash) states[color] = 2;
  return states;
}

/** O toque seguinte no pip: off → main → splash → off. */
export function cycleManaState(states: ManaStates, color: ManaColor): ManaStates {
  return { ...states, [color]: ((states[color] + 1) % 3) as ManaState };
}

/**
 * Os três estados de volta à forma que vai para o ficheiro.
 *
 * Sai sempre em WUBRG e não pela ordem em que se tocou: a ordem dos toques não é informação e só
 * faria o mesmo deck dar diffs diferentes conforme o dia.
 */
export function manaSelectionFrom(states: ManaStates): ManaSelection {
  return {
    main: MANA_ORDER.filter(color => states[color] === 1),
    splash: MANA_ORDER.filter(color => states[color] === 2),
  };
}

/** `true` se há pelo menos uma cor escolhida — serve para mostrar o botão de limpar. */
export function hasAnyMana(states: ManaStates): boolean {
  return MANA_ORDER.some(color => states[color] > 0);
}
