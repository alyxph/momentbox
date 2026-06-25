<script setup>
import { computed, ref, onMounted, nextTick } from 'vue';
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
  selectedFrame: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['select', 'go-home']);

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

const selectedLocalFrame = ref(null);
const carouselRef = ref(null);

const tripledFrames = computed(() => {
  if (allFrames.value.length === 0) return [];
  return [...allFrames.value, ...allFrames.value, ...allFrames.value];
});

onMounted(() => {
  if (props.selectedFrame) {
    selectedLocalFrame.value = allFrames.value.find(f => f.id === props.selectedFrame.id) || allFrames.value[0];
  } else {
    selectedLocalFrame.value = allFrames.value[0];
  }
  
  nextTick(() => {
    setTimeout(() => {
      if (carouselRef.value && allFrames.value.length > 0) {
        const idx = allFrames.value.findIndex(f => f.id === selectedLocalFrame.value?.id);
        const N = allFrames.value.length;
        const targetDOMIndex = N + (idx >= 0 ? idx : 0);
        const targetCardEl = carouselRef.value.children[targetDOMIndex];
        if (targetCardEl) {
          targetCardEl.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
      }
    }, 100);
  });
});

function selectFrame(frame, index) {
  selectedLocalFrame.value = frame;
  nextTick(() => {
    if (carouselRef.value) {
      const clickedEl = carouselRef.value.children[index];
      if (clickedEl) {
        clickedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });
}

function handleNext() {
  if (selectedLocalFrame.value) {
    emit('select', selectedLocalFrame.value);
  }
}

function scrollLeft() {
  if (carouselRef.value && allFrames.value.length > 0) {
    const currentIndex = allFrames.value.findIndex(f => f.id === selectedLocalFrame.value?.id);
    let nextIndex = currentIndex - 1;
    if (nextIndex < 0) {
      nextIndex = allFrames.value.length - 1;
    }
    const nextFrame = allFrames.value[nextIndex];
    selectedLocalFrame.value = nextFrame;
    
    nextTick(() => {
      const N = allFrames.value.length;
      const targetDOMIndex = N + nextIndex;
      const targetCardEl = carouselRef.value?.children[targetDOMIndex];
      if (targetCardEl) {
        targetCardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }
}

function scrollRight() {
  if (carouselRef.value && allFrames.value.length > 0) {
    const currentIndex = allFrames.value.findIndex(f => f.id === selectedLocalFrame.value?.id);
    let nextIndex = currentIndex + 1;
    if (nextIndex >= allFrames.value.length) {
      nextIndex = 0;
    }
    const nextFrame = allFrames.value[nextIndex];
    selectedLocalFrame.value = nextFrame;
    
    nextTick(() => {
      const N = allFrames.value.length;
      const targetDOMIndex = N + nextIndex;
      const targetCardEl = carouselRef.value?.children[targetDOMIndex];
      if (targetCardEl) {
        targetCardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }
}

function handleScroll() {
  const el = carouselRef.value;
  if (!el) return;
  
  const N = allFrames.value.length;
  if (N === 0) return;
  
  const children = el.children;
  if (children.length < N * 3) return;
  
  const middleStart = children[N].offsetLeft - (el.clientWidth - children[N].clientWidth) / 2;
  const middleEnd = children[N * 2].offsetLeft - (el.clientWidth - children[N * 2].clientWidth) / 2;
  const setScrollWidth = middleEnd - middleStart;
  
  const maxScroll = el.scrollWidth - el.clientWidth;
  
  // Only trigger jump reposition when getting very close to the extreme left/right edges.
  // This keeps the user within the middle/safe zone during 99% of scrolling, avoiding constant jumping conflicts.
  if (el.scrollLeft < 100) {
    el.scrollLeft += setScrollWidth;
  } else if (el.scrollLeft > maxScroll - 100) {
    el.scrollLeft -= setScrollWidth;
  }
}

function getBoxStyle(box, frame) {
  const fw = frame.frame?.width || 600;
  const fh = frame.frame?.height || 1800;
  return {
    left: `${(box.x / fw) * 100}%`,
    top: `${(box.y / fh) * 100}%`,
    width: `${(box.width / fw) * 100}%`,
    height: `${(box.height / fh) * 100}%`,
    position: 'absolute',
    backgroundColor: '#8A3DFF', // Vibrant purple
    borderRadius: '4px',
    boxShadow: 'inset 0 0 8px rgba(0, 0, 0, 0.4)',
    border: '1.5px solid rgba(255, 255, 255, 0.1)',
  };
}

const defaultBoxes = [
  { id: 1, x: 40, y: 240, width: 520, height: 345 },
  { id: 2, x: 40, y: 605, width: 520, height: 345 },
  { id: 3, x: 40, y: 970, width: 520, height: 345 },
  { id: 4, x: 40, y: 1335, width: 520, height: 345 }
];
</script>

<template>
  <div class="frames-page-wrapper">
    <!-- Background Bokeh Blobs -->
    <div class="blob blob-pink"></div>
    <div class="blob blob-orange"></div>

    <!-- Floating Back Button -->
    <button
      class="back-button-floating"
      @click="emit('go-home')"
      title="Kembali ke Beranda"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <!-- Header Section -->
    <div class="page-header">
      <h1 class="page-title">Choose Template</h1>
    </div>

    <!-- Carousel Section -->
    <div class="carousel-container-outer">
      <!-- Left Arrow -->
      <button class="carousel-nav-btn prev-btn" @click="scrollLeft" aria-label="Sebelumnya">
        <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      <!-- Carousel -->
      <div class="frames-carousel" ref="carouselRef" @scroll="handleScroll">
        <div
          v-for="(frame, index) in tripledFrames"
          :key="frame.id + '-' + index"
          class="frame-card-new"
          :class="{ 'selected': selectedLocalFrame && selectedLocalFrame.id === frame.id }"
          @click="selectFrame(frame, index)"
        >
          <!-- Frame Strip Container wrapper -->
          <div class="frame-strip-wrapper">
            
            <!-- Custom/Preset Frame (Image Overlay + Purple Placeholders) -->
            <div 
              v-if="frame.frameUrl" 
              class="frame-strip-container" 
              :style="{ aspectRatio: (frame.frame?.width || 600) + '/' + (frame.frame?.height || 1800) }"
            >
              <!-- Absolute Purple Placeholders Behind PNG -->
              <div
                v-for="box in frame.boxes"
                :key="box.id"
                :style="getBoxStyle(box, frame)"
              ></div>
              <!-- Frame PNG overlay -->
              <img :src="frame.frameUrl" class="frame-overlay-img" alt="Frame Overlay" />
            </div>

            <!-- Default Frame Strip (Canvas CSS style + Purple Placeholders) -->
            <div 
              v-else 
              class="frame-strip-container default-frame-strip"
              :style="{ backgroundColor: frameConfigs[frame.id]?.bg || '#fff', borderColor: frameConfigs[frame.id]?.border || '#000', aspectRatio: '600/1800' }"
            >
              <!-- Header -->
              <div 
                class="default-frame-header"
                :style="{ background: frameConfigs[frame.id]?.headerBg || '#000', color: frameConfigs[frame.id]?.headerText || '#fff' }"
              >
                ✦ {{ frame.name }} ✦
              </div>

              <!-- Purple Photo Placeholders positioned identically to preview -->
              <div
                v-for="box in defaultBoxes"
                :key="box.id"
                :style="getBoxStyle(box, { frame: { width: 600, height: 1800 } })"
              ></div>

              <!-- Footer -->
              <div 
                class="default-frame-footer"
                :style="{ background: frameConfigs[frame.id]?.footerBg || '#eee' }"
              ></div>
            </div>

          </div>
        </div>
      </div>

      <!-- Right Arrow -->
      <button class="carousel-nav-btn next-btn" @click="scrollRight" aria-label="Berikutnya">
        <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>

    <!-- Bottom Button Section -->
    <div class="footer-btn-container">
      <button 
        class="btn-next" 
        @click="handleNext" 
        :disabled="!selectedLocalFrame"
      >
        Next! <span class="btn-arrow">→</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.frames-page-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 40px 20px;
  box-sizing: border-box;
  background-color: #E2F0D9; /* Soft green */
  background-image:
    linear-gradient(45deg, #d3e7c8 25%, transparent 25%),
    linear-gradient(-45deg, #d3e7c8 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d3e7c8 75%),
    linear-gradient(-45deg, transparent 75%, #d3e7c8 75%);
  background-size: 80px 80px;
  background-position: 0 0, 0 40px, 40px -40px, -40px 0px;
}

/* Background Blobs */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 1;
  pointer-events: none;
  opacity: 0.6;
}
.blob-pink {
  top: 15%;
  left: 10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 76, 176, 0.4) 0%, rgba(255, 76, 176, 0) 70%);
}
.blob-orange {
  bottom: 10%;
  right: 15%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(255, 140, 0, 0.45) 0%, rgba(255, 140, 0, 0) 70%);
}

/* Floating Back Button */
.back-button-floating {
  position: absolute;
  top: 24px;
  left: 24px;
  width: 64px;
  height: 64px;
  border-radius: 0;
  border: 4px solid #000000;
  background: #ff4cb0; /* Bright pink */
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000000;
  z-index: 10;
  cursor: pointer;
  transition: all 0.1s ease;
  box-shadow: 6px 6px 0 #000000;
}
.back-button-floating:hover {
  background: #ff60bd;
  transform: translate(-2px, -2px);
  box-shadow: 8px 8px 0 #000000;
}
.back-button-floating:active {
  transform: translate(4px, 4px);
  box-shadow: 0px 0px 0 #000000;
}
.back-button-floating svg {
  width: 40px;
  height: 40px;
  stroke: #000;
  stroke-width: 4;
}

/* Header/Title */
.page-header {
  position: relative;
  z-index: 5;
  text-align: center;
  margin-top: 10px;
}
.page-title {
  font-family: 'Nunito', sans-serif;
  font-weight: 900;
  font-size: 38px;
  color: #ffffff;
  text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.15);
  margin: 0;
  letter-spacing: -0.5px;
}

/* Carousel Container */
.carousel-container-outer {
  position: relative;
  width: 100%;
  max-width: 1200px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: auto 0;
  z-index: 5;
}

.frames-carousel {
  display: flex;
  overflow-x: auto;
  gap: 28px;
  padding: 20px 60px;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Hide scrollbar for Firefox */
}
.frames-carousel::-webkit-scrollbar {
  display: none; /* Hide scrollbar for Chrome/Safari/Opera */
}

/* Frame Card */
.frame-card-new {
  flex: 0 0 250px;
  height: 480px;
  scroll-snap-align: center;
  background: #252526; /* Charcoal grey background like mockup */
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
  user-select: none;
}
.frame-card-new:hover {
  transform: translateY(-8px) scale(1.02);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.35);
}
.frame-card-new.selected {
  border-color: #ffffff;
  box-shadow: 0 0 0 3px #ffffff, 0 15px 40px rgba(0, 0, 0, 0.4);
}

/* Frame Strip Wrapper & Containers */
.frame-strip-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.frame-strip-container {
  position: relative;
  height: 100%;
  max-height: 420px;
  max-width: 100%;
  border-radius: 4px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.8);
}

.frame-overlay-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  z-index: 2;
}

/* Default frame strip styles */
.default-frame-strip {
  width: 140px;
  height: 100%;
  position: relative;
  overflow: hidden;
  border: 3px solid #000;
}

.default-frame-header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 11.11%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-family: 'Bangers', cursive;
  letter-spacing: 1px;
  font-weight: 900;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 0 6px;
  text-align: center;
  z-index: 2;
}

.default-frame-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 5.55%;
  z-index: 2;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
}

/* Navigation Arrow Buttons */
.carousel-nav-btn {
  width: 50px;
  height: 50px;
  min-width: 50px;
  min-height: 50px;
  flex-shrink: 0;
  border-radius: 0;
  background: #ffffff;
  border: 4px solid #000000;
  color: #000000;
  font-size: 32px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.1s ease;
  box-shadow: 4px 4px 0 #000000;
  user-select: none;
  z-index: 10;
}
.carousel-nav-btn:hover {
  background: #f3f4f6;
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #000000;
}
.carousel-nav-btn:active {
  transform: translate(4px, 4px);
  box-shadow: 0px 0px 0 #000000;
}
.prev-btn {
  margin-right: 15px;
}
.next-btn {
  margin-left: 15px;
}

/* Bottom Button Container & Button */
.footer-btn-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
  z-index: 5;
}

.btn-next {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #7C3AED; /* Vibrant Violet */
  color: #ffffff;
  font-family: 'Nunito', sans-serif;
  font-weight: 900;
  font-size: 18px;
  padding: 14px 48px;
  border-radius: 30px;
  border: 3px solid #000000;
  box-shadow: 5px 5px 0 #000000;
  cursor: pointer;
  transition: all 0.1s ease;
  text-transform: capitalize;
}
.btn-next:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 7px 7px 0 #000000;
  background: #8B5CF6;
}
.btn-next:active:not(:disabled) {
  transform: translate(4px, 4px);
  box-shadow: 1px 1px 0 #000000;
}
.btn-next:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #cccccc;
  color: #888888;
  box-shadow: 2px 2px 0 #000000;
  border-color: #000000;
}
.btn-arrow {
  font-size: 20px;
  transition: transform 0.2s ease;
}
.btn-next:hover .btn-arrow {
  transform: translateX(4px);
}

/* Responsiveness overrides */
@media (max-width: 768px) {
  .frames-page-wrapper {
    padding: 30px 10px;
  }
  .page-title {
    font-size: 28px;
  }
  .back-button-floating {
    top: 8px;
    left: 8px;
    width: 42px;
    height: 42px;
    border-width: 3px;
    box-shadow: 3px 3px 0 #000000;
    border-radius: 0;
  }
  .back-button-floating svg {
    width: 24px;
    height: 24px;
    stroke-width: 3.5;
  }
  .carousel-nav-btn {
    display: none; /* Hide arrows on mobile touch devices */
  }
  .frames-carousel {
    padding: 10px 20px;
    gap: 18px;
  }
  .frame-card-new {
    flex: 0 0 210px;
    height: 400px;
    padding: 12px;
  }
  .frame-strip-container {
    max-height: 350px;
  }
  .default-frame-strip {
    width: 110px;
  }
  .default-frame-header {
    height: 32px;
    font-size: 10px;
  }
  .default-frame-boxes {
    padding: 8px 6px;
    gap: 6px;
  }
  .btn-next {
    padding: 12px 36px;
    font-size: 16px;
  }
}
</style>
