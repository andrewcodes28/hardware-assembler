// Compiles assembly text into machine code

function error(text, start, end, message) {
  const lines = text.split("\n");
  let lineStart = 0;
  let lineCount = 0;
  let lineCountBegin = -1;
  let lineCountEnd = -1;
  let lineStartBegin = -1;
  for (const line of lines) {
    if (start < lineStart + line.length + 1 && lineCountBegin === -1) {
      lineCountBegin = lineCount;
      lineStartBegin = lineStart;
    }
    if (end <= lineStart + line.length + 1) {
      lineCountEnd = lineCount;
      break;
    }
    lineStart += line.length + 1;
    lineCount++;
  }

  let msg = `Failed to parse code: ${message}.`;
  for (let i = lineCountBegin; i <= lineCountEnd; i++) {
    const line = lines[i];
    const lineEnd = lineStartBegin + line.length;
    const trueStart = Math.max(start, lineStartBegin);

    const padCount = trueStart - lineStartBegin;
    const pointerCount = Math.max(Math.min(end, lineEnd) - trueStart, 1);
    msg += `\n${line}\n${" ".repeat(padCount)}${"^".repeat(pointerCount)}`;
    lineStartBegin += line.length + 1;
  }
  msg += `\nAt ${
    lineCountBegin === lineCountEnd
      ? `line ${lineCountBegin + 1}`
      : `lines ${lineCountBegin + 1}-${lineCountEnd + 1}`
  }`;
  throw new Error(msg);
}

const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const TOKENS = Object.freeze({
  NUMBER: 0,
  IDENTIFIER: 1,
  EOF: 2,
  COLON: 3,
});

function lex(text) {
  const tokens = [];
  let idx = 0;
  while (idx < text.length) {
    const char = text[idx];
    switch (char) {
      case ":":
        tokens.push({
          token: TOKENS.COLON,
          start: idx,
          end: idx + 1,
        });
        break;
      case "\t":
      case " ":
      case "\n":
        break;
      case "/":
        if (text[idx + 1] === "/") {
          while (idx < text.length && text[idx] !== "\n") idx++;
          idx--;
        } else if (text[idx + 1] === "*") {
          const start = idx;
          idx += 2; // Don't let /*/ be valid by skipping past it
          while (
            idx < text.length &&
            (text[idx] !== "/" || text[idx - 1] !== "*")
          )
            idx++;
          if (idx >= text.length)
            error(text, start, start + 2, "Expected end of comment");
        } else error(text, idx, idx + 1, "Expected the start of a comment");
        break;
      default:
        if (DIGITS.includes(char)) {
          const start = idx;
          let str = "";
          while (DIGITS.includes(text[idx])) {
            str += text[idx];
            idx++;
          }
          tokens.push({
            token: TOKENS.NUMBER,
            num: Number(str),
            start,
            end: idx,
          });
          idx--;
        } else if (LETTERS.includes(char)) {
          const start = idx;
          let identifier = "";
          while (LETTERS.includes(text[idx]) || DIGITS.includes(text[idx])) {
            identifier += text[idx];
            idx++;
          }
          tokens.push({
            token: TOKENS.IDENTIFIER,
            identifier,
            start,
            end: idx,
          });
          idx--;
        } else error(text, idx, idx + 1, "Unknown character");
        break;
    }
    idx++;
  }
  tokens.push({
    token: TOKENS.EOF,
    start: idx,
    end: idx + 1,
  });
  return tokens;
}

export const INSTRUCTIONS = Object.freeze({
  __proto__: null,
  NOP: {
    opcode: 0,
    args: [],
  },
  HALT: {
    opcode: 1,
    args: [],
  },
  ADD: {
    opcode: 2,
    args: ["reg", "reg", "writereg"],
  },
  SUB: {
    opcode: 3,
    args: ["reg", "reg", "writereg"],
  },
  AND: {
    opcode: 4,
    args: ["reg", "reg", "writereg"],
  },
  OR: {
    opcode: 5,
    args: ["reg", "reg", "writereg"],
  },
  XOR: {
    opcode: 6,
    args: ["reg", "reg", "writereg"],
  },
  NOT: {
    opcode: 7,
    args: ["reg", "writereg"],
  },
  SET: {
    opcode: 8,
    args: ["reg", "writereg"],
  },
  IST: {
    opcode: 9,
    args: ["num", "writereg"],
  },
  JMP: {
    opcode: 10,
    args: ["reg"],
  },
  JIP: {
    opcode: 11,
    args: ["reg", "reg"],
  },
  LOD: {
    opcode: 12,
    args: ["reg", "writereg"],
  },
  STO: {
    opcode: 13,
    args: ["reg", "reg"],
  },
  SHL: {
    opcode: 14,
    args: ["reg", "reg", "writereg"],
  },
  SHR: {
    opcode: 15,
    args: ["reg", "reg", "writereg"],
  },
});

export const REGISTERS = [
  "r0",
  "r1",
  "r2",
  "r3",
  "r4",
  "r5",
  "r6",
  "r7",
  "r8",
  "r9",
  "r10",
  "r11",
  "r12",
  "r13",
  "zero",
  "status",
];

const READ_ONLY_REGISTERS = ["status"];

class Parser {
  constructor(tokens, text) {
    this.text = text;
    this.tokens = tokens;
    this.idx = 0;
  }

  peek() {
    return this.tokens[this.idx];
  }

  expect(type, message) {
    const tkn = this.peek();
    if (tkn.token !== type) this.errorToken(tkn, message);
    this.idx++;
    return tkn;
  }

  match(type) {
    const tkn = this.peek();
    if (tkn.token !== type) return null;
    this.idx++;
    return tkn;
  }

  errorToken(tkn, message) {
    error(this.text, tkn.start, tkn.end, message);
  }

  parse() {
    const machineCode = [];
    const needsPatching = [];
    const labels = new Map();
    while (this.peek().token !== TOKENS.EOF) {
      let type = this.expect(TOKENS.IDENTIFIER, "Expected an instruction");
      if (this.match(TOKENS.COLON)) {
        if (labels.has(type.identifier))
          this.errorToken(type, "Labels must be unique");
        else labels.set(type.identifier, machineCode.length);
        type = this.expect(TOKENS.IDENTIFIER, "Expected an instruction");
      }
      const instr = INSTRUCTIONS[type.identifier.toUpperCase()];

      if (instr === undefined)
        this.errorToken(type, "Expected a valid instruction");
      let code = instr.opcode;
      let i = 0;
      for (const expected of instr.args) {
        switch (expected) {
          case "writereg":
          case "reg": {
            const token = this.expect(TOKENS.IDENTIFIER, "Expected a register");
            const idx = REGISTERS.indexOf(token.identifier);
            if (idx === -1) this.errorToken(token, "Expected a valid register");
            if (
              expected === "writereg" &&
              READ_ONLY_REGISTERS.includes(token.identifier)
            )
              this.errorToken(
                token,
                `Expected a writable register, and ${token.identifier} is not a writable register`
              );
            code = (code << 4) | idx;
            i++;
            break;
          }
          case "num": {
            const num =
              this.match(TOKENS.IDENTIFIER) ??
              this.expect(TOKENS.NUMBER, "Expected a number or label");
            if (num.token === TOKENS.NUMBER) {
              if (num.num >= 256)
                this.errorToken(num, "Number exceeds 8-bit integer limit");
              code = (code << 8) | num.num;
            } else {
              needsPatching.push([machineCode.length, num]);
              code <<= 8;
            }
            i += 2;
            break;
          }
          default:
            throw new Error("bad code");
        }
      }
      // Pad the instructions so that way the decoding process is always the same
      for (; i < 3; i++) code <<= 4;
      machineCode.push(code);
    }
    for (const [id, patch] of needsPatching) {
      const PATCH_MASK = 255 << 4;
      const label = labels.get(patch.identifier);
      if (label === undefined)
        this.errorToken(patch, "This label does not exist");
      machineCode[id] = (machineCode[id] & ~PATCH_MASK) | (label << 4);
    }
    if (machineCode.length >= 256)
      this.errorToken(
        this.tokens.at(-1),
        `Too many instructions (there are ${machineCode.length} instructions but the maximum allowed is 256)`
      );
    return machineCode;
  }
}

export function parseAssembly(text) {
  const out = new Parser(lex(text), text).parse();
  console.log(out);
  return out;
}
