<script setup>
import { computed } from 'vue';
import { frameConfigs } from '../data/frames';

const props = defineProps({
  frames: {
    type: Array,
    required: true,
  },
  photos: {
    type: Array,
    required: true,
  },
  customLayouts: {
    type: Array,
    default: () => [],
  },
});

const allFrames = computed(() => {
  const customOnes = props.customLayouts.map(layout => ({
    ...layout,
    id: layout.id,
    name: layout.name || 'CUSTOM FRAME',
    pattern: 'DESIGN SENDIRI',
    bg: '#ffffff',
    accent: '#00e5ff',
    patternBg: '#f0f9ff',
    btnText: '#000',
    isCustom: true,
  }));
  
  return [...customOnes, ...props.frames];
});

const emit = defineEmits(['select', 'go-home']);
</script>

<template>
  <div class="checkerboard frames-page">
    <!-- Header -->
    <div class="frames-header">
      <button
        class="btn-3d frames-back-btn"
        @click="emit('go-home')"
      >
        ✕
      </button>

      <div>
        <h2 class="frames-header-title">
          PILIH FRAME TEMA
        </h2>
        <p class="frames-header-sub">
          TENTUKAN TAMPILAN FOTO STRIP KAMU
        </p>
      </div>
    </div>

    <!-- Grid -->
    <div class="frames-grid">
      <div
        v-for="frame in allFrames"
        :key="frame.id"
        class="frame-card"
        style="background:white; border:4px solid #000; overflow:hidden; display:flex; flex-direction:column; cursor:pointer;"
        @click="emit('select', frame)"
      >
        <!-- Preview Area (FULL FRAME) -->
        <div 
          style="flex: 1; min-height: 200px; display: flex; align-items: center; justify-content: center; 
                 padding: 10px; background-image: radial-gradient(#ddd 1px, transparent 1px); background-size: 10px 10px;"
          :style="{ backgroundColor: frame.bg + '10' }"
        >
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative;">
            
            <!-- Actual Frame Image -->
            <img 
              v-if="frame.frameUrl" 
              :src="frame.frameUrl" 
              style="max-width: 100%; max-height: 180px; object-fit: contain; box-shadow: 6px 6px 0 rgba(0,0,0,0.1); border: 2px solid #000;" 
            />

            <!-- Detailed Visualization for default frames -->
            <div 
              v-else 
              style="width: 80px; height: 200px; border: 3px solid #000; box-shadow: 6px 6px 0 rgba(0,0,0,0.1); 
                     display: flex; flex-direction: column; overflow: hidden;"
              :style="{ backgroundColor: frameConfigs[frame.id]?.bg || '#fff', borderColor: frameConfigs[frame.id]?.border || '#000' }"
            >
              <!-- Mini Header -->
              <div 
                style="height: 20px; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 900; color: #fff;"
                :style="{ background: frameConfigs[frame.id]?.headerBg || '#000', color: frameConfigs[frame.id]?.headerText || '#fff' }"
              >
                ✦ {{ frame.name }} ✦
              </div>

              <!-- Mini Photo Boxes -->
              <div style="flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
                <div v-for="n in 4" :key="n" style="flex: 1; background: #ddd; border: 1px solid rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
                   <span style="font-size: 6px; opacity: 0.3;">📷</span>
                </div>
              </div>

              <!-- Mini Footer -->
              <div 
                style="height: 10px; background: #eee; border-top: 1px solid rgba(0,0,0,0.1);"
                :style="{ background: frameConfigs[frame.id]?.footerBg || '#eee' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.frames-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background-color: #f6f1e9;
  min-height: 100vh;
  min-height: 100dvh;
}

.frames-header {
  background: #ff4cb0;
  padding: 14px 20px;
  border-bottom: 5px solid #000;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: 0 4px 0 #000;
}

.frames-back-btn {
  background: #000;
  color: white;
  border: 4px solid #000;
  width: 44px;
  height: 44px;
  font-size: 20px;
  cursor: pointer;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 4px 4px 0 #ff4cb0;
}

.frames-header-title {
  font-family: 'Bangers', cursive;
  font-size: 28px;
  color: white;
  letter-spacing: 2px;
  text-shadow: 2px 2px 0 #000;
  margin: 0;
}

.frames-header-sub {
  color: #ffe0f0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  margin: 0;
}

.frames-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px;
  padding: 30px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 767px) {
  .frames-page {
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
    overflow: visible;
  }

  .frames-header {
    padding: 10px 14px;
    gap: 10px;
  }

  .frames-back-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
    border-width: 3px;
  }

  .frames-header-title {
    font-size: 20px;
  }

  .frames-header-sub {
    font-size: 9px;
    letter-spacing: 1px;
  }

  .frames-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 14px;
    padding: 16px;
  }
}
</style>
