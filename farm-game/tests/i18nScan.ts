/**
 * Finds hard-coded, player-visible strings in game code (tests/i18n.test.ts runs it over src). A string literal or
 * template counts when it reads like prose: two words, a capitalised word, a SHOUTED word or a sentence. Ids,
 * texture keys, event names, paths and colours do not.
 *
 * Not counted: imports, type positions, object keys, the arguments of `t()` / `tEn()` (they are keys), errors and
 * console output, and any line marked `// i18n-ok` (or the line under such a comment) for text a player never
 * sees. Pure TypeScript compiler API, no Phaser.
 */
import ts from 'typescript';

export interface Finding {
  line: number;
  text: string;
}

/** Callees whose arguments are never player-visible. */
const QUIET_CALLS = new Set([
  't',
  'tn',
  'tEn',
  'has',
  'Error',
  'TypeError',
  'RangeError',
  'log',
  'warn',
  'error',
  'info',
  'debug',
  'require',
  'querySelector',
  'getElementById',
  'addEventListener',
  'removeEventListener',
  'setAttribute',
  'createElement',
]);

/** Text that is a key, an id or markup, not prose. */
function looksLikeProse(raw: string): boolean {
  const s = raw.trim();
  if (!/[A-Za-z]{2,}/.test(s)) return false;
  if (/^[a-z0-9_.:@/#\-[\]{}*$|^()?+=,]+$/.test(s)) return false; // ids, keys, paths, regex bits
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return false;
  if (/^(bold |italic )?\d+px /.test(s)) return false; // CSS font
  if (/^[A-Z][a-zA-Z]+$/.test(s) && /[a-z][A-Z]/.test(s)) return false; // PascalCase identifiers
  if (/\s/.test(s) && /[A-Za-z]{2,}[^\n]*\s+[^\n]*[A-Za-z]/.test(s)) return true;
  if (/^[A-Z][a-z']+[!?.:]*$/.test(s)) return true; // Close, Continue, Done!
  if (/^[A-Z]{2,}[!?.:]*$/.test(s)) return true; // OK, TINY
  if (/[a-z][.!?]$/.test(s)) return true;
  return false;
}

function templateText(node: ts.TemplateExpression): string {
  return node.head.text + node.templateSpans.map((sp) => `{}${sp.literal.text}`).join('');
}

function calleeName(call: ts.CallExpression | ts.NewExpression): string {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return '';
}

function quiet(node: ts.Node): boolean {
  for (
    let p: ts.Node | undefined = node.parent, child: ts.Node = node;
    p;
    child = p, p = p.parent
  ) {
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isLiteralTypeNode(p) || ts.isTypeNode(p)) return true;
    if (ts.isPropertyAssignment(p) && p.name === child) return true;
    if (ts.isElementAccessExpression(p) && p.argumentExpression === child) return true;
    if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && QUIET_CALLS.has(calleeName(p)))
      return true;
    if (ts.isThrowStatement(p)) return true;
    if (ts.isCaseClause(p) && p.expression === child) return true;
    if (
      ts.isBinaryExpression(p) &&
      [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(
        p.operatorToken.kind,
      )
    )
      return true;
    if (ts.isStatement(p) || ts.isClassElement(p)) return false;
  }
  return false;
}

/** Player-visible strings in one TypeScript source text. */
export function scanSource(text: string, fileName = 'x.ts'): Finding[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const lines = text.split('\n');
  const marked = (line: number) =>
    /i18n-ok/.test(lines[line - 1] ?? '') || /\/\/.*i18n-ok/.test(lines[line - 2] ?? '');
  const out: Finding[] = [];
  const visit = (node: ts.Node): void => {
    let s: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) s = node.text;
    else if (ts.isTemplateExpression(node)) s = templateText(node);
    if (s !== null) {
      if (looksLikeProse(s) && !quiet(node)) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        if (!marked(line)) out.push({ line, text: s });
      }
      if (!ts.isTemplateExpression(node)) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
