import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import './index.css';

function App() {
  const [logs, setLogs] = useState([]);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [stats, setStats] = useState({
    activeConnections: 0,
    blockedIPs: new Set(),
    globalEntropy: 0.85
  });

  // Historial de entropía para la gráfica (60 puntos)
  const [entropyHistory, setEntropyHistory] = useState(Array(60).fill(0));

  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  // Referencias mutables para el renderizador 3D
  const sceneRef = useRef(null);
  const nodesMapRef = useRef(new Map()); // IP -> Group { mesh, line, particles, isAttacking }
  const coreRef = useRef(null);
  const coreOriginalVertices = useRef([]); // Para restaurar la forma

  // Añadir un log a la consola táctica
  const appendLog = (msg, type) => {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
    const newLog = { id: Math.random(), time: timestamp, msg, type };
    setLogs(prev => [newLog, ...prev].slice(0, 8));
  };

  // 1. Conexión WebSocket
  useEffect(() => {
    const connectWS = () => {
      const ws = new WebSocket('ws://127.0.0.1:8081');
      wsRef.current = ws;

      ws.onopen = () => {
        appendLog('TZANiX ENGINE ACTIVADO. Holograma en línea.', 'INFO');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.event_type === 'TRAFFIC_FLOW') {
            const ip = `${data.source_ip}:${Math.floor(data.coordinates.x)}`;
            const entropyPct = data.entropy_score / 8.0;

            setStats(prev => ({ ...prev, globalEntropy: entropyPct }));
            setEntropyHistory(prev => [...prev.slice(1), entropyPct]);
            trigger3DNodeTelemetry(ip, data.coordinates.y, entropyPct, false);

          } else if (data.event_type === 'ATR_KILL_SWITCH') {
            const ip = `${data.source_ip}:${Math.floor(data.coordinates.x)}`;
            setIsAnomaly(true);
            setTimeout(() => setIsAnomaly(false), 2000);

            appendLog(`ALERTA: Pico de Entropía detectado (${data.entropy_score.toFixed(2)} Shannon)`, 'WARN');
            appendLog(`VECTOR: Intento de exfiltración en IP ${ip}`, 'WARN');
            appendLog(`ACCIÓN: TZANiX Engine activó Kill-Switch ATR`, 'CRITICAL');
            appendLog(`ESTADO: Amenaza neutralizada en ${data.coordinates.t} ms (Datos intactos)`, 'SUCCESS');

            setStats(prev => {
              const updatedBlocked = new Set(prev.blockedIPs);
              updatedBlocked.add(ip);
              return { ...prev, blockedIPs: updatedBlocked, globalEntropy: 0.0 };
            });
            setEntropyHistory(prev => [...prev.slice(1), 1.0]); // Pico rojo máximo

            trigger3DNodeBlock(ip);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        appendLog('CONEXIÓN PERDIDA. Reconectando...', 'WARN');
        setTimeout(connectWS, 2000);
      };
    };

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 2. Inicialización de la Escena 3D
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x05050f, 0.06);

    const camera = new THREE.PerspectiveCamera(60, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 3, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const ambientLight = new THREE.AmbientLight(0x112244);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f2fe, 2.0);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const redLight = new THREE.PointLight(0xff0033, 0, 20); // Empieza apagada
    redLight.position.set(0, 0, 0);
    scene.add(redLight);

    // NÚCLEO COMPLEJO (Esfera Geodésica / Wireframe)
    const coreGeometry = new THREE.IcosahedronGeometry(1.8, 3);
    
    // Guardar vértices originales para la animación de respiración y deformación
    const posAttribute = coreGeometry.attributes.position;
    const vertexCount = posAttribute.count;
    coreOriginalVertices.current = new Float32Array(posAttribute.array);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      wireframe: true,
      emissive: 0x004488,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9
    });
    
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);
    coreRef.current = core;

    // Núcleo interno brillante
    const innerCoreGeo = new THREE.IcosahedronGeometry(1.5, 2);
    const innerCoreMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.15 });
    const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    core.add(innerCore);

    // Fondo Cuántico
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 800;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 40;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0x4facfe, size: 0.05, transparent: true, opacity: 0.4 });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Animación del Núcleo Central (Respiración + Deformación)
      if (coreRef.current) {
        coreRef.current.rotation.y = elapsedTime * 0.15;
        coreRef.current.rotation.x = elapsedTime * 0.05;
        innerCore.rotation.y = -elapsedTime * 0.1;

        const positions = coreRef.current.geometry.attributes.position.array;
        const originals = coreOriginalVertices.current;
        const anomalyState = isAnomaly; // Usar variable del estado actual

        redLight.intensity = anomalyState ? 3.0 : 0;
        coreRef.current.material.color.setHex(anomalyState ? 0xff0033 : 0x00f2fe);
        coreRef.current.material.emissive.setHex(anomalyState ? 0x660000 : 0x004488);
        innerCore.material.color.setHex(anomalyState ? 0xff0000 : 0x00f2fe);

        for (let i = 0; i < vertexCount; i++) {
          const idx = i * 3;
          let nx = originals[idx];
          let ny = originals[idx + 1];
          let nz = originals[idx + 2];

          // Respiración base
          const breathe = 1 + Math.sin(elapsedTime * 2 + ny) * 0.03;
          
          if (anomalyState) {
            // Deformación caótica si hay anomalía
            nx += (Math.random() - 0.5) * 0.4;
            ny += (Math.random() - 0.5) * 0.4;
            nz += (Math.random() - 0.5) * 0.4;
          }

          positions[idx] = nx * breathe;
          positions[idx + 1] = ny * breathe;
          positions[idx + 2] = nz * breathe;
        }
        coreRef.current.geometry.attributes.position.needsUpdate = true;
      }

      starField.rotation.y = elapsedTime * 0.02;

      // Animar Nodos y Conexiones
      const nodesMap = nodesMapRef.current;
      setStats(prev => ({ ...prev, activeConnections: nodesMap.size }));

      nodesMap.forEach((nodeGroup, ip) => {
        // Rotación orbital
        const angle = elapsedTime * nodeGroup.orbitSpeed + nodeGroup.initialAngle;
        nodeGroup.mesh.position.x = Math.cos(angle) * nodeGroup.orbitRadius;
        nodeGroup.mesh.position.z = Math.sin(angle) * nodeGroup.orbitRadius;
        nodeGroup.mesh.position.y = Math.sin(angle * 1.5) * 1.5;

        // Actualizar línea
        const positions = new Float32Array([
          0, 0, 0,
          nodeGroup.mesh.position.x, nodeGroup.mesh.position.y, nodeGroup.mesh.position.z
        ]);
        nodeGroup.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Cuarentena Cube (si está bloqueado)
        if (nodeGroup.quarantine) {
          nodeGroup.quarantine.position.copy(nodeGroup.mesh.position);
          nodeGroup.quarantine.rotation.x += 0.05;
          nodeGroup.quarantine.rotation.y += 0.05;
        }

        // Animar Flujo de Datos
        if (nodeGroup.particles && nodeGroup.line.material.opacity > 0) {
          const particlePositions = nodeGroup.particles.geometry.attributes.position.array;
          for (let i = 0; i < nodeGroup.particlesCount; i++) {
            
            // Si es ataque, el flujo se INVIERTE (Exfiltración hacia afuera)
            if (nodeGroup.isAttacking) {
              nodeGroup.particlesProgress[i] += 0.04;
              if (nodeGroup.particlesProgress[i] >= 1.0) nodeGroup.particlesProgress[i] = 0.0;
            } else {
              // Flujo normal hacia adentro
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

        // Auto-eliminar inactivos
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
  }, [isAnomaly]); // Re-bind animation when anomaly state changes

  // 3. Crear o Actualizar Nodos (Telemetría Normal o Ataque Pre-Bloqueo)
  const trigger3DNodeTelemetry = (ip, magnitude, entropyPct, isAttack) => {
    const scene = sceneRef.current;
    if (!scene) return;

    let nodeGroup = nodesMapRef.current.get(ip);

    if (!nodeGroup) {
      const orbitRadius = 4.0 + Math.random() * 3.0;
      const initialAngle = Math.random() * Math.PI * 2;
      const orbitSpeed = 0.2 + Math.random() * 0.3;

      const geom = new THREE.OctahedronGeometry(0.2);
      const mat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x004422 });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);

      const lineGeom = new THREE.BufferGeometry();
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
      const line = new THREE.Line(lineGeom, lineMat);
      scene.add(line);

      const particlesCount = 6;
      const particleGeom = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particlesCount * 3);
      const particlesProgress = Array(particlesCount).fill(0).map((_, i) => i / particlesCount);
      particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particleMat = new THREE.PointsMaterial({ color: 0x00ffaa, size: 0.15, transparent: true, opacity: 0.8 });
      const particles = new THREE.Points(particleGeom, particleMat);
      scene.add(particles);

      nodeGroup = {
        mesh, line, particles, particlesCount, particlesProgress,
        orbitRadius, orbitSpeed, initialAngle,
        blocked: false, isAttacking: false, quarantine: null, lastActive: Date.now()
      };
      nodesMapRef.current.set(ip, nodeGroup);
    }

    nodeGroup.lastActive = Date.now();
    nodeGroup.isAttacking = isAttack || magnitude > 20000;

    if (nodeGroup.isAttacking && !nodeGroup.blocked) {
      // Intento de exfiltración (Rojo, deformación)
      nodeGroup.mesh.material.color.setHex(0xff0033);
      nodeGroup.mesh.material.emissive.setHex(0x660000);
      nodeGroup.line.material.color.setHex(0xff0033);
      nodeGroup.line.material.opacity = 0.8;
      nodeGroup.particles.material.color.setHex(0xff0033);
    } else if (!nodeGroup.blocked) {
      // Normal
      nodeGroup.mesh.material.color.setHex(0x00ffcc);
      nodeGroup.line.material.color.setHex(0x00ffff);
      nodeGroup.line.material.opacity = 0.3;
      nodeGroup.particles.material.color.setHex(0x00ffaa);
    }
  };

  // 4. TZANiX Action: Bloqueo, Escudo Dorado, Cuarentena
  const trigger3DNodeBlock = (ip) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const nodeGroup = nodesMapRef.current.get(ip);
    if (!nodeGroup) return;

    nodeGroup.blocked = true;
    nodeGroup.isAttacking = false;
    nodeGroup.lastActive = Date.now() + 100000; 

    // Onda de Choque Dorada (El escudo repelente)
    const waveGeom = new THREE.TorusGeometry(1.8, 0.1, 16, 100);
    const waveMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 1.0 });
    const shockwave = new THREE.Mesh(waveGeom, waveMat);
    shockwave.rotation.x = Math.PI / 2;
    shockwave.name = "shockwave";
    scene.add(shockwave);

    // Malla de Cuarentena (Cubo dorado/blanco encerrando al atacante)
    const cubeGeom = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const cubeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true, transparent: true, opacity: 0.8 });
    const quarantine = new THREE.Mesh(cubeGeom, cubeMat);
    scene.add(quarantine);
    nodeGroup.quarantine = quarantine;

    // Congelar y apagar el nodo
    nodeGroup.mesh.material.color.setHex(0x555555);
    nodeGroup.mesh.material.emissive.setHex(0x000000);
    
    // Romper la conexión instantáneamente
    nodeGroup.line.material.opacity = 0;
    scene.remove(nodeGroup.particles);

    // Destrucción total en 3 segundos
    setTimeout(() => {
      const activeNode = nodesMapRef.current.get(ip);
      if (activeNode) {
        scene.remove(activeNode.mesh, activeNode.line, activeNode.quarantine);
        nodesMapRef.current.delete(ip);
      }
    }, 3000);
  };

  // Renderizar Gráfico de Entropía SVG
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
            <stop offset="0%" stopColor="#00f2fe" />
            <stop offset="100%" stopColor={isAnomaly ? "#ff0033" : "#00f2fe"} />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="url(#gradientLine)" strokeWidth="2" points={points} />
      </svg>
    );
  };

  return (
    <div className={`dashboard-container ${isAnomaly ? 'screen-flash-alert' : ''}`}>
      <canvas ref={canvasRef} className="three-canvas" />

      {/* Capa de Información Holográfica Frontal */}
      <div className="hud-overlay">
        
        <header className="header glass-panel">
          <div className="brand">
            <h1>TZANiX Q-Balam</h1>
            <p className="subtitle">Radar Cuántico Empresarial 4D</p>
          </div>
          <div className={`status-badge ${isAnomaly ? 'alert' : ''}`}>
            {isAnomaly ? 'DEFENSA ACTIVA: EXFILTRACIÓN BLOQUEADA' : 'ESTADO: NÚCLEO PROTEGIDO (Q-SECURE)'}
          </div>
        </header>

        {/* Panel Inferior Izquierdo: Gráfico de Entropía */}
        <div className="panel bottom-left glass-panel">
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

        {/* Panel Inferior Derecho: Consola Táctica */}
        <div className="panel bottom-right glass-panel console-panel">
          <h3>Consola de Eventos del Motor</h3>
          <div className="terminal">
            {logs.map(log => (
              <div key={log.id} className={`log-entry ${log.type.toLowerCase()}`}>
                <span className="time">[{log.time}]</span>
                <span className="msg">{log.msg}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="log-entry info">Esperando eventos del Tesseract...</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
