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

// [新增] 创建一个独立的图片保存函数
const saveImageToLocal = (imageSrc) => {
  if (!imageSrc) return;

  // 创建一个a标签并模拟点击来下载图片
  const link = document.createElement('a');
  link.href = imageSrc;
  // 使用时间戳命名文件，确保唯一性
  link.download = `photo-coach-${new Date().getTime()}.jpeg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


function CameraCoach() {
  const webcamRef = useRef(null);
  const [aiFeedback, setAiFeedback] = useState('请将镜头对准拍摄对象，然后点击“获取建议”');
  const [isProcessing, setIsProcessing] = useState(false);

  // [修改] 核心功能：捕获、保存并调用API
  const handleAnalyzeAndSaveImage = useCallback(async () => {
    if (isProcessing) return; 

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setAiFeedback('无法捕获图像，请重试。');
      return;
    }

    // --- 新增的核心逻辑 ---
    // 步骤1：立即保存图片到本地
    saveImageToLocal(imageSrc);
    // --- 结束 ---

    // 步骤2：继续执行AI分析
    setIsProcessing(true);
    setAiFeedback('正在分析图片...');

    try {
      const imagePart = fileToGenerativePart(imageSrc, "image/jpeg");
      const result = await model.generateContent([PROMPT, imagePart]);
      const response = await result.response;
      const text = response.text();
      setAiFeedback(text);
    } catch (error) {
      // --- 核心改动在这里 ---
      console.error("【AI分析失败】详细错误信息:", error); // 开发者看的详细日志

      // [修改] 创建一个对用户更友好的消息变量
      let userFriendlyMessage = '发生未知错误，请稍后再试。';

      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes("api key not valid") || errorMessage.includes("[400]")) {
          userFriendlyMessage = 'AI分析失败：API Key 无效，请检查您的 Key 是否正确配置。';
        } else if (errorMessage.includes("permission denied") || errorMessage.includes("[403]")) {
          userFriendlyMessage = 'AI分析失败：API 权限不足。请确保您已在 Google Cloud 项目中启用了所需的 API 服务。';
        } else if (errorMessage.includes("rate limit") || errorMessage.includes("[429]")) {
          userFriendlyMessage = '请求过于频繁，已超出速率限制，请稍等一分钟再试。';
        } else if (errorMessage.includes("content was blocked")) {
          userFriendlyMessage = '分析被拒绝：图片或提示词可能因安全策略被拦截。请尝试更换图片。';
        } else if (errorMessage.includes("[500]") || errorMessage.includes("[503]")) {
          userFriendlyMessage = 'AI 服务端出现临时问题 (错误码 5xx)，请稍后再试。';
        }
      }
      
      setAiFeedback(userFriendlyMessage); // 更新UI，显示更具体的错误信息
      // --- 核心改动结束 ---
    } finally {
      setIsProcessing(false); 
    }
  }, [isProcessing]); 

  return (
    <div style={styles.container}>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        style={styles.webcam}
        videoConstraints={{ facingMode: "environment" }} 
      />
      <div style={styles.overlayContainer}>
        {/* 顶部AI反馈区域 */}
        <div style={styles.feedbackBox}>
          <p style={styles.feedbackText}>{aiFeedback}</p>
        </div>

        {/* [修改] 底部按钮现在只有一个 */}
        <div style={styles.bottomControls}>
          <button 
            onClick={handleAnalyzeAndSaveImage} 
            disabled={isProcessing}
            style={isProcessing ? {...styles.captureButton, ...styles.disabledButton} : styles.captureButton}
          >
            {isProcessing ? '...' : '拍摄并获取建议'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 样式区 (有少量修改) ---
const styles = {
  container: { position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#000' },
  webcam: { width: '100%', height: '100%', objectFit: 'cover' },
  overlayContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '20px',
  },
  feedbackBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: '10px', padding: '10px 15px', maxWidth: '90%', marginTop: '20px',
  },
  feedbackText: { color: 'white', fontSize: '16px', margin: 0 },
  bottomControls: { display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', paddingBottom: '30px' },
  captureButton: { // 复用拍照按钮的样式
    width: '100px', height: '100px', borderRadius: '50%',
    border: '4px solid white', backgroundColor: 'rgba(255, 255, 255, 0.3)',
    cursor: 'pointer', fontSize: '18px', color: 'white', fontWeight: 'bold',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  disabledButton: { opacity: 0.6, cursor: 'not-allowed' },
};

export default CameraCoach;