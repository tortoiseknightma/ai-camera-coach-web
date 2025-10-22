// src/CameraCoach.js
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai'; // [新增] 导入OpenAI库

const content = {
  en: {
    // UI 文本
    initialFeedback: 'Please select a model and start...',
    switchModel: 'Model',
    switchLanguage: 'Language: EN',
    getAdviceAndSave: 'Advice & Save',
    getAdviceOnly: 'Get Advice',
    processing: 'Analyzing...',
    captureError: 'Failed to capture image. Please try again.',
    feedbackError: (model) => `Failed to call ${model} API. Please check configuration or network.`,
    // 大模型 Prompt
    prompt: "You are a camera assistant. For the given photo, do the following:\n Step 1: Classify the user's photo intent. Choose ONE or TWO intents from this list: [Portrait, Social, Food, Landscape, Architecture, Object].\n Step 2: Identify ONE or TWO short issues in the photo composition, focusing on subject placement, balance, clutter, or perspective.\n Step 3: Suggest ONE or TWO concrete camera adjustments only from this list: [Pan left, Pan right, Tilt up, Tilt down, Zoom in, Zoom out, Shift left, Shift right, Shift up, Shift down, Move forward, Move backward].\n Format as:\n Intent: [Option] or [Option1, Option2]. Do NOT explain. Do NOT add extra text.\n Diagnosis: [Issue] or [Issue1, Issue2]. Keep them concise, like bullet points.\n Adjustment: [Adjustment] or [Adjustment1, Adjustment2]. Always choose one clear option or a valid non-contradictory combination."
  },
  zh: {
    // UI 文本
    initialFeedback: '请选择模型并开始...',
    switchModel: '模型',
    switchLanguage: '语言: ZH',
    getAdviceAndSave: '建议并保存',
    getAdviceOnly: '获取建议',
    processing: '分析中...',
    captureError: '无法捕获图像，请重试。',
    feedbackError: (model) => `调用 ${model} API 失败，请检查配置或网络。`,
    // 大模型 Prompt
    prompt: "你是一位摄影助手。针对给定的照片，请完成以下步骤：\n步骤1：对用户的拍照意图进行分类。从此列表选择一个或两个意图：[人像, 社交, 食物, 风景, 建筑, 物体]。\n步骤2：指出照片构图中的一到两个简短问题，重点关注主体位置、平衡、杂乱或视角。\n步骤3：仅从此列表建议一到两个具体的相机调整：[向左平移, 向右平移, 向上倾斜, 向下倾斜, 放大, 缩小, 向左平移相机, 向右平移相机, 向上平移相机, 向下平移相机, 向前移动, 向后移动]。\n格式要求：\n意图：[选项] 或 [选项1, 选项2]。不要解释。不要添加额外文字。\n诊断：[问题] 或 [问题1, 问题2]。保持简洁，类似要点。\n调整：[调整] 或 [调整1, 调整2]。总是选择一个明确的选项或一个有效的、不矛盾的组合。"
  }
};


// --- 配置区 ---
const GEMINI_API_KEY = 'AIzaSyB-yqkHhnY201EBFpmzamtmzwjVsT2VZ1k'; // !! 替换成你的API Key
const GEMINI_PROMPT = "You are a camera assistant. For the given photo, do the following:\n Step 1: Classify the user's photo intent. Choose ONE or TWO intents from this list: [Portrait, Social, Food, Landscape, Architecture, Object].\n Step 2: Identify ONE or TWO short issues in the photo composition, focusing on subject placement, balance, clutter, or perspective.\n Step 3: Suggest ONE or TWO concrete camera adjustments only from this list: [Pan left, Pan right, Tilt up, Tilt down, Zoom in, Zoom out, Shift left, Shift right, Shift up, Shift down, Move forward, Move backward].\n Format as:\n Intent: [Option] or [Option1, Option2]. Do NOT explain. Do NOT add extra text.\n Diagnosis: [Issue] or [Issue1, Issue2]. Keep them concise, like bullet points.\n Adjustment: [Adjustment] or [Adjustment1, Adjustment2]. Always choose one clear option or a valid non-contradictory combination.";// ---

// --- [新增] Ark (OpenAI-Compatible) 配置区 ---
const ARK_API_KEY = '3b791088-c0b3-41da-a630-60a524702c4b'; // !! 替换成你的 Ark API Key
const ARK_MODEL_ID = 'doubao-seed-1-6-flash-250828'; // !! 替换成你的 Ark 模型 Endpoint ID
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

const QWEN_API_KEY = 'sk-b2bc37c05e7843abb200904466bf9347';
const QWEN_MODEL_ID = 'qwen3-omni-flash'; // 使用支持视觉的通用模型
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// --- SDK 初始化 ---
const geminiAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const arkClient = new OpenAI({
  apiKey: ARK_API_KEY,
  baseURL: ARK_BASE_URL,
  dangerouslyAllowBrowser: true,
});

const qwenClient = new OpenAI({
  apiKey: QWEN_API_KEY,
  baseURL: QWEN_BASE_URL,
  dangerouslyAllowBrowser: true,
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

// 定义模型列表，方便切换
const models = ['gemini', 'ark', 'qwen'];

function CameraCoach() {
  const webcamRef = useRef(null);
  const [language, setLanguage] = useState('zh');
  const [aiFeedback, setAiFeedback] = useState(content[language].initialFeedback);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLLM, setCurrentLLM] = useState('gemini');
  const [analyzedImage, setAnalyzedImage] = useState(null);

  const [zoom, setZoom] = useState(1);
  const [zoomSupport, setZoomSupport] = useState({
    isSupported: false,
    min: 1,
    max: 1,
    step: 0.1,
  });

  useEffect(() => {
    const checkZoomCapabilities = async () => {
      if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
        const stream = webcamRef.current.video.srcObject;
        const videoTrack = stream.getVideoTracks()[0];
        
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          try {
            const capabilities = videoTrack.getCapabilities();
            if (capabilities.zoom) {
              console.log('Zoom is supported!');
              setZoomSupport({
                isSupported: true,
                min: capabilities.zoom.min,
                max: capabilities.zoom.max,
                step: capabilities.zoom.step,
              });
              setZoom(capabilities.zoom.min);
            } else {
              console.log('Zoom is not supported by this camera.');
            }
          } catch (error) {
            console.error('Error getting capabilities:', error);
          }
        }
      }
    };

    const timeoutId = setTimeout(checkZoomCapabilities, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleZoomChange = async (event) => {
    const newZoomValue = parseFloat(event.target.value);
    setZoom(newZoomValue);

    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
      const stream = webcamRef.current.video.srcObject;
      const videoTrack = stream.getVideoTracks()[0];
      try {
        await videoTrack.applyConstraints({
          advanced: [{ zoom: newZoomValue }]
        });
      } catch (error) {
        console.error('Failed to apply zoom constraints:', error);
      }
    }
  };

  const toggleLanguage = () => {
    setLanguage(prevLang => (prevLang === 'en' ? 'zh' : 'en'));
  };

  const toggleLLM = () => {
    setCurrentLLM(prevLLM => {
      const currentIndex = models.indexOf(prevLLM);
      const nextIndex = (currentIndex + 1) % models.length;
      const newLLM = models[nextIndex];
      setAiFeedback(`模型已切换至 ${newLLM.toUpperCase()}。`);
      return newLLM;
    });
  };

  const getAiFeedback = async (imageSrc) => {
    setAnalyzedImage(imageSrc);
    setIsProcessing(true);
    setAiFeedback(''); 

    try {
      let responseText = '';
      const currentPrompt = content[language].prompt;

      if (currentLLM === 'gemini') {
        const imagePart = fileToGenerativePart(imageSrc, "image/jpeg");
        const result = await geminiModel.generateContent([currentPrompt, imagePart]);
        responseText = result.response.text();
        setAiFeedback(responseText);

      } else if (currentLLM === 'ark') {
        const response = await arkClient.chat.completions.create({
          model: ARK_MODEL_ID,
          messages: [{ role: 'user', content: [{ type: 'text', text: currentPrompt }, { type: 'image_url', image_url: { url: imageSrc } }] }],
        });
        responseText = response.choices[0].message.content;
        setAiFeedback(responseText);

      } else if (currentLLM === 'qwen') {
        const stream = await qwenClient.chat.completions.create({
          model: QWEN_MODEL_ID,
          messages: [{ role: 'user', content: [{ type: 'text', text: currentPrompt }, { type: 'image_url', image_url: { url: imageSrc } }] }],
          stream: true,
        });

        for await (const chunk of stream) {
          const textChunk = chunk.choices[0]?.delta?.content || "";
          if (textChunk) {
            setAiFeedback(prevFeedback => prevFeedback + textChunk);
          }
        }
      }
    } catch (error) {
      console.error(`Error with ${currentLLM.toUpperCase()} API:`, error);
      setAiFeedback(content[language].feedbackError(currentLLM.toUpperCase()));
      setAnalyzedImage(null); 
    } finally {
      setIsProcessing(false); 
    }
  };

  const handleAnalyzeAndSaveImage = useCallback(async () => {
    if (isProcessing) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setAiFeedback(content[language].captureError);
      return;
    }
    saveImageToLocal(imageSrc);
    getAiFeedback(imageSrc);
  }, [isProcessing, currentLLM, language]);

  const handleAnalyzeOnly = useCallback(async () => {
    if (isProcessing) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setAiFeedback(content[language].captureError);
      return;
    }
    getAiFeedback(imageSrc);
  }, [isProcessing, currentLLM, language]);


  return (
    <div style={styles.container}>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        style={styles.webcam}
        videoConstraints={{ facingMode: "environment" }} 
      />

      {zoomSupport.isSupported && (
        <div style={styles.zoomControls}>
          <input
            type="range"
            min={zoomSupport.min}
            max={zoomSupport.max}
            step={zoomSupport.step}
            value={zoom}
            onChange={handleZoomChange}
            style={styles.zoomSlider}
          />
        </div>
      )}
      
      <div style={styles.overlayContainer}>
        <div style={styles.feedbackBox}>
          <p style={styles.feedbackText}>{aiFeedback}</p>
        </div>
        
        {analyzedImage && (
          <div style={styles.floatingImageContainer}>
            <img src={analyzedImage} alt="Analyzed frame" style={styles.analyzedImagePreview} />
            <button onClick={() => setAnalyzedImage(null)} style={styles.closeButton}>
              &times;
            </button>
          </div>
        )}

        <div style={styles.bottomControls}>
          <button onClick={toggleLanguage} style={styles.utilityButton}>
            {content[language].switchLanguage}
          </button>
          
          <button onClick={toggleLLM} style={styles.utilityButton}>
            {content[language].switchModel}: {currentLLM.toUpperCase()}
          </button>
          
          <button 
            onClick={handleAnalyzeAndSaveImage} 
            disabled={isProcessing}
            style={isProcessing ? {...styles.captureButton, ...styles.disabledButton} : styles.captureButton}
          >
            {isProcessing ? '...' : content[language].getAdviceAndSave}
          </button>

          <button 
            onClick={handleAnalyzeOnly}
            disabled={isProcessing}
            style={styles.secondaryButton}
          >
            {content[language].getAdviceOnly}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 样式区 ---
const styles = {
  container: { 
    position: 'relative', 
    width: '100vw', 
    height: '100vh', 
    backgroundColor: '#000' 
  },
  webcam: { 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover' 
  },
  overlayContainer: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '20px',
    pointerEvents: 'none',
  },
  feedbackBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
    borderRadius: '10px', 
    padding: '10px 15px', 
    maxWidth: '90%', 
    marginTop: '20px', 
    pointerEvents: 'auto',
  },
  feedbackText: { 
    color: 'white', 
    fontSize: '16px', 
    margin: 0, 
    whiteSpace: 'pre-wrap' 
  },
  bottomControls: { 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexWrap: 'wrap',
    gap: '10px',
    width: '100%', 
    maxWidth: '500px', 
    paddingBottom: '20px', 
    pointerEvents: 'auto',
  },
  captureButton: {
    width: '100px', 
    height: '100px', 
    borderRadius: '50%', 
    border: '4px solid white', 
    backgroundColor: 'rgba(255, 255, 255, 0.3)', 
    cursor: 'pointer', 
    fontSize: '16px', 
    color: 'white', 
    fontWeight: 'bold', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    textAlign: 'center', 
    order: 3,
    flexShrink: 0,
  },
  disabledButton: { 
    opacity: 0.6, 
    cursor: 'not-allowed' 
  },
  utilityButton: {
    backgroundColor: '#007AFF', 
    color: 'white', 
    border: 'none',
    borderRadius: '20px', 
    padding: '10px 15px', 
    fontSize: '12px',
    cursor: 'pointer', 
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(128, 128, 128, 0.5)', 
    color: 'white', 
    border: '1px solid white',
    borderRadius: '20px', 
    padding: '10px 15px', 
    fontSize: '14px',
    cursor: 'pointer', 
    fontWeight: 'bold',
  },
  floatingImageContainer: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    width: '120px',
    height: 'auto',
    border: '2px solid white',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    pointerEvents: 'auto',
    zIndex: 10,
  },
  analyzedImagePreview: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  closeButton: {
    position: 'absolute',
    top: '0px',
    right: '0px',
    width: '24px',
    height: '24px',
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    border: 'none',
    borderRadius: '0 0 0 8px',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '24px',
    textAlign: 'center',
  },
  zoomControls: {
    position: 'absolute',
    right: '15px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '20px',
    padding: '10px 5px',
    zIndex: 10,
    pointerEvents: 'auto',
  },
  zoomSlider: {
    writingMode: 'vertical-lr',
    direction: 'rtl',
    width: '8px',
    height: '150px',
    cursor: 'pointer',
  }
};

export default CameraCoach;