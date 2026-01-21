class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.tileSize = 40;
        this.cols = 15; // Width of one room
        this.rows = 15; // Height of one room
    }

    preload() {
        // Generate placeholder textures programmatically
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });

        // Wall (Grey)
        graphics.fillStyle(0x666666);
        graphics.fillRect(0, 0, this.tileSize, this.tileSize);
        graphics.generateTexture('wall', this.tileSize, this.tileSize);

        // Player Past (Blue)
        graphics.clear();
        graphics.fillStyle(0x00aaff);
        graphics.fillRect(5, 5, this.tileSize - 10, this.tileSize - 10);
        graphics.generateTexture('player_past', this.tileSize, this.tileSize);

        // Player Future (Purple)
        graphics.clear();
        graphics.fillStyle(0xaa00ff);
        graphics.fillRect(5, 5, this.tileSize - 10, this.tileSize - 10);
        graphics.generateTexture('player_future', this.tileSize, this.tileSize);

        // Goal (Green)
        graphics.clear();
        graphics.fillStyle(0x00ff00);
        graphics.fillCircle(this.tileSize / 2, this.tileSize / 2, this.tileSize / 3);
        graphics.generateTexture('goal', this.tileSize, this.tileSize);

        // Floor (Darker Grey)
        graphics.clear();
        graphics.fillStyle(0x222222);
        graphics.fillRect(0, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0x333333); // Grid line effect
        graphics.fillRect(1, 1, this.tileSize - 2, this.tileSize - 2);
        graphics.generateTexture('floor', this.tileSize, this.tileSize);

        // Key (Yellow)
        graphics.clear();
        graphics.fillStyle(0xffff00);
        graphics.fillCircle(this.tileSize / 2, this.tileSize / 2, this.tileSize / 4);
        graphics.generateTexture('key', this.tileSize, this.tileSize);

        // Chest (Brown)
        graphics.clear();
        graphics.fillStyle(0x8B4513);
        graphics.fillRect(5, 5, this.tileSize - 10, this.tileSize - 10);
        graphics.generateTexture('chest', this.tileSize, this.tileSize);

        // Chest Full (Gold) - Just different color for now
        graphics.clear();
        graphics.fillStyle(0xFFD700);
        graphics.fillRect(5, 5, this.tileSize - 10, this.tileSize - 10);
        graphics.generateTexture('chest_full', this.tileSize, this.tileSize);

        // Door (Red)
        graphics.clear();
        graphics.fillStyle(0xff0000);
        graphics.fillRect(0, 0, this.tileSize, this.tileSize);
        graphics.generateTexture('door', this.tileSize, this.tileSize);

        // Lever Off (Grey/Red Switch)
        graphics.clear();
        graphics.fillStyle(0x444444); // Base
        graphics.fillRect(5, 25, 30, 10);
        graphics.fillStyle(0xff0000); // Handle
        graphics.fillRect(10, 5, 5, 20);
        graphics.generateTexture('lever_off', this.tileSize, this.tileSize);

        // Lever On (Grey/Green Switch)
        graphics.clear();
        graphics.fillStyle(0x444444); // Base
        graphics.fillRect(5, 25, 30, 10);
        graphics.fillStyle(0x00ff00); // Handle shifted
        graphics.fillRect(25, 5, 5, 20);
        graphics.generateTexture('lever_on', this.tileSize, this.tileSize);

        // Gate Closed (Iron Bars)
        graphics.clear();
        graphics.fillStyle(0x333333); // Background
        graphics.fillRect(0, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0x888888); // Bars
        graphics.fillRect(5, 0, 5, 40);
        graphics.fillRect(15, 0, 5, 40);
        graphics.fillRect(25, 0, 5, 40);
        graphics.generateTexture('gate_closed', this.tileSize, this.tileSize);

        // Gate Open (Bars down/gone) - Same as floor but maybe hint?
        graphics.clear();
        graphics.fillStyle(0x222222); // Floor-ish
        graphics.fillRect(0, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0x333333);
        graphics.fillRect(1, 1, this.tileSize - 2, this.tileSize - 2);
        // Small "open" indicator?
        graphics.fillStyle(0x555555);
        graphics.fillRect(0, 35, 40, 5); // Bars retracted
        graphics.generateTexture('gate_open', this.tileSize, this.tileSize);
    }

    create() {
        this.physicsSystem = new window.GridPhysics(this);
        this.levelGenerator = new window.LevelGenerator();

        this.pastContainer = this.add.container(0, 0);
        // Initial position, will be updated in generateLevel
        this.futureContainer = this.add.container(0, 0);

        this.stepsLeft = 50;
        this.updateCounterUI();

        // UI Hooks
        document.getElementById('generate-btn').onclick = () => {
            this.generateLevel();
            this.game.canvas.focus();
        };

        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                this.resetLevelState();
                this.game.canvas.focus();
            };
        }

        const diffSlider = document.getElementById('difficulty-slider');
        diffSlider.oninput = (e) => {
            document.getElementById('difficulty-val').innerText = e.target.value;
        };

        const sizeSlider = document.getElementById('room-size-slider');
        sizeSlider.oninput = (e) => {
            const sizes = ['Small', 'Medium', 'Large'];
            document.getElementById('room-size-val').innerText = sizes[e.target.value - 1];
        };

        this.input.keyboard.on('keydown-W', () => this.handleInput('up'));
        this.input.keyboard.on('keydown-A', () => this.handleInput('left'));
        this.input.keyboard.on('keydown-S', () => this.handleInput('down'));
        this.input.keyboard.on('keydown-D', () => this.handleInput('right'));

        this.generateLevel();
    }

    generateLevel() {
        // Safe Cleanup
        if (this.winText) this.winText.destroy();
        if (this.loseText) this.loseText.destroy();

        // Get Settings
        const rawDiff = document.getElementById('difficulty-slider').value;
        const difficulty = parseInt(rawDiff);
        const rawSize = document.getElementById('room-size-slider').value;
        const sizeMap = { 1: 10, 2: 15, 3: 20 };
        this.cols = sizeMap[rawSize];
        this.rows = sizeMap[rawSize];

        // Generate Data
        const levelData = this.levelGenerator.generate(this.cols, this.rows, difficulty);

        // Store Deep Copy
        this.levelData = JSON.parse(JSON.stringify(levelData));

        // Initial Logic State Setup
        this.startPos = this.levelData.start;
        this.minMoves = this.levelData.minMoves;
        this.solutionPath = this.levelData.solutionPath || [];

        // UPDATE UI WITH SOLUTION
        const solutionBox = document.getElementById('solution-box');
        if (solutionBox) {
            const compressed = [];
            if (this.solutionPath.length > 0) {
                let currentMove = this.solutionPath[0];
                let count = 1;
                for (let i = 1; i < this.solutionPath.length; i++) {
                    if (this.solutionPath[i] === currentMove) {
                        count++;
                    } else {
                        compressed.push(count > 1 ? `${currentMove} x${count}` : currentMove);
                        currentMove = this.solutionPath[i];
                        count = 1;
                    }
                }
                compressed.push(count > 1 ? `${currentMove} x${count}` : currentMove);
            }

            solutionBox.innerText = compressed.join(', ').toUpperCase();
            solutionBox.style.display = 'none';
        }

        const solutionBtn = document.getElementById('solution-btn');
        if (solutionBtn) {
            solutionBtn.innerText = 'SHOW SOLUTION';
            solutionBtn.onclick = () => {
                if (solutionBox.style.display === 'none') {
                    solutionBox.style.display = 'block';
                    solutionBtn.innerText = 'HIDE SOLUTION';
                } else {
                    solutionBox.style.display = 'none';
                    solutionBtn.innerText = 'SHOW SOLUTION';
                }
            };
        }

        // Camera Fit & Container Layout
        // We set futureContainer position dynamically based on current cols
        const gap = 4; // Small border gap
        this.futureContainer.x = this.cols * this.tileSize + gap;

        // Draw Separator Line
        if (this.separator) this.separator.destroy();
        this.separator = this.add.graphics();
        this.separator.lineStyle(2, 0xffffff, 0.5); // Thin white line
        this.separator.beginPath();
        this.separator.moveTo(this.cols * this.tileSize + gap / 2, 0);
        this.separator.lineTo(this.cols * this.tileSize + gap / 2, this.rows * this.tileSize);
        this.separator.strokePath();

        // Initialize Level State (Rendering & Players)
        // We do this BEFORE calculting total size just to sure? No, size is static based on cols.
        this.resetLevelState();

        const totalWidth = (this.cols * this.tileSize) * 2 + gap;
        const totalHeight = this.rows * this.tileSize;
        const camera = this.cameras.main;

        // Center on the combined width
        camera.centerOn(totalWidth / 2, totalHeight / 2);

        // Dynamic Zoom to fit screen with padding
        // Screen buffer: 50px
        const screenW = this.cameras.main.width;
        const screenH = this.cameras.main.height;
        const zoomX = (screenW - 100) / totalWidth;
        const zoomY = (screenH - 100) / totalHeight;
        let finalZoom = Math.min(zoomX, zoomY, 1.2); // Cap zoom at 1.2x (was 1x)
        if (finalZoom < 0.1) finalZoom = 0.1; // Safety min

        camera.setZoom(finalZoom);
    }

    resetLevelState() {
        this.stepsLeft = this.minMoves;
        this.updateCounterUI();
        this.isGameOver = false;

        if (this.winText) this.winText.destroy();
        if (this.loseText) this.loseText.destroy();
        this.winText = null;
        this.loseText = null;

        // Reset Logic State
        this.hasKey = false;
        this.depositedKey = false;
        this.futureHasKey = false;
        this.leverOn = false; // Reset Lever

        // Restore Grids from initial copy
        if (this.levelData) {
            this.pastGrid = JSON.parse(JSON.stringify(this.levelData.past));
            this.futureGrid = JSON.parse(JSON.stringify(this.levelData.future));

            // Re-render world (This clears containers completely)
            this.renderGrid(this.pastContainer, this.pastGrid, 'past');
            this.renderGrid(this.futureContainer, this.futureGrid, 'future');
        }

        // Create Players Fresh
        if (this.playerPast) {
            // Just destroy old ones if they werent cleared? 
            // renderGrid clears container, so simple re-add is fine.
            // But we need to make sure we don't duplicate logic.
        }

        // Player Past
        this.playerPast = this.add.sprite(
            this.startPos.x * this.tileSize + this.tileSize / 2,
            this.startPos.y * this.tileSize + this.tileSize / 2,
            'player_past'
        );
        this.pastContainer.add(this.playerPast);
        this.playerPast.currGridX = this.startPos.x;
        this.playerPast.currGridY = this.startPos.y;

        // Player Future
        this.playerFuture = this.add.sprite(
            this.startPos.x * this.tileSize + this.tileSize / 2,
            this.startPos.y * this.tileSize + this.tileSize / 2,
            'player_future'
        );
        this.futureContainer.add(this.playerFuture);
        this.playerFuture.currGridX = this.startPos.x;
        this.playerFuture.currGridY = this.startPos.y;
    }

    renderGrid(container, grid, timeline) {
        container.removeAll(true); // Clear everything

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[0].length; x++) {
                const type = grid[y][x];
                const posX = x * this.tileSize + this.tileSize / 2;
                const posY = y * this.tileSize + this.tileSize / 2;

                container.add(this.add.image(posX, posY, 'floor'));

                if (type === 1) {
                    container.add(this.add.image(posX, posY, 'wall'));
                } else if (type === 4) {
                    container.add(this.add.image(posX, posY, 'goal'));
                } else if (type === 5) {
                    container.add(this.add.image(posX, posY, 'key'));
                } else if (type === 6) {
                    container.add(this.add.image(posX, posY, 'door'));
                } else if (type === 7) {
                    let tex = 'chest';
                    if (timeline === 'past' && this.depositedKey) tex = 'chest_full';
                    if (timeline === 'future' && this.depositedKey && !this.futureHasKey) tex = 'chest_full';
                    container.add(this.add.image(posX, posY, tex));
                } else if (type === 8) {
                    // Lever
                    let tex = this.leverOn ? 'lever_on' : 'lever_off';
                    container.add(this.add.image(posX, posY, tex));
                } else if (type === 9) {
                    // Lever Gate
                    let tex = this.leverOn ? 'gate_open' : 'gate_closed';
                    container.add(this.add.image(posX, posY, tex));
                }
            }
        }

        const labelText = timeline === 'past' ? "PAST (ANCESTOR)" : "FUTURE (DESCENDANT)";
        const label = this.add.text(
            (grid[0].length * this.tileSize) / 2,
            -30,
            labelText,
            { fontSize: '20px', fill: '#fff' }
        ).setOrigin(0.5);
        container.add(label);
    }

    handleInput(direction) {
        if (this.isGameOver) return;
        if (!this.playerPast || !this.playerFuture) return;

        // Check for Gate Blocking (Tile 9)
        // Past Logic:
        let pdx = 0, pdy = 0;
        if (direction === 'left') pdx = -1; else if (direction === 'right') pdx = 1;
        else if (direction === 'up') pdy = -1; else if (direction === 'down') pdy = 1;

        let nextPX = this.playerPast.currGridX + pdx;
        let nextPY = this.playerPast.currGridY + pdy;
        let pBlocked = false;
        if (nextPX >= 0 && nextPX < this.cols && nextPY >= 0 && nextPY < this.rows) {
            if (this.pastGrid[nextPY][nextPX] === 9 && !this.leverOn) pBlocked = true;
        }

        let pastMoved = false;
        if (!pBlocked) {
            pastMoved = this.physicsSystem.moveEntity(this.playerPast, direction, this.pastGrid);
        }

        // Future Logic (Check Doors AND Gates)
        let fdx = pdx, fdy = pdy;
        let nextFX = this.playerFuture.currGridX + fdx;
        let nextFY = this.playerFuture.currGridY + fdy;
        let fBlocked = false;
        if (nextFX >= 0 && nextFX < this.cols && nextFY >= 0 && nextFY < this.rows) {
            if (this.futureGrid[nextFY][nextFX] === 6 && !this.futureHasKey) fBlocked = true;
            if (this.futureGrid[nextFY][nextFX] === 9 && !this.leverOn) fBlocked = true; // Gate exists in future?
        }

        let futureMoved = false;
        if (!fBlocked) {
            futureMoved = this.physicsSystem.moveEntity(this.playerFuture, direction, this.futureGrid);
        }

        let needsRender = false;

        // Past Interactions
        if (pastMoved) {
            const px = this.playerPast.currGridX;
            const py = this.playerPast.currGridY;
            const tile = this.pastGrid[py][px];

            if (tile === 5) { // Key
                this.hasKey = true;
                this.pastGrid[py][px] = 0; // Remove key from grid
                needsRender = true;
                console.log("Key Picked Up");
            }
            if (tile === 7 && this.hasKey) { // Chest
                this.hasKey = false;
                this.depositedKey = true;
                needsRender = true;
                console.log("Key Deposited");
            }
            if (tile === 8) { // Lever
                // Toggle? Or One-way? "Switch".
                // Let's make it toggle for complexity, but solution assumes On.
                // Simple: Turn ON if Off.
                if (!this.leverOn) {
                    this.leverOn = true;
                    needsRender = true;
                    console.log("Lever Activated");
                }
            }
        }

        // Future interactions (Lever in future? Paradox? Let's say Lever exists in both but Past takes precedence)
        // If Future walks on Lever (8), should it work? 
        // Logic: Lever in Past opens Gate in Past (to get Key). 
        // Does Future have a lever? Maybe not.

        if (futureMoved) {
            const fx = this.playerFuture.currGridX;
            const fy = this.playerFuture.currGridY;
            const tile = this.futureGrid[fy][fx];

            if (tile === 7 && this.depositedKey && !this.futureHasKey) {
                this.futureHasKey = true;
                needsRender = true;
                console.log("Future Key Retrieved");
            }
        }

        if (needsRender) {
            // Remove players from container so they aren't destroyed by removeAll(true)
            this.pastContainer.remove(this.playerPast);
            this.futureContainer.remove(this.playerFuture);

            this.renderGrid(this.pastContainer, this.pastGrid, 'past');
            this.renderGrid(this.futureContainer, this.futureGrid, 'future');

            // Re-add players
            this.pastContainer.add(this.playerPast);
            this.futureContainer.add(this.playerFuture);
        }

        if (pastMoved || futureMoved) {
            this.stepsLeft--;
            this.updateCounterUI();
            this.checkWinCondition();
            if (!this.isGameOver && this.stepsLeft <= 0) {
                this.handleLose();
            }
        }
    }

    checkWinCondition() {
        if (!this.playerPast || !this.playerFuture) return;
        const pastOnGoal = this.pastGrid[this.playerPast.currGridY][this.playerPast.currGridX] === 4;
        const futureOnGoal = this.futureGrid[this.playerFuture.currGridY][this.playerFuture.currGridX] === 4;

        if (pastOnGoal && futureOnGoal) {
            this.isGameOver = true;
            this.winText = this.add.text(
                this.cameras.main.worldView.centerX,
                this.cameras.main.worldView.centerY,
                'TIMELINE SYNCED!',
                {
                    fontSize: '64px',
                    fill: '#00ff00',
                    backgroundColor: '#000000aa',
                    padding: { x: 20, y: 10 }
                }
            ).setOrigin(0.5).setScrollFactor(0);
        }
    }

    handleLose() {
        this.isGameOver = true;
        this.loseText = this.add.text(
            this.cameras.main.worldView.centerX,
            this.cameras.main.worldView.centerY,
            'TIME LOST... RESETTING',
            {
                fontSize: '64px',
                fill: '#ff0000',
                backgroundColor: '#000000aa',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5).setScrollFactor(0);

        this.time.delayedCall(1500, () => {
            if (this.loseText) this.loseText.destroy();
            this.resetLevelState();
        });
    }

    updateCounterUI() {
        const counter = document.getElementById('step-counter');
        if (counter) counter.innerText = this.stepsLeft;
    }
}

window.GameScene = GameScene;
