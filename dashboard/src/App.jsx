import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import './index.css';

function App() {
  const [logs, setLogs] = useState([]);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [stats, setStats] = useState({
    activeConnections: 0,
    blockedIPs: new Set(),
    globalEntropy: 0.15
  });

  // Modos de operación
  const [mode, setMode] = useState('DEMO'); // 'DEMO' | 'PROD'
  const [demoRunning, setDemoRunning] = useState(false);
  const [wsUrl, setWsUrl] = useState('ws://127.0.0.1:8081');

  // Historial de entropía para la gráfica (60 puntos)
  const [entropyHistory, setEntropyHistory] = useState(Array(60).fill(0));

  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const demoIntervalRef = useRef(null);

  // Referencias mutables para el renderizador 3D
  const sceneRef = useRef(null);
  const nodesMapRef = useRef(new Map());
  const tesseractRef = useRef(null);
  const outerCubeRef = useRef(null);
  const innerCubeRef = useRef(null);
  const tesseractLinksRef = useRef(null);

  const appendLog = (msg, type) => {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
    const newLog = { id: Math.random(), time: timestamp, msg, type };
    setLogs(prev => [newLog, ...prev].slice(0, 8));
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

      ws.onopen = () => appendLog(`CONECTADO A LA RED: ${wsUrl}`, 'INFO');

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

      ws.onclose = () => {
        appendLog('CONEXIÓN WS CERRADA.', 'WARN');
      };
    };

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [mode, wsUrl]);

  // --- LÓGICA DE SIMULACIÓN (MODO DEMO) ---
  useEffect(() => {
    if (mode === 'DEMO' && demoRunning) {
      demoIntervalRef.current = setInterval(() => {
        const ip = `192.168.1.${Math.floor(Math.random() * 255)}`;
        const x = (Math.random() - 0.5) * 10;
        const y = (Math.random() - 0.5) * 10;
        const z = (Math.random() - 0.5) * 10;
        const t = Math.random() * 1000;
        const entropy = Math.random() * 1.5; // Entropía baja normal
        handleTrafficFlow(ip, {x, y, z, t}, entropy);
      }, 100);
    } else {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    }

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [mode, demoRunning]);

  // Manejadores centrales de estado (usados por PROD y DEMO)
  const handleTrafficFlow = (source_ip, coords, entropy_score) => {
    const ip = `${source_ip}:${Math.floor(coords.x)}`;
    const entropyPct = Math.min(entropy_score / 8.0, 1.0);
    
    setStats(prev => ({ ...prev, globalEntropy: entropyPct }));
    setEntropyHistory(prev => [...prev.slice(1), entropyPct]);
    trigger3DNodeTelemetry(ip, coords.y, entropyPct, false);
  };

  const handleKillSwitch = (source_ip, coords, entropy_score) => {
    const ip = `${source_ip}:${Math.floor(coords.x)}`;
    setIsAnomaly(true);
    setTimeout(() => setIsAnomaly(false), 2000);

    appendLog(`ALERTA: Pico de Entropía (ATR) ${entropy_score.toFixed(2)} Shannon`, 'WARN');
    appendLog(`VECTOR: Intento exfiltración desde ${ip}`, 'WARN');
    appendLog(`ACCIÓN: TZANiX Motor Inercial activó escudo ATR`, 'CRITICAL');
    appendLog(`ESTADO: Red protegida. Pérdida 0.00%`, 'SUCCESS');

    setStats(prev => {
      const updated = new Set(prev.blockedIPs);
      updated.add(ip);
      return { ...prev, blockedIPs: updated, globalEntropy: 0.0 };
    });
    setEntropyHistory(prev => [...prev.slice(1), 1.0]); 
    trigger3DNodeBlock(ip);
  };


  // --- INICIALIZACIÓN 3D ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x070a0f, 0.06);

    const camera = new THREE.PerspectiveCamera(60, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 3, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const ambientLight = new THREE.AmbientLight(0x161b22, 2.0);
    scene.add(ambientLight);

    const redLight = new THREE.PointLight(0xff0055, 0, 20); 
    redLight.position.set(0, 0, 0);
    scene.add(redLight);

    // CONSTRUCCIÓN DEL TESSERACT 4D
    const tesseractGroup = new THREE.Group();
    scene.add(tesseractGroup);
    tesseractRef.current = tesseractGroup;

    // Cubo Exterior
    const outerSize = 2.4;
    const outerGeom = new THREE.BoxGeometry(outerSize, outerSize, outerSize);
    const outerEdgesGeom = new THREE.EdgesGeometry(outerGeom);
    const outerMat = new THREE.LineBasicMaterial({ color: 0x00ff9d, transparent: true, opacity: 0.8 });
    const outerCube = new THREE.LineSegments(outerEdgesGeom, outerMat);
    tesseractGroup.add(outerCube);
    outerCubeRef.current = outerCube;

    // Cubo Interior
    const innerSize = 1.0;
    const innerGeom = new THREE.BoxGeometry(innerSize, innerSize, innerSize);
    const innerEdgesGeom = new THREE.EdgesGeometry(innerGeom);
    const innerMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 1.0 });
    const innerCube = new THREE.LineSegments(innerEdgesGeom, innerMat);
    tesseractGroup.add(innerCube);
    innerCubeRef.current = innerCube;

    // Vértices de conexión 4D
    const linkGeom = new THREE.BufferGeometry();
    const linkPositions = new Float32Array(8 * 2 * 3); // 8 lineas, 2 puntos, 3 ejes
    linkGeom.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
    const linkMat = new THREE.LineBasicMaterial({ color: 0x00ff9d, transparent: true, opacity: 0.3 });
    const tesseractLinks = new THREE.LineSegments(linkGeom, linkMat);
    tesseractGroup.add(tesseractLinks);
    tesseractLinksRef.current = tesseractLinks;

    // Fondo Malla (Grid)
    const gridHelper = new THREE.GridHelper(40, 40, 0x1f2937, 0x0d1117);
    gridHelper.position.y = -4;
    scene.add(gridHelper);

    // Fondo de Nodos Cuánticos
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 400;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 40;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0x8b949e, size: 0.05, transparent: true, opacity: 0.3 });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    let animationFrameId;
    let clock = new THREE.Clock();

    const getCubeVertices = (size) => {
      const s = size / 2;
      return [
        [-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s],
        [-s, s, -s], [s, s, -s], [s, s, s], [-s, s, s]
      ];
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const anomalyState = isAnomaly;

      // Animación del Tesseract
      if (tesseractGroup) {
        tesseractGroup.rotation.y = elapsedTime * 0.1;
        tesseractGroup.rotation.x = elapsedTime * 0.05;

        // Rotación relativa del cubo interior para efecto 4D
        innerCube.rotation.x = elapsedTime * -0.2;
        innerCube.rotation.y = elapsedTime * 0.15;
        innerCube.rotation.z = elapsedTime * 0.05;

        redLight.intensity = anomalyState ? 5.0 : 0;
        outerCube.material.color.setHex(anomalyState ? 0xff0055 : 0x00ff9d);
        innerCube.material.color.setHex(anomalyState ? 0xff0000 : 0x00e5ff);
        tesseractLinks.material.color.setHex(anomalyState ? 0xff0055 : 0x00ff9d);

        // Actualizar vértices de conexión dinámicamente
        const outerVerts = getCubeVertices(outerSize);
        const innerVerts = getCubeVertices(innerSize);
        
        // Aplicar la rotación del innerCube a sus vértices locales para calcular la línea
        const euler = new THREE.Euler(innerCube.rotation.x, innerCube.rotation.y, innerCube.rotation.z);
        const q = new THREE.Quaternion().setFromEuler(euler);

        let linkIdx = 0;
        const positions = tesseractLinks.geometry.attributes.position.array;

        for (let i = 0; i < 8; i++) {
          let ox = outerVerts[i][0], oy = outerVerts[i][1], oz = outerVerts[i][2];
          
          let vec = new THREE.Vector3(innerVerts[i][0], innerVerts[i][1], innerVerts[i][2]);
          vec.applyQuaternion(q);
          let ix = vec.x, iy = vec.y, iz = vec.z;

          // Deformación si hay anomalía
          if (anomalyState) {
            const jitter = 0.3;
            ox += (Math.random() - 0.5) * jitter; oy += (Math.random() - 0.5) * jitter; oz += (Math.random() - 0.5) * jitter;
            ix += (Math.random() - 0.5) * jitter; iy += (Math.random() - 0.5) * jitter; iz += (Math.random() - 0.5) * jitter;
          }

          positions[linkIdx++] = ox; positions[linkIdx++] = oy; positions[linkIdx++] = oz;
          positions[linkIdx++] = ix; positions[linkIdx++] = iy; positions[linkIdx++] = iz;
        }
        tesseractLinks.geometry.attributes.position.needsUpdate = true;
      }

      // Animar Nodos
      const nodesMap = nodesMapRef.current;
      setStats(prev => ({ ...prev, activeConnections: nodesMap.size }));

      nodesMap.forEach((nodeGroup, ip) => {
        const angle = elapsedTime * nodeGroup.orbitSpeed + nodeGroup.initialAngle;
        nodeGroup.mesh.position.x = Math.cos(angle) * nodeGroup.orbitRadius;
        nodeGroup.mesh.position.z = Math.sin(angle) * nodeGroup.orbitRadius;
        nodeGroup.mesh.position.y = Math.sin(angle * 1.5) * 1.5;

        const positions = new Float32Array([0, 0, 0, nodeGroup.mesh.position.x, nodeGroup.mesh.position.y, nodeGroup.mesh.position.z]);
        nodeGroup.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        if (nodeGroup.quarantine) {
          nodeGroup.quarantine.position.copy(nodeGroup.mesh.position);
          nodeGroup.quarantine.rotation.x += 0.05;
          nodeGroup.quarantine.rotation.y += 0.05;
        }

        if (nodeGroup.particles && nodeGroup.line.material.opacity > 0) {
          const particlePositions = nodeGroup.particles.geometry.attributes.position.array;
          for (let i = 0; i < nodeGroup.particlesCount; i++) {
            if (nodeGroup.isAttacking) {
              nodeGroup.particlesProgress[i] += 0.04;
              if (nodeGroup.particlesProgress[i] >= 1.0) nodeGroup.particlesProgress[i] = 0.0;
            } else {
              nodeGroup.particlesProgress[i] -= 0.02;
              if (nodeGroup.particlesProgress[i] <= 0) nodeGroup.particlesProgress[i] = 1.0;
            }
            const progress = nodeGroup.particlesProgress[i];
            particlePositions[i * 3 + 0] = nodeGroup.mesh.position.x * progress;
            particlePositions[i * 3 + 1] = nodeGroup.mesh.position.y * progress;
            particlePositions[i * 3 + 2] = nodeGroup.mesh.position.z * progress;
          }
          nodeGroup.particles.geometry.attributes.position.needsUpdate = true;
        }

        if (Date.now() - nodeGroup.lastActive > 3000 && !nodeGroup.blocked) {
          scene.remove(nodeGroup.mesh, nodeGroup.line, nodeGroup.particles);
          nodesMap.delete(ip);
        }
      });

      // Animar Ondas de Choque
      scene.children.forEach(child => {
        if (child.name === "shockwave") {
          child.scale.addScalar(0.4);
          child.material.opacity -= 0.02;
          if (child.material.opacity <= 0) scene.remove(child);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!canvasRef.current) return;
      camera.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isAnomaly]);

  const trigger3DNodeTelemetry = (ip, magnitude, entropyPct, isAttack) => {
    const scene = sceneRef.current;
    if (!scene) return;

    let nodeGroup = nodesMapRef.current.get(ip);
    if (!nodeGroup) {
      const geom = new THREE.OctahedronGeometry(0.2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);

      const lineGeom = new THREE.BufferGeometry();
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.2 });
      const line = new THREE.Line(lineGeom, lineMat);
      scene.add(line);

      const particleGeom = new THREE.BufferGeometry();
      const particlesCount = 6;
      particleGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particlesCount * 3), 3));
      const particleMat = new THREE.PointsMaterial({ color: 0x00ff9d, size: 0.15, transparent: true, opacity: 0.8 });
      const particles = new THREE.Points(particleGeom, particleMat);
      scene.add(particles);

      nodeGroup = {
        mesh, line, particles, particlesCount, particlesProgress: Array(particlesCount).fill(0).map((_, i) => i / particlesCount),
        orbitRadius: 4.0 + Math.random() * 3.0, orbitSpeed: 0.2 + Math.random() * 0.3, initialAngle: Math.random() * Math.PI * 2,
        blocked: false, isAttacking: false, quarantine: null, lastActive: Date.now()
      };
      nodesMapRef.current.set(ip, nodeGroup);
    }

    nodeGroup.lastActive = Date.now();
    nodeGroup.isAttacking = isAttack || magnitude > 20000;

    if (nodeGroup.isAttacking && !nodeGroup.blocked) {
      nodeGroup.mesh.material.color.setHex(0xff0055);
      nodeGroup.line.material.color.setHex(0xff0055);
      nodeGroup.line.material.opacity = 0.8;
      nodeGroup.particles.material.color.setHex(0xff0055);
    } else if (!nodeGroup.blocked) {
      nodeGroup.mesh.material.color.setHex(0x00e5ff);
      nodeGroup.line.material.color.setHex(0x00e5ff);
      nodeGroup.line.material.opacity = 0.2;
      nodeGroup.particles.material.color.setHex(0x00ff9d);
    }
  };

  const trigger3DNodeBlock = (ip) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const nodeGroup = nodesMapRef.current.get(ip);
    if (!nodeGroup) return;

    nodeGroup.blocked = true;
    nodeGroup.isAttacking = false;
    nodeGroup.lastActive = Date.now() + 100000; 

    const waveMat = new THREE.MeshBasicMaterial({ color: 0x00ff9d, transparent: true, opacity: 1.0 });
    const shockwave = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.05, 16, 100), waveMat);
    shockwave.rotation.x = Math.PI / 2;
    shockwave.name = "shockwave";
    scene.add(shockwave);

    const cubeMat = new THREE.MeshBasicMaterial({ color: 0x00ff9d, wireframe: true, transparent: true, opacity: 0.8 });
    const quarantine = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), cubeMat);
    scene.add(quarantine);
    nodeGroup.quarantine = quarantine;

    nodeGroup.mesh.material.color.setHex(0x8b949e);
    nodeGroup.line.material.opacity = 0;
    scene.remove(nodeGroup.particles);

    setTimeout(() => {
      const activeNode = nodesMapRef.current.get(ip);
      if (activeNode) {
        scene.remove(activeNode.mesh, activeNode.line, activeNode.quarantine);
        nodesMapRef.current.delete(ip);
      }
    }, 3000);
  };

  // --- UI TRIGGERS ---
  const triggerSimulation = () => {
    if (mode === 'DEMO') {
      appendLog('🚀 INYECTANDO VECTOR DE EXFILTRACIÓN...', 'INFO');
      const fakeIp = `192.168.1.${Math.floor(Math.random() * 255)}`;
      handleKillSwitch(fakeIp, {x: 1, y: 1, z: 1, t: 0.42}, 8.9);
    } else {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'START_SIMULATION' }));
        appendLog('🚀 ORDEN ENVIADA AL PROXY: Lanzando ataque...', 'INFO');
      } else {
        appendLog('❌ ERROR: Sin conexión al WebSocket en Modo Producción.', 'CRITICAL');
      }
    }
  };

  const renderEntropyGraph = () => {
    const width = 300;
    const height = 100;
    const points = entropyHistory.map((val, i) => {
      const x = (i / (entropyHistory.length - 1)) * width;
      const y = height - (val * height);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="entropy-svg">
        <defs>
          <linearGradient id="gradientLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00ff9d" />
            <stop offset="100%" stopColor={isAnomaly ? "#ff0055" : "#00ff9d"} />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="url(#gradientLine)" strokeWidth="2" points={points} />
      </svg>
    );
  };

  return (
    <div className={`dashboard-container ${isAnomaly ? 'screen-flash-alert' : ''}`}>
      <canvas ref={canvasRef} className="three-canvas" />

      <div className="hud-overlay">
        <header className="header glass-panel">
          <div className="brand">
            <h1>TZANiX Q-BALAM</h1>
            <p className="subtitle">RADAR CUÁNTICO EMPRESARIAL 4D</p>
          </div>
          
          <div className="controls">
            <select className="mode-select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="DEMO">MODO: SIMULACIÓN INTERACTIVA</option>
              <option value="PROD">MODO: PRODUCCIÓN WEBSOCKET</option>
            </select>
            
            {mode === 'PROD' && (
              <input 
                className="ws-input" 
                value={wsUrl} 
                onChange={(e) => setWsUrl(e.target.value)} 
                placeholder="ws://localhost:8081"
              />
            )}

            {mode === 'DEMO' && (
              <button className="demo-btn" onClick={() => {
                setDemoRunning(!demoRunning);
                appendLog(demoRunning ? 'PAUSANDO RED DEMO.' : 'INICIANDO INYECCIÓN DE TRÁFICO DEMO.', 'INFO');
              }}>
                {demoRunning ? '⏸ PAUSAR DEMO' : '▶ INICIAR DEMO'}
              </button>
            )}

            <button className="simulate-btn" onClick={triggerSimulation}>
              ⚠ SIMULAR ATAQUE
            </button>
          </div>
        </header>

        {/* Panel Izquierdo: Gráfico */}
        <div className="panel left-panel glass-panel">
          <h3>Volatilidad y Entropía (ATR)</h3>
          <div className="entropy-graph-container">
            {renderEntropyGraph()}
          </div>
          <div className="stat-grid">
            <div>
              <span className="label">CONEXIONES</span>
              <span className="val cyan">{stats.activeConnections}</span>
            </div>
            <div>
              <span className="label">IPs AISLADAS</span>
              <span className="val red">{stats.blockedIPs.size}</span>
            </div>
            <div>
              <span className="label">ENTROPÍA GLOBAL</span>
              <span className="val green">{(stats.globalEntropy * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* HUD Central Inferior */}
        <div className="center-hud glass-panel">
          <span className="status-indicator">ESTADO: {isAnomaly ? 'EXFILTRACIÓN BLOQUEADA' : 'Q-SECURE (NORMAL)'}</span>
          <span className="separator">|</span>
          <span className="latency-indicator">Latencia del Proxy: 0.42 ms</span>
          <span className="separator">|</span>
          <span className="threads-indicator">Hilos Rayon: 8 Activos</span>
        </div>

        {/* Panel Derecho: Terminal */}
        <div className="panel right-panel glass-panel console-panel">
          <h3>Consola de Eventos del Motor</h3>
          <div className="terminal">
            {logs.map(log => (
              <div key={log.id} className={`log-entry ${log.type.toLowerCase()}`}>
                <span className="time">[{log.time}]</span>
                <span className="msg">{log.msg}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="log-entry info">Esperando telemetría...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
