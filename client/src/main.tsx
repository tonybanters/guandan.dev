import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const style = document.createElement('style')
style.textContent = `
  @font-face {
    font-family: 'Iosevka Nerd Font';
    src: url('/fonts/IosevkaNerdFont-Bold.woff2') format('woff2');
    font-weight: bold;
    font-style: normal;
    font-display: swap;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html, body, #root {
    height: 100%;
    overflow: hidden;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #1a1a2e;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }
  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.2);
    border-radius: 2px;
  }
  button {
    -webkit-tap-highlight-color: transparent;
  }
  @keyframes tut-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
`
document.head.appendChild(style)

const viewport = document.querySelector('meta[name="viewport"]')
if (!viewport) {
  const meta = document.createElement('meta')
  meta.name = 'viewport'
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
  document.head.appendChild(meta)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
