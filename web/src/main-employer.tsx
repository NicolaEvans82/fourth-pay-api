import React from 'react';
import ReactDOM from 'react-dom/client';
import { EmployerDashboard } from './components/screens/EmployerDashboard';
import './styles.css';

document.body.classList.add('employer');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EmployerDashboard />
  </React.StrictMode>,
);
