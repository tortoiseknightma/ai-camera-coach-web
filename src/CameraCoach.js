// src/CameraCoach.js
import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- 配置区 ---
const API_KEY = 'AIzaSyB-yqkHhnY201EBFpmzamtmzwjVsT2VZ1k'; // !! 替换成你的API Key
const PROMPT = "You are a camera assistant. For the given photo, do the following:\n Step 1: Classify the user's photo intent. Choose ONE or TWO intents from this list: [Portrait, Social, Food, Landscape, Architecture, Object].\n Step 2: Identify ONE or TWO short issues in the photo composition, focusing on subject placement, balance, clutter, or perspective.\n Step 3: Suggest ONE or TWO concrete camera adjustments only from this list: [Pan left, Pan right, Tilt up, Tilt down, Zoom in, Zoom out, Shift left, Shift right, Shift up, Shift down, Move forward, Move backward].\n Format as:\n Intent: [Option] or [Option1, Option2]. Do NOT explain. Do NOT add extra text.\n Diagnosis: [Issue] or [Issue1, Issue2]. Keep them concise, like bullet points.\n Adjustment: [Adjustment] or [Adjustment1, Adjustment2]. Always choose one clear option or a valid non-contradictory combination.";// ---

// 初始化 Gemini
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// 将base64数据转换为API需要的格式
function fileToGenerativePart(base64, mimeType) {
  return {
    inlineData: {
      data: base64.split(',')[1], // 移除 "data:image/jpeg;base64," 前缀
      mimeType
    },
  };
}

function CameraCoach() {
  const webcamRef = useRef(null);
  const [aiFeedback, setAiFeedback] = useState('请将镜头对准拍摄对象，然后点击“获取建议”');
  const [isProcessing, setIsProcessing] = useState(false);

  // 核心功能：捕获图像并调用API，现在由按钮手动触发
  const handleAnalyzeImage = useCallback(async () => {
    if (isProcessing) return; // 防止在处理过程中重复点击

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setAiFeedback('无法捕获图像，请重试。');
      return;
    }

    setIsProcessing(true);
    setAiFeedback('正在分析图片...');

    try {
      const imagePart = fileToGenerativePart(imageSrc, "image/jpeg");
      const result = await model.generateContent([PROMPT, imagePart]);
      const response = await result.response;
      const text = response.text();
      setAiFeedback(text);
    } catch (error) {
      console.error("Error analyzing image:", error);
      setAiFeedback('AI分析失败，请检查API Key或网络连接。');
    } finally {
      setIsProcessing(false); // 请求结束后，允许再次点击
    }
  }, [isProcessing]); // 依赖isProcessing以获取最新状态

  // ** [修改] ** 定时器相关的 useEffect 已被移除

  // 用户手动拍照
  const handleCapture = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    // 创建一个链接并模拟点击来下载图片
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `capture-${new Date().getTime()}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.container}>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        style={styles.webcam}
        videoConstraints={{ facingMode: "environment" }} // 优先使用后置摄像头
      />
      <div style={styles.overlayContainer}>
        {/* 顶部AI反馈区域 */}
        <div style={styles.feedbackBox}>
          <p style={styles.feedbackText}>{aiFeedback}</p>
        </div>

        {/* ** [修改] ** 底部按钮容器 */}
        <div style={styles.bottomControls}>
          {/* 新增的“获取建议”按钮 */}
          <button 
            onClick={handleAnalyzeImage} 
            disabled={isProcessing} // 处理中时禁用按钮
            style={isProcessing ? {...styles.controlButton, ...styles.disabledButton} : styles.controlButton}
          >
            {isProcessing ? '分析中...' : '获取建议'}
          </button>

          {/* 原有的拍照按钮 */}
          <button onClick={handleCapture} style={styles.captureButton}>
            拍照
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 样式区 (有更新) ---
const styles = {
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000',
  },
  webcam: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
  },
  feedbackBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '10px',
    padding: '10px 15px',
    maxWidth: '90%',
    marginTop: '20px',
  },
  feedbackText: {
    color: 'white',
    fontSize: '16px',
    margin: 0,
  },
  // ** [新增] ** 底部按钮容器样式
  bottomControls: {
    display: 'flex',
    justifyContent: 'space-around', // 让按钮均匀分布
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px', // 限制最大宽度
  },
  // ** [新增] ** 普通控制按钮样式
  controlButton: {
    backgroundColor: '#007AFF', // 蓝色背景
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    padding: '12px 24px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  // ** [新增] ** 禁用状态的样式
  disabledButton: {
    backgroundColor: '#555',
    cursor: 'not-allowed',
  },
  captureButton: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    border: '4px solid white',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    cursor: 'pointer',
    fontSize: '18px',
    color: 'black',
  },
};

export default CameraCoach;