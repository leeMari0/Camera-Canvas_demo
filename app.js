const CONFIG = {
  minBrushSize: 1,
  maxBrushSize: 50,
  smoothingFactor: 0.4,
  eraserSize: 50
};

const state = {
  color: '#ff0000',
  brushSize: 5,
  smoothedDraw: null,
  lastPoint: null,
  isDrawing: false,
  smoothedPoints: {},
  time: 0
};

const elements = {
  video: null,
  drawCanvas: null,
  feedbackCanvas: null,
  colorPicker: null,
  brushSize: null,
  sizeValue: null,
  clearBtn: null,
  saveBtn: null,
  statusText: null,
  canvasContainer: null
};

let drawCtx = null;
let feedbackCtx = null;
let hands = null;
let camera = null;

const FINGER_TIPS = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const FINGER_PIPS = { thumb: 3, index: 6, middle: 10, ring: 14, pinky: 18 };

function initElements() {
  elements.video = document.getElementById('video');
  elements.drawCanvas = document.getElementById('draw');
  elements.feedbackCanvas = document.getElementById('feedback');
  elements.colorPicker = document.getElementById('colorPicker');
  elements.brushSize = document.getElementById('brushSize');
  elements.sizeValue = document.getElementById('sizeValue');
  elements.clearBtn = document.getElementById('clearBtn');
  elements.saveBtn = document.getElementById('saveBtn');
  elements.statusText = document.getElementById('statusText');
  elements.canvasContainer = document.getElementById('canvas-container');
  
  drawCtx = elements.drawCanvas.getContext('2d');
  feedbackCtx = elements.feedbackCanvas.getContext('2d');
}

function setupCanvas() {
  const container = elements.canvasContainer;
  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  
  elements.drawCanvas.width = width;
  elements.drawCanvas.height = height;
  elements.feedbackCanvas.width = width;
  elements.feedbackCanvas.height = height;
}

function updateStatus(text) {
  elements.statusText.textContent = text;
}

function initHands() {
  if (typeof Hands === 'undefined') {
    console.error('MediaPipe Hands not loaded');
    updateStatus('❌ 手势识别库未加载，请刷新页面');
    return;
  }
  
  console.log('开始初始化 MediaPipe Hands...');
  
  try {
    hands = new Hands({
      locateFile: (file) => {
        const url = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
        console.log('Loading:', url);
        return url;
      }
    });
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: isMobile ? 0 : 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5
    });
    
    hands.onResults(onResults);
    
    console.log('MediaPipe Hands 配置完成');
    updateStatus('手势识别已准备就绪');
  } catch (error) {
    console.error('MediaPipe Hands 初始化失败:', error);
    updateStatus('❌ 手势识别初始化失败: ' + error.message);
  }
}

async function initCamera() {
  try {
    updateStatus('正在请求摄像头权限...');
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const videoWidth = isMobile ? 640 : 1280;
    const videoHeight = isMobile ? 480 : 720;
    
    if (isIOS && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      updateStatus('⚠️ iOS需要HTTPS才能访问摄像头');
      showMobileTip('iOS设备需要HTTPS环境\n请部署到HTTPS服务器或使用:\nnpx localtunnel --port 8080');
      return;
    }
    
    updateStatus('获取摄像头流...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: videoWidth },
        height: { ideal: videoHeight },
        facingMode: 'user'
      },
      audio: false
    });
    
    updateStatus('摄像头权限已获取');
    
    elements.video.srcObject = stream;
    
    elements.video.onloadedmetadata = async () => {
      updateStatus('视频元数据已加载');
      
      try {
        await elements.video.play();
        updateStatus('视频播放成功');
      } catch (playError) {
        console.error('视频播放失败:', playError);
        updateStatus('视频播放失败: ' + playError.message);
        return;
      }
      
      setupCanvas();
      
      updateStatus('初始化手势识别...');
      
      try {
        const initPromise = hands.initialize();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('初始化超时')), 10000)
        );
        
        await Promise.race([initPromise, timeoutPromise]);
        updateStatus('手势识别已初始化');
      } catch (handsError) {
        console.error('手势识别初始化失败:', handsError);
        updateStatus('⚠️ 手势识别加载失败，使用基础模式');
      }
      
      animate();
      
      try {
        camera = new Camera(elements.video, {
          onFrame: async () => {
            try {
              await hands.send({ image: elements.video });
            } catch (sendError) {
              console.error('帧处理错误:', sendError);
            }
          },
          width: videoWidth,
          height: videoHeight
        });
        
        camera.start();
      } catch (cameraError) {
        console.error('相机启动失败:', cameraError);
        updateStatus('⚠️ 相机启动失败，请刷新页面');
      }
      
      if (isIOS) {
        updateStatus('✅ 摄像头已启动 | 建议横屏使用');
      } else if (isMobile) {
        updateStatus('✅ 摄像头已启动 | 保持手机稳定');
      } else {
        updateStatus('✅ 准备就绪 | 请允许摄像头访问');
      }
    };
    
    elements.video.onerror = (videoError) => {
      console.error('视频错误:', videoError);
      updateStatus('❌ 视频加载错误');
    };
    
  } catch (error) {
    console.error('摄像头初始化失败:', error);
    console.error('错误详情:', error.name, error.message);
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (error.name === 'NotAllowedError') {
      updateStatus('❌ 摄像头权限被拒绝');
      if (isMobile) {
        showMobileTip('摄像头权限被拒绝\n\n请在 Safari 设置中:\n1. 点击网站设置\n2. 允许摄像头访问\n\n或重新加载页面');
      }
    } else if (error.name === 'NotFoundError') {
      updateStatus('❌ 未找到摄像头设备');
      showMobileTip('未检测到摄像头\n\n请检查设备是否有前置摄像头');
    } else if (error.name === 'NotSupportedError') {
      updateStatus('❌ 浏览器不支持摄像头');
      showMobileTip('浏览器不支持摄像头访问\n\n请使用 Safari (iOS)\n或 Chrome (Android)');
    } else if (error.name === 'OverconstrainedError') {
      updateStatus('⚠️ 摄像头参数不支持，尝试降级...');
      await tryFallbackCamera();
    } else if (error.name === 'AbortError') {
      updateStatus('❌ 摄像头访问被中止');
      showMobileTip('摄像头访问被中止\n\n可能原因:\n- 其他应用占用摄像头\n- 系统限制\n\n请关闭其他使用摄像头的应用后重试');
    } else if (error.name === 'NotReadableError') {
      updateStatus('❌ 摄像头被占用');
      showMobileTip('摄像头被其他应用占用\n\n请关闭其他使用摄像头的应用后重试');
    } else {
      updateStatus('❌ 摄像头初始化失败: ' + error.name);
      showMobileTip('摄像头初始化失败\n\n错误: ' + error.name + '\n' + error.message + '\n\n请刷新页面重试');
    }
  }
}

async function tryFallbackCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });
    
    elements.video.srcObject = stream;
    await elements.video.play();
    setupCanvas();
    animate();
    
    camera = new Camera(elements.video, {
      onFrame: async () => {
        await hands.send({ image: elements.video });
      },
      width: 640,
      height: 480
    });
    
    camera.start();
    updateStatus('摄像头已启动(降级模式)');
  } catch (fallbackError) {
    updateStatus('摄像头无法启动');
  }
}

function showMobileTip(message) {
  const tip = document.createElement('div');
  tip.id = 'mobile-tip';
  tip.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9);
    color: #fff;
    padding: 20px 30px;
    border-radius: 10px;
    font-size: 14px;
    text-align: center;
    z-index: 10000;
    white-space: pre-line;
    max-width: 80%;
  `;
  tip.textContent = message;
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.cssText = `
    margin-top: 15px;
    padding: 8px 20px;
    background: #0f3460;
    color: #fff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  `;
  closeBtn.onclick = () => document.body.removeChild(tip);
  
  tip.appendChild(closeBtn);
  document.body.appendChild(tip);
}

function isFingerExtended(landmarks, finger) {
  const tip = landmarks[FINGER_TIPS[finger]];
  const pip = landmarks[FINGER_PIPS[finger]];
  
  if (finger === 'thumb') {
    return Math.abs(tip.x - pip.x) > 0.04;
  }
  
  return tip.y < pip.y;
}

function getExtendedFingerCount(landmarks) {
  let count = 0;
  ['index', 'middle', 'ring', 'pinky'].forEach(f => {
    if (isFingerExtended(landmarks, f)) count++;
  });
  return count;
}

function getFingerTip(landmarks, finger = 'index') {
  const tip = landmarks[FINGER_TIPS[finger]];
  return {
    x: tip.x * elements.drawCanvas.width,
    y: tip.y * elements.drawCanvas.height
  };
}

function getExtendedFingers(landmarks) {
  const extended = [];
  ['index', 'middle', 'ring', 'pinky'].forEach(finger => {
    if (isFingerExtended(landmarks, finger)) {
      extended.push(finger);
    }
  });
  return extended;
}

function smoothPoint(point, key) {
  if (!key) {
    if (!state.smoothedDraw) {
      state.smoothedDraw = { x: point.x, y: point.y };
      return point;
    }
    state.smoothedDraw.x += (point.x - state.smoothedDraw.x) * CONFIG.smoothingFactor;
    state.smoothedDraw.y += (point.y - state.smoothedDraw.y) * CONFIG.smoothingFactor;
    return { x: state.smoothedDraw.x, y: state.smoothedDraw.y };
  }
  
  if (!state.smoothedPoints[key]) {
    state.smoothedPoints[key] = { x: point.x, y: point.y };
    return point;
  }
  
  state.smoothedPoints[key].x += (point.x - state.smoothedPoints[key].x) * CONFIG.smoothingFactor;
  state.smoothedPoints[key].y += (point.y - state.smoothedPoints[key].y) * CONFIG.smoothingFactor;
  
  return { x: state.smoothedPoints[key].x, y: state.smoothedPoints[key].y };
}

function onResults(results) {
  if (!feedbackCtx || !elements.feedbackCanvas) {
    console.error('Canvas not initialized');
    return;
  }
  
  feedbackCtx.clearRect(0, 0, elements.feedbackCanvas.width, elements.feedbackCanvas.height);
  
  const handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
  
  if (handCount === 0) {
    state.lastPoint = null;
    state.isDrawing = false;
    state.smoothedDraw = null;
    updateStatus('请将手放入画面');
    return;
  }
  
  console.log('检测到手势:', handCount, '只手');
  
  if (handCount === 1) {
    handleSingleHand(results.multiHandLandmarks[0]);
  } else if (handCount === 2) {
    handleTwoHands(results.multiHandLandmarks[0], results.multiHandLandmarks[1]);
  }
}

function handleSingleHand(hand) {
  drawHandSkeleton(hand);
  
  const extendedCount = getExtendedFingerCount(hand);
  
  if (extendedCount >= 4) {
    state.isDrawing = false;
    state.lastPoint = null;
    state.smoothedDraw = null;
    
    const palmCenter = getPalmCenter(hand);
    erase(palmCenter);
    drawEraserIndicator(palmCenter);
    updateStatus('橡皮擦模式 🧹');
    return;
  }
  
  if (extendedCount === 1 && isFingerExtended(hand, 'index')) {
    state.isDrawing = true;
    
    const currentPoint = getFingerTip(hand, 'index');
    const smoothedPoint = smoothPoint(currentPoint);
    
    if (state.lastPoint) {
      drawLine(state.lastPoint, smoothedPoint);
    }
    state.lastPoint = smoothedPoint;
    updateStatus('绘图中 ✏️');
    return;
  }
  
  state.isDrawing = false;
  state.lastPoint = null;
  state.smoothedDraw = null;
  updateStatus('伸出食指绘图，张开手掌擦除');
}

function handleTwoHands(hand1, hand2) {
  drawHandSkeleton(hand1, '#00ffff');
  drawHandSkeleton(hand2, '#ff00ff');
  
  state.isDrawing = false;
  state.lastPoint = null;
  state.smoothedDraw = null;
  
  const extended1 = getExtendedFingers(hand1);
  const extended2 = getExtendedFingers(hand2);
  
  if (extended1.length >= 2 && extended2.length >= 2) {
    const tips1 = extended1.slice(0, 2).map(f => smoothPoint(getFingerTip(hand1, f), `h1_${f}`));
    const tips2 = extended2.slice(0, 2).map(f => smoothPoint(getFingerTip(hand2, f), `h2_${f}`));
    
    const orderedPoints = [tips1[0], tips2[0], tips2[1], tips1[1]];
    drawCyberShape(orderedPoints);
    updateStatus(`花绳模式 (${extended1.length}+${extended2.length}指) ✨`);
  } else if (extended1.length >= 1 && extended2.length >= 1) {
    const tip1 = smoothPoint(getFingerTip(hand1, extended1[0]), 'h1_line');
    const tip2 = smoothPoint(getFingerTip(hand2, extended2[0]), 'h2_line');
    
    drawCyberLine(tip1, tip2);
    updateStatus('双指连线 ✨');
  } else {
    state.smoothedPoints = {};
    updateStatus('双手请伸出手指连线');
  }
}

function getPalmCenter(landmarks) {
  const points = [0, 5, 9, 13, 17];
  let sumX = 0, sumY = 0;
  points.forEach(i => {
    sumX += landmarks[i].x;
    sumY += landmarks[i].y;
  });
  return {
    x: (sumX / points.length) * elements.drawCanvas.width,
    y: (sumY / points.length) * elements.drawCanvas.height
  };
}

function drawEraserIndicator(point) {
  feedbackCtx.strokeStyle = '#ff6b6b';
  feedbackCtx.lineWidth = 2;
  feedbackCtx.beginPath();
  feedbackCtx.arc(point.x, point.y, CONFIG.eraserSize, 0, Math.PI * 2);
  feedbackCtx.stroke();
  
  feedbackCtx.fillStyle = 'rgba(255, 107, 107, 0.2)';
  feedbackCtx.fill();
}

function drawHandSkeleton(landmarks, color = '#00FF00') {
  if (typeof drawConnectors === 'function' && typeof HAND_CONNECTIONS !== 'undefined') {
    try {
      drawConnectors(feedbackCtx, landmarks, HAND_CONNECTIONS, {
        color: color,
        lineWidth: 2
      });
    } catch (e) {
      console.warn('drawConnectors failed:', e);
    }
  } else {
    console.warn('drawConnectors or HAND_CONNECTIONS not available');
  }
  
  if (typeof drawLandmarks === 'function') {
    try {
      drawLandmarks(feedbackCtx, landmarks, {
        color: '#FF0000',
        lineWidth: 1,
        radius: 3
      });
    } catch (e) {
      console.warn('drawLandmarks failed:', e);
    }
  } else {
    drawSimpleLandmarks(landmarks);
  }
}

function drawSimpleLandmarks(landmarks) {
  feedbackCtx.fillStyle = '#FF0000';
  landmarks.forEach(point => {
    feedbackCtx.beginPath();
    feedbackCtx.arc(
      point.x * elements.feedbackCanvas.width,
      point.y * elements.feedbackCanvas.height,
      3, 0, Math.PI * 2
    );
    feedbackCtx.fill();
  });
}

function drawLine(from, to) {
  drawCtx.strokeStyle = state.color;
  drawCtx.lineWidth = state.brushSize;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  
  drawCtx.beginPath();
  drawCtx.moveTo(from.x, from.y);
  drawCtx.lineTo(to.x, to.y);
  drawCtx.stroke();
}

function erase(point) {
  drawCtx.save();
  drawCtx.globalCompositeOperation = 'destination-out';
  drawCtx.beginPath();
  drawCtx.arc(point.x, point.y, CONFIG.eraserSize, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.restore();
}

function drawCyberShape(points) {
  const colors = ['#00ffff', '#ff00ff', '#00ffff', '#ff00ff'];
  
  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    const color = colors[i % colors.length];
    
    feedbackCtx.strokeStyle = color;
    feedbackCtx.lineWidth = 3;
    feedbackCtx.lineCap = 'round';
    feedbackCtx.shadowColor = color;
    feedbackCtx.shadowBlur = 15;
    
    feedbackCtx.beginPath();
    feedbackCtx.moveTo(from.x, from.y);
    feedbackCtx.lineTo(to.x, to.y);
    feedbackCtx.stroke();
    
    feedbackCtx.strokeStyle = '#ffffff';
    feedbackCtx.lineWidth = 2;
    feedbackCtx.shadowBlur = 0;
    feedbackCtx.beginPath();
    feedbackCtx.moveTo(from.x, from.y);
    feedbackCtx.lineTo(to.x, to.y);
    feedbackCtx.stroke();
  }
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const color = colors[i % colors.length];
    
    feedbackCtx.fillStyle = color;
    feedbackCtx.shadowColor = color;
    feedbackCtx.shadowBlur = 20;
    feedbackCtx.beginPath();
    feedbackCtx.arc(point.x, point.y, 10, 0, Math.PI * 2);
    feedbackCtx.fill();
    
    feedbackCtx.fillStyle = '#ffffff';
    feedbackCtx.shadowBlur = 0;
    feedbackCtx.beginPath();
    feedbackCtx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    feedbackCtx.fill();
  }
  
  feedbackCtx.shadowBlur = 0;
}

function drawCyberLine(from, to) {
  const gradient = feedbackCtx.createLinearGradient(from.x, from.y, to.x, to.y);
  gradient.addColorStop(0, '#00ffff');
  gradient.addColorStop(1, '#ff00ff');
  
  feedbackCtx.strokeStyle = gradient;
  feedbackCtx.lineWidth = 3;
  feedbackCtx.lineCap = 'round';
  feedbackCtx.shadowColor = '#00ffff';
  feedbackCtx.shadowBlur = 15;
  
  feedbackCtx.beginPath();
  feedbackCtx.moveTo(from.x, from.y);
  feedbackCtx.lineTo(to.x, to.y);
  feedbackCtx.stroke();
  
  feedbackCtx.strokeStyle = '#ffffff';
  feedbackCtx.lineWidth = 2;
  feedbackCtx.shadowBlur = 0;
  feedbackCtx.beginPath();
  feedbackCtx.moveTo(from.x, from.y);
  feedbackCtx.lineTo(to.x, to.y);
  feedbackCtx.stroke();
  
  feedbackCtx.fillStyle = '#ffffff';
  feedbackCtx.shadowColor = '#00ffff';
  feedbackCtx.shadowBlur = 15;
  feedbackCtx.beginPath();
  feedbackCtx.arc(from.x, from.y, 8, 0, Math.PI * 2);
  feedbackCtx.fill();
  
  feedbackCtx.shadowColor = '#ff00ff';
  feedbackCtx.beginPath();
  feedbackCtx.arc(to.x, to.y, 8, 0, Math.PI * 2);
  feedbackCtx.fill();
  
  feedbackCtx.shadowBlur = 0;
}

function animate() {
  state.time++;
  requestAnimationFrame(animate);
}

function clearCanvas() {
  drawCtx.clearRect(0, 0, elements.drawCanvas.width, elements.drawCanvas.height);
  updateStatus('画布已清除');
}

function saveImage() {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  if (isIOS) {
    const dataUrl = elements.drawCanvas.toDataURL('image/png');
    const blob = dataURLtoBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    
    updateStatus('图片已生成，长按保存');
    
    const img = new Image();
    img.src = url;
    img.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1000;background:#000';
    img.onload = () => {
      document.body.appendChild(img);
      img.onclick = () => {
        document.body.removeChild(img);
        URL.revokeObjectURL(url);
      };
    };
  } else {
    const link = document.createElement('a');
    link.download = `gesture-drawing-${Date.now()}.png`;
    link.href = elements.drawCanvas.toDataURL('image/png');
    link.click();
    updateStatus('图片已保存');
  }
}

function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

function setupToolbar() {
  elements.colorPicker.value = state.color;
  elements.brushSize.value = state.brushSize;
  elements.sizeValue.textContent = state.brushSize;
  
  elements.colorPicker.addEventListener('input', (e) => {
    state.color = e.target.value;
  });
  
  elements.brushSize.addEventListener('input', (e) => {
    state.brushSize = parseInt(e.target.value);
    elements.sizeValue.textContent = state.brushSize;
  });
  
  elements.clearBtn.addEventListener('click', clearCanvas);
  elements.saveBtn.addEventListener('click', saveImage);
}

function handleResize() {
  setupCanvas();
  state.smoothedDraw = null;
  state.smoothedPoints = {};
}

async function init() {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isHTTPS = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  
  if (isIOS && !isHTTPS) {
    showMobileTip(
      '⚠️ iOS 需要HTTPS环境\n' +
      '当前地址: ' + window.location.href + '\n\n' +
      '解决方案:\n' +
      '1. 使用 npx localtunnel --port 8080\n' +
      '2. 部署到HTTPS服务器'
    );
    return;
  }
  
  if (!checkBrowserSupport()) {
    return;
  }
  
  initElements();
  setupToolbar();
  initHands();
  await initCamera();
  
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 100);
  });
  
  if ('ontouchstart' in window) {
    document.body.addEventListener('touchstart', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
      }
    }, { passive: false });
  }
}

function checkBrowserSupport() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    updateStatus('浏览器不支持摄像头，请使用Chrome/Safari');
    return false;
  }
  
  if (!window.WebGLRenderingContext) {
    updateStatus('浏览器不支持WebGL，请使用现代浏览器');
    return false;
  }
  
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  if (isIOS && !window.webkit) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!isSafari && !window.webkit.messageHandlers) {
      updateStatus('iOS请使用Safari浏览器');
      return true;
    }
  }
  
  if (isAndroid) {
    const isChrome = /Chrome/i.test(navigator.userAgent);
    if (!isChrome) {
      updateStatus('Android推荐使用Chrome浏览器');
      return true;
    }
  }
  
  return true;
}

document.addEventListener('DOMContentLoaded', init);