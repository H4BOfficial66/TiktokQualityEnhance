// H4B Enhancer Method App (V2 Worker Engine + V1 Fallback)
document.addEventListener('DOMContentLoaded', () => {
  initMethodApp();
});

function initMethodApp() {
  const isV1 = window.IS_V1_MODE || false;
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const stepItems = document.querySelectorAll('.v2-step-item');
  const stepLines = document.querySelectorAll('.v2-step-line');

  const step1Container = document.getElementById('step1Container');
  const step2Container = document.getElementById('step2Container');
  const step3Container = document.getElementById('step3Container');

  let currentFile = null;
  let processedBlobUrl = null;
  let processedFileName = '';

  if (!dropzone || !fileInput) return;

  // File selection triggers
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag & drop events
  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  function setStep(stepNum) {
    stepItems.forEach((item, idx) => {
      if (idx + 1 < stepNum) {
        item.className = 'v2-step-item completed';
      } else if (idx + 1 === stepNum) {
        item.className = 'v2-step-item active';
      } else {
        item.className = 'v2-step-item';
      }
    });

    stepLines.forEach((line, idx) => {
      if (idx + 1 < stepNum) {
        line.className = 'v2-step-line active';
      } else {
        line.className = 'v2-step-line';
      }
    });

    if (step1Container) step1Container.style.display = stepNum === 1 ? 'block' : 'none';
    if (step2Container) step2Container.style.display = stepNum === 2 ? 'block' : 'none';
    if (step3Container) step3Container.style.display = stepNum === 3 ? 'block' : 'none';
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function handleFile(file) {
    const validExtensions = ['.mp4', '.mov', '.mkv', '.webm'];
    const nameLower = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => nameLower.endsWith(ext)) || file.type.startsWith('video/');

    if (!isValid) {
      alert('Unsupported format. Please select a valid MP4 or MOV video file.');
      return;
    }

    currentFile = file;

    const video = document.createElement('video');
    video.preload = 'metadata';
    const tempUrl = URL.createObjectURL(file);
    video.src = tempUrl;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(tempUrl);
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      const duration = Math.round(video.duration || 0);

      document.getElementById('metaFileName').textContent = file.name;
      document.getElementById('metaFileSize').textContent = formatBytes(file.size);
      document.getElementById('metaResolution').textContent = `${width}x${height}`;
      document.getElementById('metaDuration').textContent = `${duration}s`;
      document.getElementById('metaTimescale').textContent = '120 FPS Ready';

      setStep(2);
    };

    video.onerror = () => {
      document.getElementById('metaFileName').textContent = file.name;
      document.getElementById('metaFileSize').textContent = formatBytes(file.size);
      document.getElementById('metaResolution').textContent = '1080x1920 (Auto)';
      document.getElementById('metaDuration').textContent = 'Detected';
      document.getElementById('metaTimescale').textContent = '120 FPS Ready';

      setStep(2);
    };
  }

  const changeVideoBtn = document.getElementById('changeVideoBtn');
  if (changeVideoBtn) {
    changeVideoBtn.addEventListener('click', () => {
      currentFile = null;
      fileInput.value = '';
      setStep(1);
    });
  }

  // Next-Gen Web Worker execution pipeline
  function runV2Worker(file, onProgress, onLog, onStage) {
    return new Promise((resolve, reject) => {
      if (typeof Worker === 'undefined') {
        return reject(new Error('Web Workers not supported in this browser.'));
      }

      let worker = null;
      let isDone = false;

      const cleanup = () => {
        if (worker) {
          worker.terminate();
          worker = null;
        }
      };

      try {
        worker = new Worker('/engine/v2/h4bWorker.js', { type: 'module' });

        worker.onmessage = (e) => {
          if (isDone) return;
          const msg = e.data || {};
          if (msg.type === 'progress') {
            if (typeof msg.percent === 'number' && onProgress) onProgress(msg.percent);
            if (msg.stage && onStage) onStage(msg.stage);
            if (msg.log && onLog) onLog(msg.log);
          } else if (msg.type === 'done' && msg.buffer) {
            isDone = true;
            const outputBytes = new Uint8Array(msg.buffer);
            cleanup();
            resolve({ bytes: outputBytes, route: msg.route || 'unknown', notes: msg.notes || [] });
          } else if (msg.type === 'error') {
            isDone = true;
            cleanup();
            reject(new Error(msg.error || 'Worker engine optimization failed'));
          }
        };

        worker.onerror = (err) => {
          if (!isDone) {
            isDone = true;
            cleanup();
            reject(new Error(err.message || 'Worker thread initialization error'));
          }
        };

        file.arrayBuffer().then((buffer) => {
          if (onLog) onLog('[*] Transferring video to V2 Next-Gen Engine Worker...');
          worker.postMessage({
            type: 'process',
            buffer: buffer,
            fileName: file.name,
            postingDevice: 'phone'
          }, [buffer]);
        }).catch(err => {
          cleanup();
          reject(err);
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  // Start Process Button
  const processBtn = document.getElementById('processBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const stageLabel = document.getElementById('stageLabel');
  const percentLabel = document.getElementById('percentLabel');
  const processTerminal = document.getElementById('processTerminal');
  const terminalLogs = document.getElementById('terminalLogs');

  if (processBtn) {
    processBtn.addEventListener('click', async () => {
      if (!currentFile) return;

      processBtn.style.display = 'none';
      if (progressContainer) progressContainer.style.display = 'block';
      processTerminal.style.display = 'block';
      terminalLogs.innerHTML = '';

      async function setProgress(pct, stage, logText) {
        if (progressFill) progressFill.style.width = pct + '%';
        if (percentLabel) percentLabel.textContent = Math.round(pct);
        if (stageLabel) stageLabel.textContent = stage;
        if (logText) {
          const line = document.createElement('div');
          line.className = 'terminal-line';
          line.textContent = logText;
          terminalLogs.appendChild(line);
          terminalLogs.scrollTop = terminalLogs.scrollHeight;
        }
        await new Promise(r => setTimeout(r, 450));
      }

      // Instant (no artificial delay) progress used by the V2 worker pipeline
      function showProgress(pct, stage, logText) {
        if (typeof pct === 'number') {
          if (progressFill) progressFill.style.width = pct + '%';
          if (percentLabel) percentLabel.textContent = Math.round(pct);
        }
        if (stage && stageLabel) stageLabel.textContent = stage;
        if (logText) {
          const line = document.createElement('div');
          line.className = 'terminal-line';
          line.textContent = logText;
          terminalLogs.appendChild(line);
          terminalLogs.scrollTop = terminalLogs.scrollHeight;
        }
      }

      let outputBytes = null;
      let engineRoute = 'legacy-v1';

      try {
        if (isV1) {
          // Classic V1 page (/old-method): in-page container remux (unchanged behaviour)
          await setProgress(15, 'Initializing container restructurer...', `[*] Initializing classic engine...`);
          const inputBytes = new Uint8Array(await currentFile.arrayBuffer());
          await setProgress(55, 'Restructuring container...', `[*] Processing ${formatBytes(inputBytes.length)}...`);
          if (typeof window.h4bRestructureMp4 === 'function') {
            outputBytes = window.h4bRestructureMp4(inputBytes, { fileName: currentFile.name, extendTiming: true });
          } else if (typeof window.remuxMp4Boxes === 'function') {
            outputBytes = window.remuxMp4Boxes(inputBytes, { fileName: currentFile.name, extendTiming: true });
          } else {
            outputBytes = inputBytes;
          }
          await setProgress(100, 'Optimization Complete!', `[✓] Container restructured.`);
        } else {
          // V2 page (/method): run the REAL V2 engine in a worker, show its real progress/logs
          showProgress(3, 'Initializing...', `[*] Starting V2 engine worker (${formatBytes(currentFile.size)})...`);
          const v2 = await runV2Worker(
            currentFile,
            (pct) => showProgress(pct),
            (log) => showProgress(undefined, undefined, log),
            (stage) => showProgress(undefined, stage)
          );
          outputBytes = v2.bytes;
          engineRoute = v2.route;
          showProgress(100, 'Optimization Complete!', `[✓] Done. Engine route: ${engineRoute}`);
          if (engineRoute !== 'v3') {
            showProgress(undefined, undefined, `[!] Warning: v3 engine did not run, this is a fallback output (${engineRoute}). See the log above for the reason.`);
          }
        }

        if (!outputBytes || outputBytes.length === 0) {
          throw new Error('Container optimization failed. Empty output.');
        }

        // Increment global counter
        fetch('/api/counter/up').catch(() => {});

        // Trigger Confetti
        if (typeof window.confetti === 'function') {
          try {
            window.confetti({
              particleCount: 110,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#c084fc', '#a855f7', '#34d399', '#60a5fa']
            });
          } catch (err) {}
        }

        // Build download blob
        const blob = new Blob([outputBytes], { type: 'video/mp4' });
        if (processedBlobUrl) URL.revokeObjectURL(processedBlobUrl);
        processedBlobUrl = URL.createObjectURL(blob);

        const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
        processedFileName = `${baseName}_h4b_optimized.mp4`;

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
          downloadBtn.href = processedBlobUrl;
          downloadBtn.download = processedFileName;
        }

        const previewVideo = document.getElementById('previewVideo');
        if (previewVideo) {
          previewVideo.src = processedBlobUrl;
        }

        document.getElementById('downloadFileName').textContent = processedFileName;
        document.getElementById('downloadFileSize').textContent = formatBytes(outputBytes.length);

        await new Promise(r => setTimeout(r, 400));
        setStep(3);
      } catch (error) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.style.color = '#ef4444';
        line.textContent = `[ERROR] Processing failed: ${error.message}`;
        terminalLogs.appendChild(line);
        alert(`Processing error: ${error.message}`);
      } finally {
        processBtn.style.display = 'flex';
        if (progressContainer) progressContainer.style.display = 'none';
      }
    });
  }

  // Reset / Process Another
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentFile = null;
      if (processedBlobUrl) URL.revokeObjectURL(processedBlobUrl);
      processedBlobUrl = null;
      fileInput.value = '';
      if (processTerminal) processTerminal.style.display = 'none';
      if (terminalLogs) terminalLogs.innerHTML = '';
      if (progressContainer) progressContainer.style.display = 'none';
      if (progressFill) progressFill.style.width = '0%';
      if (processBtn) processBtn.style.display = 'flex';
      setStep(1);
    });
  }
}
