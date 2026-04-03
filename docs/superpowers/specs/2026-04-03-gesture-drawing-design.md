# 手势空中绘图应用设计文档

## 概述

基于摄像头的实时手势识别绘图应用，用户通过手指在空中书写、绘画。

## 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| MediaPipe Hands | 手势识别 | CDN |
| Canvas API | 绘图 | 原生 |
| WebRTC | 摄像头调用 | 原生 |
| HTML/CSS/JS | 前端 | 原生 |

## 功能需求

### 核心功能
1. **手势追踪** - 实时追踪食指指尖位置作为"笔尖"
2. **绘图模式** - 手指张开开始绘图，握拳停止
3. **颜色选择** - 调色板选择笔刷颜色
4. **笔刷大小** - 滑块调整粗细
5. **清除功能** - 清除全部内容
6. **保存图片** - 导出为 PNG

### 手势识别规则
- **绘图激活**: 食指伸出，其他手指弯曲
- **停止绘图**: 握拳或手掌张开
- **笔尖位置**: 食指指尖关键点 (landmark 8)

## 系统架构

```
┌─────────────────────────────────────────┐
│              HTML 页面                   │
├─────────────────────────────────────────┤
│  <video>     <canvas id="draw">        │
│  摄像头流      绘图层                    │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│          MediaPipe Hands                │
│  - 获取摄像头流                          │
│  - 处理视频帧                            │
│  - 输出 21 个手部关键点                   │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│          手势状态机                       │
│  - 判断绘图/停止状态                      │
│  - 计算指尖坐标                          │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│          Canvas 绑图                    │
│  - 绑制路径                              │
│  - 应用颜色/大小                         │
└─────────────────────────────────────────┘
```

## 文件结构

```
/
├── index.html        # 主页面
├── style.css         # 样式
├── app.js            # 主应用逻辑
└── README.md         # 说明文档
```

## 详细设计

### 1. HTML 结构 (index.html)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>手势绘图</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- 工具栏 -->
  <div id="toolbar">
    <input type="color" id="colorPicker">
    <input type="range" id="brushSize" min="1" max="50" value="5">
    <button id="clearBtn">清除</button>
    <button id="saveBtn">保存</button>
  </div>
  
  <!-- 画布容器 -->
  <div id="canvas-container">
    <video id="video" autoplay playsinline></video>
    <canvas id="draw"></canvas>
    <canvas id="feedback"></canvas>
  </div>
  
  <!-- MediaPipe CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils"></script>
  <script src="app.js"></script>
</body>
</html>
```

### 2. CSS 样式 (style.css)

- 视频和画布层叠，视频作为背景
- 绘图层透明，显示绑制内容
- 反馈层显示手部骨架
- 工具栏固定在顶部

### 3. JavaScript 逻辑 (app.js)

#### 3.1 模块划分

```javascript
// 配置
const CONFIG = { ... }

// 状态管理
const state = {
  isDrawing: false,
  lastPoint: null,
  color: '#ff0000',
  brushSize: 5
}

// 初始化 MediaPipe Hands
function initHands() { ... }

// 初始化摄像头
function initCamera() { ... }

// 处理手势结果
function onResults(results) { ... }

// 判断绘图手势
function isDrawingGesture(landmarks) { ... }

// 绑制路径
function draw(x, y) { ... }

// 工具栏事件
function setupToolbar() { ... }
```

#### 3.2 手势判断逻辑

```javascript
function isDrawingGesture(landmarks) {
  // 食指伸出: landmark[8].y < landmark[6].y
  // 中指弯曲: landmark[12].y > landmark[10].y
  // 无名指弯曲: landmark[16].y > landmark[14].y
  // 小指弯曲: landmark[20].y > landmark[18].y
  
  const indexExtended = landmarks[8].y < landmarks[6].y
  const middleBent = landmarks[12].y > landmarks[10].y
  const ringBent = landmarks[16].y > landmarks[14].y
  const pinkyBent = landmarks[20].y > landmarks[18].y
  
  return indexExtended && middleBent && ringBent && pinkyBent
}
```

#### 3.3 绘图流程

```
摄像头帧 → MediaPipe 处理 → 输出关键点
                              ↓
                        判断手势状态
                              ↓
                   是绘图手势? ──否──→ 停止绘图
                        │
                        是
                        ↓
                    获取指尖坐标
                        ↓
                    绑制到 Canvas
```

## 用户体验

1. 打开页面，请求摄像头权限
2. 将手放入摄像头视野
3. 伸出食指开始绘图
4. 握拳或移开手停止
5. 可随时切换颜色、调整大小
6. 点击清除重新开始
7. 点击保存下载图片

## 错误处理

| 场景 | 处理 |
|------|------|
| 摄像头权限拒绝 | 提示用户授权 |
| 浏览器不支持 | 提示使用 Chrome/Edge |
| 手势识别不稳定 | 增加平滑处理 |
| 性能问题 | 降低视频分辨率 |

## 测试计划

1. Chrome/Edge 浏览器测试
2. 不同光线环境测试
3. 不同手型测试
4. 性能测试（FPS 监控）

## 后续扩展

- [ ] 手机端支持
- [ ] 更多手势（撤销、重做）
- [ ] 电子花绳游戏模式
- [ ] 多人协作