/**
 * The email rule the members import holds a cell to, mirrored so the Check
 * step warns before the upload (finish run round 6). A prediction only: the
 * server decides, and nothing here rewrites the file that is sent.
 *
 * The server (`ValueNormalizer::email()`, lendyph-backend
 * app/Services/CsvImport) first reads the cell as `text()` does: a BOM
 * (U+FEFF) dropped, a non-breaking space read as a space, then PHP's `trim()`.
 * A blank cell is `missingRequiredFields`' question. Otherwise it validates
 * the value with Laravel's `email` and `max:255` rules; a value either refuses
 * is imported blank, with a warning, and the row still imports.
 *
 * Laravel's `email` rule, with no options, refuses a value holding a carriage
 * return or a line feed, then runs egulias/email-validator 4's
 * `RFCValidation`. That is a lexer and a small parser, ported below as it is
 * written (its warnings dropped, since only an error refuses), because a
 * shorter regular expression disagrees with it on real cells: it accepts
 * `juan@localhost`, `juan @example.com` and `"juan dela cruz"@example.com`,
 * and refuses `juan@example.com.`, `juan@exa_mple.com` and
 * `juan,cruz@example.com`. A value over 255 characters is the size check's
 * (`fieldSizeProblems`), so it isn't reported twice here.
 */

/** Token types, as egulias's `EmailLexer` numbers them. */
const T = {
  EMPTY: -1,
  NUL: 0,
  HTAB: 9,
  LF: 10,
  CR: 13,
  SP: 32,
  EXCLAMATION: 33,
  DQUOTE: 34,
  NUMBER_SIGN: 35,
  DOLLAR: 36,
  PERCENTAGE: 37,
  AMPERSAND: 38,
  SQUOTE: 39,
  OPENPARENTHESIS: 40,
  CLOSEPARENTHESIS: 41,
  ASTERISK: 42,
  PLUS: 43,
  COMMA: 44,
  HYPHEN: 45,
  DOT: 46,
  SLASH: 47,
  COLON: 58,
  SEMICOLON: 59,
  LOWERTHAN: 60,
  EQUAL: 61,
  GREATERTHAN: 62,
  QUESTIONMARK: 63,
  AT: 64,
  OPENBRACKET: 91,
  BACKSLASH: 92,
  CLOSEBRACKET: 93,
  CARET: 94,
  UNDERSCORE: 95,
  BACKTICK: 96,
  OPENCURLYBRACES: 123,
  PIPE: 124,
  CLOSECURLYBRACES: 125,
  TILDE: 126,
  INVERT_QUESTIONMARK: 168,
  INVERT_EXCLAMATION: 173,
  GENERIC: 300,
  IPV6TAG: 301,
  INVALID: 302,
  CRLF: 1310,
  DOUBLECOLON: 5858,
} as const;

/** `EmailLexer::$charValue`: values with a type of their own. */
const CHAR_VALUE: Readonly<Record<string, number>> = {
  "{": T.OPENCURLYBRACES,
  "}": T.CLOSECURLYBRACES,
  "(": T.OPENPARENTHESIS,
  ")": T.CLOSEPARENTHESIS,
  "<": T.LOWERTHAN,
  ">": T.GREATERTHAN,
  "[": T.OPENBRACKET,
  "]": T.CLOSEBRACKET,
  ":": T.COLON,
  ";": T.SEMICOLON,
  "@": T.AT,
  "\\": T.BACKSLASH,
  "/": T.SLASH,
  ",": T.COMMA,
  ".": T.DOT,
  "'": T.SQUOTE,
  "`": T.BACKTICK,
  '"': T.DQUOTE,
  "-": T.HYPHEN,
  "::": T.DOUBLECOLON,
  " ": T.SP,
  "\t": T.HTAB,
  "\r": T.CR,
  "\n": T.LF,
  "\r\n": T.CRLF,
  IPv6: T.IPV6TAG,
  "*": T.ASTERISK,
  "!": T.EXCLAMATION,
  "&": T.AMPERSAND,
  "^": T.CARET,
  $: T.DOLLAR,
  "%": T.PERCENTAGE,
  "~": T.TILDE,
  "|": T.PIPE,
  _: T.UNDERSCORE,
  "=": T.EQUAL,
  "+": T.PLUS,
  "¿": T.INVERT_QUESTIONMARK,
  "?": T.QUESTIONMARK,
  "#": T.NUMBER_SIGN,
  "¡": T.INVERT_EXCLAMATION,
};

/**
 * `EmailLexer::CATCHABLE_PATTERNS`, in order, with its `iu` modifiers. Every
 * character falls in one: a non-ASCII one is caught before `\s` and `.`.
 */
const TOKEN_PATTERN = /([a-zA-Z]+[46]?)|([^\x00-\x7F])|([0-9]+)|(\r\n)|(::)|(\s+?)|(.)/giu;

/** A value made only of symbols and other (control, format) characters. */
const ONLY_SYMBOLS_OR_CONTROL = /^[\p{S}\p{C}]+$/u;

interface Token {
  value: string;
  type: number;
  /** Where it starts in the value, in UTF-16 units. */
  offset: number;
}

const NULL_TOKEN: Token = { value: "", type: T.EMPTY, offset: -1 };

/** egulias's `EmailLexer` on doctrine's `AbstractLexer`, as far as the parser reads it. */
class Lexer {
  tokens: Token[] = [];
  position = 0;
  lookahead: Token | null = null;
  current: Token = NULL_TOKEN;
  previous: Token = NULL_TOKEN;
  hasInvalidTokens = false;

  constructor(input: string) {
    for (const match of input.matchAll(TOKEN_PATTERN)) {
      this.tokens.push({ value: match[0], type: this.typeOf(match[0]), offset: match.index });
    }
  }

  private typeOf(value: string): number {
    if (value in CHAR_VALUE) return CHAR_VALUE[value];
    if (value === "\0") return T.NUL;
    if (ONLY_SYMBOLS_OR_CONTROL.test(value)) {
      this.hasInvalidTokens = true;
      return T.INVALID;
    }
    return T.GENERIC;
  }

  moveNext(): boolean {
    this.previous = this.current;
    if (this.lookahead === null) this.lookahead = NULL_TOKEN;
    const token = this.lookahead;
    this.lookahead = this.position < this.tokens.length ? this.tokens[this.position++] : null;
    this.current = token ?? NULL_TOKEN;
    return this.lookahead !== null;
  }

  isNextToken(type: number): boolean {
    return this.lookahead !== null && this.lookahead.type === type;
  }

  isNextTokenAny(types: readonly number[]): boolean {
    return this.lookahead !== null && types.includes(this.lookahead.type);
  }

  /** `find()`: whether a token of `type` is at the lookahead or after it. */
  find(type: number): boolean {
    if (this.lookahead === null) return false;
    if (this.lookahead.type === type) return true;
    return this.tokens.slice(this.position).some((token) => token.type === type);
  }

  /** `PartParser::escaped()`. */
  escaped(): boolean {
    return this.previous.type === T.BACKSLASH && this.current.type !== T.GENERIC;
  }
}

const is = (token: Token, type: number) => token.type === type;

/** `FoldingWhiteSpace::parse()`: whether the white space here is allowed. */
function foldingWhiteSpace(lexer: Lexer): boolean {
  const fws: readonly number[] = [T.SP, T.HTAB, T.CR, T.LF, T.CRLF];
  if (lexer.escaped() || !fws.includes(lexer.current.type)) return true;
  const previous = lexer.previous;
  if (is(lexer.current, T.CRLF) && !lexer.isNextTokenAny([T.SP, T.HTAB])) return false;
  if (is(lexer.current, T.CR)) return false;
  if (lexer.isNextToken(T.GENERIC) && !is(previous, T.AT)) return false;
  if (is(lexer.current, T.LF) || is(lexer.current, T.NUL)) return false;
  return true;
}

/** `Comment::parse()`, with the local or the domain part's exit rule. */
function comment(lexer: Lexer, part: "local" | "domain"): boolean {
  let opened = 0;
  if (is(lexer.current, T.OPENPARENTHESIS)) {
    opened++;
    if (!lexer.find(T.CLOSEPARENTHESIS)) return false;
  }
  if (is(lexer.current, T.CLOSEPARENTHESIS)) return false;

  const goesOn = () => (part === "local" ? !lexer.isNextToken(T.AT) : !(opened === 0 && lexer.isNextToken(T.DOT)));
  let moreTokens = true;
  while (goesOn() && moreTokens) {
    if (lexer.isNextToken(T.OPENPARENTHESIS)) opened++;
    if (lexer.isNextToken(T.CLOSEPARENTHESIS)) opened--;
    moreTokens = lexer.moveNext();
  }
  if (opened !== 0) return false;
  return lexer.isNextToken(part === "local" ? T.AT : T.DOT);
}

/** `DoubleQuote::checkDQUOTE()`. */
function checkDoubleQuote(lexer: Lexer): boolean {
  if (lexer.isNextToken(T.GENERIC) && is(lexer.previous, T.GENERIC)) return false;
  return lexer.find(T.DQUOTE);
}

/** `DoubleQuote::parse()`. */
function doubleQuote(lexer: Lexer): boolean {
  if (!checkDoubleQuote(lexer)) return false;
  const invalid: readonly number[] = [T.NUL, T.HTAB, T.CR, T.LF];
  lexer.moveNext();
  while (!is(lexer.current, T.DQUOTE) && !is(lexer.current, T.EMPTY)) {
    if (is(lexer.current, T.BACKSLASH) && lexer.isNextToken(T.DQUOTE)) lexer.moveNext();
    lexer.moveNext();
    if (!lexer.escaped() && invalid.includes(lexer.current.type)) return false;
  }
  const previous = lexer.previous;
  if (is(previous, T.BACKSLASH) && !checkDoubleQuote(lexer)) return false;
  return lexer.isNextToken(T.AT) || is(previous, T.BACKSLASH);
}

/** `LocalPart::parse()`. */
function localPart(lexer: Lexer): boolean {
  const invalidTokens: readonly number[] = [T.COMMA, T.CLOSEBRACKET, T.OPENBRACKET, T.GREATERTHAN, T.LOWERTHAN, T.COLON, T.SEMICOLON, T.INVALID];
  while (!is(lexer.current, T.AT) && !is(lexer.current, T.EMPTY)) {
    if (is(lexer.current, T.DOT) && is(lexer.previous, T.EMPTY)) return false;
    if (is(lexer.current, T.DQUOTE) && !doubleQuote(lexer)) return false;
    if ((is(lexer.current, T.OPENPARENTHESIS) || is(lexer.current, T.CLOSEPARENTHESIS)) && !comment(lexer, "local")) return false;
    if (is(lexer.current, T.DOT) && (lexer.isNextToken(T.DOT) || lexer.isNextToken(T.AT))) return false;
    if (is(lexer.current, T.BACKSLASH) && lexer.isNextToken(T.GENERIC)) return false;
    if (invalidTokens.includes(lexer.current.type)) return false;
    if (!foldingWhiteSpace(lexer)) return false;
    lexer.moveNext();
  }
  return true;
}

/** One label's form as `idn_to_ascii()` gives it, or null when it can't be converted. */
function asciiLabel(label: string): string | null {
  try {
    return new URL(`http://${label}`).hostname;
  } catch {
    return null;
  }
}

/**
 * `DomainPart::isLabelTooLong()`. The label is read as the parser collects
 * it, with the dot before it, so after the first label the limit is 62.
 */
function labelTooLong(label: string): boolean {
  if (!/[^\x00-\x7F]/.test(label)) return label.length > 63;
  return label.split(".").some((part) => {
    if (part === "") return false;
    const ascii = asciiLabel(part);
    return ascii !== null && ascii.length > 63;
  });
}

/** `DomainLiteral::parse()`: refused only on what makes it an error. */
function domainLiteral(lexer: Lexer): boolean {
  if (!lexer.find(T.CLOSEBRACKET)) return false;
  do {
    if (is(lexer.current, T.NUL)) return false;
    if (lexer.isNextToken(T.OPENBRACKET)) return false;
    if (lexer.isNextToken(T.CR)) return false;
    if (is(lexer.current, T.BACKSLASH)) return false;
    if (is(lexer.current, T.CLOSEBRACKET)) break;
  } while (lexer.moveNext());
  return true;
}

/** `DomainPart::doParseDomainPart()`. */
function domainLabels(lexer: Lexer): boolean {
  let hasComments = false;
  let label = "";
  const checkLabel = (end: boolean) => {
    if (is(lexer.current, T.DOT) || end) {
      if (labelTooLong(label)) return false;
      label = "";
    }
    label += lexer.current.value;
    return true;
  };

  do {
    const previous = lexer.previous;
    if (is(lexer.current, T.BACKSLASH) || is(lexer.current, T.SLASH)) return false;
    if (is(lexer.current, T.OPENPARENTHESIS) || is(lexer.current, T.CLOSEPARENTHESIS)) {
      hasComments = true;
      if (!comment(lexer, "domain")) return false;
    }
    if (is(lexer.current, T.DOT) && lexer.isNextToken(T.DOT)) return false;
    if (is(lexer.current, T.OPENBRACKET)) return domainLiteral(lexer);
    if (!checkLabel(false)) return false;
    if (!foldingWhiteSpace(lexer)) return false;
    if (is(lexer.current, T.OPENBRACKET) && previous.type !== T.AT) return false;
    if (is(lexer.current, T.HYPHEN) && lexer.isNextToken(T.DOT)) return false;
    if (is(lexer.current, T.BACKSLASH) && lexer.isNextToken(T.GENERIC)) return false;
    const valid: number[] = [T.GENERIC, T.HYPHEN, T.DOT];
    if (hasComments) valid.push(T.OPENPARENTHESIS, T.CLOSEPARENTHESIS);
    if (!valid.includes(lexer.current.type)) return false;
    lexer.moveNext();
  } while (!is(lexer.current, T.EMPTY));

  return checkLabel(true);
}

/** `DomainPart::parse()`. `domain` is the value after the local part's `@`, for its length. */
function domainPart(lexer: Lexer, domain: string): boolean {
  lexer.moveNext();
  if (is(lexer.current, T.DOT) || is(lexer.current, T.HYPHEN)) return false;
  if (is(lexer.current, T.EMPTY) || (is(lexer.current, T.SP) && !lexer.isNextToken(T.GENERIC))) return false;
  if (is(lexer.current, T.AT)) return false;
  if (!domainLabels(lexer)) return false;

  const previous = lexer.previous;
  if (is(previous, T.DOT) || is(previous, T.HYPHEN) || is(lexer.current, T.SP)) return false;
  return new TextEncoder().encode(domain).length <= 253;
}

/**
 * Whether Laravel's `email` rule (no options) accepts a value: no carriage
 * return or line feed, and egulias's `RFCValidation` finds no error.
 */
export function isAcceptedEmail(value: string): boolean {
  if (/[\r\n]/.test(value)) return false;

  const lexer = new Lexer(value);
  if (lexer.hasInvalidTokens) return false;

  // `Parser::hasAtToken()`: no local part when the value starts with "@".
  lexer.moveNext();
  lexer.moveNext();
  if (is(lexer.current, T.AT)) return false;

  if (!localPart(lexer)) return false;

  // The local part stops on its "@" (or on the end, which has no domain):
  // the domain is everything after that token.
  const at = lexer.current;
  return domainPart(lexer, at.type === T.AT ? value.slice(at.offset + at.value.length) : "");
}

/** The cell as `ValueNormalizer::text()` reads it: BOM dropped, NBSP a space, PHP's `trim()`. */
export function serverText(raw: string): string {
  return raw.replace(/﻿/g, "").replace(/ /g, " ").replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, "");
}

/** Characters as PHP's `mb_strlen()` counts them. */
function characters(value: string): number {
  return Array.from(value).length;
}

/**
 * The Check step's warning for a members file's email cell, or null when the
 * server keeps it (or it is blank, or too long for the size check).
 */
export function emailWarning(raw: string): string | null {
  const value = serverText(raw);
  if (value === "" || characters(value) > 255 || isAcceptedEmail(value)) return null;
  return `"${value}" is not an email address this system accepts, so it will be imported as blank. The row still imports; correct the email in the file to keep it, or add it later on the member's page.`;
}
