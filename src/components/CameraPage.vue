<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { frameConfigs } from '../data/frames'

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
})

const emit = defineEmits([
  'update:photos',
  'update:gifs',
  'update:capturedFrames',
  'done',
  'go-home',
  'change-frame',
])

const photosList = computed({
  get: () => props.photos,
  set: (val) => emit('update:photos', val),
})

const gifsList = computed({
  get: () => props.gifs,
  set: (val) => emit('update:gifs', val),
})

const capturedFramesList = computed({
  get: () => props.capturedFrames,
  set: (val) => emit('update:capturedFrames', val),
})

const countdown = ref(0)
const isCapturing = ref(false)
const showFlash = ref(false)
const showSmile = ref(false)
const statusText = ref('Tekan MULAI FOTO untuk memulai mengambil foto')
const cameraError = ref('')

const videoEl = ref(null)
const captureCanvas = ref(null)
const streamActive = ref(false)
const framePreviewRef = ref(null)
const ipCameraImgEl = ref(null)

// IP Camera mode state (loaded from localStorage)
const ipCameraMode = ref(false)
const ipCameraUrl = ref('http://127.0.0.1:8080/video')
const ipCameraActive = ref(false)
const ipCameraError = ref('')

function loadIpCameraSettings() {
  const mode = localStorage.getItem('photobooth_ipcam_mode')
  const savedDeviceId = localStorage.getItem('photobooth_camera_device_id')
  const url = localStorage.getItem('photobooth_ipcam_url')
  console.log('CameraPage: loadIpCameraSettings', { mode, savedDeviceId, url })
  ipCameraMode.value = mode === '1' || savedDeviceId === 'ipcamera'
  console.log('CameraPage: ipCameraMode =', ipCameraMode.value)
  if (url) ipCameraUrl.value = url
}

const frameName = computed(() => (props.selectedFrame ? props.selectedFrame.name : 'PILIH FRAME'))

const hasFrame = computed(() => !!props.selectedFrame)
const isComplete = computed(() => photosList.value.length >= 4 && !isCapturing.value)
const previewBase = computed(() => {
  const layout = props.selectedFrame
  if (!layout) {
    return { isDefault: true, baseW: 600, baseH: 1800 }
  }
  const isDefault = !!frameConfigs[layout.id]
  const baseW = isDefault ? 600 : layout.frame?.width || 1200
  const baseH = isDefault ? 1800 : layout.frame?.height || 1800
  return { isDefault, baseW, baseH }
})
const previewAspect = computed(() => `${previewBase.value.baseW} / ${previewBase.value.baseH}`)
const previewBoxes = computed(() => {
  const layout = props.selectedFrame
  if (!layout) return []
  const { isDefault, baseW, baseH } = previewBase.value

  if (isDefault) {
    const pw = 560
    const ph = 425
    const startY = 20
    const gap = 20
    return Array.from({ length: 4 }, (_, idx) => ({
      id: idx + 1,
      x: 20,
      y: startY + idx * (ph + gap),
      width: pw,
      height: ph,
    }))
  }

  if (!layout.boxes) return []
  return [...layout.boxes]
    .map((box) => ({
      id: box.id,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    }))
    .sort((a, b) => a.id - b.id)
})

let stream = null
let seqTimer = null
let drawSeq = 0
let gifRecordInterval = null

function clearTimers() {
  if (seqTimer) {
    clearTimeout(seqTimer)
    seqTimer = null
  }
  if (gifRecordInterval) {
    clearInterval(gifRecordInterval)
    gifRecordInterval = null
  }
}

function retakeBoxStyle(box) {
  const { baseW, baseH } = previewBase.value
  return {
    left: `${(box.x / baseW) * 100}%`,
    top: `${(box.y / baseH) * 100}%`,
    width: `${(box.width / baseW) * 100}%`,
    height: `${(box.height / baseH) * 100}%`,
  }
}

async function startCamera() {
  cameraError.value = ''
  ipCameraError.value = ''

  // ── IP Camera mode ──────────────────────────────────────────────────────────
  if (ipCameraMode.value) {
    // Set ipCameraActive FIRST so Vue renders the <img> element
    ipCameraActive.value = true
    streamActive.value = true
    // Wait for Vue to render the <img ref="ipCameraImgEl"> element
    await nextTick()
    if (ipCameraImgEl.value && !ipCameraImgEl.value.src) {
      ipCameraImgEl.value.src = ipCameraUrl.value
    }
    return
  }

  // ── WebRTC / getUserMedia mode ───────────────────────────────────────────────
  // Baca deviceId yang tersimpan dari localStorage (di-set dari halaman Settings)
  const savedDeviceId = localStorage.getItem('photobooth_camera_device_id')

  // Susun daftar constraints: prioritaskan deviceId tersimpan, lalu fallback
  const constraintsList = []

  if (savedDeviceId) {
    constraintsList.push(
      { video: { deviceId: { exact: savedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { deviceId: savedDeviceId }, audio: false },
    )
  }

  constraintsList.push(
    { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  )

  for (const constraints of constraintsList) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamActive.value = true
      await nextTick()
      if (videoEl.value) {
        videoEl.value.srcObject = stream
        // Samsung Browser sometimes needs explicit play() after srcObject assignment
        try {
          await videoEl.value.play()
        } catch (playErr) {
          console.warn('video.play() error (may auto-play):', playErr)
        }
      }
      return // success
    } catch (e) {
      console.warn('getUserMedia failed with constraints', constraints, e)
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
        stream = null
      }
    }
  }
  // All attempts failed
  stream = null
  streamActive.value = false
  cameraError.value = 'Tidak dapat mengakses kamera. Izinkan akses kamera di browser kamu.'
}

function stopCamera() {
  if (ipCameraMode.value) {
    if (ipCameraImgEl.value) ipCameraImgEl.value.src = ''
    ipCameraActive.value = false
    streamActive.value = false
    clearTimers()
    return
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  stream = null
  streamActive.value = false
  clearTimers()
}

function resetState() {
  isCapturing.value = false
  countdown.value = 0
  showSmile.value = false
  showFlash.value = false
  statusText.value = 'Tekan MULAI FOTO untuk memulai mengambil foto'
  cameraError.value = ''
  photosList.value = []
  gifsList.value = []
  capturedFramesList.value = []
}

async function retryCamera() {
  stopCamera()
  resetState()
  await nextTick()
  startCamera()
}

function goHome() {
  stopCamera()
  emit('go-home')
}

function captureGifFrame() {
  // ── IP Camera mode: draw from <img> element ──────────────────────────────────
  if (ipCameraMode.value) {
    const imgEl = ipCameraImgEl.value
    if (!imgEl || !imgEl.naturalWidth || !imgEl.naturalHeight) return null
    const targetW = 360
    const targetH = Math.round((imgEl.naturalHeight / imgEl.naturalWidth) * targetW)
    if (!targetH) return null
    try {
      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(imgEl, 0, 0, targetW, targetH)
      return canvas.toDataURL('image/jpeg', 0.82)
    } catch (e) {
      console.warn('captureGifFrame (IP cam) error:', e)
      return null
    }
  }

  // ── WebRTC mode: draw from <video> ───────────────────────────────────────────
  const video = videoEl.value
  if (!video) return null
  // Guard: video must have valid dimensions (not ready yet on some Android browsers)
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return null

  // Frame disimpan di 360px — kualitas cukup bagus untuk video compilation.
  // Gifshot akan menerima versi 240px yang di-downsample terpisah (lihat generateGifForIndex).
  const targetW = 360
  const targetH = Math.round((vh / vw) * targetW)
  if (!targetH) return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // Mirror to match preview
    ctx.translate(targetW, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, targetW, targetH)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch (e) {
    console.warn('captureGifFrame error:', e)
    return null
  }
}

// Helper: downsample sebuah dataURL image ke lebar targetW menggunakan canvas
function downsampleDataURL(src, targetW) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const targetH = img.naturalWidth
        ? Math.round((img.naturalHeight / img.naturalWidth) * targetW)
        : Math.round(targetW * 0.75)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(src)
          return
        }
        ctx.drawImage(img, 0, 0, targetW, targetH)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      } catch (e) {
        resolve(src) // fallback: gunakan sumber asli
      }
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}

function generateGifForIndex(index, frameArray) {
  if (!frameArray || frameArray.length === 0) return

  // Save the raw captured frames array for composite strip compilation
  // (frame 360px tetap disimpan agar video terlihat bagus)
  const updatedFrames = [...capturedFramesList.value]
  updatedFrames[index] = frameArray
  capturedFramesList.value = updatedFrames

  // Mark status as loading for this GIF
  const updatedGifs = [...gifsList.value]
  updatedGifs[index] = 'loading'
  gifsList.value = updatedGifs

  // Helper: apply last-frame fallback
  const applyFallback = () => {
    const fallback = [...gifsList.value]
    fallback[index] = frameArray[frameArray.length - 1] || frameArray[0]
    gifsList.value = fallback
  }

  const gifshotLib = window.gifshot
  if (!gifshotLib) {
    console.warn('gifshot library not loaded, using static fallback')
    applyFallback()
    return
  }

  // Ambil 22 frame merata dari rekaman (animasi halus)
  const MAX_FRAMES = 22
  let sampledFrames = frameArray.filter((f) => !!f)
  if (sampledFrames.length > MAX_FRAMES) {
    const step = frameArray.length / MAX_FRAMES
    sampledFrames = Array.from(
      { length: MAX_FRAMES },
      (_, i) => frameArray[Math.min(Math.round(i * step), frameArray.length - 1)],
    ).filter((f) => !!f)
  }

  if (sampledFrames.length === 0) {
    applyFallback()
    return
  }

  // Downsample ke 240px KHUSUS untuk gifshot (hemat memori saat quantize)
  // Frame asli 360px tetap tersimpan di capturedFrames untuk video.
  const GIF_W = 240
  Promise.all(sampledFrames.map((f) => downsampleDataURL(f, GIF_W))).then((smallFrames) => {
    const firstFrame = smallFrames.find((f) => !!f)
    if (!firstFrame) {
      applyFallback()
      return
    }

    const img = new Image()
    img.onload = () => {
      const gifW = GIF_W
      const gifH = img.naturalWidth
        ? Math.round((img.naturalHeight / img.naturalWidth) * gifW)
        : 180

      try {
        gifshotLib.createGIF(
          {
            images: smallFrames,
            gifWidth: gifW,
            gifHeight: gifH,
            interval: 0.15,
            numFrames: smallFrames.length,
            frameDuration: 1,
            sampleInterval: 10,
          },
          (obj) => {
            if (!obj.error && obj.image) {
              const updated = [...gifsList.value]
              updated[index] = obj.image
              gifsList.value = updated
            } else {
              console.warn('gifshot createGIF error:', obj.error)
              applyFallback()
            }
          },
        )
      } catch (e) {
        console.error('gifshot threw exception:', e)
        applyFallback()
      }
    }
    img.onerror = () => applyFallback()
    img.src = firstFrame
  })
}

function capturePhoto(targetIndex = null) {
  const canvas = captureCanvas.value
  if (!canvas) return

  // ── IP Camera mode: capture from <img> ──────────────────────────────────────
  if (ipCameraMode.value) {
    const imgEl = ipCameraImgEl.value
    if (!imgEl) return
    // Use naturalWidth if available, otherwise fall back to rendered display size
    const iw = imgEl.naturalWidth || imgEl.clientWidth || 640
    const ih = imgEl.naturalHeight || imgEl.clientHeight || 480
    canvas.width = iw
    canvas.height = ih
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    try {
      ctx.drawImage(imgEl, 0, 0, iw, ih)
      const nextPhoto = canvas.toDataURL('image/jpeg', 1.0)
      if (targetIndex === null) {
        photosList.value = [...photosList.value, nextPhoto]
      } else {
        const updated = [...photosList.value]
        updated[targetIndex] = nextPhoto
        photosList.value = updated
      }
      showFlash.value = true
      setTimeout(() => { showFlash.value = false }, 350)
    } catch (e) {
      console.warn('capturePhoto (IP cam) error:', e)
    }
    return
  }

  // ── WebRTC mode: capture from <video> ───────────────────────────────────────
  const video = videoEl.value
  if (!video) return

  const vw = video.videoWidth || 640
  const vh = video.videoHeight || 480
  canvas.width = vw
  canvas.height = vh

  const ctx = canvas.getContext('2d')
  // Mirror to match what user sees
  ctx.translate(vw, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, vw, vh)
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const nextPhoto = canvas.toDataURL('image/jpeg', 1.0)
  if (targetIndex === null) {
    photosList.value = [...photosList.value, nextPhoto]
  } else {
    const updated = [...photosList.value]
    updated[targetIndex] = nextPhoto
    photosList.value = updated
  }

  showFlash.value = true
  setTimeout(() => {
    showFlash.value = false
  }, 350)
}

function runCountdown(n, cb) {
  countdown.value = n
  const tick = () => {
    countdown.value -= 1
    if (countdown.value > 0) {
      seqTimer = setTimeout(tick, 1000)
    } else {
      countdown.value = 0
      cb()
    }
  }
  seqTimer = setTimeout(tick, 1000)
}

function captureNext() {
  const idx = photosList.value.length
  if (idx >= 4) {
    isCapturing.value = false
    statusText.value = '✅ Semua foto berhasil! Klik foto di kanan untuk retake, atau lanjut.'
    showSmile.value = false
    // Only stop camera for WebRTC mode. In IP Camera mode keep the stream alive for retakes.
    if (!ipCameraMode.value) stopCamera()
    return
  }

  statusText.value = `Bersiap foto ${idx + 1}...`
  showSmile.value = false

  // Mulai merekam frame sejak countdown dimulai
  const recordedFrames = []
  const initialFrame = captureGifFrame()
  if (initialFrame) recordedFrames.push(initialFrame)

  gifRecordInterval = setInterval(() => {
    const frame = captureGifFrame()
    if (frame) {
      recordedFrames.push(frame)
    }
  }, 150) // Merekam setiap 150ms agar jumlah frame tidak terlalu besar (krn durasinya lebih panjang)

  runCountdown(3, () => {
    showSmile.value = true
    statusText.value = `Tahan senyum... 😄`

    // Jeda 1.0 detik agar pengguna sempat tersenyum setelah melihat tulisan SENYUM!
    seqTimer = setTimeout(() => {
      if (gifRecordInterval) {
        clearInterval(gifRecordInterval)
        gifRecordInterval = null
      }
      capturePhoto()
      statusText.value = `Foto ${idx + 1} diambil! 🎉`

      generateGifForIndex(idx, recordedFrames)

      seqTimer = setTimeout(() => {
        showSmile.value = false
        captureNext()
      }, 800)
    }, 1000)
  })
}

async function startCapture() {
  if (isCapturing.value || cameraError.value) return
  clearTimers()
  if (!streamActive.value) {
    await startCamera()
    if (!streamActive.value) return
  }
  isCapturing.value = true
  photosList.value = []
  statusText.value = 'Siap-siap...'
  captureNext()
}

async function retakePhoto(index) {
  if (isCapturing.value || cameraError.value) return
  if (!photosList.value[index]) return

  // Auto-scroll ke atas (berguna di HP agar layar kembali ke kamera)
  window.scrollTo({ top: 0, behavior: 'smooth' })

  clearTimers()
  if (!streamActive.value) {
    await startCamera()
    if (!streamActive.value) {
      isCapturing.value = false
      return
    }
  }
  isCapturing.value = true
  showSmile.value = false
  statusText.value = `Retake foto ${index + 1}...`

  // Mulai merekam frame sejak countdown dimulai
  const recordedFrames = []
  const initialFrame = captureGifFrame()
  if (initialFrame) recordedFrames.push(initialFrame)

  gifRecordInterval = setInterval(() => {
    const frame = captureGifFrame()
    if (frame) {
      recordedFrames.push(frame)
    }
  }, 150)

  runCountdown(3, () => {
    showSmile.value = true
    statusText.value = 'Tahan senyum... 😄'

    seqTimer = setTimeout(() => {
      if (gifRecordInterval) {
        clearInterval(gifRecordInterval)
        gifRecordInterval = null
      }
      capturePhoto(index)
      statusText.value = `Foto ${index + 1} diganti! 🎉`

      generateGifForIndex(index, recordedFrames)

      seqTimer = setTimeout(() => {
        showSmile.value = false
        isCapturing.value = false
        stopCamera()
      }, 800)
    }, 1000)
  })
}

function goPreview() {
  if (photosList.value.length < 4) {
    statusText.value = 'Ambil 4 foto dulu sebelum lanjut ke preview.'
    return
  }
  stopCamera()
  emit('done')
}

function drawFramePreview() {
  const canvas = framePreviewRef.value
  const layout = props.selectedFrame
  if (!canvas || !layout) return

  const { isDefault, baseW, baseH } = previewBase.value
  const targetW = 220
  const scale = targetW / baseW
  const targetH = Math.round(baseH * scale)

  canvas.width = targetW
  canvas.height = targetH

  const ctx = canvas.getContext('2d')
  const seq = ++drawSeq

  const applyScale = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, targetW, targetH)
  applyScale()

  const photosSnapshot = [...props.photos]

  if (isDefault) {
    // Clear canvas to transparent
    ctx.clearRect(0, 0, baseW, baseH)

    const boxes = previewBoxes.value

    // Draw placeholder backgrounds first (light purple) so they show up even when photos aren't taken yet
    boxes.forEach((box, idx) => {
      const src = photosSnapshot[idx]
      const x = box.x
      const y = box.y
      const pw = box.width
      const ph = box.height

      // Draw purple placeholder background
      ctx.fillStyle = '#8A3DFF'
      ctx.fillRect(x, y, pw, ph)

      // Draw slot number in center
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 80px Bangers'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(box.id), x + pw / 2, y + ph / 2)

      // Draw photo on top if exists
      if (src) {
        const img = new Image()
        img.onload = () => {
          if (seq !== drawSeq) return
          applyScale()
          const iw = img.width
          const ih = img.height
          const aspect = pw / ph
          let sw, sh, sx, sy
          if (iw / ih > aspect) {
            sh = ih
            sw = ih * aspect
            sx = (iw - sw) / 2
            sy = 0
          } else {
            sw = iw
            sh = iw / aspect
            sx = 0
            sy = (ih - sh) / 2
          }
          ctx.drawImage(img, sx, sy, sw, sh, x, y, pw, ph)
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 8
          ctx.strokeRect(x, y, pw, ph)
        }
        img.src = src
      } else {
        // Draw border around empty placeholder
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 8
        ctx.strokeRect(x, y, pw, ph)
      }
    })
    return
  }

  const drawAll = () => {
    if (seq !== drawSeq) return
    applyScale()
    ctx.clearRect(0, 0, baseW, baseH)

    // Draw placeholders/photos for all boxes in layout (frame overlay is ignored for preview)
    const boxes = layout.boxes || []
    boxes.forEach((box) => {
      const photoIdx = box.id - 1
      const src = photosSnapshot[photoIdx]

      // Draw purple placeholder background
      ctx.fillStyle = '#8A3DFF'
      ctx.fillRect(box.x, box.y, box.width, box.height)

      // Draw slot number in center
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 80px Bangers'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(box.id), box.x + box.width / 2, box.y + box.height / 2)

      if (src) {
        const img = new Image()
        img.onload = () => {
          if (seq !== drawSeq) return
          applyScale()
          const iw = img.width
          const ih = img.height
          const aspect = box.width / box.height
          let sw, sh, sx, sy
          if (iw / ih > aspect) {
            sh = ih
            sw = ih * aspect
            sx = (iw - sw) / 2
            sy = 0
          } else {
            sw = iw
            sh = iw / aspect
            sx = 0
            sy = (ih - sh) / 2
          }
          ctx.drawImage(img, sx, sy, sw, sh, box.x, box.y, box.width, box.height)
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 8
          ctx.strokeRect(box.x, box.y, box.width, box.height)
        }
        img.src = src
      } else {
        // Draw border around empty placeholder
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 8
        ctx.strokeRect(box.x, box.y, box.width, box.height)
      }
    })
  }

  drawAll()
}

// Re-init camera when the browser detects a device change (e.g., USB webcam plugged in)
async function handleDeviceChange() {
  // Only react to device changes in WebRTC mode; IP cam doesn't need this.
  if (ipCameraMode.value) return
  if (isCapturing.value) return
  await retryCamera()
}

onMounted(() => {
  loadIpCameraSettings()
  // Use async IIFE so we can await startCamera properly
  ;(async () => {
    await startCamera()
  })()
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
  }
})

onUnmounted(() => {
  stopCamera()
  if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
    navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }
})

watch(
  [() => props.selectedFrame, () => props.photos],
  () => {
    nextTick(() => {
      drawFramePreview()
    })
  },
  { deep: true, immediate: true },
)

const cameraAspectRatio = computed(() => {
  const layout = props.selectedFrame
  if (!layout) return '3 / 2'
  const isDefault = !!frameConfigs[layout.id]
  if (isDefault) {
    const baseW = 600
    const baseH = 1800
    const pw = baseW - 80
    const ph = (baseH - 420) / 4
    return `${pw} / ${ph}`
  }
  if (layout.boxes && layout.boxes.length > 0) {
    const box = layout.boxes[0]
    return `${box.width} / ${box.height}`
  }
  return '3 / 2'
})
</script>

<template>
  <div class="camera-layout">
    <!-- Floating background ornaments -->
    <div
      class="fa bg-deco bg-deco-star-tl"
      style="top: 8%; left: 8%; color: #ff4cb0; font-size: 90px; text-shadow: 5px 5px 0 #000"
    >
      ✦
    </div>
    <div
      class="fb bg-deco bg-deco-box-tr"
      style="
        top: 12%;
        right: 12%;
        width: 110px;
        height: 110px;
        background: #00e5ff;
        border: 5px solid #000;
        box-shadow: 8px 8px 0 #000;
        transform: rotate(15deg);
      "
    ></div>
    <div
      class="fc bg-deco bg-deco-box-bl"
      style="
        bottom: 15%;
        left: 10%;
        width: 140px;
        height: 80px;
        background: #ff6b35;
        border: 5px solid #000;
        box-shadow: -8px 8px 0 #000;
        transform: rotate(-10deg);
      "
    ></div>
    <div
      class="fa bg-deco bg-deco-star-br"
      style="bottom: 10%; right: 10%; color: #ffd700; font-size: 100px; text-shadow: 5px 5px 0 #000"
    >
      ✦
    </div>
    <div
      class="fb bg-deco bg-deco-sm-1"
      style="
        top: 40%;
        left: 5%;
        width: 30px;
        height: 30px;
        background: #a855f7;
        border: 3px solid #000;
        border-radius: 50%;
        box-shadow: 3px 3px 0 #000;
      "
    ></div>
    <div
      class="fc bg-deco bg-deco-sm-2"
      style="
        bottom: 40%;
        right: 6%;
        width: 40px;
        height: 40px;
        background: #fff;
        border: 4px solid #000;
        box-shadow: 4px 4px 0 #000;
        transform: rotate(45deg);
      "
    ></div>

    <!-- Back to Home Button Top Left -->
    <button class="btn-3d camera-close-btn" @click="emit('change-frame')">
      <svg
        class="camera-close-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#000"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <!-- Left: Video + Status -->
    <div class="camera-left" style="position: relative; z-index: 2">
      <!-- Title -->
      <div class="slide-up camera-title-container">
        <h2 class="neo-title camera-title-badge">
          FOTO {{ Math.min(photosList.length + 1, 4) }} / 4
        </h2>
      </div>

      <!-- Main Area: Video + Overlay Button -->
      <div
        style="
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 10px;
        "
      >
        <div class="camera-content-wrapper">
          <!-- Video / IP Camera stream -->
          <div class="neo-block camera-video-container" :style="{ aspectRatio: cameraAspectRatio }">
            <!-- WebRTC mode: standard video element -->
            <video
              v-if="!ipCameraMode"
              ref="videoEl"
              autoplay
              playsinline
              muted
              class="video-mirror camera-video-element"
            ></video>

            <!-- IP Camera mode: MJPEG stream via img element -->
            <img
              v-else
              ref="ipCameraImgEl"
              class="camera-video-element"
              style="object-fit: cover; width: 100%; height: 100%; display: block; background: #111;"
              :src="ipCameraActive ? ipCameraUrl : ''"
              alt="IP Camera Stream"
              @error="ipCameraError = 'Tidak dapat memuat stream. Pastikan URL benar dan app IP Camera sudah berjalan.'"
              @load="ipCameraError = ''"
            />

            <!-- Start button overlay -->
            <div v-if="!isCapturing && photosList.length === 0" class="camera-shutter-overlay">
              <div class="camera-shutter-wrapper">
                <button class="pulse-cam camera-shutter-btn" @click="startCapture">
                  <svg
                    class="camera-shutter-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#000"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M20 7h-3l-2-3H9L7 7H4c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"
                    />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Countdown -->
            <div
              v-if="countdown > 0"
              style="
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 4;
              "
            >
              <div
                :key="countdown"
                class="count-pop"
                style="
                  font-family: 'Bangers', cursive;
                  font-size: 130px;
                  color: #ffd700;
                  text-shadow:
                    4px 4px 0 #ff4cb0,
                    0 0 60px rgba(255, 215, 0, 0.8);
                "
              >
                {{ countdown }}
              </div>
            </div>

            <!-- Smile flash -->
            <div
              v-if="showSmile"
              style="
                position: absolute;
                bottom: 16px;
                left: 50%;
                transform: translateX(-50%);
                background: #00e5ff;
                padding: 8px 22px;
                border: 3px solid #000;
                z-index: 4;
              "
            >
              <span
                style="
                  font-family: 'Bangers', cursive;
                  font-size: 22px;
                  color: #000;
                  letter-spacing: 2px;
                "
              >
                😄 SENYUM!
              </span>
            </div>

            <!-- Finish overlay -->
            <div v-if="isComplete" class="camera-finish-overlay">
              <div class="neo-block finish-popup" style="text-align: center">
                <div class="neo-title finish-title" style="margin-bottom: 8px">
                  Foto Anda sudah siap!
                </div>
                <p class="finish-text" style="margin: 0 auto; max-width: 680px">
                  Ingin mengganti salah satu foto? Klik foto di pratinjau kanan. Jika sudah sesuai,
                  klik Next.
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
          <div class="camera-progress-container">
            <div
              style="height: 12px; background: #ffffff; border: 3px solid #000; overflow: hidden"
            >
              <div
                :style="`width:${(photosList.length / 4) * 100}%;
                  background:linear-gradient(90deg,#00E5FF,#FFD400);
                  height:100%;transition:width .4s ease;`"
              ></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 5px">
              <span style="color: #111; font-size: 11px; letter-spacing: 1px; font-weight: 800"
                >{{ photosList.length }}/4 foto diambil</span
              >
              <span style="color: #111; font-size: 11px; font-weight: 800">{{
                isCapturing ? 'Memotret...' : 'Siap'
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Retake button (shows after fail or manual) -->
      <button
        v-if="cameraError"
        class="btn-3d neo-btn"
        style="background: #ffd400; color: #000; font-size: 18px; padding: 10px 30px; outline: none"
        @click="retryCamera"
      >
        🔄 &nbsp;COBA LAGI
      </button>
      <div
        v-if="cameraError"
        style="color: #f87171; font-size: 13px; text-align: center; padding: 0 20px"
      >
        {{ cameraError }}
      </div>
      <!-- IP Camera stream error -->
      <div
        v-if="ipCameraMode && ipCameraError"
        style="color: #f97316; font-size: 13px; text-align: center; padding: 0 20px; font-weight: 800;"
      >
        📡 {{ ipCameraError }}
      </div>
    </div>

    <!-- Right: Strip preview -->
    <div class="preview-panel" style="position: relative; z-index: 2">
      <div class="preview-strip" :style="{ aspectRatio: previewAspect }">
        <div
          v-if="!hasFrame"
          style="width: 100%; padding: 16px; text-align: center; font-weight: 800"
        >
          PILIH FRAME DULU
        </div>
        <div v-else class="frame-preview" :style="{ aspectRatio: previewAspect }">
          <canvas ref="framePreviewRef" style="width: 100%; height: 100%; display: block"></canvas>
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
      <!-- instruction moved to popup; inline hint removed -->

      <!-- 'Next' is available in the popup; panel button removed to avoid duplication -->
    </div>

    <!-- Camera permission error overlay -->
    <div
      v-if="cameraError && !streamActive"
      style="
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
      "
    >
      <div class="neo-block" style="padding: 30px; text-align: center; max-width: 420px">
        <div style="font-size: 50px; margin-bottom: 12px">🚫</div>
        <h3 class="neo-title" style="font-size: 26px; letter-spacing: 2px">
          KAMERA TIDAK BISA DIAKSES
        </h3>
        <p style="color: #111; font-size: 13px; margin: 10px 0 20px; font-weight: 700">
          Izinkan akses kamera di browser kamu, lalu coba lagi.
        </p>
        <div style="display: flex; gap: 10px; justify-content: center">
          <button
            class="btn-3d neo-btn"
            style="
              background: #ff4cb0;
              color: #000;
              font-size: 18px;
              padding: 10px 25px;
              outline: none;
            "
            @click="retryCamera"
          >
            🔄 COBA LAGI
          </button>
          <button
            class="btn-3d neo-btn"
            style="
              background: #111;
              color: #ffffff;
              font-size: 18px;
              padding: 10px 25px;
              outline: none;
            "
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
    <canvas ref="captureCanvas" style="display: none"></canvas>
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
  padding: 16px 20px;
  max-width: 480px;
  width: 95%;
}

.finish-title {
  font-size: 22px;
}

.finish-text {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.4px;
  margin-top: 4px;
  line-height: 1.4;
}

.finish-next {
  margin-top: 12px;
  background: #00e5ff;
  color: #000;
  font-size: 16px;
  padding: 10px 20px;
  border-radius: 6px;
  box-shadow: 4px 4px 0 #000;
  width: 140px;
}

.frame-preview {
  position: relative;
  width: 100%;
}

.retake-hotspot {
  position: absolute;
  border: none;
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

.camera-video-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3; /* Gunakan rasio landscape standar agar tidak terlalu memanjang ke bawah */
  overflow: hidden;
  border-radius: 2px;
  background: #000;
}

.camera-video-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.camera-close-btn {
  position: absolute;
  top: 24px;
  left: 24px;
  width: 64px;
  height: 64px;
  background: #ff4cb0;
  border: 4px solid #000;
  box-shadow: 6px 6px 0 #000;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  cursor: pointer;
}

.camera-close-icon {
  width: 40px;
  height: 40px;
  stroke: #000;
  stroke-width: 4;
}

.camera-title-container {
  text-align: center;
  margin-bottom: 18px;
}

.camera-title-badge {
  font-size: clamp(24px, 4vw, 40px);
  background: #ff4cb0;
  border: 4px solid #000;
  box-shadow: 6px 6px 0 #000;
  padding: 6px 16px;
  display: inline-block;
}

.camera-shutter-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  z-index: 3;
  pointer-events: none;
  padding-right: 32px;
}

.camera-shutter-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}

.camera-shutter-btn {
  width: 100px;
  height: 100px;
  background: #00e5ff;
  border-radius: 50%;
  border: 5px solid #000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 6px 6px 0 #000;
  cursor: pointer;
  outline: none;
}

.camera-shutter-icon {
  width: 48px;
  height: 48px;
  stroke: #000;
  stroke-width: 2.5;
}

.camera-content-wrapper {
  width: 100%;
  max-width: min(
    720px,
    90.6vh
  ); /* Diperbesar batasnya agar memanfaatkan ruang layar tinggi dengan maksimal tanpa offside di layar pendek */
  margin: 0 auto;
}

.camera-progress-container {
  width: 100%;
  margin-top: 18px;
}

@media (max-width: 991px) {
  .camera-video-container {
    aspect-ratio: 4 / 3;
    height: auto;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
  }

  .camera-close-btn {
    top: 8px;
    left: 8px;
    width: 42px;
    height: 42px;
    border-width: 3px;
    box-shadow: 3px 3px 0 #000;
  }

  .camera-close-icon {
    width: 24px;
    height: 24px;
    stroke-width: 3.5;
  }

  .camera-title-container {
    margin-bottom: 10px;
  }

  .camera-title-badge {
    font-size: 20px;
    border-width: 3px;
    box-shadow: 3px 3px 0 #000;
    padding: 4px 12px;
  }

  .camera-shutter-overlay {
    justify-content: center;
    padding-right: 0;
    bottom: 20px;
    top: auto;
    left: 50%;
    transform: translateX(-50%);
    width: auto;
    height: auto;
  }

  .camera-shutter-btn {
    width: 72px;
    height: 72px;
    border-width: 4px;
    box-shadow: 4px 4px 0 #000;
  }

  .camera-shutter-icon {
    width: 34px;
    height: 34px;
    stroke-width: 2;
  }

  .camera-content-wrapper {
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .camera-progress-container {
    width: 100%;
    margin-top: 12px;
  }
}
</style>
