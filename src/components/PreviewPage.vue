<script setup>
import { onMounted, ref } from 'vue';
import { frameConfigs } from '../data/frames';

const props = defineProps({
  selectedFrame: {
    type: Object,
    required: true,
  },
  photos: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['change-frame', 'retake', 'go-home']);

const canvasRef = ref(null);
const isUploading = ref(false);
const qrUrl = ref('');
const downloadLink = ref('');
const showQrModal = ref(false);

function drawStrip() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const layout = props.selectedFrame;
  const isDefault = !!frameConfigs[layout.id];
  // 5x15 cm (600x1800px) untuk hasil strip asli
  const baseW = isDefault ? 600 : (layout.frame?.width || 1200);
  const baseH = isDefault ? 1800 : (layout.frame?.height || 1800);

  canvas.width = baseW;
  canvas.height = baseH;
  ctx.clearRect(0, 0, baseW, baseH);

  if (isDefault) {
    // --- DRAW DEFAULT THEME (5x15 cm) ---
    const cfg = frameConfigs[layout.id];
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, baseW, baseH);

    ctx.fillStyle = cfg.headerBg;
    ctx.fillRect(0, 0, baseW, 200);
    ctx.fillStyle = cfg.headerText;
    ctx.font = 'bold 50px Bangers'; // Ukuran font disesuaikan karena lebih ramping
    ctx.textAlign = 'center';
    ctx.fillText(`✦ ${layout.name} ✦`, baseW / 2, 125);

    ctx.fillStyle = cfg.footerBg;
    ctx.fillRect(0, baseH - 100, baseW, 100);

    ctx.strokeStyle = cfg.border;
    ctx.lineWidth = 20; // Border lebih tipis agar proporsional
    ctx.strokeRect(10, 10, baseW - 20, baseH - 20);

    const pw = baseW - 80; // Margin kiri-kanan lebih kecil
    const ph = (baseH - 420) / 4;
    const startY = 240;
    const gap = 20;

    props.photos.forEach((src, idx) => {
      const img = new Image();
      img.onload = () => {
        const y = startY + idx * (ph + gap);
        const iw = img.width, ih = img.height;
        const aspect = pw / ph;
        let sw, sh, sx, sy;
        if (iw / ih > aspect) {
          sh = ih; sw = ih * aspect; sx = (iw - sw) / 2; sy = 0;
        } else {
          sw = iw; sh = iw / aspect; sx = 0; sy = (ih - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 40, y, pw, ph);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(40, y, pw, ph);
      };
      img.src = src;
    });
  } else {
    // --- DRAW CUSTOM LAYOUT ---
    const frameImg = new Image();
    frameImg.crossOrigin = 'anonymous';
    const drawAll = () => {
      ctx.clearRect(0, 0, baseW, baseH);
      const order = layout.layerOrder || ['box-1', 'box-2', 'box-3', 'box-4', 'frame'];
      order.forEach((layerId) => {
        if (layerId === 'frame') {
          if (frameImg.complete) ctx.drawImage(frameImg, 0, 0, baseW, baseH);
        } else {
          const boxId = parseInt(layerId.split('-')[1]);
          const box = layout.boxes.find(b => b.id === boxId);
          const src = props.photos[boxId - 1];
          if (box && src) {
            const img = new Image();
            img.onload = () => {
              const iw = img.width, ih = img.height;
              const aspect = box.width / box.height;
              let sw, sh, sx, sy;
              if (iw / ih > aspect) {
                sh = ih; sw = ih * aspect; sx = (iw - sw) / 2; sy = 0;
              } else {
                sw = iw; sh = iw / aspect; sx = 0; sy = (ih - sh) / 2;
              }
              ctx.drawImage(img, sx, sy, sw, sh, box.x, box.y, box.width, box.height);
              if (order.indexOf('frame') > order.indexOf(layerId) && frameImg.complete) {
                ctx.drawImage(frameImg, 0, 0, baseW, baseH);
              }
            };
            img.src = src;
          }
        }
      });
    };
    if (layout.frameUrl) {
      frameImg.onload = drawAll;
      frameImg.src = layout.frameUrl;
    } else {
      drawAll();
    }
  }
}

function downloadImage() {
  const canvas = canvasRef.value;
  const link = document.createElement('a');
  link.download = `potobox-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function generateQrCode() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  isUploading.value = true;
  showQrModal.value = true;
  qrUrl.value = '';
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '12h');
    formData.append('fileToUpload', file);
    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: formData
    });
    const imageUrl = await response.text();
    if (imageUrl.startsWith('http')) {
      downloadLink.value = imageUrl;
      qrUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(imageUrl)}`;
    } else {
      throw new Error('Upload failed');
    }
  } catch (err) {
    alert('Gagal mengunggah foto. Pastikan internet stabil.');
    showQrModal.value = false;
  } finally {
    isUploading.value = false;
  }
}

onMounted(() => {
  setTimeout(drawStrip, 500);
});
</script>

<template>
  <div class="checkerboard" style="width: 100vw; height: 100vh; overflow: hidden; display: flex;">
    <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; position: relative;">
      <canvas ref="canvasRef" style="max-width: 100%; max-height: 100%; background: #fff;"></canvas>
    </div>

    <div style="width: 400px; background: #f6f1e9; border-left: 6px solid #000; padding: 40px; display: flex; flex-direction: column; gap: 20px; box-shadow: -10px 0 30px rgba(0,0,0,0.1); z-index: 10;">
      <header style="text-align: center; margin-bottom: 20px;">
        <h1 class="neo-title" style="font-size: 48px; color: #ff4cb0; text-shadow: 4px 4px 0 #000; margin-bottom: 10px; line-height: 0.9;">FOTO STRIP KAMU</h1>
        <div class="neo-chip" style="background: #ffd400; font-size: 14px; font-weight: 900;">FRAME: {{ selectedFrame.name }}</div>
      </header>

      <div style="display: flex; flex-direction: column; gap: 15px;">
        <button class="btn-3d neo-btn" style="background: #00e5ff; padding: 18px; font-size: 20px;" @click="downloadImage">DOWNLOAD FOTO</button>
        <button class="btn-3d neo-btn" style="background: #ffd400; padding: 18px; font-size: 20px;" @click="generateQrCode">QR FOTO</button>
        <button class="btn-3d neo-btn" style="background: #a855f7; color: white; padding: 18px; font-size: 20px;" @click="emit('change-frame')">UBAH FRAME</button>
        <button class="btn-3d neo-btn" style="background: #ff4cb0; color: white; padding: 18px; font-size: 20px;" @click="emit('retake')">FOTO ULANG</button>
        <button class="btn-3d neo-btn" style="background: #fff; color: #000; padding: 18px; font-size: 20px; border: 4px solid #000;" @click="emit('go-home')">BERANDA</button>
      </div>
    </div>

    <!-- QR Modal -->
    <div v-if="showQrModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);">
      <div class="neo-block bounce-in" style="background: white; padding: 40px; text-align: center; max-width: 450px; width: 90%; position: relative;">
        <button @click="showQrModal = false" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 30px; cursor: pointer; font-weight: 900;">✕</button>
        <h2 class="neo-title" style="font-size: 32px; margin-bottom: 20px;">UNDUH FOTO DISINI</h2>
        <div style="width: 350px; height: 350px; background: #fff; margin: 0 auto; border: 4px solid #000; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 10px 10px 0 #000;">
          <div v-if="!qrUrl" style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
            <div style="width: 50px; height: 50px; border: 6px solid #ff4cb0; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p style="font-weight: 800; font-size: 14px; color: #000;">MENGUNGGAH FOTO...</p>
          </div>
          <img v-else :src="qrUrl" style="width: 90%; height: 90%; image-rendering: pixelated;" />
        </div>
        <div style="margin-top: 25px; font-size: 11px; color: #888; font-weight: 700; border-top: 2px dashed #eee; pt-15">
          *Link foto akan otomatis terhapus dalam 24 jam.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes bounceIn {
  0% { transform: scale(0.3); opacity: 0; }
  60% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}
.bounce-in { animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
</style>
