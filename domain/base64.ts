/**
 * Base64 de texto UTF-8, que é o que a Contents API do GitHub quer.
 *
 * Escrito à mão de propósito. O `btoa` global existe em alguns runtimes de React Native e não em
 * outros, e só aceita bytes — um "ç" ou um travessão partem-no. Uma dependência a mais para quinze
 * linhas de tabela também não se justifica, e esta versão testa-se em Node exactamente como corre no
 * telemóvel.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** UTF-8, à mão: `TextEncoder` também não é garantido em todos os runtimes de RN. */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];

  for (let i = 0; i < text.length; i += 1) {
    let code = text.codePointAt(i)!;
    // Um par substituto conta como um carácter só; saltar a segunda metade.
    if (code > 0xffff) i += 1;

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  return bytes;
}

export function toBase64(text: string): string {
  const bytes = utf8Bytes(text);
  let out = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const remaining = bytes.length - i;

    out += ALPHABET[(chunk >> 18) & 0x3f];
    out += ALPHABET[(chunk >> 12) & 0x3f];
    out += remaining > 1 ? ALPHABET[(chunk >> 6) & 0x3f] : '=';
    out += remaining > 2 ? ALPHABET[chunk & 0x3f] : '=';
  }

  return out;
}
