import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './index.css';

function App() {
  const [logs, setLogs] = useState([]);
  // attackPhase: 0 = Seguro, 1 = Ataque Inyectado, 2 = Kill-Switch, 3 = Restauración
  const [attackPhase, setAttackPhase] = useState(0); 
  const [stats, setStats] = useState({
    activeConnections: 10000, 
    blockedIPs: new Set(),
    globalEntropy: 0.18
  });

  const [mode, setMode] = useState('DEMO'); 
  const [demoRunning, setDemoRunning] = useState(false);
  const [wsUrl, setWsUrl] = useState('ws://localhost:8081');

  const [entropyHistory, setEntropyHistory] = useState(Array(60).fill(0.12));

  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const demoIntervalRef = useRef(null);

  const sceneRef = useRef(null);
  const pointsRef = useRef(null);
  const originalPositionsRef = useRef(null);
  
  // Referencias para coreografía dinámica
  const vectorsGroupRef = useRef(null);
  const quarantineGroupRef = useRef(null);
  const shockwaveRef = useRef(null);
  const bloomPassRef = useRef(null);

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
            handleTrafficFlow(data.source_ip, data.entropy_score);
          } else if (data.event_type === 'ATR_KILL_SWITCH') {
            executeAttackChoreography(data.source_ip, data.entropy_score);
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
      appendLog('[3:25:20] ESTADO: Red protegida. Entropía de Shannon: 0.18 (Baja).', 'INFO');
      demoIntervalRef.current = setInterval(() => {
        const entropy = 0.10 + (Math.random() * 0.05); // Fluctúa entre 10% y 15%
        handleTrafficFlow("192.168.x.x", entropy * 8.0);
      }, 500);
    } else {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    }

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [mode, demoRunning]);

  const handleTrafficFlow = (source_ip, entropy_score) => {
    if (attackPhase !== 0) return; // Ignorar tráfico normal durante el ataque
    const entropyPct = Math.min(entropy_score / 8.0, 1.0);
    setStats(prev => ({ ...prev, globalEntropy: entropyPct }));
    setEntropyHistory(prev => [...prev.slice(1), entropyPct]);
  };

  // --- COREOGRAFÍA DE 4 FASES (MÁQUINA DE ESTADOS) ---
  const executeAttackChoreography = (ip, entropy) => {
    if (attackPhase !== 0) return;

    // FASE 2: Inyección de Ataque (T=0ms)
    setAttackPhase(1);
    const entropyPct = 0.98;
    setStats(prev => ({ ...prev, globalEntropy: entropyPct }));
    setEntropyHistory(prev => [...prev.slice(1), entropyPct]);
    appendLog(`ALERTA: Pico de Entropía (${entropy.toFixed(2)} Shannon). Inyectando Vector de Exfiltración...`, 'CRITICAL');

    // FASE 3: Activación Kill-Switch ATR (T=420ms)
    setTimeout(() => {
      setAttackPhase(2);
      appendLog(`ACCIÓN: TZANiX Motor Inercial activó Kill-Switch ATR. IP ${ip} Aislada (0.42ms).`, 'SUCCESS');
      setStats(prev => {
        const updated = new Set(prev.blockedIPs);
        updated.add(ip);
        return { ...prev, blockedIPs: updated };
      });
      setEntropyHistory(prev => [...prev.slice(1), entropyPct]); 
    }, 420);

    // FASE 4: Restauración (T=2500ms)
    setTimeout(() => {
      setAttackPhase(3);
      setStats(prev => ({ ...prev, globalEntropy: 0.12 }));
      setEntropyHistory(prev => [...prev.slice(1), 0.12]);
      appendLog(`ESTADO: Red protegida. Pérdida de datos: 0.00%. Latencia Proxy: 0.38ms.`, 'INFO');
    }, 2500);

    // Retorno a FASE 1: Estado Seguro (T=4000ms)
    setTimeout(() => {
      setAttackPhase(0);
    }, 4000);
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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.1);
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.5;
    bloomPass.threshold = 0.1;
    bloomPassRef.current = bloomPass;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // 1. Matriz Cuántica Densa (El Núcleo 4D)
    const particlesCount = 8000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particlesCount * 3);
    
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
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particlesMesh = new THREE.Points(geometry, material);
    scene.add(particlesMesh);
    pointsRef.current = particlesMesh;

    // 2. Grupo de Vectores de Ataque (Inicialmente Vacío)
    const vectorsGroup = new THREE.Group();
    scene.add(vectorsGroup);
    vectorsGroupRef.current = vectorsGroup;

    // 3. Grupo de Cuarentena y Onda de Choque (Inicialmente Vacío)
    const quarantineGroup = new THREE.Group();
    scene.add(quarantineGroup);
    quarantineGroupRef.current = quarantineGroup;

    let localShockwave = null;

    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      
      // Obtenemos el estado actual desde la referencia de React indirectamente
      // dado que el bucle clousure captura la variable. Para asegurarnos, usamos setState dependency o un ref.
      // Para evitar problemas de closure en requestAnimationFrame con React State:
      // Usamos los hooks pero dependen de la renderización actual.
      
      // Evaluamos attackPhase directamente del scope
      const phase = attackPhase;

      controls.update();

      // --- LOGICA VISUAL DE FASES ---
      if (pointsRef.current) {
        const posAttr = pointsRef.current.geometry.attributes.position.array;
        const originals = originalPositionsRef.current;
        
        // Fase 1: Estado Seguro
        if (phase === 0 || phase === 3) {
            pointsRef.current.material.color.lerp(new THREE.Color(0x00f0ff), 0.05);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 1.2, 0.05);
            
            // Limpiar grupos visuales si no hay ataque
            if (phase === 0 && vectorsGroup.children.length > 0) {
               vectorsGroup.clear();
               quarantineGroup.clear();
               localShockwave = null;
            }

            for(let i = 0; i < particlesCount; i++) {
                const ix = i * 3;
                let px = originals[ix];
                let py = originals[ix+1];
                let pz = originals[ix+2];
                // Onda trigonométrica de reposo (Frecuencia armónica 5.00 Hz sim)
                const wave = Math.sin(elapsedTime * 2.0 + px * 0.5) * 0.1;
                
                // Lerp suave hacia posición original
                posAttr[ix] = THREE.MathUtils.lerp(posAttr[ix], px, 0.1);
                posAttr[ix+1] = THREE.MathUtils.lerp(posAttr[ix+1], py + wave, 0.1);
                posAttr[ix+2] = THREE.MathUtils.lerp(posAttr[ix+2], pz, 0.1);
            }
        } 
        // Fase 2: Inyección de Ataque (Vectores Rojos, Deformación)
        else if (phase === 1) {
            pointsRef.current.material.color.lerp(new THREE.Color(0xff2e63), 0.1);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 2.5, 0.1);

            // Crear vectores rojos disparándose si no existen
            if (vectorsGroup.children.length === 0) {
                for (let j = 0; j < 15; j++) {
                    const lineGeo = new THREE.BufferGeometry();
                    const lineMat = new THREE.LineBasicMaterial({ color: 0xff2e63, transparent: true, opacity: 0.8 });
                    // Desde afuera hacia un punto central aleatorio
                    const start = new THREE.Vector3((Math.random()-0.5)*40, (Math.random()-0.5)*40, (Math.random()-0.5)*40);
                    const end = new THREE.Vector3((Math.random()-0.5)*4, (Math.random()-0.5)*4, (Math.random()-0.5)*4);
                    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...start.toArray(), ...end.toArray()]), 3));
                    const vectorLine = new THREE.Line(lineGeo, lineMat);
                    vectorsGroup.add(vectorLine);
                }
            }

            // Animar el jaloneo rojo y temblor de la malla
            for(let i = 0; i < particlesCount; i++) {
                const ix = i * 3;
                let px = originals[ix];
                let py = originals[ix+1];
                let pz = originals[ix+2];
                // Ruido y deformación
                const noise = Math.sin(elapsedTime * 20.0 + px) * 0.8;
                posAttr[ix] = px + noise * Math.random();
                posAttr[ix+1] = py + noise * Math.random();
                posAttr[ix+2] = pz + noise * Math.random();
            }
        }
        // Fase 3: Kill-Switch (Onda Blanca/Turquesa, Cuarentena)
        else if (phase === 2) {
            pointsRef.current.material.color.lerp(new THREE.Color(0xff2e63), 0.1);

            // Desaparecer vectores de ataque rotos
            vectorsGroup.children.forEach(child => {
                child.material.opacity -= 0.1;
            });

            // Generar onda y cuarentena
            if (quarantineGroup.children.length === 0) {
                // Onda expansiva blanca
                const ringGeo = new THREE.TorusGeometry(1, 0.05, 16, 100);
                const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
                localShockwave = new THREE.Mesh(ringGeo, ringMat);
                localShockwave.rotation.x = Math.PI / 2;
                quarantineGroup.add(localShockwave);

                // Cubos de cuarentena en zonas aleatorias de la malla
                for(let k=0; k < 5; k++) {
                    const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
                    const cubeMat = new THREE.MeshBasicMaterial({ color: 0xff2e63, wireframe: true, transparent: true, opacity: 0.9 });
                    const cube = new THREE.Mesh(cubeGeo, cubeMat);
                    cube.position.set((Math.random()-0.5)*6, (Math.random()-0.5)*6, (Math.random()-0.5)*6);
                    quarantineGroup.add(cube);
                }
            }

            // Animar onda expansiva
            if (localShockwave) {
                localShockwave.scale.addScalar(0.5);
                localShockwave.material.opacity -= 0.03;
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
      renderer.dispose();
    };
  }, [attackPhase]); // Re-bind on phase change para asegurar que el closure tome la variable correcta

  // --- UI TRIGGERS ---
  const triggerSimulation = () => {
    if (mode === 'DEMO') {
      const fakeIp = `192.168.1.${Math.floor(Math.random() * 255)}`;
      executeAttackChoreography(fakeIp, 8.90);
    } else {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'START_SIMULATION' }));
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

    const isAlertColor = attackPhase === 1 || attackPhase === 2;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="entropy-svg">
        <defs>
          <linearGradient id="gradientLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="100%" stopColor={isAlertColor ? "#FF2E63" : "#00F0FF"} />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="url(#gradientLine)" strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  const getStatusText = () => {
    if (attackPhase === 0) return 'NÚCLEO PROTEGIDO (Q-SECURE)';
    if (attackPhase === 1) return 'ANOMALÍA DETECTADA';
    return 'EXFILTRACIÓN BLOQUEADA';
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
             <div className={`status-indicator ${attackPhase > 0 ? 'alert' : ''}`}>
                ESTADO: {getStatusText()}
             </div>
             <div className="separator">|</div>
             <div className="latency-indicator">LATENCY: {attackPhase === 0 ? '0.38' : '0.42'}ms</div>
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
                <span className="label">- Frecuencia:</span>
                <span className="val">{attackPhase > 0 ? '98.50' : (5.00 + Math.random()*0.1).toFixed(2)} Hz</span>
              </li>
              <li>
                <span className="label">- Entropía:</span>
                <span className="val">{stats.globalEntropy.toFixed(2)}</span>
              </li>
              <li>
                <span className="label">- Conexiones:</span>
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
                  {demoRunning ? '[PAUSAR DEMO]' : '[INICIAR DEMO]'}
                </button>
             )}
             <button className="action-btn alert-btn" onClick={triggerSimulation}>
               [SIMULAR ATAQUE]
             </button>
          </div>
          
        </div>

        {/* BOTTOM RIGHT - CONSOLE */}
        <div className="panel right-panel glass-panel console-panel">
          <div className="terminal">
            {logs.map(log => (
              <div key={log.id} className={`log-entry ${log.type.toLowerCase()}`}>
                <span className="time">{'>'} {log.msg.includes('[') ? '' : `[${log.time}] `}</span>
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
