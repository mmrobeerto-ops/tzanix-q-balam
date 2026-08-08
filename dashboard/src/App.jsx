import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './index.css';

function App() {
  const [logs, setLogs] = useState([]);
  
  // null = Seguro. 
  // 'GATE2_ATTACK', 'GATE2_KILL', 'GATE2_RESTORE'
  const [activeGate, setActiveGate] = useState(null); 
  
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
            executeGate2(data.source_ip, data.entropy_score);
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
      if (!activeGate) {
        appendLog('[3:25:20] ESTADO: Red protegida. Entropía de Shannon: 0.18 (Baja).', 'INFO');
      }
      
      let timeOffset = 0;
      demoIntervalRef.current = setInterval(() => {
        timeOffset += 0.1;
        const baseEntropy = 0.12 + Math.sin(timeOffset) * 0.03 + (Math.random() * 0.02);
        handleTrafficFlow("192.168.x.x", baseEntropy * 8.0);
      }, 50);
    } else {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    }

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [mode, demoRunning, activeGate]);

  const handleTrafficFlow = (source_ip, entropy_score) => {
    if (activeGate) return; 

    let currentEntropy = Math.min(entropy_score / 8.0, 1.0);
    let connections = 10000 + Math.floor(Math.random() * 1000);

    setStats(prev => ({ ...prev, globalEntropy: currentEntropy, activeConnections: connections }));
    setEntropyHistory(prev => [...prev.slice(1), currentEntropy]);
  };

  // --- GATE 2: ENTROPY & EXFILTRATION (El Kill-Switch) ---
  const executeGate2 = (ip = "192.168.1.136", entropy = 8.90) => {
    if (activeGate) return;
    setActiveGate('GATE2_ATTACK');
    
    const entropyPct = 0.98;
    setStats(prev => ({ ...prev, globalEntropy: entropyPct }));
    setEntropyHistory(prev => {
       const newHist = [...prev];
       newHist[newHist.length - 1] = entropyPct;
       newHist[newHist.length - 2] = entropyPct - 0.1;
       return newHist;
    });
    appendLog(`ALERTA: Pico de Entropía (${entropy.toFixed(2)} Shannon). Inyectando Vector de Exfiltración...`, 'CRITICAL');

    setTimeout(() => {
      setActiveGate('GATE2_KILL');
      appendLog(`ACCIÓN: TZANiX Motor Inercial activó Kill-Switch ATR. IP ${ip} Aislada (0.42ms).`, 'SUCCESS');
      setStats(prev => {
        const updated = new Set(prev.blockedIPs);
        updated.add(ip);
        return { ...prev, blockedIPs: updated };
      });
      setEntropyHistory(prev => [...prev.slice(1), entropyPct]); 
    }, 420);

    setTimeout(() => {
      setActiveGate('GATE2_RESTORE');
      setStats(prev => ({ ...prev, globalEntropy: 0.12 }));
      setEntropyHistory(prev => [...prev.slice(1), 0.12]);
      appendLog(`ESTADO: Red protegida. Pérdida de datos: 0.00%. Latencia Proxy: 0.38ms.`, 'INFO');
    }, 2500);

    setTimeout(() => setActiveGate(null), 4000);
  };


  // --- INICIALIZACIÓN 3D ---
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
    controls.autoRotate = false; // Desactivado para rotación manual por componente

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.1);
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.5;
    bloomPass.threshold = 0.1;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // 1. Matriz Exterior (Nube de Partículas)
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

    // 2. Tesseract Core (Hipercubo 4D)
    const coreGeo = new THREE.IcosahedronGeometry(2, 1);
    const coreEdges = new THREE.EdgesGeometry(coreGeo);
    const coreMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const coreMesh = new THREE.LineSegments(coreEdges, coreMat);
    scene.add(coreMesh);
    const coreRef = coreMesh;

    // 3. Lazos de Datos (Líneas Vectoriales Dinámicas)
    const linksCount = 60;
    const linksGeo = new THREE.BufferGeometry();
    const linksPos = new Float32Array(linksCount * 6);
    for(let i=0; i<linksCount; i++) {
        // Start: Punto aleatorio en el núcleo (R=2)
        const d1 = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(2);
        // End: Punto aleatorio en la periferia (R=5 a 6)
        const d2 = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(5 + Math.random());
        linksPos[i*6] = d1.x; linksPos[i*6+1] = d1.y; linksPos[i*6+2] = d1.z;
        linksPos[i*6+3] = d2.x; linksPos[i*6+4] = d2.y; linksPos[i*6+5] = d2.z;
    }
    linksGeo.setAttribute('position', new THREE.BufferAttribute(linksPos, 3));
    const linksMat = new THREE.LineBasicMaterial({ color: 0x00ffa3, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
    const dataLinksMesh = new THREE.LineSegments(linksGeo, linksMat);
    scene.add(dataLinksMesh);

    // 4. Partículas en Tránsito (Inbound Flow)
    const inboundCount = 30;
    const inboundGeo = new THREE.BufferGeometry();
    const inboundPos = new Float32Array(inboundCount * 3);
    const inboundDirs = [];
    const inboundDistances = [];
    
    for(let i=0; i<inboundCount; i++) {
        const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
        inboundDirs.push(dir);
        inboundDistances.push(6 + Math.random() * 2); 
    }
    inboundGeo.setAttribute('position', new THREE.BufferAttribute(inboundPos, 3));
    const inboundMat = new THREE.PointsMaterial({ size: 0.15, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const inboundMesh = new THREE.Points(inboundGeo, inboundMat);
    scene.add(inboundMesh);

    // 5. Pulso de Entropía (Heartbeat)
    const pulseGeo = new THREE.TorusGeometry(1, 0.02, 16, 100);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    pulseMesh.rotation.x = Math.PI / 2;
    scene.add(pulseMesh);
    let lastPulseTime = 0;


    const vectorsGroup = new THREE.Group();
    scene.add(vectorsGroup);
    vectorsGroupRef.current = vectorsGroup;

    const quarantineGroup = new THREE.Group();
    scene.add(quarantineGroup);
    quarantineGroupRef.current = quarantineGroup;

    let localShockwave = null;
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const gate = activeGate;

      controls.update();

      if (pointsRef.current) {
        const posAttr = pointsRef.current.geometry.attributes.position.array;
        const originals = originalPositionsRef.current;
        
        // EFECTO GIROSCOPIO 4D (Rotación Opuesta Constante)
        if (gate !== 'GATE2_ATTACK' && gate !== 'GATE2_KILL') {
            coreRef.rotation.x += 0.01;
            coreRef.rotation.z += 0.015;
            pointsRef.current.rotation.y -= 0.003; // Nube externa gira al revés
            dataLinksMesh.rotation.y -= 0.003; 
        }

        // PULSO DE ENTROPÍA (Cada 2.5s)
        if (!gate || gate === 'GATE2_RESTORE') {
           if (elapsedTime - lastPulseTime > 2.5) {
               pulseMesh.scale.set(0.1, 0.1, 0.1);
               pulseMesh.material.opacity = 0.8;
               lastPulseTime = elapsedTime;
           }
           pulseMesh.scale.addScalar(0.08);
           pulseMesh.material.opacity -= 0.02;
        } else {
           pulseMesh.material.opacity = 0; // Ocultar durante ataque
        }

        // LAZOS DE DATOS DINÁMICOS
        if (gate === 'GATE2_ATTACK') {
            linksMat.color.setHex(0xff2e63);
            linksMat.opacity = Math.random() * 0.8;
        } else {
            linksMat.color.setHex(0x00ffa3);
            linksMat.opacity = (Math.sin(elapsedTime * 6) * 0.5 + 0.5) * 0.3; // Parpadeo estilo fibra óptica
        }

        // TRÁNSITO INBOUND
        const inPos = inboundMesh.geometry.attributes.position.array;
        let speed = 0.02;
        if (gate === 'GATE2_ATTACK') { speed = 0.1; inboundMat.color.setHex(0xff2e63); }
        else if (gate === 'GATE2_KILL') { speed = 0.0; inboundMat.opacity -= 0.05; }
        else { speed = 0.02; inboundMat.color.setHex(0xffffff); inboundMat.opacity = 1; }

        for(let i=0; i<inboundCount; i++) {
            inboundDistances[i] -= speed;
            if (inboundDistances[i] < 2) inboundDistances[i] = 6 + Math.random() * 2; // Reset al borde
            const d = inboundDirs[i];
            const dist = inboundDistances[i];
            inPos[i*3] = d.x * dist;
            inPos[i*3+1] = d.y * dist;
            inPos[i*3+2] = d.z * dist;
        }
        inboundMesh.geometry.attributes.position.needsUpdate = true;


        // ESTADO NORMAL (Red Turquesa)
        if (!gate || gate === 'GATE2_RESTORE') {
            pointsRef.current.material.color.lerp(new THREE.Color(0x00f0ff), 0.05);
            coreRef.material.color.lerp(new THREE.Color(0x00f0ff), 0.05);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 1.2, 0.05);
            
            if (!gate && vectorsGroup.children.length > 0) {
               vectorsGroup.clear();
               quarantineGroup.clear();
               localShockwave = null;
            }

            for(let i = 0; i < particlesCount; i++) {
                const ix = i * 3;
                let px = originals[ix];
                let py = originals[ix+1];
                let pz = originals[ix+2];
                const wave = Math.sin(elapsedTime * 2.0 + px * 0.5) * 0.1;
                
                posAttr[ix] = THREE.MathUtils.lerp(posAttr[ix], px, 0.1);
                posAttr[ix+1] = THREE.MathUtils.lerp(posAttr[ix+1], py + wave, 0.1);
                posAttr[ix+2] = THREE.MathUtils.lerp(posAttr[ix+2], pz, 0.1);
            }
        } 
        // GATE 2: FASE ATAQUE
        else if (gate === 'GATE2_ATTACK') {
            pointsRef.current.material.color.lerp(new THREE.Color(0xff2e63), 0.1);
            coreRef.material.color.lerp(new THREE.Color(0xff2e63), 0.1);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 2.5, 0.1);

            coreRef.rotation.y += (Math.random() - 0.5) * 0.2;
            coreRef.rotation.x += (Math.random() - 0.5) * 0.2;
            pointsRef.current.rotation.y += (Math.random() - 0.5) * 0.05; // Sacudida esférica

            if (vectorsGroup.children.length === 0) {
                for (let j = 0; j < 15; j++) {
                    const lineGeo = new THREE.BufferGeometry();
                    const lineMat = new THREE.LineBasicMaterial({ color: 0xff2e63, transparent: true, opacity: 0.8 });
                    const start = new THREE.Vector3((Math.random()-0.5)*40, (Math.random()-0.5)*40, (Math.random()-0.5)*40);
                    const end = new THREE.Vector3((Math.random()-0.5)*4, (Math.random()-0.5)*4, (Math.random()-0.5)*4);
                    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...start.toArray(), ...end.toArray()]), 3));
                    vectorsGroup.add(new THREE.Line(lineGeo, lineMat));
                }
            }

            for(let i = 0; i < particlesCount; i++) {
                const ix = i * 3;
                let px = originals[ix];
                let py = originals[ix+1];
                let pz = originals[ix+2];
                const noise = Math.sin(elapsedTime * 20.0 + px) * 0.8;
                posAttr[ix] = px + noise * Math.random();
                posAttr[ix+1] = py + noise * Math.random();
                posAttr[ix+2] = pz + noise * Math.random();
            }
        }
        // GATE 2: FASE KILLSWITCH
        else if (gate === 'GATE2_KILL') {
            pointsRef.current.material.color.lerp(new THREE.Color(0xff2e63), 0.1);
            coreRef.material.color.lerp(new THREE.Color(0xff2e63), 0.1);
            
            // Frenado Inercial
            coreRef.rotation.x += 0.001; 
            pointsRef.current.rotation.y -= 0.0005;

            vectorsGroup.children.forEach(child => child.material.opacity -= 0.1);

            if (quarantineGroup.children.length === 0) {
                const ringGeo = new THREE.TorusGeometry(1, 0.05, 16, 100);
                const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
                localShockwave = new THREE.Mesh(ringGeo, ringMat);
                localShockwave.rotation.x = Math.PI / 2;
                quarantineGroup.add(localShockwave);

                for(let k=0; k < 5; k++) {
                    const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
                    const cubeMat = new THREE.MeshBasicMaterial({ color: 0xff2e63, wireframe: true, transparent: true, opacity: 0.9 });
                    const cube = new THREE.Mesh(cubeGeo, cubeMat);
                    cube.position.set((Math.random()-0.5)*6, (Math.random()-0.5)*6, (Math.random()-0.5)*6);
                    quarantineGroup.add(cube);
                }
            }

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
  }, [activeGate]); 

  const renderEntropyGraph = () => {
    const width = 300;
    const height = 80;
    
    if (entropyHistory.length === 0) return null;

    let pathD = `M 0,${height - (entropyHistory[0] * height)}`;
    for (let i = 1; i < entropyHistory.length; i++) {
      const x0 = ((i - 1) / (entropyHistory.length - 1)) * width;
      const y0 = height - (entropyHistory[i - 1] * height);
      const x1 = (i / (entropyHistory.length - 1)) * width;
      const y1 = height - (entropyHistory[i] * height);
      
      const cp1x = x0 + (x1 - x0) / 2;
      const cp1y = y0;
      const cp2x = x0 + (x1 - x0) / 2;
      const cp2y = y1;
      
      pathD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${y1}`;
    }
    
    const fillD = pathD + ` L ${width},${height} L 0,${height} Z`;
    const isAlertColor = activeGate === 'GATE2_ATTACK' || activeGate === 'GATE2_KILL';

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="entropy-svg">
        <defs>
          <linearGradient id="gradientLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="100%" stopColor={isAlertColor ? "#FF2E63" : "#00F0FF"} />
          </linearGradient>
          <linearGradient id="gradientFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isAlertColor ? "rgba(255, 46, 99, 0.35)" : "rgba(0, 229, 255, 0.25)"} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <path fill="url(#gradientFill)" d={fillD} style={{ transition: 'fill 0.3s ease' }} />
        <path fill="none" stroke="url(#gradientLine)" strokeWidth="1.2" d={pathD} filter="url(#neonGlow)" style={{ transition: 'stroke 0.3s ease' }} />
      </svg>
    );
  };

  const getStatusText = () => {
    if (activeGate === 'GATE2_ATTACK') return 'ANOMALÍA DETECTADA';
    if (activeGate === 'GATE2_KILL') return 'EXFILTRACIÓN BLOQUEADA';
    if (activeGate === 'GATE2_RESTORE') return 'RESTAURANDO ESTADO...';
    return 'NÚCLEO PROTEGIDO';
  };

  const isAlertState = activeGate === 'GATE2_ATTACK' || activeGate === 'GATE2_KILL';
  
  const getLatency = () => {
    return '0.38';
  };

  const getFrequency = () => {
    if (isAlertState) return '98.50';
    return (5.00 + Math.random()*0.1).toFixed(2);
  };

  return (
    <div className="dashboard-container">
      <canvas ref={canvasRef} className="three-canvas" />

      <div className="hud-overlay">
        
        {/* TOP BAR - COMMAND CENTER */}
        <header className="header glass-panel">
          <div className="brand">
            <h1>TZANiX Q-Balam</h1>
          </div>
          
          <div className="top-metrics">
             <div className={`status-pill ${isAlertState ? 'alert' : ''}`}>
                <div className="led-dot"></div>
                <span>ESTADO: {getStatusText()}</span>
             </div>
             <div className="separator">|</div>
             <div className="latency-indicator">LATENCY: {getLatency()}ms</div>
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
                <span className="val">{getFrequency()} Hz</span>
              </li>
              <li>
                <span className="label">- Entropía:</span>
                <span className="val">{isAlertState ? '0.98' : stats.globalEntropy.toFixed(2)}</span>
              </li>
              <li>
                <span className="label">- Conexiones:</span>
                <span className="val">{stats.activeConnections.toLocaleString()}</span>
              </li>
            </ul>
          </div>

          {/* CENTER ACTIONS */}
          <div className="center-actions">
            
             <div className="simulation-controls">
               {mode === 'PROD' && (
                  <input 
                    className="ws-input" 
                    value={wsUrl} 
                    onChange={(e) => setWsUrl(e.target.value)} 
                    placeholder="ws://localhost:8081"
                  />
               )}
               {mode === 'DEMO' && (
                  <button className="action-btn demo-toggle-btn" onClick={() => setDemoRunning(!demoRunning)}>
                    {demoRunning ? '[ PAUSAR SIMULACIÓN ]' : '[ INICIAR SIMULACIÓN ]'}
                  </button>
               )}
             </div>

             <div className="gates-panel">
               <button 
                 className={`action-btn alert-btn ${!activeGate ? 'pulse-red' : 'disabled'}`} 
                 onClick={() => executeGate2()}
                 disabled={!!activeGate}
               >
                 {activeGate ? '[ SISTEMA EN RESPUESTA ]' : '[ SIMULAR ATAQUE ]'}
               </button>
             </div>
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
