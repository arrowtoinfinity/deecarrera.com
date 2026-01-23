// Constellation Network Animation
// Slow drifting nodes with dynamic connections
// Blue flash on new connections

(function() {
    const canvas = document.getElementById('constellation');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Configuration
    const config = {
        nodeCount: window.innerWidth < 768 ? 50 : 90,
        connectionDistance: 150,
        scrollDepthMultiplier: 1.2,
        driftSpeed: 0.15
    };

    let nodes = [];
    let scrollY = 0;
    let pageHeight = 0;
    let activeConnections = new Set();
    let flashingConnections = new Map(); // connectionKey -> flashIntensity

    // Resize canvas to full page
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        pageHeight = document.documentElement.scrollHeight;
        initNodes();
    }

    // Initialize nodes spread across entire page height
    function initNodes() {
        nodes = [];
        const count = window.innerWidth < 768 ? 50 : 90;

        for (let i = 0; i < count; i++) {
            const depth = Math.random(); // 0 = far (subtle), 1 = near (bold)

            nodes.push({
                baseX: Math.random() * canvas.width,
                baseY: Math.random() * pageHeight,
                // Drift velocity
                vx: (Math.random() - 0.5) * config.driftSpeed,
                vy: (Math.random() - 0.5) * config.driftSpeed,
                z: depth,
                size: 1 + depth * depth * 24,
                opacity: 0.08 + depth * 0.42
            });
        }

        // Sort by depth so far nodes render first
        nodes.sort((a, b) => a.z - b.z);
    }

    // Update node positions (drift)
    function updateNodes() {
        nodes.forEach(node => {
            node.baseX += node.vx;
            node.baseY += node.vy;

            // Wrap around edges
            if (node.baseX < -50) node.baseX = canvas.width + 50;
            if (node.baseX > canvas.width + 50) node.baseX = -50;
            if (node.baseY < -50) node.baseY = pageHeight + 50;
            if (node.baseY > pageHeight + 50) node.baseY = -50;
        });
    }

    // Get scroll-adjusted position for 3D parallax
    function getNodePosition(node) {
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
                        // Start blue flash
                        flashingConnections.set(connectionKey, 0.4); // Start brighter, will fade to subtle
                    }

                    // Line opacity based on distance and average depth
                    const avgDepth = (nodeA.z + nodeB.z) / 2;
                    const distanceFade = 1 - distance / config.connectionDistance;
                    const opacity = distanceFade * avgDepth * 0.3;

                    // Check for flash
                    const flashIntensity = flashingConnections.get(connectionKey) || 0;

                    // Draw line
                    ctx.beginPath();
                    ctx.moveTo(posA.x, posA.y);
                    ctx.lineTo(posB.x, posB.y);
                    ctx.strokeStyle = `rgba(100, 100, 100, ${opacity})`;
                    ctx.lineWidth = 0.5 + avgDepth * 0.5;
                    ctx.stroke();

                    // Draw blue glow circles at connection midpoint if flashing
                    if (flashIntensity > 0.01) {
                        const midX = (posA.x + posB.x) / 2;
                        const midY = (posA.y + posB.y) / 2;
                        const glowRadius = 30 + flashIntensity * 40;

                        const flashGlow = ctx.createRadialGradient(
                            midX, midY, 0,
                            midX, midY, glowRadius
                        );
                        // Lighter blue (sky blue)
                        flashGlow.addColorStop(0, `rgba(135, 206, 250, ${flashIntensity * 0.5})`);
                        flashGlow.addColorStop(0.5, `rgba(135, 206, 250, ${flashIntensity * 0.2})`);
                        flashGlow.addColorStop(1, `rgba(135, 206, 250, 0)`);

                        ctx.beginPath();
                        ctx.arc(midX, midY, glowRadius, 0, Math.PI * 2);
                        ctx.fillStyle = flashGlow;
                        ctx.fill();
                    }
                }
            }
        }

        // Update active connections
        activeConnections = newConnections;

        // Decay flash intensity
        flashingConnections.forEach((intensity, key) => {
            const newIntensity = intensity * 0.92; // Slower decay
            if (newIntensity < 0.01) {
                flashingConnections.delete(key);
            } else {
                flashingConnections.set(key, newIntensity);
            }
        });
    }

    // Draw nodes
    function drawNodes() {
        nodes.forEach(node => {
            const pos = getNodePosition(node);

            // Skip if off screen
            const margin = node.size * 4;
            if (pos.y < -margin || pos.y > canvas.height + margin) return;
            if (pos.x < -margin || pos.x > canvas.width + margin) return;

            // Glow
            const glowSize = node.size * 2.5;
            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, 0,
                pos.x, pos.y, glowSize
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${node.opacity * 0.4})`);
            gradient.addColorStop(0.5, `rgba(255, 255, 255, ${node.opacity * 0.1})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, node.size, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        });
    }

    // Render frame
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawConnections();
        drawNodes();
    }

    // Animation loop - continuous
    function animate() {
        updateNodes();
        render();
        requestAnimationFrame(animate);
    }

    // Handle scroll
    function handleScroll() {
        scrollY = window.scrollY;
    }

    // Initialize
    function init() {
        resize();

        window.addEventListener('resize', resize);
        window.addEventListener('scroll', handleScroll, { passive: true });

        animate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
