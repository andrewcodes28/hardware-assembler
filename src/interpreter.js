export class Interpreter {
  constructor(machineCode) {
    this.machineCode = machineCode;
    this.reset();
  }
  reset() {
    this.memory = new Uint8Array(256);
    this.registers = new Uint8Array(16);
    this.ip = 0;
    this.terminated = false;
  }
  step() {
    if (this.terminated) return;
    if (this.ip >= this.machineCode.length)
      throw new Error("tried to execute instruction that was out of bounds");
    const code = this.machineCode[this.ip];
    const opcode = code >> 12;
    const arg1 = (code >> 8) & 15;
    const arg2 = (code >> 4) & 15;
    const arg3 = code & 15;
    let zero = 0;
    let negative = 0;
    let overflow = 0;

    function updateFlags(result) {
      if (result < 0) {
        negative = true;
        overflow = true;
      }
      if (result === 0) zero = true;
      if (result >= 256) overflow = true;
    }
    switch (opcode) {
      case 0:
        break;
      case 1:
        this.terminated = true;
        return;
      case 2:
        updateFlags(
          (this.registers[arg3] = this.registers[arg1] + this.registers[arg2])
        );
        break;
      case 3:
        updateFlags(
          (this.registers[arg3] = this.registers[arg1] - this.registers[arg2])
        );
        break;
      case 4:
        updateFlags(
          (this.registers[arg3] = this.registers[arg1] & this.registers[arg2])
        );
        break;
      case 5:
        updateFlags(
          (this.registers[arg3] = this.registers[arg1] | this.registers[arg2])
        );
        break;
      case 6:
        updateFlags(
          (this.registers[arg3] = this.registers[arg1] ^ this.registers[arg2])
        );
        break;
      case 7:
        updateFlags((this.registers[arg2] = ~this.registers[arg1]));
        break;
      case 8:
        updateFlags((this.registers[arg2] = this.registers[arg1]));
        break;
      case 9:
        updateFlags((this.registers[arg3] = (code >> 4) & 255));
        break;
      case 10:
        this.ip = this.registers[arg1] - 1;
        break;
      case 11:
        if (this.registers[arg2] !== 0) {
          this.ip = this.registers[arg1] - 1;
        }
        break;
      case 12:
        updateFlags((this.registers[arg2] = this.memory[this.registers[arg1]]));
        break;
      case 13:
        this.memory[this.registers[arg1]] = this.registers[arg2];
        break;
      case 14:
        updateFlags(
          (this.registers[arg3] = this.registers[arg1] << this.registers[arg2])
        );
        break;
      case 15:
        updateFlags(
          (this.registers[arg3] = this.registers[arg1] >> this.registers[arg2])
        );
        break;
      default:
        throw new Error("are you okay?");
    }
    // It's more correct to enforce the restriction that the zero register always is zero
    // instead of resetting it to zero unconditionally, but it's easier that way and I'm lazy
    this.registers[14] = 0;
    this.registers[15] = (overflow << 2) | (negative << 1) | zero;
    this.ip++;
  }
}
