import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// 1. 将 reportWebVitals 替换为 serviceWorkerRegistration
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 2. 将 reportWebVitals() 调用替换为 serviceWorkerRegistration.register()
serviceWorkerRegistration.register();