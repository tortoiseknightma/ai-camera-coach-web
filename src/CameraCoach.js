// src/CameraCoach.js
import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai'; // [新增] 导入OpenAI库


// --- 配置区 ---
const GEMINI_API_KEY = 'AIzaSyB-yqkHhnY201EBFpmzamtmzwjVsT2VZ1k'; // !! 替换成你的API Key
const GEMINI_PROMPT = "You are a camera assistant. For the given photo, do the following:\n Step 1: Classify the user's photo intent. Choose ONE or TWO intents from this list: [Portrait, Social, Food, Landscape, Architecture, Object].\n Step 2: Identify ONE or TWO short issues in the photo composition, focusing on subject placement, balance, clutter, or perspective.\n Step 3: Suggest ONE or TWO concrete camera adjustments only from this list: [Pan left, Pan right, Tilt up, Tilt down, Zoom in, Zoom out, Shift left, Shift right, Shift up, Shift down, Move forward, Move backward].\n Format as:\n Intent: [Option] or [Option1, Option2]. Do NOT explain. Do NOT add extra text.\n Diagnosis: [Issue] or [Issue1, Issue2]. Keep them concise, like bullet points.\n Adjustment: [Adjustment] or [Adjustment1, Adjustment2]. Always choose one clear option or a valid non-contradictory combination.";// ---

// --- [新增] Ark (OpenAI-Compatible) 配置区 ---
const ARK_API_KEY = '3b791088-c0b3-41da-a630-60a524702c4b'; // !! 替换成你的 Ark API Key
const ARK_MODEL_ID = 'doubao-seed-1-6-flash-250828'; // !! 替换成你的 Ark 模型 Endpoint ID
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

// --- SDK 初始化 ---
// 初始化 Gemini
const geminiAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }); // 使用有效的模型名称

// [新增] 初始化 Ark Client
const arkClient = new OpenAI({
  apiKey: ARK_API_KEY,
  baseURL: ARK_BASE_URL,
  dangerouslyAllowBrowser: true, // !! 重要：在浏览器端使用时必须添加此项
});

// --- 工具函数 ---
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
  const [aiFeedback, setAiFeedback] = useState('请选择模型并开始...');
  const [isProcessing, setIsProcessing] = useState(false);
  // [新增] 用于追踪当前模型的 State
  const [currentLLM, setCurrentLLM] = useState('gemini'); // 'gemini' 或 'ark'

  // [新增] 切换模型的函数
  const toggleLLM = () => {
    setCurrentLLM(prevLLM => {
      const newLLM = prevLLM === 'gemini' ? 'ark' : 'gemini';
      setAiFeedback(`模型已切换至 ${newLLM.toUpperCase()}。`);
      return newLLM;
    });
  };

  const handleAnalyzeAndSaveImage = useCallback(async () => {
    if (isProcessing) return; 

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setAiFeedback('无法捕获图像，请重试。');
      return;
    }
    saveImageToLocal(imageSrc);

    setIsProcessing(true);
    setAiFeedback(`正在使用 ${currentLLM.toUpperCase()} 分析图片...`);

    try {
      let responseText = '';
      
      // [修改] 根据当前模型执行不同的API调用
      if (currentLLM === 'gemini') {
        const imagePart = fileToGenerativePart(imageSrc, "image/jpeg");
        const result = await geminiModel.generateContent([GEMINI_PROMPT, imagePart]);
        const response = await result.response;
        responseText = response.text();

      } else if (currentLLM === 'ark') {
        const response = await arkClient.chat.completions.create({
          model: ARK_MODEL_ID,
          apikey: ARK_API_KEY,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: GEMINI_PROMPT }, // 同样使用之前的Prompt
                {
                  type: 'image_url',
                  image_url: {
                    url: imageSrc, // OpenAI SDK可以直接使用base64 data URL
                  },
                },
              ],
            },
          ],
        });
        responseText = response.choices[0].message.content;
      }

      setAiFeedback(responseText);

    } catch (error) {
      console.error(`Error with ${currentLLM.toUpperCase()} API:`, error);
      setAiFeedback(`调用 ${currentLLM.toUpperCase()} API 失败，请检查配置或网络。`);
    } finally {
      setIsProcessing(false); 
    }
  }, [isProcessing, currentLLM]); // 依赖中加入 currentLLM

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
        <div style={styles.feedbackBox}>
          <p style={styles.feedbackText}>{aiFeedback}</p>
        </div>
        
        <div style={styles.bottomControls}>
          {/* [新增] 模型切换按钮 */}
          <button onClick={toggleLLM} style={styles.toggleButton}>
            切换模型 ({currentLLM.toUpperCase()})
          </button>
          
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

// --- 样式区 ---
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
  feedbackText: { color: 'white', fontSize: '16px', margin: 0, whiteSpace: 'pre-wrap' }, // whiteSpace用于保留换行
  bottomControls: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', width: '100%', maxWidth: '400px', paddingBottom: '30px' },
  captureButton: {
    width: '100px', height: '100px', borderRadius: '50%', border: '4px solid white', 
    backgroundColor: 'rgba(255, 255, 255, 0.3)', cursor: 'pointer', fontSize: '16px', 
    color: 'white', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center'
  },
  disabledButton: { opacity: 0.6, cursor: 'not-allowed' },
  // [新增] 切换按钮样式
  toggleButton: {
    backgroundColor: '#007AFF', color: 'white', border: 'none',
    borderRadius: '20px', padding: '10px 15px', fontSize: '14px',
    cursor: 'pointer', fontWeight: 'bold',
  }
};

export default CameraCoach;