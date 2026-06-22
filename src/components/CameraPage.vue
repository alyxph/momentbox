<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { frameConfigs } from '../data/frames';

const props = defineProps({
  photos: {
    type: Array,
    required: true,
  },
  gifs: {
    type: Array,
    required: true,
  },
  capturedFrames: {
    type: Array,
    required: true,
  },
  selectedFrame: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:photos', 'update:gifs', 'update:capturedFrames', 'done', 'go-home', 'change-frame']);

const photosList = computed({
  get: () => props.photos,
  set: (val) => emit('update:photos', val),
});

const gifsList = computed({
  get: () => props.gifs,
  set: (val) => emit('update:gifs', val),
});

const capturedFramesList = computed({
  get: () => props.capturedFrames,
  set: (val) => emit('update:capturedFrames', val),
});

const countdown = ref(0);
const isCapturing = ref(false);
const showFlash = ref(false);
const showSmile = ref(false);
const statusText = ref('Tekan MULAI FOTO untuk memulai mengambil foto');
const cameraError = ref('');

const videoEl = ref(null);
const captureCanvas = ref(null);
const streamActive = ref(false);
const framePreviewRef = ref(null);
const frameName = computed(() => (props.selectedFrame ? props.selectedFrame.name : 'PILIH FRAME'));
const hasFrame = computed(() => !!props.selectedFrame);
const isComplete = computed(() => photosList.value.length >= 4 && !isCapturing.value);
const previewBase = computed(() => {
  const layout = props.selectedFrame;
  if (!layout) {
    return { isDefault: true, baseW: 600, baseH: 1800 };
  }
  const isDefault = !!frameConfigs[layout.id];
  const baseW = isDefault ? 600 : (layout.frame?.width || 1200);
  const baseH = isDefault ? 1800 : (layout.frame?.height || 1800);
  return { isDefault, baseW, baseH };
});
const previewAspect = computed(() => `${previewBase.value.baseW} / ${previewBase.value.baseH}`);
const previewBoxes = computed(() => {
  const layout = props.selectedFrame;
  if (!layout) return [];
  const { isDefault, baseW, baseH } = previewBase.value;

  if (isDefault) {
    const pw = baseW - 80;
    const ph = (baseH - 420) / 4;
    const startY = 240;
    const gap = 20;
    return Array.from({ length: 4 }, (_, idx) => ({
      id: idx + 1,
      x: 40,
      y: startY + idx * (ph + gap),
      width: pw,
      height: ph,
    }));
  }

  if (!layout.boxes) return [];
  return [...layout.boxes]
    .map(box => ({
      id: box.id,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    }))
    .sort((a, b) => a.id - b.id);
});

let stream = null;
let seqTimer = null;
let drawSeq = 0;
let gifRecordInterval = null;

function clearTimers() {
  if (seqTimer) {
    clearTimeout(seqTimer);
    seqTimer = null;
  }
  if (gifRecordInterval) {
    clearInterval(gifRecordInterval);
    gifRecordInterval = null;
  }
}

function retakeBoxStyle(box) {
  const { baseW, baseH } = previewBase.value;
  return {
    left: `${(box.x / baseW) * 100}%`,
    top: `${(box.y / baseH) * 100}%`,
    width: `${(box.width / baseW) * 100}%`,
    height: `${(box.height / baseH) * 100}%`,
  };
}

async function startCamera() {
  cameraError.value = '';
  // Try progressively simpler constraints for broader device compatibility
  // (Samsung Browser on Android 10 can reject complex constraint objects)
  const constraintsList = [
    { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  ];
  for (const constraints of constraintsList) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamActive.value = true;
      await nextTick();
      if (videoEl.value) {
        videoEl.value.srcObject = stream;
        // Samsung Browser sometimes needs explicit play() after srcObject assignment
        try {
          await videoEl.value.play();
        } catch (playErr) {
          console.warn('video.play() error (may auto-play):', playErr);
        }
      }
      return; // success
    } catch (e) {
      console.warn('getUserMedia failed with constraints', constraints, e);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
    }
  }
  // All attempts failed
  stream = null;
  streamActive.value = false;
  cameraError.value = 'Tidak dapat mengakses kamera. Izinkan akses kamera di browser kamu.';
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  stream = null;
  streamActive.value = false;
  clearTimers();
}

function resetState() {
  isCapturing.value = false;
  countdown.value = 0;
  showSmile.value = false;
  showFlash.value = false;
  statusText.value = 'Tekan MULAI FOTO untuk memulai mengambil foto';
  cameraError.value = '';
  photosList.value = [];
  gifsList.value = [];
  capturedFramesList.value = [];
}

async function retryCamera() {
  stopCamera();
  resetState();
  await nextTick();
  startCamera();
}

function goHome() {
  stopCamera();
  emit('go-home');
}

function captureGifFrame() {
  const video = videoEl.value;
  if (!video) return null;
  // Guard: video must have valid dimensions (not ready yet on some Android browsers)
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // Frame disimpan di 360px — kualitas cukup bagus untuk video compilation.
  // Gifshot akan menerima versi 240px yang di-downsample terpisah (lihat generateGifForIndex).
  const targetW = 360;
  const targetH = Math.round((vh / vw) * targetW);
  if (!targetH) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Mirror to match preview
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, targetW, targetH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (e) {
    console.warn('captureGifFrame error:', e);
    return null;
  }
}

// Helper: downsample sebuah dataURL image ke lebar targetW menggunakan canvas
function downsampleDataURL(src, targetW) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const targetH = img.naturalWidth
        ? Math.round((img.naturalHeight / img.naturalWidth) * targetW)
        : Math.round(targetW * 0.75);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(src); return; }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch (e) {
        resolve(src); // fallback: gunakan sumber asli
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function generateGifForIndex(index, frameArray) {
  if (!frameArray || frameArray.length === 0) return;

  // Save the raw captured frames array for composite strip compilation
  // (frame 360px tetap disimpan agar video terlihat bagus)
  const updatedFrames = [...capturedFramesList.value];
  updatedFrames[index] = frameArray;
  capturedFramesList.value = updatedFrames;

  // Mark status as loading for this GIF
  const updatedGifs = [...gifsList.value];
  updatedGifs[index] = 'loading';
  gifsList.value = updatedGifs;

  // Helper: apply last-frame fallback
  const applyFallback = () => {
    const fallback = [...gifsList.value];
    fallback[index] = frameArray[frameArray.length - 1] || frameArray[0];
    gifsList.value = fallback;
  };

  const gifshotLib = window.gifshot;
  if (!gifshotLib) {
    console.warn('gifshot library not loaded, using static fallback');
    applyFallback();
    return;
  }

  // Ambil 22 frame merata dari rekaman (animasi halus)
  const MAX_FRAMES = 22;
  let sampledFrames = frameArray.filter(f => !!f);
  if (sampledFrames.length > MAX_FRAMES) {
    const step = frameArray.length / MAX_FRAMES;
    sampledFrames = Array.from({ length: MAX_FRAMES }, (_, i) =>
      frameArray[Math.min(Math.round(i * step), frameArray.length - 1)]
    ).filter(f => !!f);
  }

  if (sampledFrames.length === 0) {
    applyFallback();
    return;
  }

  // Downsample ke 240px KHUSUS untuk gifshot (hemat memori saat quantize)
  // Frame asli 360px tetap tersimpan di capturedFrames untuk video.
  const GIF_W = 240;
  Promise.all(sampledFrames.map(f => downsampleDataURL(f, GIF_W))).then(smallFrames => {
    const firstFrame = smallFrames.find(f => !!f);
    if (!firstFrame) { applyFallback(); return; }

    const img = new Image();
    img.onload = () => {
      const gifW = GIF_W;
      const gifH = img.naturalWidth
        ? Math.round((img.naturalHeight / img.naturalWidth) * gifW)
        : 180;

      try {
        gifshotLib.createGIF({
          images: smallFrames,
          gifWidth: gifW,
          gifHeight: gifH,
          interval: 0.15,
          numFrames: smallFrames.length,
          frameDuration: 1,
          sampleInterval: 10,
          }, (obj) => {
            if (!obj.error && obj.image) {
              const updated = [...gifsList.value];
              updated[index] = obj.image;
              gifsList.value = updated;
            } else {
              console.warn('gifshot createGIF error:', obj.error);
              applyFallback();
            }
          });
        } catch (e) {
          console.error('gifshot threw exception:', e);
          applyFallback();
        }
      };
      img.onerror = () => applyFallback();
      img.src = firstFrame;
    });
}

function capturePhoto(targetIndex = null) {
  const video = videoEl.value;
  const canvas = captureCanvas.value;
  if (!video || !canvas) return;

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  canvas.width = vw;
  canvas.height = vh;

  const ctx = canvas.getContext('2d');
  // Mirror to match what user sees
  ctx.translate(vw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, vw, vh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const nextPhoto = canvas.toDataURL('image/jpeg', 1.0);
  if (targetIndex === null) {
    photosList.value = [...photosList.value, nextPhoto];
  } else {
    const updated = [...photosList.value];
    updated[targetIndex] = nextPhoto;
    photosList.value = updated;
  }

  showFlash.value = true;
  setTimeout(() => {
    showFlash.value = false;
  }, 350);
}

function runCountdown(n, cb) {
  countdown.value = n;
  const tick = () => {
    countdown.value -= 1;
    if (countdown.value > 0) {
      seqTimer = setTimeout(tick, 1000);
    } else {
      countdown.value = 0;
      cb();
    }
  };
  seqTimer = setTimeout(tick, 1000);
}

function captureNext() {
  const idx = photosList.value.length;
  if (idx >= 4) {
    isCapturing.value = false;
    statusText.value = '✅ Semua foto berhasil! Klik foto di kanan untuk retake, atau lanjut.';
    showSmile.value = false;
    stopCamera();
    return;
  }

  statusText.value = `Bersiap foto ${idx + 1}...`;
  showSmile.value = false;

  // Mulai merekam frame sejak countdown dimulai
  const recordedFrames = [];
  const initialFrame = captureGifFrame();
  if (initialFrame) recordedFrames.push(initialFrame);
  
  gifRecordInterval = setInterval(() => {
    const frame = captureGifFrame();
    if (frame) {
      recordedFrames.push(frame);
    }
  }, 150); // Merekam setiap 150ms agar jumlah frame tidak terlalu besar (krn durasinya lebih panjang)

  runCountdown(3, () => {
    showSmile.value = true;
    statusText.value = `Tahan senyum... 😄`;
    
    // Jeda 1.0 detik agar pengguna sempat tersenyum setelah melihat tulisan SENYUM!
    seqTimer = setTimeout(() => {
      if (gifRecordInterval) {
        clearInterval(gifRecordInterval);
        gifRecordInterval = null;
      }
      capturePhoto();
      statusText.value = `Foto ${idx + 1} diambil! 🎉`;
      
      generateGifForIndex(idx, recordedFrames);
      
      seqTimer = setTimeout(() => {
        showSmile.value = false;
        captureNext();
      }, 800);
    }, 1000);
  });
}

async function startCapture() {
  if (isCapturing.value || cameraError.value) return;
  clearTimers();
  if (!streamActive.value) {
    await startCamera();
    if (!streamActive.value) return;
  }
  isCapturing.value = true;
  photosList.value = [];
  statusText.value = 'Siap-siap...';
  captureNext();
}

async function retakePhoto(index) {
  if (isCapturing.value || cameraError.value) return;
  if (!photosList.value[index]) return;
  clearTimers();
  if (!streamActive.value) {
    await startCamera();
    if (!streamActive.value) {
      isCapturing.value = false;
      return;
    }
  }
  isCapturing.value = true;
  showSmile.value = false;
  statusText.value = `Retake foto ${index + 1}...`;

  // Mulai merekam frame sejak countdown dimulai
  const recordedFrames = [];
  const initialFrame = captureGifFrame();
  if (initialFrame) recordedFrames.push(initialFrame);
  
  gifRecordInterval = setInterval(() => {
    const frame = captureGifFrame();
    if (frame) {
      recordedFrames.push(frame);
    }
  }, 150);

  runCountdown(3, () => {
    showSmile.value = true;
    statusText.value = 'Tahan senyum... 😄';
    
    seqTimer = setTimeout(() => {
      if (gifRecordInterval) {
        clearInterval(gifRecordInterval);
        gifRecordInterval = null;
      }
      capturePhoto(index);
      statusText.value = `Foto ${index + 1} diganti! 🎉`;

      generateGifForIndex(index, recordedFrames);

      seqTimer = setTimeout(() => {
        showSmile.value = false;
        isCapturing.value = false;
        stopCamera();
      }, 800);
    }, 1000);
  });
}

function goPreview() {
  if (photosList.value.length < 4) {
    statusText.value = 'Ambil 4 foto dulu sebelum lanjut ke preview.';
    return;
  }
  stopCamera();
  emit('done');
}

function drawFramePreview() {
  const canvas = framePreviewRef.value;
  const layout = props.selectedFrame;
  if (!canvas || !layout) return;

  const { isDefault, baseW, baseH } = previewBase.value;
  const targetW = 220;
  const scale = targetW / baseW;
  const targetH = Math.round(baseH * scale);

  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  const seq = ++drawSeq;

  const applyScale = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, targetW, targetH);
  applyScale();

  const photosSnapshot = [...props.photos];

  if (isDefault) {
    const cfg = frameConfigs[layout.id];
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, baseW, baseH);

    ctx.fillStyle = cfg.headerBg;
    ctx.fillRect(0, 0, baseW, 200);
    ctx.fillStyle = cfg.headerText;
    ctx.font = 'bold 50px Bangers';
    ctx.textAlign = 'center';
    ctx.fillText(`✦ ${layout.name} ✦`, baseW / 2, 125);

    ctx.fillStyle = cfg.footerBg;
    ctx.fillRect(0, baseH - 100, baseW, 100);

    ctx.strokeStyle = cfg.border;
    ctx.lineWidth = 20;
    ctx.strokeRect(10, 10, baseW - 20, baseH - 20);

    const pw = baseW - 80;
    const ph = (baseH - 420) / 4;
    const startY = 240;
    const gap = 20;

    photosSnapshot.forEach((src, idx) => {
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        if (seq !== drawSeq) return;
        applyScale();
        const y = startY + idx * (ph + gap);
        const iw = img.width;
        const ih = img.height;
        const aspect = pw / ph;
        let sw;
        let sh;
        let sx;
        let sy;
        if (iw / ih > aspect) {
          sh = ih;
          sw = ih * aspect;
          sx = (iw - sw) / 2;
          sy = 0;
        } else {
          sw = iw;
          sh = iw / aspect;
          sx = 0;
          sy = (ih - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 40, y, pw, ph);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(40, y, pw, ph);
      };
      img.src = src;
    });
    return;
  }

  const frameImg = new Image();
  frameImg.crossOrigin = 'anonymous';

  const drawAll = () => {
    if (seq !== drawSeq) return;
    applyScale();
    ctx.clearRect(0, 0, baseW, baseH);

    const order = layout.layerOrder || ['box-1', 'box-2', 'box-3', 'box-4', 'frame'];
    order.forEach((layerId) => {
      if (layerId === 'frame') {
        if (frameImg.complete && layout.frameUrl) {
          ctx.drawImage(frameImg, 0, 0, baseW, baseH);
        }
        return;
      }

      const boxId = parseInt(layerId.split('-')[1], 10);
      const box = layout.boxes?.find(b => b.id === boxId);
      const src = photosSnapshot[boxId - 1];
      if (!box || !src) return;

      const img = new Image();
      img.onload = () => {
        if (seq !== drawSeq) return;
        applyScale();
        const iw = img.width;
        const ih = img.height;
        const aspect = box.width / box.height;
        let sw;
        let sh;
        let sx;
        let sy;
        if (iw / ih > aspect) {
          sh = ih;
          sw = ih * aspect;
          sx = (iw - sw) / 2;
          sy = 0;
        } else {
          sw = iw;
          sh = iw / aspect;
          sx = 0;
          sy = (ih - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, box.x, box.y, box.width, box.height);
        if (order.indexOf('frame') > order.indexOf(layerId) && frameImg.complete) {
          ctx.drawImage(frameImg, 0, 0, baseW, baseH);
        }
      };
      img.src = src;
    });
  };

  if (layout.frameUrl) {
    frameImg.onload = drawAll;
    frameImg.src = layout.frameUrl;
  } else {
    drawAll();
  }
}

onMounted(() => {
  startCamera();
});

onUnmounted(() => {
  stopCamera();
});

watch(
  [() => props.selectedFrame, () => props.photos],
  () => {
    nextTick(() => {
      drawFramePreview();
    });
  },
  { deep: true, immediate: true }
);
</script>

<template>
  <div class="camera-layout">
    <!-- Back to Home Button Top Left -->
    <button
      class="btn-3d"
      style="position: absolute; top: 24px; left: 24px; width: 64px; height: 64px; background: #ff4cb0;
        border: 4px solid #000; box-shadow: 6px 6px 0 #000; border-radius: 0;
        display: flex; align-items: center; justify-content: center; z-index: 50; cursor: pointer;"
      @click="emit('change-frame')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <!-- Left: Video + Status -->
    <div class="camera-left">
      <!-- Title -->
      <div class="slide-up" style="text-align: center; margin-bottom: 18px;">
        <h2
          class="neo-title"
          style="font-size: clamp(24px, 4vw, 40px); background: #ff4cb0; border: 4px solid #000;
            box-shadow: 6px 6px 0 #000; padding: 6px 16px; display: inline-block;"
        >
          FOTO {{ Math.min(photosList.length + 1, 4) }} / 4
        </h2>
      </div>

      <!-- Main Area: Video + Overlay Button -->
        <div style="width: 100%; display: flex; flex-direction: column; align-items: center; padding-top: 10px;">
          <div style="width: 100%; max-width: 1000px;">
          <!-- Video -->
          <div
            class="neo-block"
            style="position: relative; width: 100%; max-height: 72vh; overflow: hidden; border-radius: 2px; background: #000;"
          >
            <video
              ref="videoEl"
              autoplay
              playsinline
              muted
              class="video-mirror"
              style="width: 100%; height: auto; min-height: 300px; max-height: 72vh; object-fit: cover; display: block;"
            ></video>

            <!-- Start button overlay -->
            <div
              v-if="!isCapturing && photosList.length === 0"
              style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end;
                z-index: 3; pointer-events: none; padding-right: 32px;"
            >
              <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; pointer-events: auto;">
                <button
                  class="pulse-cam"
                  style="width: 100px; height: 100px; background: #00e5ff; border-radius: 50%;
                    border: 5px solid #000; font-size: 42px; display: inline-flex; align-items: center;
                    justify-content: center; box-shadow: 6px 6px 0 #000; cursor: pointer; outline: none;"
                  @click="startCapture"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 7h-3l-2-3H9L7 7H4c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
                    <circle cx="12" cy="13" r="3.5"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Countdown -->
            <div
              v-if="countdown > 0"
              style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex;
                align-items: center; justify-content: center; z-index: 4;"
            >
              <div
                :key="countdown"
                class="count-pop"
                style="font-family: 'Bangers', cursive; font-size: 130px; color: #ffd700;
                  text-shadow: 4px 4px 0 #ff4cb0, 0 0 60px rgba(255, 215, 0, 0.8);"
              >
                {{ countdown }}
              </div>
            </div>

            <!-- Smile flash -->
            <div
              v-if="showSmile"
              style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
                background: #00e5ff; padding: 8px 22px; border: 3px solid #000; z-index: 4;"
            >
              <span
                style="font-family: 'Bangers', cursive; font-size: 22px; color: #000; letter-spacing: 2px;"
              >
                😄 SENYUM!
              </span>
            </div>

            <!-- Finish overlay -->
            <div v-if="isComplete" class="camera-finish-overlay">
              <div class="neo-block finish-popup" style="text-align: center;">
                <div class="neo-title finish-title" style="margin-bottom: 12px;">
                  Foto Anda sudah siap!
                </div>
                <p class="finish-text" style="margin: 0 auto; max-width: 680px;">
                  Ingin mengganti salah satu foto? Cukup klik foto yang ingin diubah pada pratinjau di sebelah kanan. Jika sudah sesuai, tekan Next untuk melanjutkan.
                </p>
                <button
                  class="btn-3d neo-btn finish-next"
                  :disabled="isCapturing"
                  @click="goPreview"
                >
                  NEXT
                </button>
              </div>
            </div>


          </div>

          <!-- Progress bar -->
          <div style="width: 100%; margin-top: 18px;">
            <div
              style="height: 12px; background: #ffffff; border: 3px solid #000; overflow: hidden;"
            >
              <div
                :style="`width:${(photosList.length / 4) * 100}%;
                  background:linear-gradient(90deg,#00E5FF,#FFD400);
                  height:100%;transition:width .4s ease;`"
              ></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 5px;">
              <span style="color: #111; font-size: 11px; letter-spacing: 1px; font-weight: 800;"
                >{{ photosList.length }}/4 foto diambil</span
              >
              <span style="color: #111; font-size: 11px; font-weight: 800;">{{ isCapturing ? 'Memotret...' : 'Siap' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Retake button (shows after fail or manual) -->
      <button
        v-if="cameraError"
        class="btn-3d neo-btn"
        style="background: #ffd400; color: #000; font-size: 18px; padding: 10px 30px; outline: none;"
        @click="retryCamera"
      >
        🔄 &nbsp;COBA LAGI
      </button>
      <div v-if="cameraError" style="color: #f87171; font-size: 13px; text-align: center; padding: 0 20px;">
        {{ cameraError }}
      </div>
    </div>

    <!-- Right: Strip preview -->
    <div class="preview-panel">
      <h3
        class="neo-title"
        style="font-size: 16px; letter-spacing: 2px; text-align: center; background: #ffd400;
          border: 3px solid #000; padding: 6px 10px; box-shadow: 4px 4px 0 #000;"
      >
        PREVIEW FRAME
      </h3>
      <div class="preview-strip">
        <div v-if="!hasFrame" style="width: 100%; padding: 16px; text-align: center; font-weight: 800;">
          PILIH FRAME DULU
        </div>
        <div
          v-else
          class="frame-preview"
          :style="{ aspectRatio: previewAspect }"
        >
          <canvas ref="framePreviewRef" style="width: 100%; height: 100%; display: block;"></canvas>
          <template v-if="isComplete">
            <button
              v-for="box in previewBoxes"
              :key="`retake-area-${box.id}`"
              class="retake-hotspot"
              :style="retakeBoxStyle(box)"
              :disabled="isCapturing || !photosList[box.id - 1]"
              :aria-label="`Retake foto ${box.id}`"
              @click="retakePhoto(box.id - 1)"
            >
              <span class="retake-badge">{{ box.id }}</span>
            </button>
          </template>
        </div>
      </div>
      <p style="color: #111; font-size: 10px; letter-spacing: 1px; text-align: center; font-weight: 800;">
        FRAME: {{ frameName }}
      </p>
      <!-- instruction moved to popup; inline hint removed -->

      <!-- 'Next' is available in the popup; panel button removed to avoid duplication -->
    </div>

    <!-- Camera permission error overlay -->
    <div
      v-if="cameraError && !streamActive"
      style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.65); display: flex;
        align-items: center; justify-content: center; z-index: 50;"
    >
      <div
        class="neo-block"
        style="padding: 30px; text-align: center; max-width: 420px;"
      >
        <div style="font-size: 50px; margin-bottom: 12px;">🚫</div>
        <h3
          class="neo-title"
          style="font-size: 26px; letter-spacing: 2px;"
        >
          KAMERA TIDAK BISA DIAKSES
        </h3>
        <p style="color: #111; font-size: 13px; margin: 10px 0 20px; font-weight: 700;">
          Izinkan akses kamera di browser kamu, lalu coba lagi.
        </p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button
            class="btn-3d neo-btn"
            style="background: #ff4cb0; color: #000; font-size: 18px; padding: 10px 25px; outline: none;"
            @click="retryCamera"
          >
            🔄 COBA LAGI
          </button>
          <button
            class="btn-3d neo-btn"
            style="background: #111; color: #ffffff; font-size: 18px; padding: 10px 25px; outline: none;"
            @click="goHome"
          >
            🏠 PULANG
          </button>
        </div>
      </div>
    </div>

    <!-- Flash effect -->
    <div v-if="showFlash" class="flash-screen"></div>
    <!-- Hidden capture canvas -->
    <canvas ref="captureCanvas" style="display: none;"></canvas>
  </div>
</template>

<style scoped>
.camera-finish-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 5;
}

.finish-popup {
  padding: 28px 30px;
  max-width: 820px;
  width: 95%;
}

.finish-title {
  font-size: 34px;
}

.finish-text {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.6px;
  margin-top: 6px;
}

.finish-next {
  margin-top: 18px;
  background: #00e5ff;
  color: #000;
  font-size: 20px;
  padding: 18px 28px;
  border-radius: 8px;
  box-shadow: 8px 8px 0 #000;
  width: 220px;
}

.frame-preview {
  position: relative;
  width: 100%;
}

.retake-hotspot {
  position: absolute;
  border: 2px dashed rgba(0, 0, 0, 0.6);
  background: rgba(255, 255, 255, 0);
  cursor: pointer;
  padding: 0;
}

.retake-hotspot:not(:disabled):hover {
  background: rgba(255, 76, 176, 0.12);
}

.retake-hotspot:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.retake-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  background: #ff4cb0;
  color: #000;
  border: 2px solid #000;
  font-size: 10px;
  font-weight: 900;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}


</style>
