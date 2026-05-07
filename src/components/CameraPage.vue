<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps({
  photos: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['update:photos', 'done', 'go-home']);

const photosList = computed({
  get: () => props.photos,
  set: (val) => emit('update:photos', val),
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

let stream = null;
let seqTimer = null;

async function startCamera() {
  cameraError.value = '';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
      audio: false,
    });
    streamActive.value = true;
    await nextTick();
    if (videoEl.value) {
      videoEl.value.srcObject = stream;
      await videoEl.value.play();
    }
  } catch (e) {
    stream = null;
    streamActive.value = false;
    cameraError.value = 'Tidak dapat mengakses kamera. Izinkan akses kamera di browser kamu.';
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  stream = null;
  streamActive.value = false;
  if (seqTimer) {
    clearTimeout(seqTimer);
    seqTimer = null;
  }
}

function resetState() {
  isCapturing.value = false;
  countdown.value = 0;
  showSmile.value = false;
  showFlash.value = false;
  statusText.value = 'Tekan MULAI FOTO untuk memulai mengambil foto';
  cameraError.value = '';
  photosList.value = [];
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

function capturePhoto() {
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
  photosList.value = [...photosList.value, nextPhoto];

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
    statusText.value = '✅ Semua foto berhasil! Pilih frame...';
    stopCamera();
    seqTimer = setTimeout(() => {
      emit('done');
    }, 900);
    return;
  }

  statusText.value = `Bersiap foto ${idx + 1}...`;
  showSmile.value = false;
  runCountdown(3, () => {
    showSmile.value = true;
    statusText.value = `Tahan senyum... 😄`;
    
    // Jeda 1.2 detik agar pengguna sempat tersenyum setelah melihat tulisan SENYUM!
    seqTimer = setTimeout(() => {
      capturePhoto();
      statusText.value = `Foto ${idx + 1} diambil! 🎉`;
      
      seqTimer = setTimeout(() => {
        showSmile.value = false;
        captureNext();
      }, 800);
    }, 1200);
  });
}

function startCapture() {
  if (isCapturing.value || cameraError.value) return;
  isCapturing.value = true;
  photosList.value = [];
  statusText.value = 'Siap-siap...';
  captureNext();
}

onMounted(() => {
  startCamera();
});

onUnmounted(() => {
  stopCamera();
});
</script>

<template>
  <div class="camera-layout">
    <!-- Back to Home Button Top Left -->
    <button
      class="btn-3d"
      style="position: absolute; top: 24px; left: 24px; width: 64px; height: 64px; background: #ff4cb0;
        border: 4px solid #000; box-shadow: 6px 6px 0 #000; border-radius: 0;
        display: flex; align-items: center; justify-content: center; z-index: 50; cursor: pointer;"
      @click="goHome"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <!-- Left: Video + Status -->
    <div class="camera-left">
      <!-- Title -->
      <div class="slide-up" style="text-align: center;">
        <h2
          class="neo-title"
          style="font-size: clamp(24px, 4vw, 40px); background: #ff4cb0; border: 4px solid #000;
            box-shadow: 6px 6px 0 #000; padding: 6px 16px; display: inline-block;"
        >
          FOTO {{ Math.min(photosList.length + 1, 4) }} / 4
        </h2>
        <p class="neo-chip" style="font-size: 12px; margin-top: 8px; letter-spacing: 1px; font-weight: 800;">
          {{ statusText }}
        </p>
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
                align-items: center; justify-content: center;"
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
                background: #00e5ff; padding: 8px 22px; border: 3px solid #000;"
            >
              <span
                style="font-family: 'Bangers', cursive; font-size: 22px; color: #000; letter-spacing: 2px;"
              >
                😄 SENYUM!
              </span>
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
        PREVIEW
      </h3>
      <div class="preview-strip">
        <div
          v-for="n in 4"
          :key="n"
          style="width: 100%; aspect-ratio: 4 / 3; background: #f4f4f4; border: 3px solid #000;
            overflow: hidden; position: relative; margin-bottom: 6px;"
        >
          <img v-if="photosList[n - 1]" :src="photosList[n - 1]" style="width: 100%; height: 100%; object-fit: cover;" />
          <div v-else style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            <span style="color: #333; font-size: 18px;">📷</span>
          </div>
          <!-- Badge -->
          <div
            :style="`position:absolute;top:2px;left:2px;width:18px;height:18px;
              background:${photosList[n - 1] ? '#00E5FF' : '#111'};
              display:flex;align-items:center;justify-content:center;border:2px solid #000;`"
          >
            <span style="color: white; font-size: 9px; font-weight: 900;">{{ n }}</span>
          </div>
        </div>
      </div>
      <p style="color: #111; font-size: 10px; letter-spacing: 1px; text-align: center; font-weight: 800;">
        4 STRIP LAYOUT
      </p>
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
