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
    }

    create() {
        this.physicsSystem = new window.GridPhysics(this);
        this.levelGenerator = new window.LevelGenerator();

        this.pastContainer = this.add.container(0, 0);
        this.futureContainer = this.add.container(this.cols * this.tileSize + 20, 0);

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
        // Safe Cleanup (though resetLevelState handles containers)
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

        // Camera Fit
        const totalWidth = (this.cols * this.tileSize) * 2 + 20;
        const totalHeight = this.rows * this.tileSize;
        const camera = this.cameras.main;
        camera.centerOn(totalWidth / 2, totalHeight / 2);
        if (totalHeight > 600 || totalWidth > 800) {
            const zoomX = 800 / (totalWidth + 50);
            const zoomY = 600 / (totalHeight + 50);
            camera.setZoom(Math.min(zoomX, zoomY));
        } else {
            camera.setZoom(1);
        }

        // Initialize Level State (Rendering & Players)
        this.resetLevelState();
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

        // Restore Grids from initial copy
        if (this.levelData) {
            this.pastGrid = JSON.parse(JSON.stringify(this.levelData.past));
            this.futureGrid = JSON.parse(JSON.stringify(this.levelData.future));

            // Re-render world (This clears containers completely)
            this.renderGrid(this.pastContainer, this.pastGrid, 'past');
            this.renderGrid(this.futureContainer, this.futureGrid, 'future');
        }

        // Create Players Fresh
        // Since renderGrid cleared containers, old players are gone.

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
        if (!this.playerPast || !this.playerFuture) return; // Safety check

        const pastMoved = this.physicsSystem.moveEntity(this.playerPast, direction, this.pastGrid);

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
        }

        // Future Pre-check (Doors)
        let fdx = 0, fdy = 0;
        if (direction === 'left') fdx = -1;
        if (direction === 'right') fdx = 1;
        if (direction === 'up') fdy = -1;
        if (direction === 'down') fdy = 1;

        const nextFX = this.playerFuture.currGridX + fdx;
        const nextFY = this.playerFuture.currGridY + fdy;
        let blockedByDoor = false;

        if (nextFX >= 0 && nextFX < this.cols && nextFY >= 0 && nextFY < this.rows) {
            if (this.futureGrid[nextFY][nextFX] === 6 && !this.futureHasKey) {
                blockedByDoor = true;
            }
        }

        let futureMoved = false;
        if (!blockedByDoor) {
            futureMoved = this.physicsSystem.moveEntity(this.playerFuture, direction, this.futureGrid);
        }

        // Future Interactions
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
