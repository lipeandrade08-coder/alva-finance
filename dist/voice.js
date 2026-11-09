export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const AUDIO_ACCEPT = 'audio/*,.mp3,.mp4,.m4a,.wav,.webm,.ogg,.oga,.flac';
export const isAudioFile = file => /^audio\//i.test(file.type || '') ||
  /\.(mp3|mp4|m4a|wav|webm|ogg|oga|flac|aac)$/i.test(file.name || '');

const recordingTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];

function openRecorder(Recorder, stream) {
  for (const mimeType of [...recordingTypes.filter(type => Recorder.isTypeSupported?.(type)), '']) {
    try { return new Recorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 48000 }); }
    catch { /* Tenta o próximo formato que o navegador declara suportar. */ }
  }
  return new Recorder(stream);
}

function microphoneError(error) {
  const name = error?.name || error;
  if (['NotAllowedError', 'SecurityError', 'not-allowed', 'service-not-allowed'].includes(name)) {
    return 'O microfone está bloqueado. Permita o acesso nas configurações do site e tente de novo.';
  }
  if (['NotFoundError', 'audio-capture'].includes(name)) return 'Nenhum microfone foi encontrado neste aparelho.';
  if (['NotReadableError', 'AbortError'].includes(name)) return 'O microfone está ocupado ou foi interrompido. Feche outros apps de áudio e tente de novo.';
  if (name === 'network') return 'O ditado perdeu a conexão. Tente de novo ou anexe um áudio.';
  if (name === 'no-speech') return 'Não ouvi uma fala completa. Aproxime-se do microfone e tente de novo.';
  return 'Não consegui usar o microfone. Tente de novo, anexe um áudio ou digite sua mensagem.';
}

export function createVoiceCapture({
  getStream = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices),
  Recorder = globalThis.MediaRecorder,
  Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition,
  secure = globalThis.isSecureContext,
  transcribe, onChange, onTranscript
}) {
  let active = null;
  let retryFile = null;
  let state = { phase: 'idle' };

  function display(phase, message = '') {
    state = { phase, message, canRetry: Boolean(retryFile) };
    onChange(state);
  }

  function release(run) {
    clearTimeout(run.timer);
    run.cleanup?.();
    run.cleanup = null;
  }

  function finish(run, message = '', text = '') {
    if (run !== active) return;
    active = null;
    release(run);
    display('idle', message);
    if (text) onTranscript(text);
  }

  function cancel() {
    retryFile = null;
    if (active) finish(active);
    else if (state.message || state.canRetry) display('idle');
  }

  function stop() {
    const run = active;
    if (!run || state.phase !== 'recording') return;
    clearTimeout(run.timer);
    display('stopping', 'Finalizando o áudio…');
    run.timer = setTimeout(() => finish(run, 'O microfone não terminou a gravação. Tente de novo.'), 3500);
    try { run.stop(); }
    catch (error) { finish(run, microphoneError(error)); }
  }

  function startRun() {
    retryFile = null;
    const run = {};
    active = run;
    display('starting', 'Aguardando o microfone…');
    run.timer = setTimeout(() => finish(run, 'O microfone demorou para responder. Confira a permissão do site e tente de novo.'), 16000);
    return run;
  }

  function listening(run) {
    clearTimeout(run.timer);
    display('recording', 'Ouvindo… Toque em Finalizar quando acabar.');
    run.timer = setTimeout(stop, 60000);
  }

  async function upload(file) {
    if (active) return;
    retryFile = null;
    if (!file?.size || file.size > MAX_AUDIO_BYTES) {
      display('idle', 'Selecione um áudio de até 2 MB com uma fala gravada.');
      return;
    }
    const run = { abort: new AbortController() };
    run.cleanup = () => run.abort.abort();
    active = run;
    display('processing', 'Transcrevendo seu áudio…');
    try {
      const result = await transcribe(file, run.abort.signal);
      if (run !== active) return;
      const text = typeof result?.text === 'string' ? result.text.trim() : '';
      finish(run, text ? '' : 'Não identifiquei uma fala nesse áudio. Tente gravar de novo.', text);
    } catch (error) {
      if (run !== active) return;
      if (!error.status || [429, 502, 503, 504].includes(error.status)) {
        if (!['audio_unavailable', 'audio_credentials', 'audio_billing', 'audio_model_access'].includes(error.code)) retryFile = file;
      }
      finish(run, error.message || 'Não foi possível transcrever. Tente de novo ou digite.');
    }
  }

  async function record() {
    const run = startRun();
    let stream;
    const stopTracks = () => stream?.getTracks().forEach(track => track.stop());
    run.cleanup = stopTracks;
    try {
      stream = await getStream({ audio: true, video: false });
      if (active !== run) { stopTracks(); return; }
      const recorder = openRecorder(Recorder, stream);
      const chunks = [];
      let size = 0;
      run.cleanup = () => {
        recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
        if (recorder.state !== 'inactive') {
          try { recorder.stop(); } catch {}
        }
        stopTracks();
      };
      run.stop = () => recorder.stop();
      recorder.ondataavailable = ({ data }) => {
        if (active !== run || !data?.size) return;
        size += data.size;
        if (size > MAX_AUDIO_BYTES) finish(run, 'A gravação passou de 2 MB. Tente uma mensagem mais curta.');
        else chunks.push(data);
      };
      recorder.onerror = event => finish(run, microphoneError(event.error));
      recorder.onstop = () => {
        if (run !== active) return;
        const audio = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || '' });
        finish(run);
        if (audio.size) void upload(audio);
        else display('idle', 'Não consegui gravar som. Confira o microfone e tente de novo.');
      };
      recorder.start(500);
      listening(run);
    } catch (error) { finish(run, microphoneError(error)); }
  }

  function dictate() {
    const run = startRun();
    try {
      const recognition = new Recognition();
      const final = new Map();
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = () => { if (run === active) listening(run); };
      recognition.onresult = event => {
        if (run !== active) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final.set(i, event.results[i][0].transcript.trim());
        }
      };
      recognition.onerror = event => finish(run, microphoneError(event.error));
      recognition.onend = () => {
        const text = [...final.entries()].sort(([a], [b]) => a - b).map(([, part]) => part).join(' ').trim();
        finish(run, text ? '' : microphoneError('no-speech'), text);
      };
      run.stop = () => recognition.stop();
      run.cleanup = () => {
        recognition.onstart = recognition.onresult = recognition.onend = recognition.onerror = null;
        try { recognition.abort(); } catch {}
      };
      recognition.start();
    } catch (error) { finish(run, microphoneError(error)); }
  }

  function toggle({ cloud, nativeOnly = false } = {}) {
    if (active) {
      if (state.phase === 'recording') stop();
      return;
    }
    if (secure === false) {
      display('idle', 'Abra a Alva pelo endereço HTTPS para liberar o microfone.');
      return;
    }
    if (!nativeOnly && cloud !== false && Recorder && getStream && (cloud || !Recognition)) void record();
    else if (Recognition) dictate();
    else display('idle', 'O microfone direto não está disponível aqui. Anexe um áudio ou digite sua mensagem.');
  }

  return {
    toggle, cancel, upload, retry: () => { if (retryFile) return upload(retryFile); },
    get state() { return state; }
  };
}
