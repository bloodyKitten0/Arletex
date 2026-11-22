import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopCompanionView } from './components/companion/DesktopCompanionView';
import './styles/index.css';

const isCompanionRoute =
  window.location.hash === '#companion' || window.location.search.includes('view=companion');

const rootElement = document.getElementById('root');
if (rootElement) {
  if (isCompanionRoute) {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>{isCompanionRoute ? <DesktopCompanionView /> : <App />}</React.StrictMode>,
  );
}
