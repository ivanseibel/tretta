import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('porta do servidor', () => {
  it('usa PORT da plataforma quando TRE_TTA_PORT não foi definido', () => {
    expect(loadConfig({ PORT: '10000' }).port).toBe(10000);
    expect(loadConfig({ PORT: '10000', TRE_TTA_PORT: '' }).port).toBe(10000);
  });

  it('mantém a prioridade explícita de TRE_TTA_PORT e o padrão local', () => {
    expect(loadConfig({ PORT: '10000', TRE_TTA_PORT: '3101' }).port).toBe(3101);
    expect(loadConfig({}).port).toBe(3100);
  });

  it('valida a variável que definiu uma porta inválida', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('PORT inválido');
    expect(() => loadConfig({ PORT: '10000', TRE_TTA_PORT: '-1' })).toThrow('TRE_TTA_PORT inválido');
  });
});
