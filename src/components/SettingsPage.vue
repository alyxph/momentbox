<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import interact from 'interactjs';

const emit = defineEmits(['go-home', 'save', 'delete']);

// View management
const view = ref('menu'); // 'menu' or 'editor'
const currentLayoutId = ref(null);

// Settings Tab switcher: 'frames', 'buttons', or 'camera'
const activeSettingTab = ref('frames');

// ── CAMERA SETTINGS ──────────────────────────────────────────────────────────
const cameraDevices = ref([]);
const selectedDeviceId = ref('');
const cameraSettingStatus = ref('');
const cameraPermissionError = ref('');

async function loadCameraDevices() {
  cameraPermissionError.value = '';
  try {
    // Minta izin kamera dulu agar label perangkat dapat terbaca
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    tempStream.getTracks().forEach(t => t.stop());
  } catch (e) {
    cameraPermissionError.value = 'Izinkan akses kamera di browser untuk melihat daftar kamera.';
    return;
  }
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    cameraDevices.value = all.filter(d => d.kind === 'videoinput');
    // Muat deviceId tersimpan dari localStorage
    const saved = localStorage.getItem('photobooth_camera_device_id');
    if (saved && cameraDevices.value.find(d => d.deviceId === saved)) {
      selectedDeviceId.value = saved;
    } else if (cameraDevices.value.length > 0) {
      selectedDeviceId.value = cameraDevices.value[0].deviceId;
    }
  } catch (err) {
    cameraPermissionError.value = 'Gagal mendapatkan daftar kamera: ' + err.message;
  }
}

function saveCameraConfig() {
  localStorage.setItem('photobooth_camera_device_id', selectedDeviceId.value);
  cameraSettingStatus.value = 'Pengaturan kamera berhasil disimpan!';
  setTimeout(() => {
    cameraSettingStatus.value = '';
  }, 2500);
}
// ─────────────────────────────────────────────────────────────────────────────

// ── WALLPAPER SETTINGS ───────────────────────────────────────────────────────
const wallpaperInputRef = ref(null);
const wallpaperPreview = ref('');
const wallpaperStatus = ref('');
const wallpaperError = ref('');

function loadWallpaperPreview() {
  const saved = localStorage.getItem('photobooth_wallpaper');
  wallpaperPreview.value = saved || '';
}

function openWallpaperPicker() {
  wallpaperInputRef.value?.click();
}

function handleWallpaperUpload(event) {
  wallpaperError.value = '';
  const file = event.target.files?.[0];
  if (!file) return;

  // Warn if file is too large (> 2.5MB)
  if (file.size > 2.5 * 1024 * 1024) {
    wallpaperError.value = 'Gambar terlalu besar (> 2.5MB). Harap pilih gambar yang lebih kecil agar tidak melebihi kapasitas penyimpanan browser.';
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    wallpaperPreview.value = base64;
    try {
      localStorage.setItem('photobooth_wallpaper', base64);
      // Notify HomePage (same tab) of the change
      window.dispatchEvent(new CustomEvent('photobooth-wallpaper-changed'));
      wallpaperStatus.value = 'Wallpaper berhasil disimpan!';
      setTimeout(() => { wallpaperStatus.value = ''; }, 2500);
    } catch (err) {
      wallpaperError.value = 'Gagal menyimpan: penyimpanan browser penuh. Coba pakai gambar yang lebih kecil.';
    }
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function deleteWallpaper() {
  localStorage.removeItem('photobooth_wallpaper');
  wallpaperPreview.value = '';
  window.dispatchEvent(new CustomEvent('photobooth-wallpaper-changed'));
  wallpaperStatus.value = 'Wallpaper dihapus. Tampilan default aktif kembali.';
  setTimeout(() => { wallpaperStatus.value = ''; }, 2500);
}
// ─────────────────────────────────────────────────────────────────────────────

// Config toggles for buttons shown in PreviewPage
const previewButtons = ref({
  downloadPhoto: true,
  downloadVideo: true,
  qrCode: true,
  changeFrame: true,
  retake: true,
  goHome: true,
});

const buttonSaveStatus = ref('');

const buttonsConfig = [
  { key: 'downloadPhoto', name: 'DOWNLOAD FOTO', desc: 'Menampilkan tombol untuk mengunduh foto strip hasil akhir.' },
  { key: 'downloadVideo', name: 'DOWNLOAD VIDEO', desc: 'Menampilkan tombol untuk merekam dan mengunduh video animasi (MP4/Story).' },
  { key: 'qrCode', name: 'SIMPAN FOTO', desc: 'Menampilkan tombol untuk mengunggah hasil dan membagikannya lewat scan QR Code.' },
  { key: 'changeFrame', name: 'UBAH FRAME', desc: 'Menampilkan tombol untuk kembali memilih frame lain.' },
  { key: 'retake', name: 'FOTO ULANG', desc: 'Menampilkan tombol untuk mengulang proses pemotretan.' },
  { key: 'goHome', name: 'BERANDA', desc: 'Menampilkan tombol untuk kembali ke layar utama.' }
];

function toggleButton(key) {
  previewButtons.value[key] = !previewButtons.value[key];
}

function saveButtonsConfig() {
  localStorage.setItem('photobooth_preview_buttons', JSON.stringify(previewButtons.value));
  buttonSaveStatus.value = 'Pengaturan tombol berhasil disimpan!';
  setTimeout(() => {
    buttonSaveStatus.value = '';
  }, 2500);
}

const canvasRef = ref(null);
const frameInputRef = ref(null);

const frameUrl = ref('');
const frameName = ref('');
const frameMeta = ref({ width: 0, height: 0 });
const frameError = ref('');

const selectedId = ref('box-1');
const exportJson = ref('');
const exportStatus = ref('');
const customDisplayName = ref('Custom Frame');

const canvasRect = ref({ width: 0, height: 0 });
const hasCustomLayout = ref(false);
let resizeObserver;

// Coordinates are PERCENTAGES (0-100) for screen independence
const photoBoxes = ref([
  { id: 'box-1', label: '1', x: 15, y: 10, width: 70, height: 16 },
  { id: 'box-2', label: '2', x: 15, y: 30, width: 70, height: 16 },
  { id: 'box-3', label: '3', x: 15, y: 50, width: 70, height: 16 },
  { id: 'box-4', label: '4', x: 15, y: 70, width: 70, height: 16 },
]);

const layerOrder = ref(['frame', 'box-1', 'box-2', 'box-3', 'box-4']);
const savedLayouts = ref([]);

function loadLayouts() {
  const saved = localStorage.getItem('photobooth_custom_layouts');
  if (saved) {
    try {
      savedLayouts.value = JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
}

const layerItems = computed(() => [
  { id: 'frame', label: 'Frame PNG' },
  { id: 'box-1', label: 'Kotak Foto 1' },
  { id: 'box-2', label: 'Kotak Foto 2' },
  { id: 'box-3', label: 'Kotak Foto 3' },
  { id: 'box-4', label: 'Kotak Foto 4' },
]);

const canvasAspect = computed(() => {
  if (frameMeta.value.width && frameMeta.value.height) {
    return `${frameMeta.value.width} / ${frameMeta.value.height}`;
  }
  return '3 / 5';
});

const activeLabel = computed(() => {
  const active = layerItems.value.find((item) => item.id === selectedId.value);
  return active ? active.label : '-';
});

function selectElement(id) {
  selectedId.value = id;
}

function getZIndex(id) {
  const idx = layerOrder.value.indexOf(id);
  return idx < 0 ? 1 : idx + 1;
}

function moveLayer(delta) {
  const order = [...layerOrder.value];
  const idx = order.indexOf(selectedId.value);
  if (idx < 0) return;
  const nextIdx = Math.max(0, Math.min(order.length - 1, idx + delta));
  if (idx === nextIdx) return;
  const [item] = order.splice(idx, 1);
  order.splice(nextIdx, 0, item);
  layerOrder.value = order;
}

function updateCanvasSize() {
  if (!canvasRef.value) return;
  // Use clientWidth/Height to exclude borders and get pure content area
  canvasRect.value = { 
    width: canvasRef.value.clientWidth, 
    height: canvasRef.value.clientHeight 
  };
}

function resetLayout() {
  photoBoxes.value = [
    { id: 'box-1', label: '1', x: 15, y: 10, width: 70, height: 16 },
    { id: 'box-2', label: '2', x: 15, y: 30, width: 70, height: 16 },
    { id: 'box-3', label: '3', x: 15, y: 50, width: 70, height: 16 },
    { id: 'box-4', label: '4', x: 15, y: 70, width: 70, height: 16 },
  ];
  hasCustomLayout.value = true;
  exportStatus.value = 'Layout di-reset.';
}

function boxStyle(box) {
  const pxX = (box.x * canvasRect.value.width) / 100;
  const pxY = (box.y * canvasRect.value.height) / 100;
  const pxW = (box.width * canvasRect.value.width) / 100;
  const pxH = (box.height * canvasRect.value.height) / 100;

  return {
    width: `${pxW}px`,
    height: `${pxH}px`,
    transform: `translate(${pxX}px, ${pxY}px)`,
    zIndex: getZIndex(box.id),
    touchAction: 'none',
  };
}

function openFramePicker() {
  frameInputRef.value?.click();
}

function clearFrame() {
  frameUrl.value = '';
  frameName.value = '';
  frameMeta.value = { width: 0, height: 0 };
  frameError.value = '';
}

function handleFrameUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.type !== 'image/png') {
    frameError.value = 'Frame harus file PNG.';
    event.target.value = '';
    return;
  }
  frameError.value = '';
  clearFrame();
  frameName.value = file.name;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const url = e.target.result;
    frameUrl.value = url;
    const img = new Image();
    img.onload = () => {
      frameMeta.value = { width: img.naturalWidth, height: img.naturalHeight };
      nextTick(updateCanvasSize);
    };
    img.src = url;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function initInteract() {
  interact('.js-photo-box').unset();
  interact('.js-photo-box')
    .draggable({
      ignoreFrom: '.resize-handle',
      listeners: {
        start(event) {
          const id = event.target.dataset.boxId;
          if (id) selectElement(id);
        },
        move(event) {
          const id = event.target.dataset.boxId;
          const box = photoBoxes.value.find(b => b.id === id);
          if (!box || !canvasRect.value.width) return;
          
          hasCustomLayout.value = true;
          box.x += (event.dx / canvasRect.value.width) * 100;
          box.y += (event.dy / canvasRect.value.height) * 100;
        },
      },
      modifiers: [interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })],
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      listeners: {
        start(event) {
          const id = event.target.dataset.boxId;
          if (id) selectElement(id);
        },
        move(event) {
          const id = event.target.dataset.boxId;
          const box = photoBoxes.value.find(b => b.id === id);
          if (!box || !canvasRect.value.width) return;
          
          hasCustomLayout.value = true;
          box.width = (event.rect.width / canvasRect.value.width) * 100;
          box.height = (event.rect.height / canvasRect.value.height) * 100;
          box.x += (event.deltaRect.left / canvasRect.value.width) * 100;
          box.y += (event.deltaRect.top / canvasRect.value.height) * 100;
        },
      },
      modifiers: [
        interact.modifiers.restrictEdges({ outer: 'parent' }),
        interact.modifiers.restrictSize({ min: { width: 5, height: 5 } }),
      ],
    });
}

function saveConfiguration() {
  exportStatus.value = '';
  if (!frameMeta.value.width) {
    exportStatus.value = 'Harap upload frame PNG dulu!';
    return;
  }

  const baseWidth = frameMeta.value.width;
  const baseHeight = frameMeta.value.height;

  const boxes = photoBoxes.value.map((box) => ({
    id: Number(box.label),
    x: Math.round((box.x * baseWidth) / 100),
    y: Math.round((box.y * baseHeight) / 100),
    width: Math.round((box.width * baseWidth) / 100),
    height: Math.round((box.height * baseHeight) / 100),
  }));

  const payload = {
    frame: { width: baseWidth, height: baseHeight },
    boxes,
    layerOrder: [...layerOrder.value],
    frameUrl: frameUrl.value, 
    name: customDisplayName.value || 'Custom Frame',
    id: currentLayoutId.value || `custom-${Date.now()}`
  };

  exportJson.value = JSON.stringify(payload, null, 2);
  emit('save', payload);
  
  exportStatus.value = 'Tersimpan!';
  setTimeout(() => {
    loadLayouts();
    view.value = 'menu';
  }, 1000);
}

function startNewLayout() {
  currentLayoutId.value = null;
  customDisplayName.value = 'Custom Frame ' + (savedLayouts.value.length + 1);
  clearFrame();
  resetLayout();
  view.value = 'editor';
  nextTick(() => {
    updateCanvasSize();
    initInteract();
  });
}

function editLayout(layout) {
  currentLayoutId.value = layout.id;
  customDisplayName.value = layout.name;
  frameUrl.value = layout.frameUrl;
  frameMeta.value = layout.frame;
  
  photoBoxes.value = layout.boxes.map(b => ({
    id: `box-${b.id}`,
    label: String(b.id),
    x: (b.x / layout.frame.width) * 100,
    y: (b.y / layout.frame.height) * 100,
    width: (b.width / layout.frame.width) * 100,
    height: (b.height / layout.frame.height) * 100
  }));
  
  if (layout.layerOrder) layerOrder.value = layout.layerOrder;
  hasCustomLayout.value = true;
  view.value = 'editor';
  
  nextTick(() => {
    updateCanvasSize();
    initInteract();
  });
}

function deleteSavedLayout(id) {
  if (confirm('Hapus frame ini dari browser?')) {
    emit('delete', id);
    setTimeout(loadLayouts, 100);
  }
}

onMounted(() => {
  loadLayouts();
  const savedButtons = localStorage.getItem('photobooth_preview_buttons');
  if (savedButtons) {
    try {
      const parsed = JSON.parse(savedButtons);
      previewButtons.value = { ...previewButtons.value, ...parsed };
    } catch (e) {
      console.error('Failed to load preview buttons config', e);
    }
  }
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  interact('.js-photo-box').unset();
});
</script>

<template>
  <div style="width: 100vw; height: 100vh; overflow: hidden; background: #f6f1e9;
      background-image: linear-gradient(0deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
      background-size: 28px 28px; padding: 2vh 4vw; font-family: 'Nunito', sans-serif; position: relative;">
    
    <!-- Back Button -->
    <button
      class="btn-3d"
      style="position: absolute; top: 20px; left: 24px; width: 48px; height: 48px; background: #ff4cb0; border: 4px solid #000; box-shadow: 4px 4px 0 #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; z-index: 50; cursor: pointer; outline: none;"
      @click="view === 'menu' ? emit('go-home') : (view = 'menu')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <div style="max-width: 1300px; margin: 0 auto; height: 100%; display: flex; flex-direction: column; gap: 16px;">
      
      <header style="display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px; flex-shrink: 0; text-align: center;">
        <h1 class="neo-title" style="font-size: clamp(32px, 6vw, 48px); color: #ff4cb0; text-shadow: 4px 4px 0 #000; margin: 0; line-height: 1;">
          SETTINGS
        </h1>
        <p class="neo-chip" style="font-size: 12px; font-weight: 800; display: inline-block; margin-top: 8px; background: #00e5ff; color: #000; padding: 6px 14px;">
          {{ view === 'menu' ? (activeSettingTab === 'frames' ? 'MANAGE CUSTOM FRAMES' : activeSettingTab === 'buttons' ? 'CUSTOM BUTTONS' : activeSettingTab === 'camera' ? 'SETTING KAMERA' : 'CUSTOM WALLPAPER') : 'EDITING: ' + customDisplayName }}
        </p>
      </header>

      <!-- Tab Switcher (only in menu view) -->
      <div v-if="view === 'menu'" style="display: flex; gap: 16px; justify-content: center; margin-top: 4px; flex-shrink: 0;">
        <button
          class="btn-3d neo-btn"
          style="padding: 10px 24px; font-size: 14px; font-weight: 800; border: 3px solid #000; box-shadow: 4px 4px 0 #000;"
          :style="{ background: activeSettingTab === 'frames' ? '#ff4cb0' : '#fff', color: activeSettingTab === 'frames' ? '#fff' : '#000' }"
          @click="activeSettingTab = 'frames'"
        >
          FRAME CUSTOM
        </button>
        <button
          class="btn-3d neo-btn"
          style="padding: 10px 24px; font-size: 14px; font-weight: 800; border: 3px solid #000; box-shadow: 4px 4px 0 #000;"
          :style="{ background: activeSettingTab === 'buttons' ? '#ffd700' : '#fff', color: '#000' }"
          @click="activeSettingTab = 'buttons'"
        >
          KUSTOMISASI TOMBOL
        </button>
        <button
          class="btn-3d neo-btn"
          style="padding: 10px 24px; font-size: 14px; font-weight: 800; border: 3px solid #000; box-shadow: 4px 4px 0 #000;"
          :style="{ background: activeSettingTab === 'camera' ? '#a78bfa' : '#fff', color: activeSettingTab === 'camera' ? '#fff' : '#000' }"
          @click="activeSettingTab = 'camera'; loadCameraDevices()"
        >
          🎥 KAMERA
        </button>
        <button
          class="btn-3d neo-btn"
          style="padding: 10px 24px; font-size: 14px; font-weight: 800; border: 3px solid #000; box-shadow: 4px 4px 0 #000;"
          :style="{ background: activeSettingTab === 'wallpaper' ? '#f97316' : '#fff', color: activeSettingTab === 'wallpaper' ? '#fff' : '#000' }"
          @click="activeSettingTab = 'wallpaper'; loadWallpaperPreview()"
        >
          🖼️ WALLPAPER
        </button>
      </div>

      <!-- MENU VIEW -->
      <div v-if="view === 'menu'" style="flex: 1; overflow-y: auto; padding: 20px 0;">

        <!-- FRAMES TAB CONTENT -->
        <div v-if="activeSettingTab === 'frames'" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px;">
          <!-- ADD NEW CARD -->
          <div 
            class="neo-block btn-3d" 
            style="background: #ffffff; padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; border-style: dashed; min-height: 200px;"
            @click="startNewLayout"
          >
            <div style="width: 24px; height: 24px; border: 3px dashed #000; margin-bottom: 16px;"></div>
            <h3 class="neo-title" style="font-size: 20px; margin: 0;">TAMBAH FRAME</h3>
            <p style="font-size: 12px; font-weight: 800; color: #888; margin-top: 8px;">BUAT LAYOUT BARU</p>
          </div>

          <!-- SAVED CARDS -->
          <div 
            v-for="layout in savedLayouts" 
            :key="layout.id"
            class="neo-block"
            style="background: #ffffff; padding: 20px; display: flex; flex-direction: column; min-height: 200px;"
          >
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 3px solid #000; margin-bottom: 12px; overflow: hidden; position: relative;">
               <img v-if="layout.frameUrl" :src="layout.frameUrl" style="max-height: 120px; width: auto; object-fit: contain;" />
               <div v-else style="font-size: 32px; font-weight: 800; color: #888;">NO IMAGE</div>
            </div>
            <h3 class="neo-title" style="font-size: 18px; margin: 0; text-align: center;">{{ layout.name }}</h3>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
              <button 
                class="btn-3d neo-btn" 
                style="background: #00e5ff; flex: 1; padding: 8px; font-size: 12px;"
                @click="editLayout(layout)"
              >EDIT</button>
              <button 
                class="btn-3d neo-btn" 
                style="background: #ef4444; color: #fff; flex: 1; padding: 8px; font-size: 12px;"
                @click="deleteSavedLayout(layout.id)"
              >HAPUS</button>
            </div>
          </div>
        </div>

        <!-- BUTTONS TAB CONTENT -->
        <div v-else-if="activeSettingTab === 'buttons'" style="display: flex; flex-direction: column; gap: 16px; max-width: 650px; margin: 0 auto; width: 100%;">
          <div
            v-for="btn in buttonsConfig"
            :key="btn.key"
            class="neo-block"
            style="background: #ffffff; padding: 20px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: 4px solid #000; box-shadow: 6px 6px 0 #000;"
            @click="toggleButton(btn.key)"
          >
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="text-align: left;">
                <h3 class="neo-title" style="font-size: 18px; margin: 0;">{{ btn.name }}</h3>
                <p style="font-size: 12px; color: #555; margin: 4px 0 0 0; font-weight: 700;">{{ btn.desc }}</p>
              </div>
            </div>
            <!-- Neo-brutalist Checkbox -->
            <div
              style="width: 32px; height: 32px; border: 4px solid #000; box-shadow: 3px 3px 0 #000; display: flex; align-items: center; justify-content: center; transition: all 0.1s; flex-shrink: 0;"
              :style="{ background: previewButtons[btn.key] ? '#00e5ff' : '#fff' }"
            >
              <span v-if="previewButtons[btn.key]" style="font-size: 18px; font-weight: 900; color: #000;">✓</span>
            </div>
          </div>

          <div style="margin-top: 15px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <button
              class="btn-3d neo-btn"
              style="background: #ff4cb0; color: #fff; padding: 14px 40px; font-size: 18px; font-weight: 800; border: 4px solid #000; box-shadow: 6px 6px 0 #000;"
              @click="saveButtonsConfig"
            >
              SIMPAN PENGATURAN
            </button>
            <p v-if="buttonSaveStatus" style="font-size: 14px; font-weight: 900; color: #10b981; text-align: center; margin-top: 5px;">
              {{ buttonSaveStatus }}
            </p>
          </div>
        </div>

        <!-- CAMERA TAB CONTENT -->
        <div v-else-if="activeSettingTab === 'camera'" style="display: flex; flex-direction: column; gap: 16px; max-width: 650px; margin: 0 auto; width: 100%;">
          
          <!-- Error / permission notice -->
          <div
            v-if="cameraPermissionError"
            class="neo-block"
            style="background: #fff3cd; border: 4px solid #000; box-shadow: 6px 6px 0 #000; padding: 20px; display: flex; align-items: center; gap: 14px;"
          >
            <span style="font-size: 28px;">⚠️</span>
            <p style="font-size: 13px; font-weight: 700; margin: 0; color: #6b4f00;">{{ cameraPermissionError }}</p>
          </div>

          <!-- Camera selector card -->
          <div
            class="neo-block"
            style="background: #ffffff; padding: 28px; border: 4px solid #000; box-shadow: 6px 6px 0 #000;"
          >
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
              <div style="width: 48px; height: 48px; background: #a78bfa; border: 4px solid #000; box-shadow: 4px 4px 0 #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">🎥</div>
              <div>
                <h3 class="neo-title" style="font-size: 20px; margin: 0;">PILIH KAMERA</h3>
                <p style="font-size: 12px; font-weight: 700; color: #555; margin: 4px 0 0 0;">Pilih kamera yang ingin digunakan saat memotret</p>
              </div>
            </div>

            <!-- No devices found -->
            <div
              v-if="cameraDevices.length === 0 && !cameraPermissionError"
              style="text-align: center; padding: 30px; border: 3px dashed #000; background: #f8fafc;"
            >
              <div style="font-size: 40px; margin-bottom: 8px;">📷</div>
              <p style="font-weight: 800; font-size: 14px; color: #888;">Klik tombol di bawah untuk memuat daftar kamera</p>
            </div>

            <!-- Dropdown device list -->
            <div v-if="cameraDevices.length > 0" style="display: flex; flex-direction: column; gap: 12px;">
              <label style="font-size: 13px; font-weight: 900; color: #000;">KAMERA TERSEDIA:</label>
              <div style="position: relative;">
                <select
                  id="camera-device-select"
                  v-model="selectedDeviceId"
                  style="width: 100%; padding: 12px 40px 12px 14px; font-size: 14px; font-weight: 800; font-family: 'Nunito', sans-serif; border: 4px solid #000; box-shadow: 4px 4px 0 #000; background: #fff; appearance: none; cursor: pointer; outline: none;"
                >
                  <option
                    v-for="device in cameraDevices"
                    :key="device.deviceId"
                    :value="device.deviceId"
                  >
                    {{ device.label || `Kamera ${cameraDevices.indexOf(device) + 1}` }}
                  </option>
                </select>
                <!-- Custom dropdown arrow -->
                <div style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; font-weight: 900; font-size: 16px;">▼</div>
              </div>

              <!-- Currently selected info -->
              <div
                v-if="selectedDeviceId"
                style="background: #f0fdf4; border: 3px solid #000; padding: 10px 14px; display: flex; align-items: center; gap: 10px;"
              >
                <span style="font-size: 18px;">✅</span>
                <span style="font-size: 12px; font-weight: 800; color: #166534; word-break: break-all;">
                  {{ cameraDevices.find(d => d.deviceId === selectedDeviceId)?.label || 'Kamera Terpilih' }}
                </span>
              </div>
            </div>

            <!-- Action buttons -->
            <div style="display: flex; gap: 12px; margin-top: 20px;">
              <button
                class="btn-3d neo-btn"
                style="background: #a78bfa; color: #fff; padding: 12px 20px; font-size: 14px; font-weight: 800; border: 4px solid #000; box-shadow: 4px 4px 0 #000; flex: 1;"
                @click="loadCameraDevices"
              >
                🔄 MUAT ULANG
              </button>
              <button
                v-if="cameraDevices.length > 0"
                class="btn-3d neo-btn"
                style="background: #ff4cb0; color: #fff; padding: 12px 20px; font-size: 14px; font-weight: 800; border: 4px solid #000; box-shadow: 4px 4px 0 #000; flex: 1;"
                @click="saveCameraConfig"
              >
                💾 SIMPAN
              </button>
            </div>

            <p v-if="cameraSettingStatus" style="font-size: 14px; font-weight: 900; color: #10b981; text-align: center; margin-top: 12px;">
              {{ cameraSettingStatus }}
            </p>
          </div>

          <!-- Info card -->
          <div
            class="neo-block"
            style="background: #e0f2fe; padding: 18px; border: 4px solid #000; box-shadow: 6px 6px 0 #000;"
          >
            <h4 class="neo-title" style="font-size: 14px; margin: 0 0 8px 0;">ℹ️ INFO</h4>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; font-weight: 700; color: #0c4a6e; line-height: 1.8;">
              <li>Pengaturan kamera akan disimpan dan dipakai setiap kali memotret.</li>
              <li>Jika kamera yang dipilih tidak tersedia, aplikasi akan otomatis memilih kamera default.</li>
              <li>Pada perangkat mobile, kamera depan biasanya berlabel "user" / "front".</li>
            </ul>
          </div>
        </div>

        <!-- WALLPAPER TAB CONTENT -->
        <div v-else-if="activeSettingTab === 'wallpaper'" style="display: flex; flex-direction: column; gap: 16px; max-width: 650px; margin: 0 auto; width: 100%;">

          <!-- Error / size warning -->
          <div
            v-if="wallpaperError"
            class="neo-block"
            style="background: #fff3cd; border: 4px solid #000; box-shadow: 6px 6px 0 #000; padding: 20px; display: flex; align-items: center; gap: 14px;"
          >
            <span style="font-size: 28px;">⚠️</span>
            <p style="font-size: 13px; font-weight: 700; margin: 0; color: #6b4f00;">{{ wallpaperError }}</p>
          </div>

          <!-- Main card -->
          <div
            class="neo-block"
            style="background: #ffffff; padding: 28px; border: 4px solid #000; box-shadow: 6px 6px 0 #000;"
          >
            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
              <div style="width: 48px; height: 48px; background: #f97316; border: 4px solid #000; box-shadow: 4px 4px 0 #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">🖼️</div>
              <div>
                <h3 class="neo-title" style="font-size: 20px; margin: 0;">CUSTOM WALLPAPER</h3>
                <p style="font-size: 12px; font-weight: 700; color: #555; margin: 4px 0 0 0;">Upload foto/gambar untuk background halaman depan</p>
              </div>
            </div>

            <!-- Current wallpaper preview -->
            <div
              style="border: 4px solid #000; box-shadow: 4px 4px 0 #000; overflow: hidden; margin-bottom: 20px; background: #f8fafc; min-height: 160px; display: flex; align-items: center; justify-content: center; position: relative;"
            >
              <img
                v-if="wallpaperPreview"
                :src="wallpaperPreview"
                style="width: 100%; max-height: 260px; object-fit: cover; display: block;"
                alt="Wallpaper preview"
              />
              <div v-else style="text-align: center; padding: 40px; opacity: 0.5;">
                <div style="font-size: 48px; margin-bottom: 8px;">🏞️</div>
                <p style="font-weight: 800; font-size: 13px; color: #888; margin: 0;">Belum ada wallpaper</p>
                <p style="font-weight: 700; font-size: 11px; color: #aaa; margin: 4px 0 0 0;">Tampilan default aktif</p>
              </div>
              <!-- Active badge -->
              <div
                v-if="wallpaperPreview"
                style="position: absolute; top: 10px; left: 10px; background: #10b981; border: 3px solid #000; padding: 4px 12px; font-size: 11px; font-weight: 900; color: #fff; box-shadow: 3px 3px 0 #000;"
              >
                ✓ AKTIF
              </div>
            </div>

            <!-- Upload input (hidden) -->
            <input
              ref="wallpaperInputRef"
              type="file"
              accept="image/*"
              style="display: none;"
              @change="handleWallpaperUpload"
            />

            <!-- Action buttons -->
            <div style="display: flex; gap: 12px;">
              <button
                class="btn-3d neo-btn"
                style="background: #f97316; color: #fff; padding: 14px 20px; font-size: 14px; font-weight: 800; border: 4px solid #000; box-shadow: 4px 4px 0 #000; flex: 1;"
                @click="openWallpaperPicker"
              >
                📁 {{ wallpaperPreview ? 'GANTI GAMBAR' : 'UPLOAD GAMBAR' }}
              </button>
              <button
                v-if="wallpaperPreview"
                class="btn-3d neo-btn"
                style="background: #ef4444; color: #fff; padding: 14px 20px; font-size: 14px; font-weight: 800; border: 4px solid #000; box-shadow: 4px 4px 0 #000; flex: 1;"
                @click="deleteWallpaper"
              >
                🗑️ HAPUS
              </button>
            </div>

            <p v-if="wallpaperStatus" style="font-size: 14px; font-weight: 900; color: #10b981; text-align: center; margin-top: 14px;">{{ wallpaperStatus }}</p>
          </div>

          <!-- Info card -->
          <div
            class="neo-block"
            style="background: #fff7ed; padding: 18px; border: 4px solid #000; box-shadow: 6px 6px 0 #000;"
          >
            <h4 class="neo-title" style="font-size: 14px; margin: 0 0 8px 0;">ℹ️ INFO</h4>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; font-weight: 700; color: #7c2d12; line-height: 1.8;">
              <li>Wallpaper akan tampil full-screen di halaman utama. Judul &amp; dekorasi akan disembunyikan.</li>
              <li>Yang tetap terlihat: <strong>tombol kamera</strong>, label <strong>KLIK UNTUK MULAI</strong>, dan tombol <strong>Settings</strong>.</li>
              <li>Ukuran gambar disarankan <strong>&lt; 2MB</strong> agar tidak melebihi kapasitas penyimpanan browser.</li>
              <li>Format yang didukung: JPG, PNG, WebP, GIF, dsb.</li>
            </ul>
          </div>
        </div>

      </div>

      <!-- EDITOR VIEW -->
      <div v-else style="flex: 1; display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr); gap: 20px; align-items: start; min-height: 0; overflow: hidden;">
        
        <section style="display: flex; flex-direction: column; gap: 12px; height: 100%; overflow: hidden;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <h2 class="neo-title" style="font-size: 24px; margin: 0;">CANVAS PREVIEW</h2>
              <span v-if="frameMeta.width" style="font-size: 12px; font-weight: 800; color: #666; background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">
                {{ frameMeta.width }} x {{ frameMeta.height }} px
              </span>
            </div>
            <div class="neo-chip" style="background: #ff6b35; color: #fff; font-size: 12px; padding: 6px 12px;">
              Active: {{ activeLabel }}
            </div>
          </div>

          <div style="flex: 1; display: flex; justify-content: center; align-items: center; width: 100%; min-height: 0; padding: 0;">
            <!-- Outer wrapper with border to keep coordinates clean inside -->
            <div style="border: 4px solid #000; box-shadow: 10px 10px 0 rgba(0,0,0,0.1); display: flex;">
              <div
                ref="canvasRef"
                style="position: relative; background: #e2e8f0; overflow: hidden;"
                :style="{ aspectRatio: canvasAspect, height: '70vh', maxHeight: '100%' }"
              >
                <img
                  v-if="frameUrl"
                  :src="frameUrl"
                  style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: auto;"
                  :style="{ zIndex: getZIndex('frame') }"
                  @pointerdown="selectElement('frame')"
                />
              <div
                v-else
                style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; pointer-events: auto;"
                :style="{ zIndex: getZIndex('frame') }"
                @pointerdown="selectElement('frame')"
              >
                <div style="text-align: center; opacity: 0.5;">
                  <p class="neo-title" style="font-size: 20px; color: #64748b; margin: 0;">UPLOAD FRAME PNG</p>
                </div>
              </div>

              <div
                v-for="box in photoBoxes"
                :key="box.id"
                class="js-photo-box"
                style="position: absolute; left: 0; top: 0; background: rgba(0, 229, 255, 0.2); border: 2px dashed #000; user-select: none; border-radius: 4px;"
                :style="[boxStyle(box), selectedId === box.id ? { background: 'rgba(255, 76, 176, 0.3)', border: '3px solid #000', outline: '2px solid #fff' } : {}]"
                :data-box-id="box.id"
                @pointerdown="selectElement(box.id)"
              >
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 24px; color: #000; opacity: 0.5;">{{ box.label }}</div>
                
                <!-- Handles -->
                <div class="resize-handle" style="position: absolute; left: -6px; top: -6px; width: 14px; height: 14px; background: #fff; border: 2px solid #000; border-radius: 50%; cursor: nw-resize; z-index: 10;"></div>
                <div class="resize-handle" style="position: absolute; right: -6px; top: -6px; width: 14px; height: 14px; background: #fff; border: 2px solid #000; border-radius: 50%; cursor: ne-resize; z-index: 10;"></div>
                <div class="resize-handle" style="position: absolute; left: -6px; bottom: -6px; width: 14px; height: 14px; background: #fff; border: 2px solid #000; border-radius: 50%; cursor: sw-resize; z-index: 10;"></div>
                <div class="resize-handle" style="position: absolute; right: -6px; bottom: -6px; width: 14px; height: 14px; background: #fff; border: 2px solid #000; border-radius: 50%; cursor: se-resize; z-index: 10;"></div>
              </div>

              <div
                v-if="selectedId === 'frame'"
                style="position: absolute; inset: 0; pointer-events: none; outline: 4px solid #00e5ff; outline-offset: -4px; z-index: 999;"
              ></div>
            </div>
          </div>
        </div>
      </section>

        <aside style="display: flex; flex-direction: column; gap: 16px; height: 100%; overflow-y: auto; padding-right: 8px;">
          
          <div class="neo-block" style="padding: 20px; background: #ffffff;">
            <h3 class="neo-title" style="font-size: 18px; margin: 0;">1. FRAME & NAMA</h3>
            <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
              <input 
                v-model="customDisplayName"
                type="text" 
                placeholder="Nama Frame..."
                style="border: 4px solid #000; padding: 8px; font-weight: 800; outline: none; box-shadow: 3px 3px 0 #000; width: 100%;"
              />
              <input ref="frameInputRef" type="file" accept="image/png" style="display: none;" @change="handleFrameUpload" />
              <button class="btn-3d neo-btn" style="background: #00e5ff; padding: 10px; font-size: 14px; width: 100%;" @click="openFramePicker">
                {{ frameName ? 'GANTI PNG' : 'UPLOAD PNG' }}
              </button>
              <p v-if="frameName" style="font-size: 11px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #555;">📄 {{ frameName }}</p>
            </div>
          </div>

          <div class="neo-block" style="padding: 20px; background: #ffffff;">
            <h3 class="neo-title" style="font-size: 18px; margin: 0;">2. LAYER ORDER</h3>
            <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; gap: 8px;">
                <button class="btn-3d neo-btn" style="background: #c084fc; padding: 8px; flex: 1; font-size: 12px;" @click="moveLayer(1)">FORWARD</button>
                <button class="btn-3d neo-btn" style="background: #a855f7; color: #fff; padding: 8px; flex: 1; font-size: 12px;" @click="moveLayer(-1)">BACKWARD</button>
              </div>
              <div style="border: 3px dashed #000; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                <button
                  v-for="item in layerItems"
                  :key="item.id"
                  class="btn-3d"
                  style="border: 2px solid #000; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 2px 2px 0 #000; font-weight: 800; font-size: 11px;"
                  :style="selectedId === item.id ? 'background: #00e5ff;' : 'background: #fff;'"
                  @click="selectElement(item.id)"
                >
                  {{ item.label }} <span>Z:{{ getZIndex(item.id) }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="neo-block" style="padding: 20px; background: #ffffff;">
            <h3 class="neo-title" style="font-size: 18px; margin: 0;">3. SIMPAN</h3>
            <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 10px;">
              <button class="btn-3d neo-btn" style="background: #ff4cb0; color: #fff; padding: 15px; font-size: 18px; width: 100%;" @click="saveConfiguration">SIMPAN FRAME</button>
              <div style="display: flex; gap: 8px;">
                <button class="btn-3d neo-btn" style="background: #fff; border: 3px solid #000; padding: 10px; font-size: 13px; flex: 1;" @click="resetLayout">
                  RESET
                </button>
                <button class="btn-3d neo-btn" style="background: #ef4444; color: #fff; padding: 10px; font-size: 13px; flex: 1;" @click="deleteSavedLayout(currentLayoutId)">
                  HAPUS
                </button>
                <button class="btn-3d neo-btn" style="background: #fff; border: 3px solid #000; padding: 10px; font-size: 13px; flex: 1;" @click="view = 'menu'">
                  BATAL
                </button>
              </div>
              <p v-if="exportStatus" style="font-size: 14px; font-weight: 900; color: #10b981; text-align: center;">{{ exportStatus }}</p>
              
              <textarea
                v-if="exportJson"
                readonly
                style="margin-top: 10px; width: 100%; height: 80px; font-family: monospace; font-size: 10px; padding: 8px; border: 2px solid #000; background: #f8fafc;"
                :value="exportJson"
              ></textarea>
            </div>
          </div>

        </aside>
      </div>

    </div>
  </div>
</template>
