import assert from 'node:assert/strict';
import test from 'node:test';
import { createVoiceCapture } from '../dist/voice.js';
import { emptyData, tryChatCommand } from '../dist/finance.js';

test('ditado sem texto final não usa mensagem anterior nem trecho incompleto', () => {
  let native;
  class Recognition {
    constructor() { native = this; }
    start() { this.onstart(); }
    stop() { this.onend(); }
    abort() {}
  }
  const heard = [];
  const voice = createVoiceCapture({ Recognition, secure: true, onChange() {}, onTranscript: text => heard.push(text) });
  voice.toggle({ cloud: false });
  native.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'gastei quarenta' }], { isFinal: false })] });
  voice.toggle();
  assert.deepEqual(heard, []);
  assert.match(voice.state.message, /fala completa/);

  voice.toggle({ cloud: false });
  native.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'gastei quarenta reais' }], { isFinal: true })] });
  voice.toggle();
  assert.deepEqual(heard, ['gastei quarenta reais']);
});

test('cancelar enquanto espera a permissão libera um microfone que chegar depois', async () => {
  let provide;
  let released = false;
  const voice = createVoiceCapture({
    Recorder: class {}, secure: true,
    getStream: () => new Promise(resolve => { provide = resolve; }),
    onChange() {}, onTranscript: () => assert.fail('A gravação já foi cancelada')
  });
  voice.toggle({ cloud: true });
  assert.equal(voice.state.phase, 'starting');
  voice.cancel();
  provide({ getTracks: () => [{ stop: () => { released = true; } }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(released, true);
  assert.equal(voice.state.phase, 'idle');
});

test('iPhone com suporte a MP4 libera o microfone antes da transcrição e permite reenviar', async () => {
  let released = false;
  let attempts = 0;
  let heard;
  class Recorder {
    static isTypeSupported(type) { return type === 'audio/mp4'; }
    constructor(_stream, options) { this.mimeType = options.mimeType; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable({ data: new Blob(['fake audio'], {type: this.mimeType}) });
      this.onstop();
    }
  }
  const voice = createVoiceCapture({
    Recorder, secure: true,
    getStream: async () => ({ getTracks: () => [{ stop: () => { released = true; } }] }),
    onChange() {}, onTranscript: text => { heard = text; },
    transcribe: async file => {
      assert.equal(released, true);
      assert.equal(file.type, 'audio/mp4');
      if (++attempts === 1) throw Object.assign(new Error('Falha temporária'), { status: 502 });
      return { text: 'Recebi cem reais' };
    }
  });
  voice.toggle({ cloud: true });
  await new Promise(resolve => setImmediate(resolve));
  voice.toggle();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(voice.state.canRetry, true);
  assert.equal(heard, undefined);
  await voice.retry();
  assert.equal(heard, 'Recebi cem reais');
  assert.equal(voice.state.canRetry, false);
});

test('uma fala com duas movimentações incompletas não vira um lançamento parcial', () => {
  assert.throws(() => tryChatCommand('Gastei 40 no mercado e recebi de um cliente', emptyData(), { strict: true }), /incompleta/);
  assert.equal(tryChatCommand('Não gastei 40 no mercado', emptyData(), { strict: true }), null);
  const valid = tryChatCommand('Gastei 40 no mercado; recebi 100 de um cliente', emptyData(), { strict: true });
  assert.deepEqual(valid.items.map(item => item.amount), [4000, 10000]);
});
