// Constellation Network Animation
// Static at rest, 3D movement on scroll, monochrome

(function() {
    const canvas = document.getElementById('constellation');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Configuration
    const config = {
        nodeCount: window.innerWidth < 768 ? 40 : 70,
        connectionDistance: 120,
        scrollDepthMultiplier: 0.8
    };

    let nodes = [];
    let scrollY = 0;
    let lastScrollY = 0;
    let needsRender = true;

    // Resize canvas
    function resize() {
        const hero = canvas.parentElement;
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;
        initNodes();
        needsRender = true;
    }

    // Initialize nodes with fixed positions
    function initNodes() {
        nodes = [];
        const count = window.innerWidth < 768 ? 40 : 70;

        for (let i = 0; i < count; i++) {
            const depth = Math.random(); // 0 = far (subtle), 1 = near (bold)

            nodes.push({
                baseX: Math.random() * canvas.width,
                baseY: Math.random() * canvas.height,
                z: depth,
                // Size: far = 1px, near = 4px
                size: 1 + depth * 3,
                // Opacity: far = 0.15, near = 0.8
                opacity: 0.15 + depth * 0.65
            });
        }

        // Sort by depth so far nodes render first
        nodes.sort((a, b) => a.z - b.z);
    }

    // Get scroll-adjusted position for 3D parallax
    function getNodePosition(node) {
        // Far nodes (z=0) move slowly, near nodes (z=1) move faster
        const parallaxStrength = node.z * config.scrollDepthMultiplier;
        const yOffset = scrollY * parallaxStrength;

        return {
            x: node.baseX,
            y: node.baseY - yOffset
        };
    }

    // Draw connections between nearby nodes
    function drawConnections() {
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
                    // Line opacity based on distance and average depth
                    const avgDepth = (nodeA.z + nodeB.z) / 2;
                    const distanceFade = 1 - distance / config.connectionDistance;
                    const opacity = distanceFade * avgDepth * 0.3;

                    ctx.beginPath();
                    ctx.moveTo(posA.x, posA.y);
                    ctx.lineTo(posB.x, posB.y);
                    ctx.strokeStyle = `rgba(100, 100, 100, ${opacity})`;
                    ctx.lineWidth = 0.5 + avgDepth * 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    // Draw nodes
    function drawNodes() {
        nodes.forEach(node => {
            const pos = getNodePosition(node);

            // Skip if off screen
            if (pos.y < -50 || pos.y > canvas.height + 50) return;

            const gray = Math.floor(80 + node.z * 80); // 80-160 gray range

            // Glow for near nodes
            if (node.z > 0.5) {
                const glowSize = node.size * 3;
                const gradient = ctx.createRadialGradient(
                    pos.x, pos.y, 0,
                    pos.x, pos.y, glowSize
                );
                gradient.addColorStop(0, `rgba(${gray}, ${gray}, ${gray}, ${node.opacity * 0.3})`);
                gradient.addColorStop(1, `rgba(${gray}, ${gray}, ${gray}, 0)`);

                ctx.beginPath();
                ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            }

            // Core dot
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, node.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${node.opacity})`;
            ctx.fill();
        });
    }

    // Render frame
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawConnections();
        drawNodes();
    }

    // Animation loop - only renders when needed
    function animate() {
        if (scrollY !== lastScrollY) {
            needsRender = true;
            lastScrollY = scrollY;
        }

        if (needsRender) {
            render();
            needsRender = false;
        }

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

        // Initial render
        render();
        animate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
