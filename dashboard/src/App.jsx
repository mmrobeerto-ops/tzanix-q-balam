import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './index.css';

function App() {
  const [logs, setLogs] = useState([]);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [stats, setStats] = useState({
    activeConnections: 10000, // Simulando gran cantidad para look enterprise
    blockedIPs: new Set(),
    globalEntropy: 0.18
  });

  const [mode, setMode] = useState('DEMO'); 
  const [demoRunning, setDemoRunning] = useState(false);
  const [wsUrl, setWsUrl] = useState('ws://localhost:8081');

  const [entropyHistory, setEntropyHistory] = useState(Array(60).fill(0.18));

  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const demoIntervalRef = useRef(null);

  const sceneRef = useRef(null);
  const pointsRef = useRef(null);
  const originalPositionsRef = useRef(null);

  const appendLog = (msg, type) => {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
    const newLog = { id: Math.random(), time: timestamp, msg, type };
    setLogs(prev => [newLog, ...prev].slice(0, 10));
  };

  // --- LÓGICA DE WEBSOCKETS (MODO PROD) ---
  useEffect(() => {
    if (mode !== 'PROD') {
      if (wsRef.current) wsRef.current.close();
      return;
    }

    const connectWS = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => appendLog(`PROXY ACTIVE ON ${wsUrl}`, 'INFO');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event_type === 'TRAFFIC_FLOW') {
            handleTrafficFlow(data.source_ip, data.coordinates, data.entropy_score);
          } else if (data.event_type === 'ATR_KILL_SWITCH') {
            handleKillSwitch(data.source_ip, data.coordinates, data.entropy_score);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => appendLog('CONNECTION LOST. RECONNECTING...', 'WARN');
    };

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [mode, wsUrl]);

  // --- LÓGICA DE SIMULACIÓN (MODO DEMO) ---
  useEffect(() => {
    if (mode === 'DEMO' && demoRunning) {
      appendLog('INITIALIZING LOCAL SIMULATION...', 'INFO');
      demoIntervalRef.current = setInterval(() => {
        const entropy = 0.15 + (Math.random() * 0.05); // Fluctuación normal
        handleTrafficFlow("192.168.x.x", {x:0, y:0, z:0, t:0}, entropy * 8.0);
      }, 500);
    } else {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    }

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [mode, demoRunning]);

  // Manejadores centrales de estado
  const handleTrafficFlow = (source_ip, coords, entropy_score) => {
    const entropyPct = Math.min(entropy_score / 8.0, 1.0);
    setStats(prev => ({ ...prev, globalEntropy: entropyPct }));
    setEntropyHistory(prev => [...prev.slice(1), entropyPct]);
    if (Math.random() > 0.8) {
      appendLog(`ENTROPY EVALUATION: NORMAL (${entropyPct.toFixed(2)})`, 'INFO');
    }
  };

  const handleKillSwitch = (source_ip, coords, entropy_score) => {
    setIsAnomaly(true);
    setTimeout(() => setIsAnomaly(false), 2500);

    const entropyPct = 0.98;
    appendLog(`[!] ATR TRIGGER: EXFILTRATION DETECTED`, 'CRITICAL');
    appendLog(`[!] ANOMALY SCORE: ${entropy_score.toFixed(2)} SHANNON`, 'CRITICAL');
    appendLog(`[+] VECTOR ISOLATED SUCCESSFULLY`, 'SUCCESS');

    setStats(prev => {
      const updated = new Set(prev.blockedIPs);
      updated.add(source_ip);
      return { ...prev, blockedIPs: updated, globalEntropy: entropyPct };
    });
    setEntropyHistory(prev => [...prev.slice(1), entropyPct]); 
  };


  // --- INICIALIZACIÓN 3D (WEBGL AVANZADO) ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x05070a, 0.04);

    const camera = new THREE.PerspectiveCamera(50, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 100);
    camera.position.set(10, 5, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: false, powerPreference: "high-performance" });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x05070a, 1);

    // Controles Orbitales
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Post-Procesado (Bloom Effect)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.1);
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.5;
    bloomPass.threshold = 0.1;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Construcción de Matriz Cuántica Densa
    const particlesCount = 8000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particlesCount * 3);
    
    // Distribución esférica reticular
    for(let i = 0; i < particlesCount; i++) {
        const r = 6 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i*3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i*3+2] = r * Math.cos(phi);
    }

    originalPositionsRef.current = new Float32Array(positions);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particlesMesh = new THREE.Points(geometry, material);
    scene.add(particlesMesh);
    pointsRef.current = particlesMesh;

    // Grid inferior oscuro
    const gridHelper = new THREE.GridHelper(50, 50, 0x1A2333, 0x0a0e17);
    gridHelper.position.y = -7;
    scene.add(gridHelper);

    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const anomalyState = isAnomaly;

      controls.update();

      if (pointsRef.current) {
        const positions = pointsRef.current.geometry.attributes.position.array;
        const originals = originalPositionsRef.current;
        
        // Cambio de color reactivo (Cian Neón -> Rojo Neón)
        pointsRef.current.material.color.setHex(anomalyState ? 0xff2e63 : 0x00e5ff);
        bloomPass.strength = anomalyState ? 2.5 : 1.2;

        // Ruido matemático y funciones de onda
        for(let i = 0; i < particlesCount; i++) {
            const ix = i * 3;
            let px = originals[ix];
            let py = originals[ix+1];
            let pz = originals[ix+2];

            if (anomalyState) {
                // Vibración caótica de exfiltración
                const noise = Math.sin(elapsedTime * 15.0 + px) * 0.5;
                positions[ix] = px + noise * Math.random();
                positions[ix+1] = py + noise * Math.random();
                positions[ix+2] = pz + noise * Math.random();
            } else {
                // Onda trigonométrica de reposo (Frecuencia armónica)
                const wave = Math.sin(elapsedTime * 0.5 + px * 0.5) * 0.1;
                positions[ix] = px;
                positions[ix+1] = py + wave;
                positions[ix+2] = pz;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
      }

      composer.render();
    };

    animate();

    const handleResize = () => {
      if (!canvasRef.current) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isAnomaly]);

  // --- UI TRIGGERS ---
  const triggerSimulation = () => {
    if (mode === 'DEMO') {
      appendLog('MANUAL OVERRIDE: INJECTING THREAT VECTOR...', 'WARN');
      handleKillSwitch("10.0.0.99", {x:0, y:0, z:0, t:0}, 9.85);
    } else {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'START_SIMULATION' }));
        appendLog('SENDING STRESS_TEST COMMAND TO PROXY...', 'INFO');
      } else {
        appendLog('ERROR: WEBSOCKET DISCONNECTED', 'CRITICAL');
      }
    }
  };

  const renderEntropyGraph = () => {
    const width = 300;
    const height = 80;
    const points = entropyHistory.map((val, i) => {
      const x = (i / (entropyHistory.length - 1)) * width;
      const y = height - (val * height);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="entropy-svg">
        <defs>
          <linearGradient id="gradientLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor={isAnomaly ? "#FF2E63" : "#00E5FF"} />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="url(#gradientLine)" strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  return (
    <div className="dashboard-container">
      <canvas ref={canvasRef} className="three-canvas" />

      <div className="hud-overlay">
        
        {/* TOP BAR - COMMAND CENTER */}
        <header className="header glass-panel">
          <div className="brand">
            <h1>TZANiX Q-GUARD</h1>
          </div>
          
          <div className="top-metrics">
             <div className={`status-indicator ${isAnomaly ? 'alert' : ''}`}>
                [STATUS: {isAnomaly ? 'THREAT BLOCKED' : 'SECURE'}]
             </div>
             <div className="separator">|</div>
             <div className="latency-indicator">LATENCY: {(0.28 + Math.random()*0.1).toFixed(2)}ms</div>
          </div>

          <div className="controls">
            <select className="mode-select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="DEMO">MODE: DEMO</option>
              <option value="PROD">MODE: LIVE WEBSOCKET</option>
            </select>
          </div>
        </header>

        {/* MIDDLE SECTION - METRICS & ACTIONS */}
        <div className="middle-section">
          
          {/* LEFT PANEL - METRICS */}
          <div className="panel left-panel glass-panel">
            <h3>Entropy Wave (ATR)</h3>
            <div className="entropy-graph-container">
              {renderEntropyGraph()}
            </div>
            <ul className="metrics-list">
              <li>
                <span className="label">- Frequency:</span>
                <span className="val">{isAnomaly ? '98.50' : (5.00 + Math.random()).toFixed(2)} Hz</span>
              </li>
              <li>
                <span className="label">- Entropy:</span>
                <span className="val">{stats.globalEntropy.toFixed(2)}</span>
              </li>
              <li>
                <span className="label">- Connections:</span>
                <span className="val">{stats.activeConnections.toLocaleString()}</span>
              </li>
            </ul>
          </div>

          {/* CENTER ACTIONS */}
          <div className="center-actions">
             {mode === 'PROD' && (
                <input 
                  className="ws-input" 
                  value={wsUrl} 
                  onChange={(e) => setWsUrl(e.target.value)} 
                  placeholder="ws://localhost:8081"
                />
             )}
             {mode === 'DEMO' && (
                <button className="action-btn" onClick={() => setDemoRunning(!demoRunning)}>
                  {demoRunning ? '[PAUSE DEMO]' : '[START DEMO]'}
                </button>
             )}
             <button className="action-btn alert-btn" onClick={triggerSimulation}>
               [SIMULATE ATTACK]
             </button>
          </div>
          
        </div>

        {/* BOTTOM RIGHT - CONSOLE */}
        <div className="panel right-panel glass-panel console-panel">
          <div className="terminal">
            {logs.map(log => (
              <div key={log.id} className={`log-entry ${log.type.toLowerCase()}`}>
                <span className="time">{'>'} [{log.time}]</span>
                <span className="msg">{log.msg}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="log-entry info">System initializing...</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
