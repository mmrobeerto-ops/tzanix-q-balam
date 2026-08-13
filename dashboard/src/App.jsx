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


  // Referencias para leer el estado dentro del loop de animación sin reiniciar Three.js
  const engineState = useRef({ activeGate: null, demoRunning: false });
  useEffect(() => {
    engineState.current = { activeGate, demoRunning };
  }, [activeGate, demoRunning]);

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
    controls.autoRotate = false;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.1);
    bloomPass.strength = 0.6;
    bloomPass.radius = 0.5;
    bloomPass.threshold = 0.2;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // ESCALA REDUCIDA
    const holographyGroup = new THREE.Group();
    holographyGroup.scale.set(0.6, 0.6, 0.6); 
    scene.add(holographyGroup);

    // 0. NÚCLEO CENTRAL SÓLIDO (Core)
    const coreGeo = new THREE.IcosahedronGeometry(1.2, 2); // Esfera geodésica low-poly sólida
    const coreMat = new THREE.MeshBasicMaterial({ 
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.9,
        wireframe: false
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    holographyGroup.add(coreMesh);

    // 1. SISTEMA DE NODOS Y TARGET MORPHING
    const nodesCount = 1300; 
    const nodeGeo = new THREE.BufferGeometry();
    const currentPositions = new Float32Array(nodesCount * 3);
    
    const targets = [];
    const velocities = [];
    const originalTargets = []; 

    // FORMAR LA FIGURA
    for(let i = 0; i < nodesCount; i++) {
        currentPositions[i*3] = (Math.random() - 0.5) * 40;
        currentPositions[i*3+1] = (Math.random() - 0.5) * 40;
        currentPositions[i*3+2] = (Math.random() - 0.5) * 40;
        
        const radius = 6.0 + (Math.random() * 4.0); 
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const tx = radius * Math.sin(phi) * Math.cos(theta);
        const ty = radius * Math.sin(phi) * Math.sin(theta);
        const tz = radius * Math.cos(phi);
        
        const targetVec = new THREE.Vector3(tx, ty, tz);
        targets.push(targetVec);
        originalTargets.push({ vec: targetVec.clone(), theta, phi, radius });
        
        velocities.push(new THREE.Vector3(0,0,0));
    }

    nodeGeo.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    const nodeMat = new THREE.PointsMaterial({
        size: 0.1,
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const nodesMesh = new THREE.Points(nodeGeo, nodeMat);
    holographyGroup.add(nodesMesh);
    pointsRef.current = nodesMesh;

    // 2. SHADER MATERIAL PERIFÉRICO (Telaraña externa)
    const lineVertexShader = `
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float wave = sin(position.y * 3.0 - uTime * 15.0); 
        vAlpha = smoothstep(0.7, 1.0, wave); 
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const lineFragmentShader = `
      uniform vec3 uColor;
      uniform float uGlobalAlpha;
      varying float vAlpha;
      void main() {
        float finalAlpha = (0.05 + vAlpha * 0.8) * uGlobalAlpha;
        gl_FragColor = vec4(uColor, finalAlpha);
      }
    `;

    // 3. LÍNEAS PERIFÉRICAS (THRESHOLD RENDERING)
    const linesGeo = new THREE.BufferGeometry();
    const maxConnections = nodesCount * 8; 
    const linesPos = new Float32Array(maxConnections * 3); 
    linesGeo.setAttribute('position', new THREE.BufferAttribute(linesPos, 3));
    
    const linesUniforms = {
       uTime: { value: 0.0 },
       uColor: { value: new THREE.Color(0x00f0ff) },
       uGlobalAlpha: { value: 1.0 }
    };
    
    const linesMat = new THREE.ShaderMaterial({
        uniforms: linesUniforms,
        vertexShader: lineVertexShader,
        fragmentShader: lineFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const linesMesh = new THREE.LineSegments(linesGeo, linesMat);
    holographyGroup.add(linesMesh);

    // 4. LÍNEAS INBOUND (HACIA EL NÚCLEO)
    // Conectaremos el 15% de los nodos directamente al centro
    const coreLinksCount = Math.floor(nodesCount * 0.15);
    const coreLinesGeo = new THREE.BufferGeometry();
    const coreLinesPos = new Float32Array(coreLinksCount * 6); // 2 vértices por línea (nodo -> centro)
    coreLinesGeo.setAttribute('position', new THREE.BufferAttribute(coreLinesPos, 3));

    const coreLineVertexShader = `
      uniform float uTime;
      varying float vAlpha;
      void main() {
        // Distancia euclidiana al centro (0,0,0)
        float d = length(position);
        // El pulso viaja desde la periferia hacia el centro a alta velocidad
        float wave = sin(d * 1.5 + uTime * 20.0);
        vAlpha = smoothstep(0.8, 1.0, wave); 
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const coreLinesUniforms = {
       uTime: { value: 0.0 },
       uColor: { value: new THREE.Color(0x00f0ff) },
       uGlobalAlpha: { value: 1.0 }
    };
    const coreLinesMat = new THREE.ShaderMaterial({
        uniforms: coreLinesUniforms,
        vertexShader: coreLineVertexShader,
        fragmentShader: lineFragmentShader, // Reutilizamos el mismo fragment (brillo sobre 0.05 base)
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const coreLinesMesh = new THREE.LineSegments(coreLinesGeo, coreLinesMat);
    holographyGroup.add(coreLinesMesh);

    let animationFrameId;
    let clock = new THREE.Clock();
    const THRESHOLD_SQ = 3.5; 

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      
      const gate = engineState.current.activeGate;
      const isDemoRunning = engineState.current.demoRunning;

      controls.update();

      if (pointsRef.current) {
        const posAttr = pointsRef.current.geometry.attributes.position.array;
        
        // Rotación inercial súper sutil
        holographyGroup.rotation.y += 0.0005;
        
        // Animación del Núcleo Sólido
        coreMesh.rotation.y -= 0.01;
        coreMesh.rotation.x += 0.005;
        
        // El movimiento debe ocurrir si hay demo corriendo o si hay ataque
        let hasTraffic = isDemoRunning || gate === 'GATE2_ATTACK' || gate === 'GATE2_KILL';

        if (hasTraffic) {
            linesUniforms.uTime.value = elapsedTime; 
            coreLinesUniforms.uTime.value = elapsedTime; // Activa los inyectores hacia el núcleo
            
            holographyGroup.rotation.z += 0.003; 
            holographyGroup.rotation.x = Math.sin(elapsedTime * 0.5) * 0.05;
            
            // Núcleo palpita recibiendo información
            const pulse = 1.0 + Math.sin(elapsedTime * 8.0) * 0.05;
            coreMesh.scale.set(pulse, pulse, pulse);
        } else {
            linesUniforms.uTime.value = 0.0; 
            coreLinesUniforms.uTime.value = 0.0;
            coreMesh.scale.set(1.0, 1.0, 1.0);
        }

        let targetColor = new THREE.Color(0x00f0ff);
        let turbulence = 0.0; 
        
        if (gate === 'GATE2_ATTACK' || gate === 'GATE2_KILL') {
            targetColor.setHex(0xff2e63);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 1.8, 0.1);
            linesUniforms.uGlobalAlpha.value = 1.0;
            coreLinesUniforms.uGlobalAlpha.value = 1.0;
            turbulence = (gate === 'GATE2_ATTACK') ? 0.3 : 0.1;
            
            if (gate === 'GATE2_ATTACK') {
                // Núcleo tiembla bajo ataque
                coreMesh.scale.set(1.2 + Math.random()*0.1, 1.2 + Math.random()*0.1, 1.2 + Math.random()*0.1);
            }
        } else {
            targetColor.setHex(0x00f0ff);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 0.6, 0.05);
            linesUniforms.uGlobalAlpha.value = THREE.MathUtils.lerp(linesUniforms.uGlobalAlpha.value, 1.0, 0.1);
            coreLinesUniforms.uGlobalAlpha.value = THREE.MathUtils.lerp(coreLinesUniforms.uGlobalAlpha.value, 1.0, 0.1);
        }
        
        nodesMesh.material.color.lerp(targetColor, 0.1);
        linesUniforms.uColor.value.lerp(targetColor, 0.1);
        coreLinesUniforms.uColor.value.lerp(targetColor, 0.1);
        coreMesh.material.color.lerp(targetColor, 0.1);

        let lineIndex = 0;
        let coreLineIndex = 0;
        const linesArray = linesMesh.geometry.attributes.position.array;
        const coreLinesArray = coreLinesMesh.geometry.attributes.position.array;
        
        for(let i = 0; i < nodesCount; i++) {
            const ix = i * 3;
            let px = posAttr[ix];
            let py = posAttr[ix+1];
            let pz = posAttr[ix+2];
            
            const target = targets[i];
            const orig = originalTargets[i];
            
            if (hasTraffic) {
               // Simulación de Tráfico (Información entrando): Flujo orbital fluido
               const currentTheta = orig.theta + elapsedTime * (gate ? 1.5 : 0.8);
               const tx = orig.radius * Math.sin(orig.phi) * Math.cos(currentTheta);
               const ty = orig.radius * Math.sin(orig.phi) * Math.sin(currentTheta);
               const tz = orig.radius * Math.cos(orig.phi);
               
               const breathe = Math.sin(elapsedTime * 4.0 + i) * (gate ? 0.5 : 0.2);
               
               let noiseX = 0, noiseY = 0, noiseZ = 0;
               if (turbulence > 0) {
                   noiseX = Math.sin(py * 5.0 + elapsedTime * 10.0) * turbulence;
                   noiseY = Math.cos(pz * 5.0 + elapsedTime * 10.0) * turbulence;
                   noiseZ = Math.sin(px * 5.0 - elapsedTime * 10.0) * turbulence;
               }

               target.set(tx + noiseX, ty + breathe + noiseY, tz + noiseZ);
            } else {
               target.set(orig.vec.x, orig.vec.y, orig.vec.z);
            }

            posAttr[ix] = THREE.MathUtils.lerp(px, target.x, 0.1);
            posAttr[ix+1] = THREE.MathUtils.lerp(py, target.y, 0.1);
            posAttr[ix+2] = THREE.MathUtils.lerp(pz, target.z, 0.1);
            
            // ACTUALIZAR CORE LINKS INBOUND (Conectar un subset de nodos directo al centro 0,0,0)
            if (i % 7 === 0 && coreLineIndex < coreLinksCount * 6) {
                // Vértice A (Nodo Periférico)
                coreLinesArray[coreLineIndex++] = posAttr[ix];
                coreLinesArray[coreLineIndex++] = posAttr[ix+1];
                coreLinesArray[coreLineIndex++] = posAttr[ix+2];
                // Vértice B (Centro Sólido del Núcleo)
                coreLinesArray[coreLineIndex++] = 0;
                coreLinesArray[coreLineIndex++] = 0;
                coreLinesArray[coreLineIndex++] = 0;
            }

            // THRESHOLD RENDERING (Conexiones Periféricas)
            for(let j = i + 1; j < nodesCount; j++) {
                const jx = j * 3;
                const dx = posAttr[ix] - posAttr[jx];
                const dy = posAttr[ix+1] - posAttr[jx+1];
                const dz = posAttr[ix+2] - posAttr[jx+2];
                const distSq = dx*dx + dy*dy + dz*dz;
                
                if (distSq < THRESHOLD_SQ) {
                    if (lineIndex < maxConnections * 3) {
                        linesArray[lineIndex++] = posAttr[ix];
                        linesArray[lineIndex++] = posAttr[ix+1];
                        linesArray[lineIndex++] = posAttr[ix+2];
                        linesArray[lineIndex++] = posAttr[jx];
                        linesArray[lineIndex++] = posAttr[jx+1];
                        linesArray[lineIndex++] = posAttr[jx+2];
                    }
                }
            }
        }
        
        for (let k = lineIndex; k < maxConnections * 3; k++) {
            linesArray[k] = 0;
        }
        
        linesMesh.geometry.setDrawRange(0, lineIndex / 3);
        linesMesh.geometry.attributes.position.needsUpdate = true;
        
        coreLinesMesh.geometry.attributes.position.needsUpdate = true;
        
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
      scene.clear();
    };
  }, []); 

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
            <stop offset="0%" stopColor={isAlertColor ? "rgba(255, 46, 99, 0.45)" : "rgba(0, 240, 255, 0.25)"} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <path fill="url(#gradientFill)" d={fillD} style={{ transition: 'fill 0.3s ease' }} />
        <path fill="none" stroke="url(#gradientLine)" strokeWidth="2.5" d={pathD} filter="url(#neonGlow)" style={{ transition: 'stroke 0.3s ease' }} />
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
            <div className="toolbar-panel glass-panel">
               {mode === 'PROD' && (
                  <input 
                    className="ws-input" 
                    value={wsUrl} 
                    onChange={(e) => setWsUrl(e.target.value)} 
                    placeholder="ws://localhost:8081"
                  />
               )}
               {mode === 'DEMO' && (
                  <button className="toolbar-btn green-btn" onClick={() => setDemoRunning(!demoRunning)}>
                    {demoRunning ? '⏸ PAUSAR SIMULACIÓN' : '▶ INICIAR SIMULACIÓN'}
                  </button>
               )}
               
               <div className="separator-v"></div>

               <button 
                 className={`toolbar-btn red-btn ${!activeGate ? 'pulse-red' : 'disabled'}`} 
                 onClick={() => executeGate2()}
                 disabled={!!activeGate}
               >
                 {activeGate ? '🛡 SISTEMA EN RESPUESTA' : '⚠ SIMULAR ATAQUE'}
               </button>
            </div>
          </div>
          
        </div>

        {/* RIGHT PANEL - CONSOLE */}
        <div className="panel right-panel glass-panel console-panel">
          <div className="terminal">
            {logs.map(log => {
              const hasBracket = log.msg.startsWith('[');
              const timeStr = hasBracket ? '> ' : `> [${log.time}] `;
              return (
                <div key={log.id} className={`log-entry ${log.type.toLowerCase()}`}>
                  <span className="time">{timeStr}</span>
                  <span className="msg">{log.msg}</span>
                </div>
              );
            })}
            {logs.length === 0 && <div className="log-entry info"><span className="time">{'>'}</span><span className="msg">System initializing...</span></div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
