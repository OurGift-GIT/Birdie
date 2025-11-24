import * as THREE from 'three';

// ============================================================================
// MOBILE DETECTION
// ============================================================================
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 (window.innerWidth <= 768);

// ============================================================================
// MOBILE INPUT STATE
// ============================================================================
const mobileInput = {
    thrustUp: false,
    thrustDown: false,
    yawLeft: false,
    yawRight: false,
    tiltEnabled: false,
    tilt: { roll: 0, pitch: 0 },
    tiltCalibration: { roll: 0, pitch: 0 },
    shooting: false
};

// ============================================================================
// GAME STATE
// ============================================================================
const gameState = {
    started: false,
    gameOver: false,
    score: 0,
    startTime: 0,
    health: 100,
    missiles: []
};

// ============================================================================
// SCENE SETUP
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 100, 500);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('gameCanvas'),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ============================================================================
// LIGHTING
// ============================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(100, 200, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.left = -200;
sunLight.shadow.camera.right = 200;
sunLight.shadow.camera.top = 200;
sunLight.shadow.camera.bottom = -200;
sunLight.shadow.camera.far = 500;
scene.add(sunLight);

// ============================================================================
// HELICOPTER (LITTLE BIRD)
// ============================================================================
class Helicopter {
    constructor() {
        this.group = new THREE.Group();
        this.position = new THREE.Vector3(0, 15, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.angularVelocity = new THREE.Vector3(0, 0, 0);

        // Flight parameters
        this.thrust = 0;
        this.maxThrust = 0.5;
        this.rollInput = 0;
        this.pitchInput = 0;
        this.yawInput = 0;
        this.turbo = false;

        this.createModel();
        scene.add(this.group);
    }

    createModel() {
        // Body (main fuselage)
        const bodyGeometry = new THREE.BoxGeometry(2, 1.2, 4);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x2d2d2d,
            shininess: 100
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        this.group.add(body);

        // Cockpit
        const cockpitGeometry = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI);
        const cockpitMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            transparent: true,
            opacity: 0.7,
            shininess: 100
        });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.rotation.z = Math.PI / 2;
        cockpit.position.set(0, 0.3, 1.2);
        cockpit.castShadow = true;
        this.group.add(cockpit);

        // Tail boom
        const tailGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
        const tailMaterial = new THREE.MeshPhongMaterial({ color: 0x2d2d2d });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.rotation.x = Math.PI / 2;
        tail.position.set(0, 0.5, -3.5);
        tail.castShadow = true;
        this.group.add(tail);

        // Tail rotor
        const tailRotorGeometry = new THREE.BoxGeometry(0.1, 1.5, 0.05);
        const tailRotorMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.tailRotor = new THREE.Mesh(tailRotorGeometry, tailRotorMaterial);
        this.tailRotor.position.set(0.8, 0.5, -5);
        this.group.add(this.tailRotor);

        // Main rotor mast
        const mastGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        const mast = new THREE.Mesh(mastGeometry, tailMaterial);
        mast.position.set(0, 1.1, 0);
        this.group.add(mast);

        // Main rotor blades
        this.mainRotor = new THREE.Group();
        const bladeGeometry = new THREE.BoxGeometry(0.3, 0.05, 5);
        const bladeMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });

        for (let i = 0; i < 2; i++) {
            const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
            blade.rotation.y = (Math.PI / 2) * i;
            this.mainRotor.add(blade);
        }
        this.mainRotor.position.set(0, 1.6, 0);
        this.group.add(this.mainRotor);

        // Skids (landing gear)
        const skidGeometry = new THREE.CylinderGeometry(0.08, 0.08, 3, 8);
        const skidMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });

        const leftSkid = new THREE.Mesh(skidGeometry, skidMaterial);
        leftSkid.rotation.z = Math.PI / 2;
        leftSkid.position.set(-0.9, -0.8, 0);
        this.group.add(leftSkid);

        const rightSkid = new THREE.Mesh(skidGeometry, skidMaterial);
        rightSkid.rotation.z = Math.PI / 2;
        rightSkid.position.set(0.9, -0.8, 0);
        this.group.add(rightSkid);

        // Miniguns
        this.miniguns = [];
        const minigunGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8);
        const minigunMaterial = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });

        // Left minigun
        const leftGun = new THREE.Mesh(minigunGeometry, minigunMaterial);
        leftGun.rotation.x = Math.PI / 2;
        leftGun.position.set(-1.2, -0.3, 0.5);
        this.group.add(leftGun);
        this.miniguns.push(leftGun);

        // Right minigun
        const rightGun = new THREE.Mesh(minigunGeometry, minigunMaterial);
        rightGun.rotation.x = Math.PI / 2;
        rightGun.position.set(1.2, -0.3, 0.5);
        this.group.add(rightGun);
        this.miniguns.push(rightGun);
    }

    update(deltaTime) {
        // Rotate rotors
        this.mainRotor.rotation.y += 0.5;
        this.tailRotor.rotation.x += 0.8;

        // Physics simulation
        const gravity = new THREE.Vector3(0, -9.81, 0);

        // Apply gravity
        this.velocity.add(gravity.multiplyScalar(deltaTime));

        // Create rotation matrix from current orientation
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(this.rotation);

        // Apply thrust (upward force relative to helicopter orientation)
        const up = new THREE.Vector3(0, 1, 0);
        up.applyMatrix4(rotationMatrix);
        const upForce = up.multiplyScalar(this.thrust * (this.turbo ? 1.5 : 1) * deltaTime);
        this.velocity.add(upForce);

        // Apply rotational forces based on tilt
        const forward = new THREE.Vector3(0, 0, 1);
        const right = new THREE.Vector3(1, 0, 0);

        // Apply pitch (forward/backward tilt)
        forward.applyMatrix4(rotationMatrix);
        const pitchForce = forward.multiplyScalar(this.pitchInput * 15 * deltaTime);
        this.velocity.add(pitchForce);

        // Apply roll (left/right tilt)
        right.applyMatrix4(rotationMatrix);
        const rollForce = right.multiplyScalar(-this.rollInput * 15 * deltaTime);
        this.velocity.add(rollForce);

        // Air resistance
        this.velocity.multiplyScalar(0.98);

        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // Ground collision
        if (this.position.y < 1) {
            this.position.y = 1;
            this.velocity.y = Math.max(0, this.velocity.y);

            if (this.velocity.length() > 5) {
                this.takeDamage(10);
            }
        }

        // Update angular velocity based on input
        this.angularVelocity.x = this.pitchInput * 2;
        this.angularVelocity.z = this.rollInput * 2;
        this.angularVelocity.y = this.yawInput * 1.5;

        // Apply angular velocity to rotation
        this.rotation.x += this.angularVelocity.x * deltaTime;
        this.rotation.y += this.angularVelocity.y * deltaTime;
        this.rotation.z += this.angularVelocity.z * deltaTime;

        // Damping for rotation
        this.angularVelocity.multiplyScalar(0.95);

        // Limit rotation angles
        this.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.rotation.x));
        this.rotation.z = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.rotation.z));

        // Auto-stabilization when no input
        if (Math.abs(this.pitchInput) < 0.1) {
            this.rotation.x *= 0.95;
        }
        if (Math.abs(this.rollInput) < 0.1) {
            this.rotation.z *= 0.95;
        }

        // Update Three.js group transform
        this.group.position.copy(this.position);
        this.group.rotation.copy(this.rotation);
    }

    shoot() {
        const bullets = [];

        // Get forward direction
        const forward = new THREE.Vector3(0, 0, 1);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(this.rotation);
        forward.applyMatrix4(rotationMatrix);

        // Create bullets from each minigun
        this.miniguns.forEach((gun) => {
            const gunWorldPos = new THREE.Vector3();
            gun.getWorldPosition(gunWorldPos);

            const bullet = new Bullet(
                gunWorldPos.clone(),
                forward.clone().multiplyScalar(80)
            );
            bullets.push(bullet);
        });

        return bullets;
    }

    takeDamage(amount) {
        gameState.health -= amount;
        updateUI();

        if (gameState.health <= 0) {
            endGame();
        }
    }
}

// ============================================================================
// BULLET
// ============================================================================
class Bullet {
    constructor(position, velocity) {
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffff00
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.velocity = velocity;
        this.lifetime = 2;
        this.active = true;

        scene.add(this.mesh);
    }

    update(deltaTime) {
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.lifetime -= deltaTime;

        if (this.lifetime <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.active = false;
        scene.remove(this.mesh);
    }
}

// ============================================================================
// CITY GENERATION
// ============================================================================
class City {
    constructor() {
        this.buildings = [];
        this.generate();
    }

    generate() {
        const gridSize = 20;
        const spacing = 30;
        const buildingCount = 100;

        for (let i = 0; i < buildingCount; i++) {
            const x = (Math.random() - 0.5) * gridSize * spacing;
            const z = (Math.random() - 0.5) * gridSize * spacing;

            // Skip center area for spawn
            if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;

            const width = 5 + Math.random() * 10;
            const depth = 5 + Math.random() * 10;
            const height = 15 + Math.random() * 20; // Not very tall buildings

            const building = this.createBuilding(x, z, width, depth, height);
            this.buildings.push(building);
        }

        // Create ground
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshLambertMaterial({
            color: 0x4a4a4a
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Add grid lines
        const gridHelper = new THREE.GridHelper(1000, 100, 0x666666, 0x333333);
        scene.add(gridHelper);
    }

    createBuilding(x, z, width, depth, height) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.2)
        });
        const building = new THREE.Mesh(geometry, material);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;

        // Add windows
        const windowGeometry = new THREE.PlaneGeometry(0.8, 1.5);
        const windowMaterial = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xffff99 : 0x333333
        });

        const windowsPerFloor = Math.floor(width / 2);
        const floors = Math.floor(height / 3);

        for (let floor = 0; floor < floors; floor++) {
            for (let w = 0; w < windowsPerFloor; w++) {
                const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
                window1.position.set(
                    (w - windowsPerFloor / 2) * 2,
                    floor * 3 - height / 2 + 2,
                    depth / 2 + 0.01
                );
                building.add(window1);
            }
        }

        scene.add(building);

        return {
            mesh: building,
            bounds: {
                min: new THREE.Vector3(x - width / 2, 0, z - depth / 2),
                max: new THREE.Vector3(x + width / 2, height, z + depth / 2)
            }
        };
    }

    checkCollision(position, radius = 2) {
        for (const building of this.buildings) {
            const bounds = building.bounds;

            // Expanded AABB collision check
            if (position.x + radius > bounds.min.x &&
                position.x - radius < bounds.max.x &&
                position.y + radius > bounds.min.y &&
                position.y - radius < bounds.max.y &&
                position.z + radius > bounds.min.z &&
                position.z - radius < bounds.max.z) {
                return true;
            }
        }
        return false;
    }
}

// ============================================================================
// AAA (Anti-Aircraft Artillery)
// ============================================================================
class AAA {
    constructor(position) {
        this.position = position.clone();
        this.group = new THREE.Group();
        this.health = 3;
        this.fireRate = 3; // seconds between shots
        this.lastFireTime = 0;
        this.range = 150;
        this.active = true;

        this.createModel();
        this.group.position.copy(this.position);
        scene.add(this.group);
    }

    createModel() {
        // Base
        const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 1, 8);
        const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x2d5016 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.castShadow = true;
        this.group.add(base);

        // Turret
        const turretGeometry = new THREE.CylinderGeometry(1, 1.5, 1.5, 8);
        const turretMaterial = new THREE.MeshPhongMaterial({ color: 0x4a7023 });
        this.turret = new THREE.Mesh(turretGeometry, turretMaterial);
        this.turret.position.y = 1.25;
        this.turret.castShadow = true;
        this.group.add(this.turret);

        // Barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 3, 8);
        const barrelMaterial = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
        this.barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        this.barrel.rotation.x = Math.PI / 2;
        this.barrel.position.set(0, 0.5, 1.5);
        this.turret.add(this.barrel);

        // Radar dish
        const radarGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16);
        const radarMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.radar = new THREE.Mesh(radarGeometry, radarMaterial);
        this.radar.position.set(0, 1, -0.5);
        this.turret.add(this.radar);
    }

    update(deltaTime, targetPosition, currentTime, city) {
        if (!this.active) return null;

        // Rotate radar
        this.radar.rotation.y += deltaTime * 2;

        // Calculate distance to target
        const distance = this.position.distanceTo(targetPosition);

        if (distance < this.range) {
            // Aim at target
            const direction = new THREE.Vector3()
                .subVectors(targetPosition, this.position)
                .normalize();

            // Rotate turret towards target (yaw)
            const angle = Math.atan2(direction.x, direction.z);
            this.turret.rotation.y = angle;

            // Rotate barrel for elevation
            const elevation = Math.atan2(
                direction.y,
                Math.sqrt(direction.x * direction.x + direction.z * direction.z)
            );
            this.barrel.rotation.x = elevation;

            // Fire missile
            if (currentTime - this.lastFireTime > this.fireRate) {
                this.lastFireTime = currentTime;
                return this.fireMissile(targetPosition, city);
            }
        }

        return null;
    }

    fireMissile(targetPosition, city) {
        const missileStart = new THREE.Vector3();
        this.barrel.getWorldPosition(missileStart);

        return new Missile(missileStart, targetPosition, this, city);
    }

    takeDamage(amount) {
        this.health -= amount;

        // Visual feedback
        this.group.traverse((child) => {
            if (child.material) {
                child.material.emissive = new THREE.Color(0xff0000);
                setTimeout(() => {
                    child.material.emissive = new THREE.Color(0x000000);
                }, 100);
            }
        });

        if (this.health <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.active = false;

        // Explosion effect
        const explosionGeometry = new THREE.SphereGeometry(3, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8
        });
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(this.position);
        scene.add(explosion);

        // Animate explosion
        let scale = 1;
        const explodeInterval = setInterval(() => {
            scale += 0.3;
            explosion.scale.set(scale, scale, scale);
            explosion.material.opacity -= 0.1;

            if (explosion.material.opacity <= 0) {
                clearInterval(explodeInterval);
                scene.remove(explosion);
            }
        }, 50);

        scene.remove(this.group);
        gameState.score++;
        updateUI();
    }
}

// ============================================================================
// MISSILE
// ============================================================================
class Missile {
    constructor(position, targetPosition, source, city) {
        this.position = position.clone();
        this.targetPosition = targetPosition.clone();
        this.source = source;
        this.city = city;
        this.active = true;
        this.speed = 30;
        this.maxTurnRate = 2.5; // radians per second - limited turn rate!
        this.lifetime = 10;

        // Initial velocity towards target
        this.velocity = new THREE.Vector3()
            .subVectors(targetPosition, position)
            .normalize()
            .multiplyScalar(this.speed);

        this.createModel();
        scene.add(this.mesh);

        // Smoke trail
        this.trail = [];
        this.trailLength = 20;
    }

    createModel() {
        const group = new THREE.Group();

        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.2, 1.5, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2;
        group.add(body);

        // Nose cone
        const noseGeometry = new THREE.ConeGeometry(0.1, 0.4, 8);
        const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
        nose.rotation.x = -Math.PI / 2;
        nose.position.z = 0.95;
        group.add(nose);

        // Fins
        const finGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.3);
        const finMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });

        for (let i = 0; i < 4; i++) {
            const fin = new THREE.Mesh(finGeometry, finMaterial);
            fin.rotation.y = (Math.PI / 2) * i;
            fin.position.z = -0.6;
            group.add(fin);
        }

        // Flame
        const flameGeometry = new THREE.ConeGeometry(0.15, 0.8, 8);
        const flameMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8
        });
        this.flame = new THREE.Mesh(flameGeometry, flameMaterial);
        this.flame.rotation.x = Math.PI / 2;
        this.flame.position.z = -1.15;
        group.add(this.flame);

        this.mesh = group;
        this.mesh.position.copy(this.position);
    }

    update(deltaTime, helicopter) {
        if (!this.active) return;

        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.destroy();
            return;
        }

        // Update target position to current helicopter position
        this.targetPosition.copy(helicopter.position);

        // Calculate desired direction
        const desiredDirection = new THREE.Vector3()
            .subVectors(this.targetPosition, this.position)
            .normalize();

        // Current direction
        const currentDirection = this.velocity.clone().normalize();

        // Calculate angle between current and desired direction
        const angle = currentDirection.angleTo(desiredDirection);

        // Limit turn rate
        const maxAngleChange = this.maxTurnRate * deltaTime;

        if (angle > maxAngleChange) {
            // Turn towards target, but limited by maxTurnRate
            const axis = new THREE.Vector3()
                .crossVectors(currentDirection, desiredDirection)
                .normalize();

            const quaternion = new THREE.Quaternion()
                .setFromAxisAngle(axis, maxAngleChange);

            currentDirection.applyQuaternion(quaternion);
            this.velocity = currentDirection.multiplyScalar(this.speed);
        } else {
            // Can turn directly towards target
            this.velocity = desiredDirection.multiplyScalar(this.speed);
        }

        // Update position
        const newPosition = this.position.clone().add(
            this.velocity.clone().multiplyScalar(deltaTime)
        );

        // Check building collision
        if (this.city.checkCollision(newPosition, 0.5)) {
            this.destroy();
            return;
        }

        this.position.copy(newPosition);

        // Update mesh orientation
        this.mesh.position.copy(this.position);
        this.mesh.lookAt(this.position.clone().add(this.velocity));

        // Animate flame
        this.flame.scale.y = 0.8 + Math.random() * 0.4;

        // Add to trail
        this.trail.push(this.position.clone());
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }

        // Check collision with helicopter
        if (this.position.distanceTo(helicopter.position) < 2) {
            helicopter.takeDamage(20);
            this.destroy();
        }
    }

    destroy() {
        this.active = false;
        scene.remove(this.mesh);

        // Small explosion
        const explosionGeometry = new THREE.SphereGeometry(1, 8, 8);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8
        });
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(this.position);
        scene.add(explosion);

        setTimeout(() => {
            scene.remove(explosion);
        }, 200);
    }
}

// ============================================================================
// INPUT HANDLING
// ============================================================================
const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    rollLeft: false,
    rollRight: false,
    pitchUp: false,
    pitchDown: false,
    shoot: false,
    turbo: false
};

document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'KeyW': input.up = true; break;
        case 'KeyS': input.down = true; break;
        case 'KeyA': input.left = true; break;
        case 'KeyD': input.right = true; break;
        case 'ArrowLeft': input.rollLeft = true; break;
        case 'ArrowRight': input.rollRight = true; break;
        case 'ArrowUp': input.pitchDown = true; break;
        case 'ArrowDown': input.pitchUp = true; break;
        case 'Space': input.shoot = true; e.preventDefault(); break;
        case 'ShiftLeft': input.turbo = true; break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'KeyW': input.up = false; break;
        case 'KeyS': input.down = false; break;
        case 'KeyA': input.left = false; break;
        case 'KeyD': input.right = false; break;
        case 'ArrowLeft': input.rollLeft = false; break;
        case 'ArrowRight': input.rollRight = false; break;
        case 'ArrowUp': input.pitchDown = false; break;
        case 'ArrowDown': input.pitchUp = false; break;
        case 'Space': input.shoot = false; break;
        case 'ShiftLeft': input.turbo = false; break;
    }
});

// ============================================================================
// GAME INITIALIZATION
// ============================================================================
let helicopter;
let city;
let aaaList = [];
let bullets = [];
let lastShootTime = 0;
const shootDelay = 0.1; // 10 shots per second

function initGame() {
    // Clear existing game objects
    gameState.started = true;
    gameState.gameOver = false;
    gameState.score = 0;
    gameState.health = 100;
    gameState.startTime = Date.now();
    gameState.missiles = [];

    // Clear scene
    while(scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    // Re-add lights
    scene.add(ambientLight);
    scene.add(sunLight);

    // Create game objects
    helicopter = new Helicopter();
    city = new City();

    // Spawn AAAs
    aaaList = [];
    for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        const distance = 80 + Math.random() * 100;
        const position = new THREE.Vector3(
            Math.cos(angle) * distance,
            0.5,
            Math.sin(angle) * distance
        );

        // Make sure not inside building
        if (!city.checkCollision(position, 3)) {
            aaaList.push(new AAA(position));
        }
    }

    bullets = [];

    // Update UI
    updateUI();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
}

// ============================================================================
// CAMERA SETUP (Third Person)
// ============================================================================
function updateCamera() {
    if (!helicopter) return;

    const cameraDistance = 15;
    const cameraHeight = 5;

    // Calculate camera position behind and above helicopter
    const helicopterRotation = helicopter.rotation.y;
    const offset = new THREE.Vector3(
        -Math.sin(helicopterRotation) * cameraDistance,
        cameraHeight,
        -Math.cos(helicopterRotation) * cameraDistance
    );

    const targetCameraPos = helicopter.position.clone().add(offset);

    // Smooth camera follow
    camera.position.lerp(targetCameraPos, 0.1);

    // Look slightly ahead of helicopter
    const lookAhead = helicopter.velocity.clone().multiplyScalar(0.3);
    const lookTarget = helicopter.position.clone().add(lookAhead);
    camera.lookAt(lookTarget);
}

// ============================================================================
// UI UPDATES
// ============================================================================
function updateUI() {
    document.getElementById('health-fill').style.width = gameState.health + '%';
    document.getElementById('score').textContent = gameState.score;

    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('time').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;

    document.getElementById('missiles').textContent = gameState.missiles.length;
}

function endGame() {
    gameState.gameOver = true;
    gameState.started = false;

    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('final-time').textContent =
        document.getElementById('time').textContent;
    document.getElementById('game-over').classList.remove('hidden');
}

// ============================================================================
// GAME LOOP
// ============================================================================
let lastTime = performance.now();

function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    if (!gameState.started || gameState.gameOver) {
        renderer.render(scene, camera);
        return;
    }

    // Update helicopter
    if (helicopter) {
        // Apply input (keyboard or mobile)
        if (isMobile) {
            // Mobile controls
            // Thrust buttons - газ up relative to helicopter, reverse down relative to world
            if (mobileInput.thrustUp) {
                helicopter.thrust = helicopter.maxThrust;
            } else if (mobileInput.thrustDown) {
                // Reverse thrust - always downward in world space
                helicopter.thrust = -helicopter.maxThrust * 0.7;
            } else {
                helicopter.thrust = 0;
            }

            // Yaw buttons (buttons are swapped in event handlers)
            helicopter.yawInput = mobileInput.yawLeft ? -1 : mobileInput.yawRight ? 1 : 0;

            // Tilt controls roll and pitch
            if (mobileInput.tiltEnabled) {
                helicopter.rollInput = mobileInput.tilt.roll;
                helicopter.pitchInput = mobileInput.tilt.pitch;
            } else {
                helicopter.rollInput = 0;
                helicopter.pitchInput = 0;
            }

            // Shooting
            if (mobileInput.shooting && currentTime - lastShootTime > shootDelay * 1000) {
                lastShootTime = currentTime;
                const newBullets = helicopter.shoot();
                bullets.push(...newBullets);
            }
        } else {
            // Keyboard controls
            helicopter.thrust = input.up ? helicopter.maxThrust :
                               input.down ? -helicopter.maxThrust * 0.5 : 0;
            helicopter.yawInput = input.left ? -1 : input.right ? 1 : 0;
            helicopter.rollInput = input.rollLeft ? -1 : input.rollRight ? 1 : 0;
            helicopter.pitchInput = input.pitchDown ? -1 : input.pitchUp ? 1 : 0;
            helicopter.turbo = input.turbo;

            // Shooting
            if (input.shoot && currentTime - lastShootTime > shootDelay * 1000) {
                lastShootTime = currentTime;
                const newBullets = helicopter.shoot();
                bullets.push(...newBullets);
            }
        }

        helicopter.update(deltaTime);
    }

    // Update bullets
    bullets = bullets.filter(bullet => {
        if (!bullet.active) return false;

        bullet.update(deltaTime);

        // Check collision with AAAs
        for (const aaa of aaaList) {
            if (!aaa.active) continue;

            if (bullet.mesh.position.distanceTo(aaa.position) < 3) {
                aaa.takeDamage(1);
                bullet.destroy();
                return false;
            }
        }

        return bullet.active;
    });

    // Update AAAs and missiles
    const time = currentTime / 1000;
    aaaList.forEach(aaa => {
        const missile = aaa.update(deltaTime, helicopter.position, time, city);
        if (missile) {
            gameState.missiles.push(missile);
        }
    });

    // Update missiles
    gameState.missiles = gameState.missiles.filter(missile => {
        if (!missile.active) return false;
        missile.update(deltaTime, helicopter);
        return missile.active;
    });

    // Update camera
    updateCamera();

    // Update UI
    updateUI();

    // Render
    renderer.render(scene, camera);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
document.getElementById('start-btn').addEventListener('click', () => {
    initGame();
});

document.getElementById('restart-btn').addEventListener('click', () => {
    initGame();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// MOBILE CONTROLS
// ============================================================================
if (isMobile) {
    // Show mobile controls
    document.getElementById('mobile-controls').classList.remove('hidden');

    // Button Controls
    const btnThrustUp = document.getElementById('btn-thrust-up');
    const btnThrustDown = document.getElementById('btn-thrust-down');
    const btnYawLeft = document.getElementById('btn-yaw-left');
    const btnYawRight = document.getElementById('btn-yaw-right');
    const btnShoot = document.getElementById('btn-shoot');

    // Thrust Up
    btnThrustUp.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileInput.thrustUp = true;
        console.log('THRUST UP: ON');
    });
    btnThrustUp.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileInput.thrustUp = false;
        console.log('THRUST UP: OFF');
    });
    btnThrustUp.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        mobileInput.thrustUp = false;
    });

    // Thrust Down (Reverse)
    btnThrustDown.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileInput.thrustDown = true;
    });
    btnThrustDown.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileInput.thrustDown = false;
    });
    btnThrustDown.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        mobileInput.thrustDown = false;
    });

    // Yaw Left - SWAPPED: left button controls RIGHT input
    btnYawLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileInput.yawRight = true;
        console.log('LEFT BUTTON -> yawRight');
    });
    btnYawLeft.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileInput.yawRight = false;
    });
    btnYawLeft.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        mobileInput.yawRight = false;
    });

    // Yaw Right - SWAPPED: right button controls LEFT input
    btnYawRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileInput.yawLeft = true;
        console.log('RIGHT BUTTON -> yawLeft');
    });
    btnYawRight.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileInput.yawLeft = false;
    });
    btnYawRight.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        mobileInput.yawLeft = false;
    });

    // Shoot
    btnShoot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileInput.shooting = true;
    });
    btnShoot.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileInput.shooting = false;
    });
    btnShoot.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        mobileInput.shooting = false;
    });

    // Tilt controls (DeviceOrientation API)
    const tiltToggle = document.getElementById('tilt-toggle');
    const tiltCalibrate = document.getElementById('tilt-calibrate');
    const tiltIndicator = document.getElementById('tilt-indicator');
    const tiltDot = document.getElementById('tilt-dot');

    let rawTilt = { beta: 0, gamma: 0 };

    tiltToggle.addEventListener('click', async () => {
        if (!mobileInput.tiltEnabled) {
            // Request permission for iOS 13+
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        enableTilt();
                    } else {
                        alert('Необходимо разрешение на использование датчиков устройства');
                    }
                } catch (error) {
                    console.error('Error requesting device orientation permission:', error);
                    alert('Ошибка при запросе разрешения: ' + error.message);
                }
            } else {
                // Non-iOS or older iOS
                enableTilt();
            }
        } else {
            disableTilt();
        }
    });

    tiltCalibrate.addEventListener('click', () => {
        calibrateTilt();
    });

    function enableTilt() {
        mobileInput.tiltEnabled = true;
        tiltToggle.classList.add('active');
        tiltToggle.textContent = '📱 Тилт активен';
        tiltCalibrate.classList.remove('hidden');
        tiltIndicator.classList.remove('hidden');

        window.addEventListener('deviceorientation', handleOrientation);

        // Auto-calibrate after a short delay
        setTimeout(() => {
            calibrateTilt();
        }, 500);
    }

    function disableTilt() {
        mobileInput.tiltEnabled = false;
        tiltToggle.classList.remove('active');
        tiltToggle.textContent = '📱 Включить тилт';
        tiltCalibrate.classList.add('hidden');
        tiltIndicator.classList.add('hidden');
        window.removeEventListener('deviceorientation', handleOrientation);
        mobileInput.tilt = { roll: 0, pitch: 0 };
    }

    function calibrateTilt() {
        // Set current position as neutral
        mobileInput.tiltCalibration.beta = rawTilt.beta;
        mobileInput.tiltCalibration.gamma = rawTilt.gamma;

        // Visual feedback
        tiltCalibrate.style.background = 'rgba(255, 255, 0, 0.5)';
        setTimeout(() => {
            tiltCalibrate.style.background = '';
        }, 200);
    }

    function handleOrientation(event) {
        // Store raw values
        rawTilt.beta = event.beta || 0;
        rawTilt.gamma = event.gamma || 0;

        // Apply calibration
        let calibratedBeta = rawTilt.beta - mobileInput.tiltCalibration.beta;
        let calibratedGamma = rawTilt.gamma - mobileInput.tiltCalibration.gamma;

        // For landscape mode (device rotated 90 degrees)
        // beta controls pitch (forward/backward tilt)
        // gamma controls roll (left/right tilt)

        // Normalize to -1 to 1 range with dead zone
        const sensitivity = 30; // degrees for full range
        const deadZone = 5; // degrees - increased for stability

        // Pitch (forward/back) - use beta
        let pitch = -calibratedBeta / sensitivity;
        if (Math.abs(pitch) < deadZone / sensitivity) pitch = 0;
        mobileInput.tilt.pitch = Math.max(-1, Math.min(1, pitch));

        // Roll (left/right) - use gamma
        let roll = calibratedGamma / sensitivity;
        if (Math.abs(roll) < deadZone / sensitivity) roll = 0;
        mobileInput.tilt.roll = Math.max(-1, Math.min(1, roll));

        // Update indicator
        updateTiltIndicator();
    }

    function updateTiltIndicator() {
        const maxOffset = 40; // pixels from center
        const x = mobileInput.tilt.roll * maxOffset;
        const y = mobileInput.tilt.pitch * maxOffset;
        tiltDot.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }

    // Check orientation
    function checkOrientation() {
        const orientationWarning = document.getElementById('orientation-warning');
        if (window.innerWidth < window.innerHeight) {
            // Portrait mode
            orientationWarning.classList.remove('hidden');
        } else {
            // Landscape mode
            orientationWarning.classList.add('hidden');
        }
    }

    checkOrientation();
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', checkOrientation);
}

// ============================================================================
// START
// ============================================================================
gameLoop(performance.now());
