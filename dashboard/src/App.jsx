import React, { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [entropyLevel, setEntropyLevel] = useState(0.85);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // Simulación de tráfico entrante
  useEffect(() => {
    const interval = setInterval(() => {
      const isSpike = Math.random() > 0.95; // 5% de probabilidad de ataque
      
      const newLog = {
        id: Date.now(),
        x_ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        y_bytes: isSpike ? Math.floor(Math.random() * 50000) + 10000 : Math.floor(Math.random() * 1000) + 200,
        z_entropy: (Math.random() * 0.2 + 0.8).toFixed(2),
        t_time: new Date().toLocaleTimeString(),
        status: isSpike ? 'BLOCKED' : 'SECURED'
      };
      
      if (isSpike) {
        setIsAnomaly(true);
        setTimeout(() => setIsAnomaly(false), 3000); // Reset alert after 3s
      }
      
      setEntropyLevel(newLog.z_entropy);
      setLogs(prev => [newLog, ...prev].slice(0, 5)); // Keep last 5 logs
      
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>TZANiX Q-Guard</h1>
        <div className={`status-badge ${isAnomaly ? 'alert' : ''}`}>
          <span className="dot">●</span>
          {isAnomaly ? 'KILL-SWITCH ACTIVADO (ANOMALÍA ATR)' : 'SISTEMA PROTEGIDO (Q-SECURE)'}
        </div>
      </header>

      <main className="grid">
        <div className="card">
          <h2>Nivel de Entropía Global (Z)</h2>
          <div className="metric-value">{(entropyLevel * 100).toFixed(0)}%</div>
          <div className="metric-sub">Ruido matemático inyectado por paquete. Nivel óptimo &gt; 80%.</div>
          <div className="chart-placeholder">
            Gráfico de Tensión Entrópica
          </div>
        </div>

        <div className="card">
          <h2>Volatilidad de Tráfico (ATR)</h2>
          <div className="metric-value">{isAnomaly ? 'ALTO RIESGO' : 'ESTABLE'}</div>
          <div className="metric-sub">Desviación del volumen de datos ($Y$). Media móvil a 10 ciclos.</div>
          <button className="btn-kill" onClick={() => setIsAnomaly(true)}>
            Forzar Kill-Switch Manual
          </button>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Mapeo Tesseract ($X, Y, Z, T$) en Tiempo Real</h2>
          <table className="log-table">
            <thead>
              <tr>
                <th>Vector (X) - Origen</th>
                <th>Magnitud (Y) - Bytes</th>
                <th>Entropía (Z)</th>
                <th>Tiempo (T)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.x_ip}</td>
                  <td>{log.y_bytes} B</td>
                  <td>{log.z_entropy}</td>
                  <td>{log.t_time}</td>
                  <td style={{ color: log.status === 'BLOCKED' ? '#ef4444' : '#10b981' }}>
                    {log.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;
