<script setup>
import AppLogo from './AppLogo.vue';
const emit = defineEmits(['start', 'settings']);
</script>

<template>
  <div class="home-page">
    <!-- Neobrutalist background decorations -->
    <!-- Star Top Left -->
    <div
      class="fa home-deco home-deco-star-tl"
      style="top: 8%; left: 8%; color: #ff4cb0; font-size: 90px; text-shadow: 5px 5px 0 #000;"
    >
      ✦
    </div>

    <!-- Settings Button Top Right -->
    <button
      class="btn-3d home-settings-btn"
      @click="emit('settings')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
    <!-- Box Top Right -->
    <div
      class="fb home-deco home-deco-box-tr"
      style="top: 12%; right: 12%; width: 110px; height: 110px; background: #00e5ff;
        border: 5px solid #000; box-shadow: 8px 8px 0 #000; transform: rotate(15deg);"
    ></div>
    <!-- Box Bottom Left -->
    <div
      class="fc home-deco home-deco-box-bl"
      style="bottom: 15%; left: 10%; width: 140px; height: 80px; background: #ff6b35;
        border: 5px solid #000; box-shadow: -8px 8px 0 #000; transform: rotate(-10deg);"
    ></div>
    <!-- Star Bottom Right -->
    <div
      class="fa home-deco home-deco-star-br"
      style="bottom: 10%; right: 10%; color: #ffd700; font-size: 100px; text-shadow: 5px 5px 0 #000;"
    >
      ✦
    </div>
    <!-- Small elements -->
    <div
      class="fb home-deco home-deco-sm-1"
      style="top: 40%; left: 5%; width: 30px; height: 30px; background: #a855f7;
        border: 3px solid #000; border-radius: 50%; box-shadow: 3px 3px 0 #000;"
    ></div>
    <div
      class="fc home-deco home-deco-sm-2"
      style="bottom: 40%; right: 6%; width: 40px; height: 40px; background: #fff;
        border: 4px solid #000; box-shadow: 4px 4px 0 #000; transform: rotate(45deg);"
    ></div>

    <!-- Main Content Container -->
    <div class="bounce-in home-card">
      <!-- Logo and Title -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; margin-bottom: 8px;">
        <h1 class="home-title">
          MOMENTBOX
        </h1>
      </div>
      
      <!-- Subtitle banner -->
      <div class="home-subtitle-wrap">
        <div class="home-subtitle-banner">
          <p class="home-subtitle-text">
            CAPTURE YOUR BEST MOMENTS!
          </p>
        </div>
      </div>

      <!-- Camera button -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: 24px;">
        <button
          class="pulse-cam home-cam-btn"
          @click="emit('start')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        
        <div class="home-cta-label">
          KLIK UNTUK MULAI
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f6f1e9;
  background-image: linear-gradient(0deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
}

.home-deco {
  position: absolute;
}

.home-settings-btn {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 64px;
  height: 64px;
  background: #c084fc;
  border: 4px solid #000;
  box-shadow: 6px 6px 0 #000;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  cursor: pointer;
}

.home-card {
  position: relative;
  z-index: 10;
  padding: 40px 60px;
  background: #ffffff;
  border: 6px solid #000;
  box-shadow: 16px 16px 0 #000;
  width: 90vw;
  max-width: 1000px;
  aspect-ratio: 16 / 9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.home-title {
  font-family: 'Bangers', cursive;
  font-size: clamp(60px, 12vw, 140px);
  color: #ff4cb0;
  letter-spacing: 5px;
  line-height: 1;
  text-shadow: 6px 6px 0 #000;
  margin: 0;
  padding: 0;
}

.home-subtitle-wrap {
  margin: 32px 0 48px;
}

.home-subtitle-banner {
  background: #ffd700;
  padding: 12px 32px;
  border: 4px solid #000;
  box-shadow: 6px 6px 0 #000;
  display: inline-block;
  transform: rotate(-3deg);
}

.home-subtitle-text {
  font-family: 'Bangers', cursive;
  font-size: clamp(16px, 3vw, 26px);
  color: #000;
  letter-spacing: 3px;
  margin: 0;
}

.home-cam-btn {
  width: 130px;
  height: 130px;
  background: #00e5ff;
  border-radius: 50%;
  border: 6px solid #000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 8px 8px 0 #000;
  cursor: pointer;
  outline: none;
  padding: 0;
}

.home-cta-label {
  background: #111;
  color: #fff;
  font-family: 'Bangers', cursive;
  font-size: 18px;
  letter-spacing: 3px;
  padding: 8px 24px;
  border: 3px solid #000;
  box-shadow: 4px 4px 0 #ff4cb0;
}

/* ===== MOBILE ===== */
@media (max-width: 768px) {
  .home-card {
    aspect-ratio: unset;
    padding: 30px 20px;
    width: 92vw;
    box-shadow: 10px 10px 0 #000;
    border-width: 4px;
  }

  .home-title {
    font-size: clamp(42px, 14vw, 80px);
    text-shadow: 4px 4px 0 #000;
  }

  .home-subtitle-wrap {
    margin: 20px 0 30px;
  }

  .home-subtitle-banner {
    padding: 8px 18px;
    box-shadow: 4px 4px 0 #000;
  }

  .home-cam-btn {
    width: 100px;
    height: 100px;
    box-shadow: 6px 6px 0 #000;
    border-width: 5px;
  }

  .home-cam-btn svg {
    width: 48px;
    height: 48px;
  }

  .home-cta-label {
    font-size: 15px;
    padding: 6px 18px;
  }

  .home-settings-btn {
    width: 48px;
    height: 48px;
    top: 16px;
    right: 16px;
    box-shadow: 4px 4px 0 #000;
    border-width: 3px;
  }

  .home-settings-btn svg {
    width: 24px;
    height: 24px;
  }

  .home-deco-star-tl {
    font-size: 50px !important;
    top: 4% !important;
    left: 4% !important;
  }

  .home-deco-box-tr {
    width: 60px !important;
    height: 60px !important;
    top: 6% !important;
    right: 6% !important;
    box-shadow: 5px 5px 0 #000 !important;
  }

  .home-deco-box-bl {
    width: 80px !important;
    height: 50px !important;
    bottom: 8% !important;
    left: 5% !important;
    box-shadow: -5px 5px 0 #000 !important;
  }

  .home-deco-star-br {
    font-size: 55px !important;
    bottom: 5% !important;
    right: 5% !important;
  }

  .home-deco-sm-1 {
    width: 20px !important;
    height: 20px !important;
  }

  .home-deco-sm-2 {
    width: 25px !important;
    height: 25px !important;
  }
}
</style>
