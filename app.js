(() => {
  'use strict';
  const data = window.DEMO_DATA;
  const $ = (selector) => document.querySelector(selector);
  const tones = {base: '#969e96', ppo: '#8798aa', iteration1: '#b19b73', iteration2: '#789781', iteration3: '#36594c'};
  const escape = (value) => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const duration = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;
  const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></svg>';
  let current = null;
  let activeAudio = null;
  let copyReset = null;
  const remembered = {};

  function playStatus(text, state = '') {
    const node = $('#play-status');
    node.className = `play-status ${state}`;
    node.lastElementChild.textContent = text;
  }

  function bindAudio(audio, label) {
    audio.addEventListener('play', () => {
      document.querySelectorAll('audio').forEach(other => {
        if (other !== audio) other.pause();
      });
      activeAudio = audio;
      document.querySelectorAll('.version-row').forEach(row => row.classList.remove('is-playing'));
      audio.closest('.version-row')?.classList.add('is-playing');
      playStatus(`Playing ${label}`, 'playing');
    });
    audio.addEventListener('pause', () => {
      audio.closest('.version-row')?.classList.remove('is-playing');
      if (activeAudio === audio) playStatus(`${label} paused`);
    });
    audio.addEventListener('ended', () => {
      audio.closest('.version-row')?.classList.remove('is-playing');
      if (activeAudio === audio) playStatus(`${label} finished`);
    });
    audio.addEventListener('error', () => {
      if (audio.currentSrc) playStatus(`${label} could not load. Please refresh and try again.`, 'error');
    });
  }

  function renderLyrics(text, language) {
    const node = $('#lyrics');
    node.lang = language === 'zh' ? 'zh-CN' : 'en';
    node.innerHTML = text.split('\n').map(line => {
      if (/^\s*\[.+\]\s*$/.test(line)) return `<div class="lyric-section">${escape(line)}</div>`;
      return line.trim() ? `<p class="lyric-line">${escape(line)}</p>` : '<div class="lyric-gap" aria-hidden="true"></div>';
    }).join('');
    node.scrollTop = 0;
  }

  function renderCaseTabs(sample) {
    const samples = data.samples.filter(s => s.language === sample.language);
    $('#case-tabs').innerHTML = samples.map(s => `<button class="case-button" type="button" data-case="${escape(s.id)}" aria-pressed="${s.id === sample.id}" aria-label="${s.language === 'zh' ? 'Chinese' : 'English'} case ${s.number}"><span class="case-number">${s.number}</span><span class="case-caption"><small>${s.language === 'zh' ? 'Chinese' : 'English'} case</small></span></button>`).join('');
    $('#case-tabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => navigate(button.dataset.case)));
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === sample.language));
    });
  }

  function render(sample) {
    if (current?.id === sample.id) return;
    document.querySelectorAll('audio').forEach(audio => audio.pause());
    activeAudio = null;
    current = sample;
    remembered[sample.language] = sample.id;
    document.title = `${sample.language.toUpperCase()} ${sample.number} · MuLa-RSI Paper Demo`;
    renderCaseTabs(sample);
    $('#sample-id').textContent = sample.language === 'zh' ? 'CHINESE' : 'ENGLISH';
    $('#sample-title').textContent = `Case ${sample.number}`;
    $('#sample-title').lang = 'en';
    const tags = [...sample.tags.matchAll(/([\w_]+):\[([^\]]*)\]/g)];
    $('#tags').innerHTML = tags.map(([, key, value]) => `<span class="tag"><span class="tag-label">${escape(key.replaceAll('_', ' '))}</span>${escape(value)}</span>`).join('');
    $('#reference-duration').textContent = duration(sample.reference.duration);
    $('#reference-audio').src = sample.reference.src;
    $('#reference-audio').setAttribute('aria-label', `Voice reference for ${sample.language === 'zh' ? 'Chinese' : 'English'} case ${sample.number}`);
    $('#lyrics-download').href = `text/${sample.id}.lyrics.txt`;
    renderLyrics(sample.lyrics, sample.language);
    $('#version-list').innerHTML = data.systems.map(system => {
      const audio = sample.versions[system.id];
      return `<article class="version-row" data-system="${system.id}" style="--tone:${tones[system.id]}"><div><div class="version-title"><span class="version-dot" aria-hidden="true"></span>${escape(system.label)}</div><p class="version-subtitle">${duration(audio.duration)}</p></div><audio controls preload="metadata" src="${escape(audio.src)}" aria-label="${escape(system.label)}, ${sample.language === 'zh' ? 'Chinese' : 'English'} case ${sample.number}"></audio><a class="download-audio" href="${escape(audio.src)}" download="${system.label.replaceAll(' ', '-')}_${sample.id}.mp3" title="Download ${escape(system.label)} MP3" aria-label="Download ${escape(system.label)} MP3">${downloadIcon}</a></article>`;
    }).join('');
    document.querySelectorAll('.version-row').forEach(row => {
      const system = data.systems.find(s => s.id === row.dataset.system);
      bindAudio(row.querySelector('audio'), system.label);
    });
    playStatus('Ready to listen');
  }

  function fromHash() {
    const id = new URLSearchParams(location.hash.slice(1)).get('sample');
    return data.samples.find(s => s.id === id) || data.samples[0];
  }

  function navigate(id) {
    const sample = data.samples.find(s => s.id === id);
    if (!sample) return;
    history.replaceState(null, '', `#sample=${encodeURIComponent(id)}`);
    render(sample);
  }

  document.querySelectorAll('[data-language]').forEach(button => {
    button.addEventListener('click', () => {
      const language = button.dataset.language;
      navigate(remembered[language] || data.samples.find(s => s.language === language).id);
    });
  });
  bindAudio($('#reference-audio'), 'voice reference');
  $('#copy-link').addEventListener('click', async () => {
    const button = $('#copy-link');
    const text = button.querySelector('span');
    try {
      const link = new URL(location.href);
      link.hash = `sample=${encodeURIComponent(current.id)}`;
      await navigator.clipboard.writeText(link.href);
      text.textContent = 'Copied';
      button.setAttribute('aria-label', 'Link copied');
    } catch {
      text.textContent = 'Use address bar';
      button.setAttribute('aria-label', 'Copy the link from the address bar');
    }
    clearTimeout(copyReset);
    copyReset = setTimeout(() => {text.textContent = 'Copy link'; button.setAttribute('aria-label', 'Copy a link to this case');}, 2200);
  });
  window.addEventListener('hashchange', () => {
    if (new URLSearchParams(location.hash.slice(1)).has('sample')) render(fromHash());
  });
  render(fromHash());
})();
