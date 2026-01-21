class LevelGenerator {
    constructor() {
        // Tile Types: 0 = Empty, 1 = Wall, 2 = Player Start, 3 = Box, 4 = Goal, 5 = Key, 6 = Door, 7 = Chest
    }

    generate(width, height, difficulty) {
        let attempts = 0;
        const maxAttempts = 200;

        while (attempts < maxAttempts) {
            attempts++;
            const { past, future, start, goal } = this.tryGenerate(width, height, difficulty);

            // Precise Check: Combined State BFS
            const solution = this.solveLevel(past, future, start, goal);

            if (solution) {
                console.log(`Level generated successfully after ${attempts} attempts. Min Moves: ${solution.steps}`);
                return { past, future, start, goal, minMoves: solution.steps, solutionPath: solution.path };
            }
        }

        // Fallback
        console.warn("Could not generate complex solvable level, returning empty room.");
        const fallback = this.createEmptyGrid(width, height);
        const start = { x: 1, y: 1 };
        const goal = { x: width - 2, y: height - 2 };
        if (width > 2 && height > 2) {
            fallback[start.y][start.x] = 2;
            fallback[goal.y][goal.x] = 4;
        }
        const dx = Math.abs(start.x - goal.x);
        const dy = Math.abs(start.y - goal.y);

        let simplePath = [];
        for (let i = 0; i < Math.abs(goal.x - start.x); i++) simplePath.push(goal.x > start.x ? 'right' : 'left');
        for (let i = 0; i < Math.abs(goal.y - start.y); i++) simplePath.push(goal.y > start.y ? 'down' : 'up');

        return { past: fallback, future: fallback, start, goal, minMoves: dx + dy, solutionPath: simplePath };
    }

    tryGenerate(width, height, difficulty) {
        const pastGrid = this.createEmptyGrid(width, height);
        const futureGrid = this.createEmptyGrid(width, height);

        // 1. Generate Walls
        const wallChance = 0.1 + (difficulty * 0.03);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (Math.random() < wallChance) {
                    pastGrid[y][x] = 1; // Wall
                }
            }
        }

        // 2. Future Decay
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pastTile = pastGrid[y][x];
                let futureTile = pastTile;
                if (pastTile === 1 && Math.random() < 0.3) futureTile = 0;
                if (pastTile === 0 && Math.random() < (0.02 * difficulty)) futureTile = 1;
                futureGrid[y][x] = futureTile;
            }
        }

        // 3. Place Start and Goal
        const start = this.findEmptySpot(pastGrid);
        pastGrid[start.y][start.x] = 2; // Start
        if (futureGrid[start.y][start.x] === 1) futureGrid[start.y][start.x] = 0;
        futureGrid[start.y][start.x] = 2;

        const goal = this.findEmptySpot(pastGrid);
        pastGrid[goal.y][goal.x] = 4; // Goal
        if (futureGrid[goal.y][goal.x] === 1) futureGrid[goal.y][goal.x] = 0;
        futureGrid[goal.y][goal.x] = 4;

        // 4. Place Key and Chest
        const excludes = [start, goal];

        const keyPos = this.findEmptySpot(pastGrid, excludes);
        pastGrid[keyPos.y][keyPos.x] = 5; // Key
        excludes.push(keyPos);

        const chestPos = this.findEmptySpot(pastGrid, excludes);
        pastGrid[chestPos.y][chestPos.x] = 7; // Chest
        // Ensure Future Chest is not a wall
        if (futureGrid[chestPos.y][chestPos.x] === 1) futureGrid[chestPos.y][chestPos.x] = 0;
        futureGrid[chestPos.y][chestPos.x] = 7;


        // 5. Enforce Door Usage: Box in the Future Goal
        const adjacent = [
            { x: goal.x, y: goal.y - 1 },
            { x: goal.x, y: goal.y + 1 },
            { x: goal.x - 1, y: goal.y },
            { x: goal.x + 1, y: goal.y }
        ];

        const validNeighbors = adjacent.filter(p => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height);

        // Remove start pos from valid neighbors to avoid spawning door on start
        const safeNeighbors = validNeighbors.filter(p => !(p.x === start.x && p.y === start.y));

        if (safeNeighbors.length > 0) {
            const doorIndex = Math.floor(Math.random() * safeNeighbors.length);
            const doorPos = safeNeighbors[doorIndex];

            // Set all neighbors to Wall first (EXCEPT start)
            validNeighbors.forEach(p => {
                if (!(p.x === start.x && p.y === start.y) && !(p.x === doorPos.x && p.y === doorPos.y)) {
                    futureGrid[p.y][p.x] = 1;
                }
            });
            // (Note: Above logic was slightly buggy in previous attempt if doorPos wasn't handled carefully, fixed here)
            // Wait, previous logic was: set ALL to Wall, THEN set doorPos to Door.
            // That works.
            // But we must protect Start from being walled.

            validNeighbors.forEach(p => {
                if (!(p.x === start.x && p.y === start.y)) {
                    futureGrid[p.y][p.x] = 1;
                }
            });

            futureGrid[doorPos.y][doorPos.x] = 6;
        }

        return { past: pastGrid, future: futureGrid, start, goal };
    }

    solveLevel(pastGrid, futureGrid, start, goal) {
        const width = pastGrid[0].length;
        const height = pastGrid.length;

        const queue = [];
        queue.push({
            px: start.x, py: start.y,
            fx: start.x, fy: start.y,
            hasKey: false,
            deposited: false,
            futureHasKey: false,
            steps: 0,
            path: []
        });

        const visited = new Set();
        const stateKey = (s) => `${s.px},${s.py},${s.fx},${s.fy},${s.hasKey ? 1 : 0},${s.deposited ? 1 : 0},${s.futureHasKey ? 1 : 0}`;
        visited.add(stateKey(queue[0]));

        while (queue.length > 0) {
            const current = queue.shift();

            if (current.px === goal.x && current.py === goal.y &&
                current.fx === goal.x && current.fy === goal.y) {
                return { steps: current.steps, path: current.path };
            }

            const dirs = [
                { dx: 0, dy: -1, name: 'up' },
                { dx: 0, dy: 1, name: 'down' },
                { dx: -1, dy: 0, name: 'left' },
                { dx: 1, dy: 0, name: 'right' }
            ];

            for (const dir of dirs) {
                let npx = current.px + dir.dx;
                let npy = current.py + dir.dy;
                let nextHasKey = current.hasKey;
                let nextDeposited = current.deposited;

                if (npx < 0 || npx >= width || npy < 0 || npy >= height || pastGrid[npy][npx] === 1) {
                    npx = current.px;
                    npy = current.py;
                } else {
                    const tile = pastGrid[npy][npx];
                    if (tile === 5 && !nextHasKey && !nextDeposited) nextHasKey = true;
                    if (tile === 7 && nextHasKey) {
                        nextHasKey = false;
                        nextDeposited = true;
                    }
                }

                let nfx = current.fx + dir.dx;
                let nfy = current.fy + dir.dy;
                let nextFutureHasKey = current.futureHasKey;

                if (nfx < 0 || nfx >= width || nfy < 0 || nfy >= height) {
                    nfx = current.fx;
                    nfy = current.fy;
                } else {
                    let tile = futureGrid[nfy][nfx];
                    let isBlocked = false;
                    if (tile === 1) isBlocked = true;
                    if (tile === 6 && !nextFutureHasKey) isBlocked = true;
                    if (isBlocked) {
                        nfx = current.fx;
                        nfy = current.fy;
                    } else {
                        if (tile === 7 && nextDeposited && !nextFutureHasKey) {
                            nextFutureHasKey = true;
                        }
                    }
                }

                if (npx === current.px && npy === current.py && nfx === current.fx && nfy === current.fy &&
                    nextHasKey === current.hasKey && nextDeposited === current.deposited &&
                    nextFutureHasKey === current.futureHasKey) {
                    continue;
                }

                const nextState = {
                    px: npx, py: npy,
                    fx: nfx, fy: nfy,
                    hasKey: nextHasKey,
                    deposited: nextDeposited,
                    futureHasKey: nextFutureHasKey,
                    steps: current.steps + 1,
                    path: [...current.path, dir.name]
                };

                const key = stateKey(nextState);
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push(nextState);
                }
            }
        }
        return null;
    }

    createEmptyGrid(width, height) {
        const grid = [];
        for (let y = 0; y < height; y++) {
            grid[y] = new Array(width).fill(0);
        }
        return grid;
    }

    findEmptySpot(grid, excludes = []) {
        let x, y;
        let attempts = 0;
        const maxAttempts = 100;
        do {
            x = Math.floor(Math.random() * grid[0].length);
            y = Math.floor(Math.random() * grid.length);
            attempts++;

            // Check overlaps
            let overlap = false;
            for (const p of excludes) {
                if (p.x === x && p.y === y) overlap = true;
            }
            if (overlap) continue;

            if (grid[y][x] === 0) return { x, y };

        } while (attempts < maxAttempts);

        // Fallback: Just return 0,0 or something safe if everything fails, 
        // though with 100 attempts on a mostly empty grid it's rare.
        return { x: 0, y: 0 };
    }
}

window.LevelGenerator = LevelGenerator;
