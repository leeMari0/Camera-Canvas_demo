# 手势空中绘图应用实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个基于摄像头的实时手势识别绘图应用，用户通过手指在空中书写、绘画。

**Architecture:** 使用 MediaPipe Hands 进行手势识别，Canvas API 进行绘图，WebRTC 调用摄像头。视频流作为背景层，绘图层透明叠加显示绘制内容。

**Tech Stack:** HTML5, CSS3, JavaScript (ES6+), MediaPipe Hands, Canvas API, WebRTC

---

## 文件结构

```
/
├── index.html        # 主页面结构
├── style.css         # 样式和布局
├── app.js            # 主应用逻辑（手势识别、绘图、工具栏）
└── docs/
    └── superpowers/
        ├── specs/    # 设计文档
        └── plans/    # 实施计划
```

---

## Chunk 1: 项目基础结构

### Task 1: 创建 HTML 页面结构

**Files:**
- Create: `index.html`

- [ ] **Step 1: 创建 HTML 骨架和元数据**

创建 `index.html` 文件：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>手势空中绘图</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <div id="toolbar">
      <div class="tool-group">
        <label for="colorPicker">颜色:</label>
        <input type="color" id="colorPicker" value="#ff0000">
      </div>
      <div class="tool-group">
        <label for="brushSize">大小:</label>
        <input type="range" id="brushSize" min="1" max="50" value="5">
        <span id="sizeValue">5</span>
      </div>
      <div class="tool-group">
        <button id="clearBtn">清除</button>
        <button id="saveBtn">保存</button>
      </div>
    </div>
    <div id="canvas-container">
      <video id="video" autoplay playsinline></video>
      <canvas id="draw"></canvas>
      <canvas id="feedback"></canvas>
    </div>
    <div id="status">
      <span id="statusText">正在初始化...</span>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js" crossorigin="anonymous"></script>
  <script src="app.js"></script>
</body>
</html>
```

---

### Task 2: 创建 CSS 样式

**Files:**
- Create: `style.css`

- [ ] **Step 1: 创建基础样式和布局**

创建 `style.css` 文件：

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#app {
  width: 100%;
  max-width: 1280px;
  padding: 20px;
}

#toolbar {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 15px 20px;
  background: #16213e;
  border-radius: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

label {
  font-size: 14px;
  color: #aaa;
}

#colorPicker {
  width: 50px;
  height: 35px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

#brushSize {
  width: 100px;
}

#sizeValue {
  min-width: 30px;
  text-align: center;
}

button {
  padding: 8px 20px;
  background: #0f3460;
  color: #eee;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

button:hover {
  background: #1a4f7a;
}

button:active {
  background: #0d2847;
}

#canvas-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  max-height: 70vh;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}

#video, #draw, #feedback {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

#video {
  object-fit: cover;
  transform: scaleX(-1);
}

#draw {
  z-index: 2;
  transform: scaleX(-1);
}

#feedback {
  z-index: 3;
  pointer-events: none;
}

#status {
  margin-top: 15px;
  padding: 10px;
  text-align: center;
  font-size: 14px;
  color: #aaa;
}

.drawing-active {
  background: rgba(255, 0, 0, 0.1);
}
```

---

### Task 3: 创建 JavaScript 主文件框架

**Files:**
- Create: `app.js`

- [ ] **Step 1: 创建应用配置和状态管理**

创建 `app.js` 文件，添加配置和状态：

```javascript
// 配置
const CONFIG = {
  minBrushSize: 1,
  maxBrushSize: 50,
  smoothingFactor: 0.3,
  drawThreshold: 0.02
};

// 状态管理
const state = {
  isDrawing: false,
  lastPoint: null,
  color: '#ff0000',
  brushSize: 5,
  smoothedPoint: null
};

// DOM 元素
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

// Canvas 上下文
let drawCtx = null;
let feedbackCtx = null;

// MediaPipe Hands 实例
let hands = null;
let camera = null;
```

- [ ] **Step 2: 创建初始化函数**

继续在 `app.js` 中添加：

```javascript
// 初始化 DOM 元素
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

// 设置 Canvas 尺寸
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

// 更新状态文本
function updateStatus(text) {
  elements.statusText.textContent = text;
}
```

---

## Chunk 2: 手势识别

### Task 4: 初始化 MediaPipe Hands

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 创建 MediaPipe Hands 初始化函数**

在 `app.js` 中添加：

```javascript
// 初始化 MediaPipe Hands
function initHands() {
  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
    }
  });
  
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  });
  
  hands.onResults(onResults);
  
  updateStatus('MediaPipe Hands 已初始化');
}
```

---

### Task 5: 初始化摄像头

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 创建摄像头初始化函数**

在 `app.js` 中添加：

```javascript
// 初始化摄像头
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      }
    });
    
    elements.video.srcObject = stream;
    
    elements.video.onloadedmetadata = () => {
      elements.video.play();
      setupCanvas();
      
      camera = new Camera(elements.video, {
        onFrame: async () => {
          await hands.send({ image: elements.video });
        },
        width: 1280,
        height: 720
      });
      
      camera.start();
      updateStatus('摄像头已启动，请将手放入画面');
    };
  } catch (error) {
    console.error('摄像头初始化失败:', error);
    updateStatus('摄像头初始化失败，请检查权限设置');
  }
}
```

---

### Task 6: 实现手势识别逻辑

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 创建手势判断函数**

在 `app.js` 中添加：

```javascript
// 判断是否为绘图手势（食指伸出，其他手指弯曲）
function isDrawingGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  
  const indexTip = landmarks[8];
  const indexPip = landmarks[6];
  const middleTip = landmarks[12];
  const middlePip = landmarks[10];
  const ringTip = landmarks[16];
  const ringPip = landmarks[14];
  const pinkyTip = landmarks[20];
  const pinkyPip = landmarks[18];
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  
  const indexExtended = indexTip.y < indexPip.y;
  const middleBent = middleTip.y > middlePip.y;
  const ringBent = ringTip.y > ringPip.y;
  const pinkyBent = pinkyTip.y > pinkyPip.y;
  
  return indexExtended && middleBent && ringBent && pinkyBent;
}

// 获取食指指尖坐标
function getFingerTip(landmarks) {
  const tip = landmarks[8];
  return {
    x: tip.x * elements.drawCanvas.width,
    y: tip.y * elements.drawCanvas.height
  };
}

// 平滑处理
function smoothPoint(point) {
  if (!state.smoothedPoint) {
    state.smoothedPoint = point;
    return point;
  }
  
  state.smoothedPoint.x += (point.x - state.smoothedPoint.x) * CONFIG.smoothingFactor;
  state.smoothedPoint.y += (point.y - state.smoothedPoint.y) * CONFIG.smoothingFactor;
  
  return { ...state.smoothedPoint };
}
```

---

### Task 7: 实现手势结果处理

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 创建结果处理函数**

在 `app.js` 中添加：

```javascript
// 处理 MediaPipe 结果
function onResults(results) {
  feedbackCtx.clearRect(0, 0, elements.feedbackCanvas.width, elements.feedbackCanvas.height);
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    drawHandSkeleton(landmarks);
    
    const isDrawing = isDrawingGesture(landmarks);
    const currentPoint = getFingerTip(landmarks);
    const smoothedPoint = smoothPoint(currentPoint);
    
    if (isDrawing) {
      if (state.lastPoint) {
        draw(state.lastPoint, smoothedPoint);
      }
      state.lastPoint = smoothedPoint;
      state.isDrawing = true;
      updateStatus('绑图中...');
    } else {
      state.lastPoint = null;
      state.isDrawing = false;
      updateStatus('已识别手部，伸出食指开始绑图');
    }
  } else {
    state.lastPoint = null;
    state.isDrawing = false;
    state.smoothedPoint = null;
    updateStatus('请将手放入画面');
  }
}

// 绘制手部骨架
function drawHandSkeleton(landmarks) {
  drawConnectors(feedbackCtx, landmarks, HAND_CONNECTIONS, {
    color: '#00FF00',
    lineWidth: 2
  });
  
  drawLandmarks(feedbackCtx, landmarks, {
    color: '#FF0000',
    lineWidth: 1,
    radius: 3
  });
}
```

---

## Chunk 3: 绘图和工具栏功能

### Task 8: 实现绑图功能

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 创建绑图函数**

在 `app.js` 中添加：

```javascript
// 绘制线条
function draw(from, to) {
  drawCtx.strokeStyle = state.color;
  drawCtx.lineWidth = state.brushSize;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  
  drawCtx.beginPath();
  drawCtx.moveTo(from.x, from.y);
  drawCtx.lineTo(to.x, to.y);
  drawCtx.stroke();
}

// 清除画布
function clearCanvas() {
  drawCtx.clearRect(0, 0, elements.drawCanvas.width, elements.drawCanvas.height);
  updateStatus('画布已清除');
}

// 保存图片
function saveImage() {
  const link = document.createElement('a');
  link.download = `gesture-drawing-${Date.now()}.png`;
  link.href = elements.drawCanvas.toDataURL('image/png');
  link.click();
  updateStatus('图片已保存');
}
```

---

### Task 9: 实现工具栏事件

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 创建工具栏事件绑定函数**

在 `app.js` 中添加：

```javascript
// 设置工具栏事件
function setupToolbar() {
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

// 窗口大小调整
function handleResize() {
  setupCanvas();
}
```

---

### Task 10: 应用入口

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 创建应用启动函数**

在 `app.js` 中添加：

```javascript
// 初始化应用
async function init() {
  initElements();
  setupToolbar();
  initHands();
  await initCamera();
  
  window.addEventListener('resize', handleResize);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
```

---

## 测试计划

### 手动测试步骤

1. **基础功能测试**
   - 打开 `index.html`（使用本地服务器或 VS Code Live Server）
   - 允许摄像头权限
   - 检查摄像头画面显示

2. **手势识别测试**
   - 将手放入画面
   - 检查手部骨架是否正确绘制
   - 测试食指伸出识别

3. **绘图测试**
   - 伸出食指开始绘图
   - 检查线条是否跟随手指
   - 握拳停止绘图

4. **工具栏测试**
   - 更改颜色，检查是否生效
   - 调整笔刷大小，检查是否生效
   - 点击清除，检查画布是否清空
   - 点击保存，检查是否下载图片

5. **性能测试**
   - 检查帧率是否流畅
   - 检查是否有明显延迟

### 浏览器兼容性

- Chrome 90+
- Edge 90+
- Firefox（部分支持，需要测试）

---

## 注意事项

1. **必须使用 HTTPS 或 localhost**：WebRTC 要求安全环境
2. **摄像头权限**：首次使用需要用户授权
3. **光线环境**：良好的光线环境可以提高识别准确率
4. **手势距离**：保持手与摄像头 30-60cm 距离