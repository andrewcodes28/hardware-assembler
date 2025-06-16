import { Interpreter } from "./interpreter";
import { INSTRUCTIONS, parseAssembly, REGISTERS } from "./compiler";

import "./style.css";

const code = document.getElementById("code");
const hz = document.getElementById("hz");
const clockSpeed = document.getElementById("speed");
const compileBtn = document.getElementById("compile");
const resetBtn = document.getElementById("reset");
const stepBtn = document.getElementById("step");
const runBtn = document.getElementById("run");
const log = document.getElementById("log");
const regOutput = document.getElementById("reg");
const memOutput = document.getElementById("mem");
const nextInfo = document.getElementById("info");
const sizeInfo = document.getElementById("size");
const canvasOutput = document.getElementById("dist");
const regs = [];
const mems = [];

let interpreter;
let speed = 100;
let toggled = false;
let id = -1;
const ALL_REGISTERS = ["ip", ...REGISTERS];

const formatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
function format(num) {
  return formatter.format(num);
}

function autoRun() {
  const sequence = Math.ceil(speed / 1000);
  for (let i = 0; i < sequence; i++) catchLog(() => interpreter.step());
  performUpdate();
  if (interpreter.terminated) disableAutoRun();
  else id = setTimeout(autoRun, (1000 / speed) * sequence);
}

function disableAutoRun() {
  toggled = false;
  runBtn.textContent = "Run";
  clearTimeout(id);
}

function addLog(text) {
  const el = document.createElement("pre");
  el.textContent = text;
  log.append(el);
  el.scrollIntoView({
    behavior: "smooth",
    block: "end",
  });
}

function catchLog(func) {
  try {
    func();
  } catch (e) {
    addLog(e.message);
  }
}

function performUpdate() {
  for (let i = 0; i < 256; i++) {
    mems[i].textContent = interpreter.memory[i];
  }
  regs[0].textContent = interpreter.ip;
  for (let i = 0; i < 16; i++) {
    regs[i + 1].textContent = interpreter.registers[i];
  }
  if (interpreter.terminated) {
    addLog("The program has halted.");
    nextInfo.textContent = "No more instructions (the program has halted)";
  } else if (interpreter.ip >= interpreter.machineCode.length)
    nextInfo.textContent =
      "No more instructions (program counter is out of bounds)";
  else {
    const next = interpreter.machineCode[interpreter.ip];
    const ident = next >> 12;
    const instr = Object.entries(INSTRUCTIONS).find(
      (i) => i[1].opcode === ident
    );
    if (instr === undefined) nextInfo.textContent = "Unknown instruction (???)";
    else {
      const args = instr[1].args.toReversed();
      const argData = [];
      const sum = args.reduce((a, b) => a + (b === "num" ? 2 : 1), 0);
      let shift = 12 - 4 * sum;
      for (const name of args) {
        const arg = next >> shift;
        if (name === "reg" || name === "writereg") {
          const reg = arg & 15;
          argData.push(`${REGISTERS[reg]} (${interpreter.registers[reg]})`);
          shift += 4;
        } else {
          argData.push(arg & 255);
          shift += 8;
        }
      }
      nextInfo.textContent = `Instruction ${instr[0]} ${argData.reverse().join(" ")}`;
    }
  }
}

compileBtn.addEventListener("click", () => {
  catchLog(() => {
    interpreter = new Interpreter(parseAssembly(code.value));
    performUpdate();
    disableAutoRun();
    sizeInfo.textContent = interpreter.machineCode.length;
    resetBtn.disabled = true;
    stepBtn.disabled = false;
    runBtn.disabled = false;
  });
});

resetBtn.addEventListener("click", () => {
  interpreter.reset();
  performUpdate();
  disableAutoRun();
  resetBtn.disabled = true;
});

stepBtn.addEventListener("click", () => {
  catchLog(() => interpreter.step());
  performUpdate();
  resetBtn.disabled = false;
});

runBtn.addEventListener("click", () => {
  if (toggled) disableAutoRun();
  else {
    toggled = true;
    runBtn.textContent = "Stop";
    autoRun();
  }
  resetBtn.disabled = false;
});

hz.addEventListener("input", () => {
  speed = 10 ** Number(hz.value);
  clockSpeed.textContent = format(speed);
});

for (const reg of ALL_REGISTERS) {
  const update = document.createElement("span");
  const block = document.createElement("span");
  update.textContent = 0;
  block.append(`${reg}: `, update, " ");
  block.className = "box";
  regOutput.append(block);
  regs.push(update);
}

for (let i = 0; i < 16; i++) {
  const row = document.createElement("tr");
  const header = document.createElement("td");
  header.textContent = i * 16;
  header.className = "header";
  row.append(header);
  for (let j = 0; j < 16; j++) {
    const h = document.createElement("td");
    h.className = "mem";
    h.textContent = 0;
    mems.push(h);
    row.append(h);
  }
  memOutput.append(row);
}

resetBtn.disabled = true;
stepBtn.disabled = true;
runBtn.disabled = true;
hz.value = Math.log10(speed);
clockSpeed.textContent = format(speed);
