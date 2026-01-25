// Constellation Network Animation
// Slow drifting nodes with dynamic connections
// Blue flash on new connections

(function() {
    const canvasBg = document.getElementById('constellation-bg');
    const canvasFg = document.getElementById('constellation-fg');
    if (!canvasBg || !canvasFg) return;

    const ctxBg = canvasBg.getContext('2d');
    const ctxFg = canvasFg.getContext('2d');

    // Size threshold for splitting foreground/background (only largest nodes in front)
    const SIZE_THRESHOLD = 25; // Nodes larger than this appear in front of 3D model

    // Configuration
    const config = {
        nodeCount: window.innerWidth < 768 ? 50 : 90,
        connectionDistance: 150,
        scrollDepthMultiplier: 1.2,
        driftSpeed: 0.25
    };

    let nodes = [];
    let scrollY = 0;
    let targetScrollY = 0;
    let pageHeight = 0;
    let activeConnections = new Set();
    let flashingConnections = new Map(); // connectionKey -> {intensity, color}
    let resizeTimeout = null;
    let lastWidth = 0;
    let lastHeight = 0;
    let audioCircleMode = false; // When true, nodes are in circle formation
    let circleNodeIndices = []; // Which nodes participate in the circle
    let sustainedLevel = 0; // Tracks sustained audio for synth-like sounds

    // Flash color (blue only)
    const flashColor = { r: 135, g: 206, b: 250 };

    // Resize canvas only (no node regeneration)
    function resizeCanvas() {
        const oldWidth = canvasBg.width || window.innerWidth;
        const oldPageHeight = pageHeight || document.documentElement.scrollHeight;

        canvasBg.width = window.innerWidth;
        canvasBg.height = window.innerHeight;
        canvasFg.width = window.innerWidth;
        canvasFg.height = window.innerHeight;
        pageHeight = document.documentElement.scrollHeight;

        // Scale existing node positions to new dimensions
        if (nodes.length > 0 && oldWidth > 0 && oldPageHeight > 0) {
            const scaleX = canvasBg.width / oldWidth;
            const scaleY = pageHeight / oldPageHeight;

            nodes.forEach(node => {
                node.baseX *= scaleX;
                node.baseY *= scaleY;
            });
        }
    }

    // Debounced resize handler
    function handleResize() {
        // Immediate canvas resize for smooth visuals
        resizeCanvas();

        // Debounce full reinitialization only if screen size category changes
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const isMobile = window.innerWidth < 768;
            const wasMobile = lastWidth < 768;

            // Only reinitialize nodes if crossing mobile/desktop threshold
            if (isMobile !== wasMobile && lastWidth > 0) {
                initNodes();
            }

            lastWidth = window.innerWidth;
            lastHeight = window.innerHeight;
        }, 250);
    }

    // Initialize nodes spread across entire page height
    function initNodes() {
        nodes = [];
        const count = window.innerWidth < 768 ? 50 : 90;

        for (let i = 0; i < count; i++) {
            const depth = Math.random(); // 0 = far (subtle), 1 = near (bold)

            // Larger nodes (higher depth) move faster for parallax effect
            const speedMultiplier = 0.5 + depth * 1.5; // 0.5x to 2x speed based on depth

            nodes.push({
                baseX: Math.random() * canvasBg.width,
                baseY: Math.random() * pageHeight,
                // Drift velocity - faster for larger/closer nodes
                vx: (Math.random() - 0.5) * config.driftSpeed * speedMultiplier,
                vy: (Math.random() - 0.5) * config.driftSpeed * speedMultiplier,
                z: depth,
                size: 2 + depth * depth * (20 + Math.random() * 35),
                opacity: 0.08 + depth * 0.42
            });
        }

        // Sort by depth so far nodes render first
        nodes.sort((a, b) => a.z - b.z);
    }

    // Update node positions (drift)
    function updateNodes() {
        const audio = window.audioData;
        const audioActive = audio && audio.active;
        const musicCard = document.querySelector('.music-card');

        const wasCircleMode = audioCircleMode;
        audioCircleMode = audioActive && musicCard;

        // Select random nodes for circle when entering circle mode
        if (audioCircleMode && !wasCircleMode) {
            const numCircleNodes = 24; // Only use 24 nodes for the circle
            circleNodeIndices = [];
            const shuffled = [...Array(nodes.length).keys()].sort(() => Math.random() - 0.5);
            circleNodeIndices = shuffled.slice(0, numCircleNodes);
        }

        nodes.forEach((node, index) => {
            const isCircleNode = audioCircleMode && circleNodeIndices.includes(index);

            if (isCircleNode) {
                // Get music card position (center) - in viewport coordinates
                const rect = musicCard.getBoundingClientRect();
                const cardCenterX = rect.left + rect.width / 2;
                const cardCenterY = rect.top + rect.height / 2;

                // Find position in circle (based on index within circle nodes)
                const circleIndex = circleNodeIndices.indexOf(index);
                const numCircleNodes = circleNodeIndices.length;
                const angle = (circleIndex / numCircleNodes) * Math.PI * 2 - Math.PI / 2;

                // Calculate audio reactivity - INSTANT response to waveform
                const lowRaw = audio.low || 0;    // 345 Hz - low piano notes
                const highRaw = audio.high || 0;  // 517-689 Hz - high piano notes

                // Normalize with contrast curve - separate tuning for each frequency
                // LOW range observed: ~147-221
                const lowFloor = 140;
                const lowCeiling = 220;
                const lowNorm = Math.max(0, Math.min(1, (lowRaw - lowFloor) / (lowCeiling - lowFloor)));

                // HIGH range observed: ~118-190
                const highFloor = 110;
                const highCeiling = 190;
                const highNorm = Math.max(0, Math.min(1, (highRaw - highFloor) / (highCeiling - highFloor)));

                // Alternating pattern: every other node reacts to low vs high
                const isLowNode = circleIndex % 2 === 0;

                node.inCircle = true;

                // Initialize scale smoothly when entering circle mode
                if (node.circleScale === undefined) {
                    node.circleScale = 0.5; // Start small
                }

                // Simple: each node reacts to its frequency, same max scale
                let targetScale;

                // Detect if audio is very quiet (song ending) - return to neutral size
                const isQuiet = lowRaw < 20 && highRaw < 20;

                if (isQuiet) {
                    // Smoothly return to neutral size when song ends
                    targetScale = 1.0;
                } else if (isLowNode) {
                    // Low nodes react to low frequency
                    targetScale = 0.3 + lowNorm * 2.0;
                } else {
                    // High nodes react to high frequency
                    targetScale = 0.3 + highNorm * 2.0;
                }

                // Asymmetric interpolation - fast dropoff, slower rise
                const isDropping = targetScale < node.circleScale;
                const speed = isDropping ? 0.4 : 0.2; // Drop 2x faster
                node.circleScale += (targetScale - node.circleScale) * speed;
                node.audioScale = node.circleScale;

                // RADIAL PULSE: nodes move in/out based on audio level
                const baseRadius = 200;
                const radiusOffset = 20 + (node.circleScale - 0.3) * 50; // 20-120px outward movement
                const pulseRadius = baseRadius + radiusOffset;

                const targetX = cardCenterX + Math.cos(angle) * pulseRadius;
                const targetY = cardCenterY + Math.sin(angle) * pulseRadius;

                // Smoothly interpolate position
                if (node.renderX === undefined) {
                    node.renderX = node.baseX;
                    node.renderY = node.baseY - scrollY;
                }
                node.renderX += (targetX - node.renderX) * 0.1;
                node.renderY += (targetY - node.renderY) * 0.1;
            } else {
                // Not in circle - check if transitioning out or normal behavior

                if (node.inCircle && node.renderX !== undefined) {
                    // Just exited circle mode - start transition
                    node.inCircle = false;
                    node.exitingCircle = true;
                }

                if (node.exitingCircle && node.renderX !== undefined) {
                    // Smoothly transition back to base position
                    const parallaxStrength = 1 - (node.z * config.scrollDepthMultiplier);
                    const targetX = node.baseX;
                    const targetY = node.baseY - scrollY * parallaxStrength;

                    node.renderX += (targetX - node.renderX) * 0.05; // Slower transition out
                    node.renderY += (targetY - node.renderY) * 0.05;

                    // Smoothly transition scale back to 1
                    if (node.audioScale !== undefined) {
                        node.audioScale += (1 - node.audioScale) * 0.05;
                    }

                    // Check if close enough to end transition
                    const dx = targetX - node.renderX;
                    const dy = targetY - node.renderY;
                    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
                        node.exitingCircle = false;
                        node.renderX = undefined;
                        node.renderY = undefined;
                        node.audioScale = 1;
                        node.circleScale = undefined;
                    }
                } else {
                    node.exitingCircle = false;
                    node.audioScale = 1;
                }

                // Normal drifting behavior
                node.baseX += node.vx;
                node.baseY += node.vy;

                // When music is playing, push nodes away from the circle area
                if (audioCircleMode && musicCard) {
                    const rect = musicCard.getBoundingClientRect();
                    const cardCenterX = rect.left + rect.width / 2;
                    const cardCenterY = rect.top + rect.height / 2 + window.scrollY;
                    const clearRadius = 350; // Keep nodes outside this radius

                    const dx = node.baseX - cardCenterX;
                    const dy = (node.baseY - scrollY) - (cardCenterY - window.scrollY);
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < clearRadius && distance > 0) {
                        // Push node away from center
                        const pushStrength = (clearRadius - distance) * 0.05;
                        node.baseX += (dx / distance) * pushStrength;
                        node.baseY += (dy / distance) * pushStrength;
                    }
                }

                // Wrap around edges
                if (node.baseX < -50) node.baseX = canvasBg.width + 50;
                if (node.baseX > canvasBg.width + 50) node.baseX = -50;
                if (node.baseY < -50) node.baseY = pageHeight + 50;
                if (node.baseY > pageHeight + 50) node.baseY = -50;
            }
        });
    }

    // Get scroll-adjusted position for 3D parallax
    function getNodePosition(node) {
        // In circle mode or transitioning out, use pre-calculated viewport positions
        if ((node.inCircle || node.exitingCircle) && node.renderX !== undefined) {
            return {
                x: node.renderX,
                y: node.renderY
            };
        }

        // Normal parallax mode
        const parallaxStrength = 1 - (node.z * config.scrollDepthMultiplier);
        const yOffset = scrollY * parallaxStrength;

        return {
            x: node.baseX,
            y: node.baseY - yOffset
        };
    }

    // Generate connection key
    function getConnectionKey(i, j) {
        return i < j ? `${i}-${j}` : `${j}-${i}`;
    }

    // Draw connections between nearby nodes
    function drawConnections() {
        const newConnections = new Set();

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];

                const posA = getNodePosition(nodeA);
                const posB = getNodePosition(nodeB);

                const distance = Math.sqrt(
                    (posB.x - posA.x) ** 2 + (posB.y - posA.y) ** 2
                );

                if (distance < config.connectionDistance) {
                    const connectionKey = getConnectionKey(i, j);
                    newConnections.add(connectionKey);

                    // Check if this is a new connection
                    if (!activeConnections.has(connectionKey)) {
                        // Start flash with blue color
                        flashingConnections.set(connectionKey, { intensity: 0.4, color: flashColor });
                    }

                    // Line opacity based on distance and average depth
                    const avgDepth = (nodeA.z + nodeB.z) / 2;
                    const distanceFade = 1 - distance / config.connectionDistance;
                    const opacity = distanceFade * avgDepth * 0.3;

                    // Check for flash
                    const flash = flashingConnections.get(connectionKey);
                    const flashIntensity = flash ? flash.intensity : 0;
                    const currentFlashColor = flash ? flash.color : null;

                    // Choose canvas based on node sizes (larger nodes in front of 3D model)
                    // But during audio visualization, always use background canvas
                    const eitherInCircle = nodeA.inCircle || nodeA.exitingCircle || nodeB.inCircle || nodeB.exitingCircle;
                    const bothForeground = nodeA.size >= SIZE_THRESHOLD && nodeB.size >= SIZE_THRESHOLD;
                    const eitherForeground = nodeA.size >= SIZE_THRESHOLD || nodeB.size >= SIZE_THRESHOLD;
                    const ctx = (eitherInCircle || !bothForeground) ? ctxBg : ctxFg;

                    // Draw line - darker gradient for large foreground nodes
                    ctx.beginPath();
                    ctx.moveTo(posA.x, posA.y);
                    ctx.lineTo(posB.x, posB.y);

                    if (eitherForeground) {
                        // Create gradient line from large node for depth effect
                        const gradient = ctx.createLinearGradient(posA.x, posA.y, posB.x, posB.y);
                        const largeNodeOpacity = Math.min(0.7, opacity * 3);
                        if (nodeA.size >= SIZE_THRESHOLD) {
                            gradient.addColorStop(0, `rgba(20, 20, 20, ${largeNodeOpacity})`);
                            gradient.addColorStop(1, `rgba(50, 50, 50, ${opacity * 0.5})`);
                        } else {
                            gradient.addColorStop(0, `rgba(50, 50, 50, ${opacity * 0.5})`);
                            gradient.addColorStop(1, `rgba(20, 20, 20, ${largeNodeOpacity})`);
                        }
                        ctx.strokeStyle = gradient;
                        ctx.lineWidth = 1 + avgDepth * 1.5;
                    } else {
                        ctx.strokeStyle = `rgba(50, 50, 50, ${opacity})`;
                        ctx.lineWidth = 0.5 + avgDepth * 0.5;
                    }
                    ctx.stroke();

                    // Draw colored glow circles at both nodes if flashing
                    if (flashIntensity > 0.01 && currentFlashColor) {
                        const { r, g, b } = currentFlashColor;

                        // Glow at node A - scale to node size
                        const glowRadiusA = nodeA.size * 2;
                        const flashGlowA = ctx.createRadialGradient(
                            posA.x, posA.y, 0,
                            posA.x, posA.y, glowRadiusA
                        );
                        flashGlowA.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${flashIntensity * 0.5})`);
                        flashGlowA.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${flashIntensity * 0.2})`);
                        flashGlowA.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                        ctx.beginPath();
                        ctx.arc(posA.x, posA.y, glowRadiusA, 0, Math.PI * 2);
                        ctx.fillStyle = flashGlowA;
                        ctx.fill();

                        // Glow at node B - scale to node size
                        const glowRadiusB = nodeB.size * 2;
                        const flashGlowB = ctx.createRadialGradient(
                            posB.x, posB.y, 0,
                            posB.x, posB.y, glowRadiusB
                        );
                        flashGlowB.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${flashIntensity * 0.5})`);
                        flashGlowB.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${flashIntensity * 0.2})`);
                        flashGlowB.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                        ctx.beginPath();
                        ctx.arc(posB.x, posB.y, glowRadiusB, 0, Math.PI * 2);
                        ctx.fillStyle = flashGlowB;
                        ctx.fill();
                    }
                }
            }
        }

        // Update active connections
        activeConnections = newConnections;

        // Decay flash intensity
        flashingConnections.forEach((flash, key) => {
            const newIntensity = flash.intensity * 0.96; // 2x longer duration
            if (newIntensity < 0.01) {
                flashingConnections.delete(key);
            } else {
                flashingConnections.set(key, { ...flash, intensity: newIntensity });
            }
        });
    }

    // Draw nodes
    function drawNodes() {
        nodes.forEach(node => {
            const pos = getNodePosition(node);

            // Choose canvas based on size (larger nodes in front of 3D model)
            const ctx = node.size >= SIZE_THRESHOLD ? ctxFg : ctxBg;
            const canvas = node.size >= SIZE_THRESHOLD ? canvasFg : canvasBg;

            // Skip if off screen
            const margin = node.size * 4;
            if (pos.y < -margin || pos.y > canvas.height + margin) return;
            if (pos.x < -margin || pos.x > canvas.width + margin) return;

            // For circle nodes or transitioning: base size with audio scaling
            // For regular nodes: normal size
            let displaySize;
            if (node.inCircle || node.exitingCircle) {
                const baseSize = 15; // Larger base size for circle nodes
                displaySize = baseSize * (node.audioScale || 1);
            } else {
                displaySize = node.size;
            }

            // Glow (proportional to node size)
            const glowSize = displaySize * 2.5;
            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, 0,
                pos.x, pos.y, glowSize
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, 0.6)`);
            gradient.addColorStop(0.4, `rgba(255, 255, 255, 0.2)`);
            gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, displaySize, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        });
    }

    // Render frame
    function render() {
        ctxBg.clearRect(0, 0, canvasBg.width, canvasBg.height);
        ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
        drawConnections();
        drawNodes();
    }

    // Animation loop - continuous
    function animate() {
        updateScroll();
        updateNodes();
        render();
        requestAnimationFrame(animate);
    }

    // Handle scroll
    function handleScroll() {
        // Clamp to 0 to handle iOS bounce/elastic scrolling
        targetScrollY = Math.max(0, window.scrollY);
    }

    // Smooth scroll interpolation
    function updateScroll() {
        // Lerp toward target for smooth mobile experience
        scrollY += (targetScrollY - scrollY) * 0.15;
    }

    // Initialize
    function init() {
        // Get initial scroll position
        targetScrollY = Math.max(0, window.scrollY);
        scrollY = targetScrollY;

        // Set initial dimensions
        canvasBg.width = window.innerWidth;
        canvasBg.height = window.innerHeight;
        canvasFg.width = window.innerWidth;
        canvasFg.height = window.innerHeight;
        pageHeight = document.documentElement.scrollHeight;
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;

        // Initialize nodes once
        initNodes();

        // Recalculate page height after layout settles (fixes mobile)
        setTimeout(() => {
            pageHeight = document.documentElement.scrollHeight;
        }, 100);

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll, { passive: true });

        animate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
