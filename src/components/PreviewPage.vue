<script setup>
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { frameConfigs } from '../data/frames'

const props = defineProps({
  selectedFrame: {
    type: Object,
    required: true,
  },
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
})

const emit = defineEmits(['change-frame', 'retake', 'go-home'])

const canvasRef = ref(null)
const isUploading = ref(false)
const uploadProgressText = ref('')
const qrUrl = ref('')
const downloadLink = ref('')
const showQrModal = ref(false)
const uploadedPhotoUrlCache = ref('')
const uploadedGifUrlCache = ref('')
const uploadedHtmlUrlCache = ref('')
const isBackgroundUploading = ref(false)
const activeTab = ref('photo') // 'photo' or 'gif'
const isCombinedGenerating = ref(false)
const combinedGifUrl = ref('')
const isCompositeGenerating = ref(false)
const compositeGifUrl = ref('')
const isGifDownloadClicked = ref(false)
const isVideoGenerating = ref(false)
const videoProgress = ref(0)
const canvasWidth = ref(0)
const canvasHeight = ref(0)

const visibleButtons = ref({
  downloadPhoto: true,
  downloadVideo: true,
  qrCode: true,
  changeFrame: true,
  retake: true,
  goHome: true,
})

function updateCanvasSize() {
  const canvas = canvasRef.value
  if (canvas) {
    canvasWidth.value = canvas.clientWidth
    canvasHeight.value = canvas.clientHeight
  }
}

watch(activeTab, () => {
  nextTick(updateCanvasSize)
})

function drawStrip() {
  return new Promise((resolve) => {
    const canvas = canvasRef.value
    if (!canvas) return resolve()
    const ctx = canvas.getContext('2d')

    const layout = props.selectedFrame
    const isDefault = !!frameConfigs[layout.id]
    // 5x15 cm (600x1800px) untuk hasil strip asli
    const baseW = isDefault ? 600 : layout.frame?.width || 1200
    const baseH = isDefault ? 1800 : layout.frame?.height || 1800

    // We'll render two strips side-by-side: left = original order, right = shuffled order
    const spacing = 0 // no gap between strips
    canvas.width = baseW * 2 + spacing
    canvas.height = baseH
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const normalPhotos = [...props.photos]
    const rightOrder = [1, 3, 0, 2] // 2-4-1-3
    const shuffledPhotos = rightOrder.map((idx) => normalPhotos[idx]).filter((src) => !!src)

    const drawDefaultStrip = (photoArray, xOffset) => {
      const cfg = frameConfigs[layout.id]
      ctx.fillStyle = cfg.bg
      ctx.fillRect(xOffset, 0, baseW, baseH)

      ctx.fillStyle = cfg.headerBg
      ctx.fillRect(xOffset, 0, baseW, 200)
      ctx.fillStyle = cfg.headerText
      ctx.font = 'bold 50px Bangers'
      ctx.textAlign = 'center'
      ctx.fillText(`✦ ${layout.name} ✦`, xOffset + baseW / 2, 125)

      ctx.fillStyle = cfg.footerBg
      ctx.fillRect(xOffset, baseH - 100, baseW, 100)

      ctx.strokeStyle = cfg.border
      ctx.lineWidth = 20
      ctx.strokeRect(xOffset + 10, 10, baseW - 20, baseH - 20)

      const pw = baseW - 80
      const ph = (baseH - 420) / 4
      const startY = 240
      const gap = 20

      const promises = []
      photoArray.forEach((src, idx) => {
        if (!src) return
        promises.push(
          new Promise((res) => {
            const img = new Image()
            img.onload = () => {
              const y = startY + idx * (ph + gap)
              const iw = img.width,
                ih = img.height
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
              ctx.drawImage(img, sx, sy, sw, sh, xOffset + 40, y, pw, ph)
              ctx.strokeStyle = '#000'
              ctx.lineWidth = 4
              ctx.strokeRect(xOffset + 40, y, pw, ph)
              res()
            }
            img.onerror = res
            img.src = src
          }),
        )
      })
      return Promise.all(promises)
    }

    const drawCustomStrip = (photoArray, xOffset, frameImg) => {
      const order = layout.layerOrder || ['box-1', 'box-2', 'box-3', 'box-4', 'frame']
      const promises = []
      order.forEach((layerId) => {
        if (layerId === 'frame') {
          if (frameImg && frameImg.complete) {
            ctx.drawImage(frameImg, xOffset, 0, baseW, baseH)
          }
          return
        }

        const boxId = parseInt(layerId.split('-')[1], 10)
        const box = layout.boxes.find((b) => b.id === boxId)
        const src = photoArray[boxId - 1]
        if (!box || !src) return

        promises.push(
          new Promise((res) => {
            const img = new Image()
            img.onload = () => {
              const iw = img.width,
                ih = img.height
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
              ctx.drawImage(img, sx, sy, sw, sh, xOffset + box.x, box.y, box.width, box.height)
              if (
                frameImg &&
                order.indexOf('frame') > order.indexOf(layerId) &&
                frameImg.complete
              ) {
                ctx.drawImage(frameImg, xOffset, 0, baseW, baseH)
              }
              res()
            }
            img.onerror = res
            img.src = src
          }),
        )
      })
      return Promise.all(promises)
    }

    if (isDefault) {
      Promise.all([
        drawDefaultStrip(normalPhotos, 0),
        drawDefaultStrip(shuffledPhotos, baseW + spacing),
      ]).then(() => resolve())
    } else {
      // --- DRAW CUSTOM LAYOUT ---
      const frameImg = new Image()
      frameImg.crossOrigin = 'anonymous'
      const drawAll = () => {
        Promise.all([
          drawCustomStrip(normalPhotos, 0, frameImg),
          drawCustomStrip(shuffledPhotos, baseW + spacing, frameImg),
        ]).then(() => resolve())
      }
      if (layout.frameUrl) {
        frameImg.onload = drawAll
        frameImg.onerror = () => {
          drawAll()
        }
        frameImg.src = layout.frameUrl
      } else {
        drawAll()
      }
    }
  })
}

function downloadImage() {
  const canvas = canvasRef.value
  const link = document.createElement('a')
  link.download = `potobox-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

async function uploadToLitterbox(file, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const formData = new FormData()
      formData.append('reqtype', 'fileupload')
      formData.append('time', '12h')
      formData.append('fileToUpload', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const text = await res.text()
      if (text.startsWith('http')) {
        return text
      } else {
        throw new Error(text || 'Upload failed')
      }
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1500)); // wait 1.5s before retry
    }
  }
}

async function startBackgroundUpload() {
  if (isBackgroundUploading.value || uploadedHtmlUrlCache.value) return
  isBackgroundUploading.value = true
  uploadProgressText.value = 'MEMPROSES FOTO...'

  try {
    const canvas = canvasRef.value
    if (!canvas) throw new Error('Canvas foto tidak ditemukan')

    // === PIPELINE STRATEGY (Tablet-safe & Fast) ===
    // Step 1: Generate photo blob FIRST (instant, <100ms)
    const photoBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.80))
    const photoFile = new File([photoBlob], 'photo.jpg', { type: 'image/jpeg' })

    // Step 2: Start photo upload AND video compilation AT THE SAME TIME
    //   - Photo upload = network I/O (low CPU/RAM)
    //   - Video compile = CPU work (no extra network)
    //   These don't compete for the same resource, so it's tablet-safe!
    uploadProgressText.value = 'MENGUNGGAH FOTO & MEMBUAT VIDEO...'
    const [photoUrl, videoData] = await Promise.all([
      uploadToLitterbox(photoFile),
      compileCompositeVideo()
    ])
    uploadedPhotoUrlCache.value = photoUrl

    // Step 3: Photo upload is done, now upload the video
    uploadProgressText.value = 'MENGUNGGAH VIDEO...'
    const videoFile = new File([videoData.blob], `live.${videoData.fileExt}`, {
      type: videoData.blob.type,
    })
    const videoUrl = await uploadToLitterbox(videoFile)
    uploadedGifUrlCache.value = videoUrl

    // Step 4: Build & upload the HTML download page
    uploadProgressText.value = 'MENYIAPKAN HALAMAN UNDUHAN...'
    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MOMENTBOX - Hasil Foto Kamu ✦</title>
  <link href="https://fonts.googleapis.com/css2?family=Bangers&family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #f6f1e9;
      font-family: 'Plus Jakarta Sans', sans-serif;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
      color: #000;
    }
    .container {
      max-width: 600px;
      width: 100%;
      text-align: center;
    }
    h1 {
      font-family: 'Bangers', cursive;
      font-size: 42px;
      color: #ff4cb0;
      text-shadow: 3px 3px 0 #000;
      margin: 10px 0;
      letter-spacing: 2px;
      -webkit-text-stroke: 1.5px #000;
    }
    .subtitle {
      font-weight: 800;
      font-size: 14px;
      background: #ffd400;
      border: 3px solid #000;
      padding: 6px 12px;
      display: inline-block;
      box-shadow: 4px 4px 0 #000;
      margin-bottom: 30px;
    }
    .preview-section {
      display: flex;
      flex-direction: column;
      gap: 30px;
      margin-bottom: 40px;
      width: 100%;
    }
    .card {
      background: #fff;
      border: 4px solid #000;
      box-shadow: 8px 8px 0 #000;
      padding: 20px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card h2 {
      font-family: 'Bangers', cursive;
      font-size: 28px;
      color: #000;
      margin: 0 0 15px;
      letter-spacing: 1px;
    }
    .image-container {
      width: 100%;
      max-width: 450px;
      border: 4px solid #000;
      background: #eee;
      margin-bottom: 20px;
      overflow: hidden;
      display: flex;
      justify-content: center;
    }
    .image-container img, .image-container video {
      width: 100%;
      height: auto;
      display: block;
    }
    .btn-download {
      font-family: 'Bangers', cursive;
      font-size: 20px;
      color: #000;
      text-decoration: none;
      background: #00e5ff;
      border: 4px solid #000;
      box-shadow: 5px 5px 0 #000;
      padding: 12px 30px;
      cursor: pointer;
      display: inline-block;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .btn-download:active {
      transform: translate(2px, 2px);
      box-shadow: 3px 3px 0 #000;
    }
    .btn-gif {
      background: #ff4cb0;
      color: #fff;
    }
    .footer {
      font-size: 11px;
      color: #777;
      font-weight: 700;
      margin-top: 20px;
      border-top: 2px dashed #ccc;
      padding-top: 15px;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✦ MOMENTBOX ✦</h1>
    <div class="subtitle">HASIL PHOTOBOOTH KAMU</div>

    <div class="preview-section">
      <!-- STATIC PHOTO CARD -->
      <div class="card">
        <h2>PHOTO STRIP</h2>
        <div class="image-container">
          <img src="${uploadedPhotoUrlCache.value}" alt="Photo Strip">
        </div>
        <a href="${uploadedPhotoUrlCache.value}" download="momentbox-photo.png" class="btn-download">DOWNLOAD FOTO</a>
      </div>

      <!-- LIVE VIDEO CARD -->
      <div class="card">
        <h2>LIVE VIDEO</h2>
        <div class="image-container">
          <video src="${uploadedGifUrlCache.value}" autoplay loop muted playsinline></video>
        </div>
        <a href="${uploadedGifUrlCache.value}" download="momentbox-live.${videoData.fileExt}" class="btn-download btn-gif">DOWNLOAD VIDEO</a>
      </div>
    </div>

    <div class="footer">
      *Link ini akan otomatis kedaluwarsa dan terhapus dalam 24 jam.
    </div>
  </div>
</body>
</html>`

    const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
    const htmlFile = new File([htmlBlob], 'momentbox.html', { type: 'text/html' })
    uploadedHtmlUrlCache.value = await uploadToLitterbox(htmlFile)

    uploadProgressText.value = 'SIAP!'
    if (showQrModal.value && !qrUrl.value) {
      downloadLink.value = uploadedHtmlUrlCache.value
      qrUrl.value = `/api/qr?size=450x450&data=${encodeURIComponent(uploadedHtmlUrlCache.value)}`
    }
  } catch (err) {
    console.error('Background upload error:', err)
    uploadProgressText.value = 'Gagal mengunggah: ' + err.message
  } finally {
    isBackgroundUploading.value = false
  }
}

async function generateUnifiedQrCode() {
  showQrModal.value = true
  if (uploadedHtmlUrlCache.value) {
    downloadLink.value = uploadedHtmlUrlCache.value
    qrUrl.value = `/api/qr?size=450x450&data=${encodeURIComponent(uploadedHtmlUrlCache.value)}`
  } else {
    qrUrl.value = ''
    if (!isBackgroundUploading.value) {
      startBackgroundUpload()
    }
  }
}

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
    const pw = baseW - 80
    const ph = (baseH - 420) / 4
    const startY = 240
    const gap = 20
    return Array.from({ length: 4 }, (_, idx) => ({
      id: idx + 1,
      x: 40,
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

function downloadIndividualGif(idx) {
  const gifDataUrl = props.gifs[idx]
  if (!gifDataUrl || gifDataUrl === 'loading') return
  const link = document.createElement('a')
  link.download = `potobox-gif-${idx + 1}-${Date.now()}.gif`
  link.href = gifDataUrl
  link.click()
}

function downloadAllGifs() {
  props.gifs.forEach((gifDataUrl, idx) => {
    if (gifDataUrl && gifDataUrl !== 'loading') {
      setTimeout(() => {
        const link = document.createElement('a')
        link.download = `potobox-gif-${idx + 1}-${Date.now()}.gif`
        link.href = gifDataUrl
        link.click()
      }, idx * 200)
    }
  })
}

function downloadCombinedGif() {
  if (isCombinedGenerating.value) return

  if (combinedGifUrl.value) {
    const link = document.createElement('a')
    link.download = `potobox-combined-${Date.now()}.gif`
    link.href = combinedGifUrl.value
    link.click()
    return
  }

  const gifshotLib = window.gifshot
  if (!gifshotLib) {
    alert('Library GIF belum siap.')
    return
  }

  isCombinedGenerating.value = true

  const img = new Image()
  img.onload = () => {
    const targetW = 400
    const targetH = img.naturalWidth
      ? Math.round((img.naturalHeight / img.naturalWidth) * targetW)
      : 300

    gifshotLib.createGIF(
      {
        images: props.photos,
        gifWidth: targetW,
        gifHeight: targetH,
        interval: 0.8, // 800ms per image
        numFrames: props.photos.length,
        frameDuration: 8,
        sampleInterval: 10,
      },
      (obj) => {
        isCombinedGenerating.value = false
        if (!obj.error) {
          combinedGifUrl.value = obj.image
          const link = document.createElement('a')
          link.download = `potobox-combined-${Date.now()}.gif`
          link.href = obj.image
          link.click()
        } else {
          alert('Gagal membuat combined GIF.')
        }
      },
    )
  }
  img.src = props.photos[0] || ''
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })

let compileVideoPromise = null

function compileCompositeVideo() {
  if (compileVideoPromise) {
    return compileVideoPromise
  }

  compileVideoPromise = new Promise(async (resolve, reject) => {
    isVideoGenerating.value = true
    videoProgress.value = 0

    try {
      const layout = props.selectedFrame
      const isDefault = !!frameConfigs[layout.id]
      const baseW = isDefault ? 600 : layout.frame?.width || 1200
      const baseH = isDefault ? 1800 : layout.frame?.height || 1800
      const spacing = 0
      const fullW = baseW * 2 + spacing
      const fullH = baseH
      const scale = 0.4
      const outW = Math.round(fullW * scale)
      const outH = Math.round(fullH * scale)

      const frameCounts = (props.capturedFrames || []).map((arr) => (arr ? arr.length : 0))
      const validFrameCounts = frameCounts.filter((c) => c > 0)
      const numFrames = validFrameCounts.length > 0 ? Math.min(...validFrameCounts) : 12

      let customFrameImg = null
      if (!isDefault && layout.frameUrl) {
        customFrameImg = await loadImage(layout.frameUrl)
      }

      // Render all unique frames first
      const uniqueFrameDataURLs = []
      for (let i = 0; i < numFrames; i++) {
        videoProgress.value = Math.round((i / numFrames) * 30)
        const offscreen = document.createElement('canvas')
        offscreen.width = outW
        offscreen.height = outH
        const ctx = offscreen.getContext('2d')
        ctx.scale(scale, scale)

        if (isDefault) {
          const cfg = frameConfigs[layout.id]
          ctx.fillStyle = cfg.bg
          ctx.fillRect(0, 0, baseW, baseH)
          ctx.fillRect(baseW, 0, baseW, baseH)
          ctx.fillStyle = cfg.headerBg
          ctx.fillRect(0, 0, baseW, 200)
          ctx.fillRect(baseW, 0, baseW, 200)
          ctx.fillStyle = cfg.footerBg
          ctx.fillRect(0, baseH - 100, baseW, 100)
          ctx.fillRect(baseW, baseH - 100, baseW, 100)
        } else {
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, fullW, fullH)
        }

        const leftOrder = [0, 1, 2, 3]
        const rightOrder = [1, 3, 0, 2]

        const drawStripSlots = async (order, xOffset) => {
          if (isDefault) {
            const cfg = frameConfigs[layout.id]
            const pw = baseW - 80
            const ph = (baseH - 420) / 4
            const startY = 240
            const gap = 20
            for (let idx = 0; idx < order.length; idx++) {
              const photoIdx = order[idx]
              const frameArr = props.capturedFrames ? props.capturedFrames[photoIdx] : null
              const src = frameArr && frameArr[i] ? frameArr[i] : props.photos[photoIdx]
              if (!src) continue
              const img = await loadImage(src)
              const y = startY + idx * (ph + gap)
              const iw = img.width,
                ih = img.height
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
              ctx.drawImage(img, sx, sy, sw, sh, xOffset + 40, y, pw, ph)
              ctx.strokeStyle = '#000'
              ctx.lineWidth = 4
              ctx.strokeRect(xOffset + 40, y, pw, ph)
            }
          } else {
            const orderConfig = layout.layerOrder || ['box-1', 'box-2', 'box-3', 'box-4', 'frame']
            for (const layerId of orderConfig) {
              if (layerId === 'frame') {
                if (customFrameImg) ctx.drawImage(customFrameImg, xOffset, 0, baseW, baseH)
                continue
              }
              const boxId = parseInt(layerId.split('-')[1], 10)
              const box = layout.boxes.find((b) => b.id === boxId)
              if (!box) continue
              const photoIdx = order[boxId - 1]
              const frameArr = props.capturedFrames ? props.capturedFrames[photoIdx] : null
              const src = frameArr && frameArr[i] ? frameArr[i] : props.photos[photoIdx]
              if (!src) continue
              const img = await loadImage(src)
              const iw = img.width,
                ih = img.height
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
              ctx.drawImage(img, sx, sy, sw, sh, xOffset + box.x, box.y, box.width, box.height)
              if (customFrameImg && orderConfig.indexOf('frame') > orderConfig.indexOf(layerId)) {
                ctx.drawImage(customFrameImg, xOffset, 0, baseW, baseH)
              }
            }
          }
        }

        await drawStripSlots(leftOrder, 0)
        await drawStripSlots(rightOrder, baseW)

        if (isDefault) {
          const cfg = frameConfigs[layout.id]
          ctx.fillStyle = cfg.headerText
          ctx.font = 'bold 50px Bangers'
          ctx.textAlign = 'center'
          ctx.fillText(`✦ ${layout.name} ✦`, baseW / 2, 125)
          ctx.fillText(`✦ ${layout.name} ✦`, baseW + baseW / 2, 125)
          ctx.strokeStyle = cfg.border
          ctx.lineWidth = 20
          ctx.strokeRect(10, 10, baseW - 20, baseH - 20)
          ctx.strokeRect(baseW + 10, 10, baseW - 20, baseH - 20)
        }

        uniqueFrameDataURLs.push(offscreen.toDataURL('image/jpeg', 0.75))
      }

      videoProgress.value = 35

      // Preload all frame images
      const frameImages = []
      for (const dataUrl of uniqueFrameDataURLs) {
        frameImages.push(await loadImage(dataUrl))
      }

      // Repeat frames 2x for shorter video (smaller file, faster upload)
      const repeatedFrames = []
      for (let r = 0; r < 2; r++) {
        repeatedFrames.push(...frameImages)
      }

      videoProgress.value = 40

      // Check if MediaRecorder + captureStream are supported
      const supportsMediaRecorder = typeof MediaRecorder !== 'undefined'
      const supportsCapture =
        typeof HTMLCanvasElement.prototype.captureStream === 'function' ||
        typeof HTMLCanvasElement.prototype.mozCaptureStream === 'function'

      // Try video recording path
      if (supportsMediaRecorder && supportsCapture) {
        try {
          // Create video canvas and record with MediaRecorder
          const videoCanvas = document.createElement('canvas')
          videoCanvas.width = outW
          videoCanvas.height = outH
          const videoCtx = videoCanvas.getContext('2d')

          // Pick best supported MIME type — prioritise mp4 for mobile / IG Story compatibility
          const mimeTypes = [
            'video/mp4;codecs=avc1',
            'video/mp4;codecs=h264',
            'video/mp4',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
          ]
          let chosenMime = ''
          for (const mime of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mime)) {
              chosenMime = mime
              break
            }
          }

          if (!chosenMime) {
            throw new Error('No supported MIME type for MediaRecorder')
          }

          const isMP4 = chosenMime.includes('mp4')
          const fileExt = isMP4 ? 'mp4' : 'webm'
          const fps = 10
          const frameDurationMs = 1000 / fps

          const captureStreamFn =
            videoCanvas.captureStream?.bind(videoCanvas) ||
            videoCanvas.mozCaptureStream?.bind(videoCanvas)
          const stream = captureStreamFn(fps)
          const recorder = new MediaRecorder(stream, {
            mimeType: chosenMime,
            videoBitsPerSecond: 1_200_000,
          })

          const chunks = []
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data)
          }

          await new Promise((res, rej) => {
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: chosenMime })
              compileVideoPromise = null
              resolve({ blob, fileExt })
              res()
            }
            recorder.onerror = (e) => {
              rej(e)
            }

            recorder.start()

            let frameIdx = 0
            const totalFrames = repeatedFrames.length

            const drawNext = () => {
              if (frameIdx >= totalFrames) {
                setTimeout(() => recorder.stop(), 200)
                return
              }
              videoCtx.clearRect(0, 0, outW, outH)
              videoCtx.drawImage(repeatedFrames[frameIdx], 0, 0, outW, outH)
              videoProgress.value = 40 + Math.round((frameIdx / totalFrames) * 55)
              frameIdx++
              setTimeout(drawNext, frameDurationMs)
            }

            drawNext()
          })

          return // success via video path
        } catch (videoErr) {
          console.warn('MediaRecorder path failed, falling back to GIF:', videoErr)
          // Fall through to GIF fallback
        }
      }

      // ---- GIF Fallback (for Samsung Browser / Android 10 and other incompatible devices) ----
      videoProgress.value = 45
      const gifshotLib = window.gifshot
      if (!gifshotLib) {
        throw new Error(
          'Perangkat ini tidak mendukung pembuatan video dan library GIF tidak tersedia.',
        )
      }

      // Sample frames evenly – keep max 20 for GIF to avoid OOM
      const MAX_GIF_FRAMES = 20
      const step = Math.max(1, Math.floor(uniqueFrameDataURLs.length / MAX_GIF_FRAMES))
      const gifFrames = uniqueFrameDataURLs
        .filter((_, i) => i % step === 0)
        .slice(0, MAX_GIF_FRAMES)

      videoProgress.value = 50

      await new Promise((res, rej) => {
        gifshotLib.createGIF(
          {
            images: gifFrames,
            gifWidth: outW,
            gifHeight: outH,
            interval: 0.12,
            numFrames: gifFrames.length,
            frameDuration: 1,
            sampleInterval: 15,
          },
          (obj) => {
            videoProgress.value = 95
            if (!obj.error && obj.image) {
              // Convert base64 GIF to blob
              const blob = dataURLtoBlob(obj.image)
              compileVideoPromise = null
              resolve({ blob, fileExt: 'gif' })
              res()
            } else {
              rej(new Error(obj.error || 'GIF creation failed'))
            }
          },
        )
      })
    } catch (err) {
      compileVideoPromise = null
      reject(err)
    } finally {
      isVideoGenerating.value = false
    }
  })

  return compileVideoPromise
}

async function downloadCompositeVideo() {
  try {
    const videoData = await compileCompositeVideo()
    videoProgress.value = 98

    // Download the video
    const url = URL.createObjectURL(videoData.blob)
    const link = document.createElement('a')
    link.download = `momentbox-story-${Date.now()}.${videoData.fileExt}`
    link.href = url
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)

    videoProgress.value = 100
  } catch (err) {
    console.error('Video generation error:', err)
    alert('Gagal membuat video: ' + err.message)
  } finally {
    videoProgress.value = 0
  }
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

onMounted(() => {
  const savedButtons = localStorage.getItem('photobooth_preview_buttons')
  if (savedButtons) {
    try {
      const parsed = JSON.parse(savedButtons)
      visibleButtons.value = { ...visibleButtons.value, ...parsed }
    } catch (e) {
      console.error('Failed to parse preview buttons settings', e)
    }
  }
  setTimeout(async () => {
    await drawStrip()
    // Allow small delay for canvas DOM width/height rendering
    setTimeout(() => {
      updateCanvasSize()
      startBackgroundUpload()
    }, 50)
  }, 500)
  window.addEventListener('resize', updateCanvasSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
})
</script>

<template>
  <div class="checkerboard preview-layout">
    <!-- LEFT SIDE: PREVIEW PANEL -->
    <div class="preview-left">
      <!-- Shared Wrapper for both Photo and GIF strip to guarantee identical sizing -->
      <div
        :style="{
          aspectRatio: previewBase.baseW * 2 + '/' + previewBase.baseH,
        }"
        class="preview-strip-wrapper"
      >
        <!-- Canvas for Static Photo -->
        <canvas
          v-show="activeTab === 'photo'"
          ref="canvasRef"
          style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: block;
            box-sizing: border-box;
          "
        ></canvas>

        <div
          v-if="activeTab === 'gif'"
          style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            gap: 0px;
            box-sizing: border-box;
            overflow: hidden;
          "
        >
          <!-- Left Strip (Normal Order) -->
          <div
            style="
              flex: 1;
              height: 100%;
              position: relative;
              container-type: inline-size;
              box-sizing: border-box;
            "
          >
            <div
              class="live-strip"
              :style="{
                position: 'relative',
                width: '100%',
                height: '100%',
                background: previewBase.isDefault ? frameConfigs[selectedFrame.id]?.bg : '#fff',
                border: previewBase.isDefault
                  ? `calc((20 / ${previewBase.baseW}) * 100%) solid ${frameConfigs[selectedFrame.id]?.border}`
                  : 'none',
                boxSizing: 'border-box',
              }"
            >
              <!-- Header and Footer for Default layout -->
              <template v-if="previewBase.isDefault">
                <div
                  :style="{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: (200 / previewBase.baseH) * 100 + '%',
                    background: frameConfigs[selectedFrame.id]?.headerBg,
                    color: frameConfigs[selectedFrame.id]?.headerText,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Bangers, cursive',
                    fontSize: '4.5cqw',
                    fontWeight: 'bold',
                  }"
                >
                  ✦ {{ selectedFrame.name }} ✦
                </div>
                <div
                  :style="{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: (100 / previewBase.baseH) * 100 + '%',
                    background: frameConfigs[selectedFrame.id]?.footerBg,
                  }"
                ></div>
              </template>

              <!-- Custom overlay frame image -->
              <img
                v-if="!previewBase.isDefault && selectedFrame.frameUrl"
                :src="selectedFrame.frameUrl"
                style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  z-index: 10;
                  pointer-events: none;
                "
              />

              <!-- Boxes -->
              <div
                v-for="(box, idx) in previewBoxes"
                :key="box.id"
                :style="{
                  position: 'absolute',
                  left: (box.x / previewBase.baseW) * 100 + '%',
                  top: (box.y / previewBase.baseH) * 100 + '%',
                  width: (box.width / previewBase.baseW) * 100 + '%',
                  height: (box.height / previewBase.baseH) * 100 + '%',
                  overflow: 'hidden',
                  border: previewBase.isDefault ? '2px solid #000' : 'none',
                  background: '#222',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }"
              >
                <div v-if="gifs[idx] === 'loading'" class="gif-loader-container">
                  <div class="gif-spinner"></div>
                </div>
                <img
                  v-else-if="gifs[idx]"
                  :src="gifs[idx]"
                  style="width: 100%; height: 100%; object-fit: cover"
                />
                <img
                  v-else-if="photos[idx]"
                  :src="photos[idx]"
                  style="width: 100%; height: 100%; object-fit: cover"
                />
              </div>
            </div>
          </div>

          <!-- Right Strip (Shuffled Order) -->
          <div
            style="
              flex: 1;
              height: 100%;
              position: relative;
              container-type: inline-size;
              box-sizing: border-box;
            "
          >
            <div
              class="live-strip"
              :style="{
                position: 'relative',
                width: '100%',
                height: '100%',
                background: previewBase.isDefault ? frameConfigs[selectedFrame.id]?.bg : '#fff',
                border: previewBase.isDefault
                  ? `calc((20 / ${previewBase.baseW}) * 100%) solid ${frameConfigs[selectedFrame.id]?.border}`
                  : 'none',
                boxSizing: 'border-box',
              }"
            >
              <!-- Header and Footer for Default layout -->
              <template v-if="previewBase.isDefault">
                <div
                  :style="{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: (200 / previewBase.baseH) * 100 + '%',
                    background: frameConfigs[selectedFrame.id]?.headerBg,
                    color: frameConfigs[selectedFrame.id]?.headerText,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Bangers, cursive',
                    fontSize: '4.5cqw',
                    fontWeight: 'bold',
                  }"
                >
                  ✦ {{ selectedFrame.name }} ✦
                </div>
                <div
                  :style="{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: (100 / previewBase.baseH) * 100 + '%',
                    background: frameConfigs[selectedFrame.id]?.footerBg,
                  }"
                ></div>
              </template>

              <!-- Custom overlay frame image -->
              <img
                v-if="!previewBase.isDefault && selectedFrame.frameUrl"
                :src="selectedFrame.frameUrl"
                style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  z-index: 10;
                  pointer-events: none;
                "
              />

              <!-- Boxes -->
              <div
                v-for="(box, idx) in previewBoxes"
                :key="box.id"
                :style="{
                  position: 'absolute',
                  left: (box.x / previewBase.baseW) * 100 + '%',
                  top: (box.y / previewBase.baseH) * 100 + '%',
                  width: (box.width / previewBase.baseW) * 100 + '%',
                  height: (box.height / previewBase.baseH) * 100 + '%',
                  overflow: 'hidden',
                  border: previewBase.isDefault ? '2px solid #000' : 'none',
                  background: '#222',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }"
              >
                <div v-if="gifs[[1, 3, 0, 2][idx]] === 'loading'" class="gif-loader-container">
                  <div class="gif-spinner"></div>
                </div>
                <img
                  v-else-if="gifs[[1, 3, 0, 2][idx]]"
                  :src="gifs[[1, 3, 0, 2][idx]]"
                  style="width: 100%; height: 100%; object-fit: cover"
                />
                <img
                  v-else-if="photos[[1, 3, 0, 2][idx]]"
                  :src="photos[[1, 3, 0, 2][idx]]"
                  style="width: 100%; height: 100%; object-fit: cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT SIDE: CONTROL PANEL -->
    <div class="preview-controls">
      <header style="text-align: center; margin-bottom: 6px">
        <h1 class="neo-title preview-main-title">FOTO STRIP KAMU</h1>
        <div class="neo-chip" style="background: #ffd400; font-size: 13px; font-weight: 900">
          FRAME: {{ selectedFrame.name }}
        </div>
      </header>

      <!-- TAB CONTROLLER -->
      <div class="preview-tabs">
        <button
          @click="activeTab = 'photo'"
          :style="{ background: activeTab === 'photo' ? '#00e5ff' : '#fff' }"
          class="preview-tab-btn"
        >
          PHOTO STRIP
        </button>
        <button
          @click="activeTab = 'gif'"
          :style="{ background: activeTab === 'gif' ? '#00e5ff' : '#fff' }"
          class="preview-tab-btn preview-tab-btn-right"
        >
          LIVE GIFS
        </button>
      </div>

      <!-- ACTION BUTTONS -->
      <div style="display: flex; flex-direction: column; gap: 10px">
        <button
          v-if="visibleButtons.downloadPhoto"
          class="btn-3d neo-btn preview-action-btn"
          style="background: #00e5ff"
          @click="downloadImage"
        >
          DOWNLOAD FOTO
        </button>

        <button
          v-if="visibleButtons.downloadVideo"
          class="btn-3d neo-btn preview-action-btn"
          style="background: #a855f7; color: white"
          :disabled="isVideoGenerating"
          @click="downloadCompositeVideo"
        >
          {{
            isVideoGenerating ? `MEREKAM VIDEO... ${videoProgress}%` : 'DOWNLOAD VIDEO (MP4/STORY)'
          }}
        </button>

        <button
          v-if="visibleButtons.qrCode"
          class="btn-3d neo-btn preview-action-btn"
          style="background: #ffd400"
          :disabled="isUploading"
          @click="generateUnifiedQrCode"
        >
          {{ isUploading ? 'MENGUNGGAH...' : 'SIMPAN FOTO' }}
        </button>
      </div>

      <!-- COMMON BUTTONS -->
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: -3px">
        <button
          v-if="visibleButtons.changeFrame"
          class="btn-3d neo-btn preview-action-btn"
          style="background: #a855f7; color: white"
          @click="emit('change-frame')"
        >
          UBAH FRAME
        </button>
        <button
          v-if="visibleButtons.retake"
          class="btn-3d neo-btn preview-action-btn"
          style="background: #ff4cb0; color: white"
          @click="emit('retake')"
        >
          FOTO ULANG
        </button>
        <button
          v-if="visibleButtons.goHome"
          class="btn-3d neo-btn preview-action-btn"
          style="background: #fff; color: #000; border: 4px solid #000"
          @click="emit('go-home')"
        >
          BERANDA
        </button>
      </div>
    </div>

    <!-- QR Modal -->
    <div v-if="showQrModal" class="qr-modal-overlay">
      <div class="neo-block bounce-in qr-modal-card">
        <button
          @click="showQrModal = false"
          style="
            position: absolute;
            top: 15px;
            right: 15px;
            background: none;
            border: none;
            font-size: 30px;
            cursor: pointer;
            font-weight: 900;
          "
        >
          ✕
        </button>
        <h2 class="neo-title" style="font-size: 32px; margin-bottom: 20px">UNDUH FOTO DISINI</h2>
        <div class="qr-code-container">
          <div
            v-if="!qrUrl"
            style="display: flex; flex-direction: column; align-items: center; gap: 15px"
          >
            <div
              style="
                width: 50px;
                height: 50px;
                border: 6px solid #ff4cb0;
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              "
            ></div>
            <p style="font-weight: 800; font-size: 14px; color: #000">
              {{ uploadProgressText || 'MENGUNGGAH...' }}
            </p>
          </div>
          <img v-else :src="qrUrl" style="width: 90%; height: 90%; image-rendering: pixelated" />
        </div>
        <div
          style="
            margin-top: 25px;
            font-size: 11px;
            color: #888;
            font-weight: 700;
            border-top: 2px dashed #eee;
            padding-top: 15px;
          "
        >
          *Link foto akan otomatis terhapus dalam 24 jam.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes bounceIn {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  60% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.bounce-in {
  animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.gif-loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #222;
}

.gif-spinner {
  width: 32px;
  height: 32px;
  border: 4px solid #ff4cb0;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* ===== LAYOUT ===== */
.preview-layout {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  box-sizing: border-box;
}

.preview-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  position: relative;
  max-height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.preview-strip-wrapper {
  height: 100%;
  width: auto;
  max-width: 100%;
  max-height: 100%;
  background: #fff;
  box-shadow: 10px 10px 0 #000;
  border: 4px solid #000;
  box-sizing: border-box;
  position: relative;
}

.preview-controls {
  width: 100%;
  max-width: 400px;
  background: #f6f1e9;
  border-left: 6px solid #000;
  padding: 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
  z-index: 10;
  overflow-y: auto;
  max-height: 100vh;
  box-sizing: border-box;
}

.preview-main-title {
  font-size: 48px;
  color: #ff4cb0;
  text-shadow: 4px 4px 0 #000;
  margin-bottom: 10px;
  line-height: 0.9;
}

.preview-tabs {
  display: flex;
  border: 4px solid #000;
  margin-bottom: 10px;
  background: #fff;
  box-shadow: 4px 4px 0 #000;
  flex-shrink: 0;
}

.preview-tab-btn {
  flex: 1;
  padding: 12px;
  font-family: 'Bangers', cursive;
  font-size: 20px;
  border: none;
  cursor: pointer;
  outline: none;
  transition: background 0.2s;
}

.preview-tab-btn-right {
  border-left: 4px solid #000;
}

.preview-action-btn {
  padding: 18px;
  font-size: 20px;
}

.qr-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.qr-modal-card {
  background: white;
  padding: 40px;
  text-align: center;
  max-width: 450px;
  width: 90%;
  position: relative;
}

.qr-code-container {
  width: 350px;
  height: 350px;
  background: #fff;
  margin: 0 auto;
  border: 4px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 10px 10px 0 #000;
}

/* ===== MOBILE ===== */
@media (max-width: 991px) {
  .preview-layout {
    flex-direction: column;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .preview-left {
    padding: 12px 16px 8px;
    max-height: none;
    flex: none;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .preview-strip-wrapper {
    /* Gunakan tinggi eksplisit agar aspect-ratio berfungsi dan tidak collapse ke 0 */
    height: 45vh;
    width: auto;
    max-width: 100%;
    /* Biarkan aspect ratio menentukan lebar */
    margin: 0 auto;
    box-shadow: 4px 4px 0 #000;
    border-width: 3px;
  }

  .preview-controls {
    width: 100%;
    max-width: none; /* Override max-width desktop agar memenuhi lebar iPad/tablet */
    border-left: none;
    border-top: 4px solid #000;
    padding: 14px 16px 20px;
    max-height: none;
    gap: 10px;
    box-shadow: none;
    flex-shrink: 0;
  }

  .preview-main-title {
    font-size: 26px;
    text-shadow: 2px 2px 0 #000;
    margin-bottom: 4px;
  }

  .preview-tabs {
    border-width: 3px;
    box-shadow: 3px 3px 0 #000;
    margin-bottom: 8px;
  }

  .preview-tab-btn {
    padding: 9px 8px;
    font-size: 15px;
  }

  .preview-tab-btn-right {
    border-left-width: 3px;
  }

  .preview-action-btn {
    padding: 12px;
    font-size: 15px;
  }

  .qr-modal-card {
    padding: 24px 16px;
    max-width: 92vw;
  }

  .qr-modal-card h2 {
    font-size: 24px !important;
  }

  .qr-code-container {
    width: 220px;
    height: 220px;
    box-shadow: 6px 6px 0 #000;
  }
}
</style>
