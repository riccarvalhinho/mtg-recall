// GERADO por tools/fetch-mana-symbols.mts — não editar à mão.
//
// Este ficheiro começa vazio de propósito. Os símbolos vêm da Scryfall e são descarregados pelo
// workflow "Actualizar símbolos de mana" (separador Actions), que substitui este ficheiro e o
// commita. Corre-se uma vez; os símbolos não mudam.
//
// Enquanto estiver vazio, o componente ManaCost desenha os cinco WUBRG a partir de
// assets/mana/symbols.ts e o resto em texto — ver components/ManaCost.tsx. Nada parte por isto
// faltar, só fica menos bonito.

/** A chave é o símbolo sem chavetas nem barras: `{W/U}` é `WU`. Ver domain/manaCost.ts. */
export const COST_SYMBOL_SVG: Record<string, string> = {};
