/** xorshift128: deterministic, fast, and the sole source of simulation entropy. */
export class SeededRng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private spare: number | null = null;

  constructor(seed: number) {
    const mix = (value: number) => {
      value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
      value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
      return (value ^ (value >>> 15)) >>> 0;
    };
    this.a = mix(seed || 1);
    this.b = mix(this.a + 0x9e3779b9);
    this.c = mix(this.b + 0x9e3779b9);
    this.d = mix(this.c + 0x9e3779b9);
  }

  nextUint32(): number {
    const t = this.d;
    const s = this.a;
    this.d = this.c;
    this.c = this.b;
    this.b = s;
    let value = t ^ (t << 11);
    value ^= value >>> 8;
    this.a = (value ^ s ^ (s >>> 19)) >>> 0;
    return this.a;
  }

  float(): number {
    return this.nextUint32() / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + this.float() * (max - min);
  }

  int(maxExclusive: number): number {
    return Math.floor(this.float() * maxExclusive);
  }

  normal(mean = 0, deviation = 1): number {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return mean + value * deviation;
    }
    const u = Math.max(this.float(), Number.EPSILON);
    const v = this.float();
    const magnitude = Math.sqrt(-2 * Math.log(u));
    this.spare = magnitude * Math.sin(2 * Math.PI * v);
    return mean + magnitude * Math.cos(2 * Math.PI * v) * deviation;
  }

  weighted(weights: ArrayLike<number>): number {
    let total = 0;
    for (let i = 0; i < weights.length; i += 1) total += Math.max(0, weights[i]);
    let needle = this.float() * total;
    for (let i = 0; i < weights.length; i += 1) {
      needle -= Math.max(0, weights[i]);
      if (needle <= 0) return i;
    }
    return Math.max(0, weights.length - 1);
  }
}

export function stableId(value: number): string {
  return (value >>> 0).toString(36).padStart(7, "0");
}
