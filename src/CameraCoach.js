// src/CameraCoach.js
import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from '@google/generative-ai';
import packageJson from '../package.json';

// --- 配置区 ---
const API_KEY = 'AIzaSyB-yqkHhnY201EBFpmzamtmzwjVsT2VZ1k'; // !! 替换成你的API Key
const PROMPT = "You are a camera assistant. For the given photo, do the following:\n Step 1: Classify the user's photo intent. Choose ONE or TWO intents from this list: [Portrait, Social, Food, Landscape, Architecture, Object].\n Step 2: Identify ONE or TWO short issues in the photo composition, focusing on subject placement, balance, clutter, or perspective.\n Step 3: Suggest ONE or TWO concrete camera adjustments only from this list: [Pan left, Pan right, Tilt up, Tilt down, Zoom in, Zoom out, Shift left, Shift right, Shift up, Shift down, Move forward, Move backward].\n Format as:\n Intent: [Option] or [Option1, Option2]. Do NOT explain. Do NOT add extra text.\n Diagnosis: [Issue] or [Issue1, Issue2]. Keep them concise, like bullet points.\n Adjustment: [Adjustment] or [Adjustment1, Adjustment2]. Always choose one clear option or a valid non-contradictory combination.";// ---

// ... (其他函数如 genAI, model, fileToGenerativePart, saveImageToLocal 保持不变) ...
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

function fileToGenerativePart(base64, mimeType) {
  return {
    inlineData: {
      data: base64.split(',')[1],
      mimeType
    },
  };
}

const saveImageToLocal = (imageSrc) => {
  if (!imageSrc) return;
  const link = document.createElement('a');
  link.href = imageSrc;
  link.download = `photo-coach-${new Date().getTime()}.jpeg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


function CameraCoach() {
  const webcamRef = useRef(null);
  const [aiFeedback, setAiFeedback] = useState('请将镜头对准拍摄对象，然后点击“获取建议”');
  const [isProcessing, setIsProcessing] = useState(false);

  // handleAnalyzeAndSaveImage 函数保持不变
  const handleAnalyzeAndSaveImage = useCallback(async () => {
    if (isProcessing) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setAiFeedback('无法捕获图像，请重试。');
      return;
    }
    saveImageToLocal(imageSrc);
    setIsProcessing(true);
    setAiFeedback('正在分析图片...');
    try {
      const imagePart = fileToGenerativePart(imageSrc, "image/jpeg");
      const result = await model.generateContent([PROMPT, imagePart]);
      const response = await result.response;
      setAiFeedback(response.text());
    } catch (error) {
      console.error("【AI分析失败】详细错误信息:", error);
      let detailedErrorMessage = "调试信息：\n";
      if (error instanceof Error) {
        detailedErrorMessage += `错误类型: ${error.name}\n`;
        detailedErrorMessage += `错误信息: ${error.message}\n`;
        if(error.stack) {
           detailedErrorMessage += `堆栈跟踪: ${error.stack.substring(0, 200)}...`;
        }
      } else {
        detailedErrorMessage += `捕获到非标准错误: ${String(error)}`;
      }
      setAiFeedback(detailedErrorMessage);
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

        {/* 底部按钮 */}
        <div style={styles.bottomControls}>
          <button 
            onClick={handleAnalyzeAndSaveImage} 
            disabled={isProcessing}
            style={isProcessing ? {...styles.captureButton, ...styles.disabledButton} : styles.captureButton}
          >
            {isProcessing ? '...' : '获取建议并保存'}
          </button>
        </div>
      </div>

      {/* --- [新增] 版本号显示 --- */}
      <div style={styles.versionNumber}>
        v{packageJson.version}
      </div>
      {/* --- 结束 --- */}

    </div>
  );
}

// --- [修改] 样式区 ---
const styles = {
  // ... (container, webcam, overlayContainer 等样式保持不变) ...
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
  captureButton: {
    width: '100px', height: '100px', borderRadius: '50%',
    border: '4px solid white', backgroundColor: 'rgba(255, 255, 255, 0.3)',
    cursor: 'pointer', fontSize: '18px', color: 'white', fontWeight: 'bold',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  disabledButton: { opacity: 0.6, cursor: 'not-allowed' },

  // --- [新增] 版本号样式 ---
  versionNumber: {
    position: 'absolute', // 绝对定位
    bottom: '5px',        // 距离底部 5px
    right: '10px',        // 距离右侧 10px
    color: 'rgba(255, 255, 255, 0.5)', // 半透明白色
    fontSize: '12px',     // 小字体
    fontFamily: 'monospace', // 等宽字体
  }
};

export default CameraCoach;