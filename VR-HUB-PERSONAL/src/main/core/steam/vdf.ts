/**
 * Parser minimale del formato VDF (Valve Data Format) usato da Steam per
 * `libraryfolders.vdf` e per i manifest `appmanifest_*.acf`.
 *
 * Non è un parser VDF generico completo (Steam ha anche varianti binarie),
 * ma copre il formato testuale "KeyValues" usato da entrambi questi file,
 * che è quello che ci serve.
 *
 * Esempio di input:
 * "libraryfolders"
 * {
 *   "0"
 *   {
 *     "path"    "C:\\Program Files (x86)\\Steam"
 *     "apps"
 *     {
 *       "620"    "6417000"
 *     }
 *   }
 * }
 */

export type VdfValue = string | VdfNode;
export interface VdfNode {
  [key: string]: VdfValue;
}

export function parseVdf(content: string): VdfNode {
  const tokens = tokenize(content);
  let pos = 0;

  function parseObject(): VdfNode {
    const node: VdfNode = {};
    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token === '}') {
        pos++;
        return node;
      }
      // token è una chiave (stringa quotata già "unquoted" da tokenize)
      const key = token;
      pos++;
      const next = tokens[pos];
      if (next === '{') {
        pos++;
        node[key] = parseObject();
      } else {
        node[key] = next ?? '';
        pos++;
      }
    }
    return node;
  }

  const root = parseObject();
  return root;
}

function tokenize(content: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = content.length;
  while (i < len) {
    const ch = content[i];
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < len && content[j] !== '"') {
        if (content[j] === '\\' && j + 1 < len) {
          value += content[j + 1];
          j += 2;
        } else {
          value += content[j];
          j++;
        }
      }
      tokens.push(value);
      i = j + 1;
    } else if (ch === '{' || ch === '}') {
      tokens.push(ch);
      i++;
    } else if (/\s/.test(ch)) {
      i++;
    } else if (ch === '/' && content[i + 1] === '/') {
      // commento fino a fine riga (raro nei file Steam, ma per robustezza)
      while (i < len && content[i] !== '\n') i++;
    } else {
      // token non quotato (Steam quasi sempre quota, ma per robustezza lo gestiamo)
      let j = i;
      let value = '';
      while (j < len && !/\s|\{|\}/.test(content[j])) {
        value += content[j];
        j++;
      }
      tokens.push(value);
      i = j;
    }
  }
  return tokens;
}

/** Estrae ricorsivamente il primo nodo figlio di primo livello (case-insensitive sulla chiave root). */
export function getRootNode(vdf: VdfNode, expectedKeyLower: string): VdfNode | null {
  for (const key of Object.keys(vdf)) {
    if (key.toLowerCase() === expectedKeyLower) {
      const value = vdf[key];
      return typeof value === 'string' ? null : value;
    }
  }
  return null;
}
