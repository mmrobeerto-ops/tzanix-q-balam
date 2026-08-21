import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

const MatrixRain = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '01'.split('');
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = [];
    for (let x = 0; x < columns; x++) drops[x] = 1;

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FF0055'; // Rojo Matrix
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-canvas" />;
};

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
  const [demoRunning, setDemoRunning] = useState(true); // Tráfico base siempre activo por defecto
  const [wsUrl, setWsUrl] = useState('ws://localhost:8081');
  const [viewMode, setViewMode] = useState('HOLOGRAPHIC'); // HOLOGRAPHIC | RAW_DATA

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

  const globalEntropyRef = useRef(0.12);

  // --- LATIDO CONSTANTE (SCROLL DE LA ONDA) ---
  useEffect(() => {
    let timeOffset = 0;
    const heartbeat = setInterval(() => {
      timeOffset += 0.1;
      
      let targetEntropy = 0.12;
      if (mode === 'DEMO' && demoRunning && !activeGate) {
          targetEntropy = 0.12 + Math.sin(timeOffset) * 0.03 + (Math.random() * 0.02);
      }
      
      let currentVal = globalEntropyRef.current;
      if (currentVal > targetEntropy && !activeGate) {
          currentVal = Math.max(targetEntropy, currentVal - 0.05); // Decadencia suave
      } else if (mode === 'DEMO' && demoRunning && !activeGate) {
          currentVal = targetEntropy;
      }
      
      globalEntropyRef.current = currentVal;
      
      setEntropyHistory(hist => {
          const next = [...hist.slice(1), currentVal];
          return next;
      });

    }, 50);

    return () => clearInterval(heartbeat);
  }, [mode, demoRunning, activeGate]);

  const handleTrafficFlow = (source_ip, entropy_score) => {
    if (activeGate) return; 

    let currentEntropy = Math.min(entropy_score / 8.0, 1.0);
    let connections = 10000 + Math.floor(Math.random() * 1000);

    globalEntropyRef.current = currentEntropy;
    setStats(prev => ({ ...prev, globalEntropy: currentEntropy, activeConnections: connections }));
  };

  // --- GATE 2: ENTROPY & EXFILTRATION (El Kill-Switch) ---
  const executeGate2 = (ip = "192.168.1.136", entropy = 8.90) => {
    if (activeGate) return;
    setActiveGate('GATE2_ATTACK');
    
    const entropyPct = 0.98;
    globalEntropyRef.current = entropyPct;
    setStats(prev => ({ ...prev, globalEntropy: entropyPct }));
    
    appendLog(`[!] ALERTA: Pico de Entropía detectado (0.92)`, 'CRITICAL');
    
    setTimeout(() => {
      appendLog(`[+] Origen: Inyección SQL masiva detectada`, 'WARN');
    }, 150);

    setTimeout(() => {
      setActiveGate('GATE2_KILL');
      appendLog(`[X] Conexión abortada a nivel Kernel.`, 'SUCCESS');
      setStats(prev => {
        const updated = new Set(prev.blockedIPs);
        updated.add(ip);
        return { ...prev, blockedIPs: updated };
      });
      // Mantenemos la entropía alta un instante más
      globalEntropyRef.current = entropyPct;
    }, 420);

    setTimeout(() => {
      setActiveGate('GATE2_RESTORE');
      globalEntropyRef.current = 0.12;
      setStats(prev => ({ ...prev, globalEntropy: 0.12 }));
      appendLog(`[-] Tiempo de reacción: 0.38ms (Base de datos a salvo)`, 'INFO');
    }, 2500);

    setTimeout(() => setActiveGate(null), 4000);
  };


  // Referencias para leer el estado dentro del loop de animación sin reiniciar Three.js
  const engineState = useRef({ activeGate: null, demoRunning: false, globalEntropy: 0.12, mode: 'DEMO' });
  useEffect(() => {
    engineState.current = { activeGate, demoRunning, globalEntropy: stats.globalEntropy, mode };
  }, [activeGate, demoRunning, stats.globalEntropy, mode]);

  // --- INICIALIZACIÓN 3D ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x000000, 0.04);

    const camera = new THREE.PerspectiveCamera(50, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 100);
    camera.position.set(10, 5, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: false, powerPreference: "high-performance" });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);

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
    const coreGeo = new THREE.IcosahedronGeometry(0.3, 2); // Esfera geodésica low-poly sólida, escala 25%
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

    // 4. LÍNEAS INBOUND (SINAPSIS NEURONALES HACIA EL NÚCLEO)
    const coreLinks = [];
    for (let i = 0; i < nodesCount; i++) {
        if (i % 7 === 0) { // Aproximadamente 15% de los nodos conectados
            coreLinks.push({
                nodeIndex: i,
                offsets: [
                    new THREE.Vector3((Math.random()-0.5)*3.0, (Math.random()-0.5)*3.0, (Math.random()-0.5)*3.0),
                    new THREE.Vector3((Math.random()-0.5)*2.5, (Math.random()-0.5)*2.5, (Math.random()-0.5)*2.5),
                    new THREE.Vector3((Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5)
                ]
            });
        }
    }
    
    const coreLinesGeo = new THREE.BufferGeometry();
    // 4 segmentos = 8 vértices = 24 floats por conexión
    const coreLinesPos = new Float32Array(coreLinks.length * 8 * 3); 
    coreLinesGeo.setAttribute('position', new THREE.BufferAttribute(coreLinesPos, 3));

    const coreLineVertexShader = `
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float d = length(position);
        float wave = sin(d * 1.5 + uTime * 20.0);
        vAlpha = smoothstep(0.7, 1.0, wave); 
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
        fragmentShader: lineFragmentShader, 
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const coreLinesMesh = new THREE.LineSegments(coreLinesGeo, coreLinesMat);
    holographyGroup.add(coreLinesMesh);

    let animationFrameId;
    let clock = new THREE.Clock();
    let virtualTime = 0;
    const THRESHOLD_SQ = 3.5; 

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const gate = engineState.current.activeGate;
      const isDemoRunning = engineState.current.demoRunning;
      const entropy = engineState.current.globalEntropy; // Rango 0.12 a 0.98
      const currentMode = engineState.current.mode;

      const isPaused = currentMode === 'DEMO' && !isDemoRunning;

      // Parámetros reactivos basados en la señal de entropía real (se congelan a 0 si está pausado)
      const speedMult = isPaused ? 0 : (0.6 + (entropy * 3.5)); // Aceleración del flujo temporal virtual
      const rotationSpeed = isPaused ? 0 : (0.0008 + (entropy * 0.015)); // Velocidad de giro tridimensional
      const turbulence = isPaused ? 0 : (entropy > 0.4 ? (entropy * 0.35) : (entropy * 0.04)); // Deformación del campo cuántico
      const bloomStrength = isPaused ? 0.3 : (0.5 + (entropy * 1.5)); // Brillo atenuado en pausa
      const pulseSpeed = isPaused ? 0 : (4.0 + (entropy * 12.0)); // Ritmo de pulsación del núcleo
      const pulseAmplitude = isPaused ? 0 : (0.04 + (entropy * 0.10)); // Tamaño del latido

      const delta = clock.getDelta();
      virtualTime += delta * speedMult;

      controls.update();

      // Ajustar intensidad de brillo del bloom de forma reactiva
      bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, bloomStrength, 0.1);

      if (pointsRef.current) {
        const posAttr = pointsRef.current.geometry.attributes.position.array;
        
        // Rotación inercial impulsada por la entropía
        holographyGroup.rotation.y += rotationSpeed * 0.3;
        holographyGroup.rotation.z += rotationSpeed * 0.6;
        
        // Animación del Núcleo Sólido (gira en sentido opuesto)
        coreMesh.rotation.y -= rotationSpeed * 1.8;
        coreMesh.rotation.x += rotationSpeed * 0.9;
        
        // Latido dinámico del núcleo central
        const pulse = 1.0 + Math.sin(virtualTime * pulseSpeed) * pulseAmplitude;
        coreMesh.scale.set(pulse, pulse, pulse);

        // Pasar tiempo virtual a los shaders
        linesUniforms.uTime.value = virtualTime; 
        coreLinesUniforms.uTime.value = virtualTime; 

        let targetColor = new THREE.Color(0x00f0ff);
        let finalTurbulence = turbulence;
        
        if (gate === 'GATE2_ATTACK' || gate === 'GATE2_KILL') {
            targetColor.setHex(0xff2e63);
            linesUniforms.uGlobalAlpha.value = 1.0;
            coreLinesUniforms.uGlobalAlpha.value = 1.0;
            finalTurbulence = (gate === 'GATE2_ATTACK') ? 0.38 : 0.12;
            
            if (gate === 'GATE2_ATTACK') {
                coreMesh.scale.set(pulse * 1.3, pulse * 1.3, pulse * 1.3);
            }
        } else {
            targetColor.setHex(0x00f0ff);
            linesUniforms.uGlobalAlpha.value = THREE.MathUtils.lerp(linesUniforms.uGlobalAlpha.value, 1.0, 0.1);
            coreLinesUniforms.uGlobalAlpha.value = THREE.MathUtils.lerp(coreLinesUniforms.uGlobalAlpha.value, 1.0, 0.1);
        }
        
        nodesMesh.material.color.lerp(targetColor, 0.1);
        linesUniforms.uColor.value.lerp(targetColor, 0.1);
        coreLinesUniforms.uColor.value.lerp(targetColor, 0.1);
        coreMesh.material.color.lerp(targetColor, 0.1);

        let lineIndex = 0;
        const linesArray = linesMesh.geometry.attributes.position.array;
        const coreLinesArray = coreLinesMesh.geometry.attributes.position.array;
        
        for(let i = 0; i < nodesCount; i++) {
            const ix = i * 3;
            let px = posAttr[ix];
            let py = posAttr[ix+1];
            let pz = posAttr[ix+2];
            
            const target = targets[i];
            const orig = originalTargets[i];
            
            // Movimiento orbital contínuo modulado
            const currentTheta = orig.theta + virtualTime * 0.4;
            const tx = orig.radius * Math.sin(orig.phi) * Math.cos(currentTheta);
            const ty = orig.radius * Math.sin(orig.phi) * Math.sin(currentTheta);
            const tz = orig.radius * Math.cos(orig.phi);
            
            // Respiración reactiva de los nodos
            const breathe = Math.sin(virtualTime * 2.0 + i) * (0.12 + entropy * 0.60);
            
            // Deformación de turbulencia según la entropía
            let noiseX = Math.sin(py * 4.0 + virtualTime * 8.0) * finalTurbulence;
            let noiseY = Math.cos(pz * 4.0 + virtualTime * 8.0) * finalTurbulence;
            let noiseZ = Math.sin(px * 4.0 - virtualTime * 8.0) * finalTurbulence;

            target.set(tx + noiseX, ty + breathe + noiseY, tz + noiseZ);

            posAttr[ix] = THREE.MathUtils.lerp(px, target.x, 0.1);
            posAttr[ix+1] = THREE.MathUtils.lerp(py, target.y, 0.1);
            posAttr[ix+2] = THREE.MathUtils.lerp(pz, target.z, 0.1);
            
            // Conexiones periféricas por distancia (Threshold)
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
        
        // Sinapsis neuronales hacia el centro
        let coreLineIndex = 0;
        for (let k = 0; k < coreLinks.length; k++) {
            const link = coreLinks[k];
            const nx = posAttr[link.nodeIndex * 3];
            const ny = posAttr[link.nodeIndex * 3 + 1];
            const nz = posAttr[link.nodeIndex * 3 + 2];
            
            // Vibración orgánica de la sinapsis acelerada por la entropía
            const synapticTwitch = Math.sin(virtualTime * 14.0 + k) * (0.05 + entropy * 0.35);
            
            const o0 = link.offsets[0];
            const o1 = link.offsets[1];
            const o2 = link.offsets[2];
            
            let p1x = nx * 0.75 + o0.x + synapticTwitch;
            let p1y = ny * 0.75 + o0.y + synapticTwitch;
            let p1z = nz * 0.75 + o0.z;
            
            let p2x = nx * 0.50 + o1.x - synapticTwitch;
            let p2y = ny * 0.50 + o1.y + synapticTwitch;
            let p2z = nz * 0.50 + o1.z;
            
            let p3x = nx * 0.25 + o2.x + synapticTwitch;
            let p3y = ny * 0.25 + o2.y - synapticTwitch;
            let p3z = nz * 0.25 + o2.z;
            
            // Seg 1 (Nodo a P1)
            coreLinesArray[coreLineIndex++] = nx; coreLinesArray[coreLineIndex++] = ny; coreLinesArray[coreLineIndex++] = nz;
            coreLinesArray[coreLineIndex++] = p1x; coreLinesArray[coreLineIndex++] = p1y; coreLinesArray[coreLineIndex++] = p1z;
            
            // Seg 2 (P1 a P2)
            coreLinesArray[coreLineIndex++] = p1x; coreLinesArray[coreLineIndex++] = p1y; coreLinesArray[coreLineIndex++] = p1z;
            coreLinesArray[coreLineIndex++] = p2x; coreLinesArray[coreLineIndex++] = p2y; coreLinesArray[coreLineIndex++] = p2z;
            
            // Seg 3 (P2 a P3)
            coreLinesArray[coreLineIndex++] = p2x; coreLinesArray[coreLineIndex++] = p2y; coreLinesArray[coreLineIndex++] = p2z;
            coreLinesArray[coreLineIndex++] = p3x; coreLinesArray[coreLineIndex++] = p3y; coreLinesArray[coreLineIndex++] = p3z;
            
            // Seg 4 (P3 al Centro)
            coreLinesArray[coreLineIndex++] = p3x; coreLinesArray[coreLineIndex++] = p3y; coreLinesArray[coreLineIndex++] = p3z;
            coreLinesArray[coreLineIndex++] = 0; coreLinesArray[coreLineIndex++] = 0; coreLinesArray[coreLineIndex++] = 0;
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
      const x1 = (i / (entropyHistory.length - 1)) * width;
      const y1 = height - (entropyHistory[i] * height);
      pathD += ` L ${x1},${y1}`;
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
            <stop offset="0%" stopColor={isAlertColor ? "rgba(255, 46, 99, 0.35)" : "rgba(0, 240, 255, 0.15)"} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
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
    return 'DB SIDECAR ACTIVO';
  };

  const isAlertState = activeGate === 'GATE2_ATTACK' || activeGate === 'GATE2_KILL';
  
  const getLatency = () => {
    return '0.42';
  };

  const getFrequency = () => {
    if (isAlertState) return '9,850';
    if (mode === 'DEMO' && !demoRunning) return '0';
    return (5000 + Math.floor(Math.random() * 100)).toLocaleString('en-US');
  };

  return (
    <div className="dashboard-container">
      <MatrixRain />
      <canvas ref={canvasRef} className={`three-canvas ${viewMode === 'RAW_DATA' ? 'dimmed' : ''}`} />

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
             <div className="latency-indicator">KILL-SWITCH LATENCY: {getLatency()}ms</div>
          </div>

          <div className="controls">
            <button className="mode-select" onClick={() => setViewMode(viewMode === 'HOLOGRAPHIC' ? 'RAW_DATA' : 'HOLOGRAPHIC')}>
              {viewMode === 'HOLOGRAPHIC' ? '[ VISTA DATOS RAW ]' : '[ VISTA HOLOGRÁFICA ]'}
            </button>
            <select className="mode-select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="DEMO">MODE: SHADOW (AUDITORÍA)</option>
              <option value="PROD">MODE: ENFORCEMENT (BLOQUEO ACTIVO)</option>
            </select>
          </div>
        </header>

        {viewMode === 'HOLOGRAPHIC' ? (
          <>
            {/* MIDDLE SECTION - METRICS & ACTIONS */}
            <div className="middle-section">
              
              {/* LEFT PANEL - METRICS */}
              <div className="panel left-panel glass-panel">
                <h3>SHANNON ENTROPY WAVE</h3>
                <div className="entropy-graph-container">
                  {renderEntropyGraph()}
                </div>
                <ul className="metrics-list">
                  <li>
                    <span className="label">- DB Query Rate (QPS):</span>
                    <span className="val">{getFrequency()}</span>
                  </li>
                  <li>
                    <span className="label">- Nivel de Entropía:</span>
                    <span className="val">{isAlertState ? '0.98 (CRÍTICO)' : `${stats.globalEntropy.toFixed(2)} (Normal)`}</span>
                  </li>
                  <li>
                    <span className="label">- Conexiones DB:</span>
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
                        {demoRunning ? '[ PAUSAR SIMULACIÓN ]' : '[ INICIAR SIMULACIÓN ]'}
                      </button>
                  )}
                  
                  <div className="separator-v"></div>

                  <button 
                    className={`toolbar-btn red-btn ${!activeGate ? 'pulse-red' : 'disabled'}`} 
                    onClick={() => executeGate2()}
                    disabled={!!activeGate}
                  >
                    {activeGate ? '[ SISTEMA EN RESPUESTA ]' : '[ SIMULAR EXFILTRACIÓN DE DATOS ]'}
                  </button>
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
          </>
        ) : (
          <div className="raw-data-panel">
            <div className="raw-panel-section">
              <h2>&gt;_ Live Traffic Analysis</h2>
              <div className="large-terminal terminal">
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
                {logs.length === 0 && <div className="log-entry info"><span className="time">{'>'}</span><span className="msg">Awaiting proxy connection...</span></div>}
              </div>
            </div>

            <div className="raw-panel-section">
              <h2>&gt;_ Tactical Control</h2>
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ border: '1px solid #1A2333', padding: '1rem', background: '#000' }}>
                  <h3 style={{ color: '#00E5FF', margin: '0 0 0.5rem 0', fontFamily: 'Barlow', fontSize: '1rem' }}>NETWORK STATUS</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>
                    <span style={{ color: '#8B949E' }}>Active Nodes:</span>
                    <span style={{ color: '#FFF' }}>{stats.activeConnections.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    <span style={{ color: '#8B949E' }}>Blocked IPs:</span>
                    <span style={{ color: '#FF0055' }}>{stats.blockedIPs.size}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button 
                    className="toolbar-btn red-btn" 
                    style={{ width: '100%', border: '1px solid #FF0055', color: '#FF0055', background: 'transparent' }}
                    onClick={() => executeGate2()}
                  >
                    [ ARMAR KILL-SWITCH ]
                  </button>
                  <button 
                    className="toolbar-btn green-btn" 
                    style={{ width: '100%', border: '1px solid #00FFA3', color: '#00FFA3', background: 'transparent' }}
                  >
                    [ PURGAR CONEXIONES MUERTAS ]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
