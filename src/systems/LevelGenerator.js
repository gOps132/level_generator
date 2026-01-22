export default class LevelGenerator {
    constructor() {
        // Tile Types: 0 = Empty, 1 = Wall, 2 = Player Start, 3 = Box, 4 = Goal, 5 = Key, 6 = Door, 7 = Chest, 8 = Lever, 9 = Lever Gate
    }

    generate(width, height, difficulty, options = { enableLevers: true, enableKeys: true, enableBoxes: true }) {
        let attempts = 0;
        const maxAttempts = 150; // Increased to improve success rate

        while (attempts < maxAttempts) {
            attempts++;

            // Dynamic difficulty adjustment for generation
            // If we fail many times, slightly reduce wall density to make space
            let densityMod = 0;
            if (attempts > 50) densityMod = -0.05;
            if (attempts > 100) densityMod = -0.10;

            const { past, future, start, goal } = this.tryGenerate(width, height, difficulty, options, densityMod);

            // Precise Check: Combined State BFS
            const solution = this.solveLevel(past, future, start, goal);

            if (solution) {
                // Mandatory Box Usage Check
                if (options.enableBoxes && solution.boxesPushed === 0) {
                    // console.log("Level valid but no boxes pushed. Retrying.");
                    continue;
                }

                // Apply Strict Pruning based on Solution
                this.pruneToSolution(past, future, start, goal, solution.path);

                console.log(`Level generated successfully after ${attempts} attempts. Min Moves: ${solution.steps}. Boxes Pushed: ${solution.boxesPushed}`);
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

    tryGenerate(width, height, difficulty, options, densityModifier = 0) {

        const pastGrid = this.createEmptyGrid(width, height);
        const futureGrid = this.createEmptyGrid(width, height);

        // 1. Generate Walls
        // Base chance + difficulty factor + retry modifier
        let wallChance = 0.15 + (difficulty * 0.04) + densityModifier;

        // If ALL mechanics are enabled, reduce density further by default to make room
        if (options.enableLevers && options.enableKeys && options.enableBoxes) {
            wallChance -= 0.05;
        }

        // Clamp
        if (wallChance < 0.05) wallChance = 0.05;

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

        const goal = this.findEmptySpot(pastGrid, [start], start, (width + height) / 4);
        pastGrid[goal.y][goal.x] = 4; // Goal
        if (futureGrid[goal.y][goal.x] === 1) futureGrid[goal.y][goal.x] = 0;
        futureGrid[goal.y][goal.x] = 4;


        // Identify Neighbors of Goal (for Exclusions and Gate/Door placement)
        const goalNeighbors = [
            { x: goal.x, y: goal.y - 1 },
            { x: goal.x, y: goal.y + 1 },
            { x: goal.x - 1, y: goal.y },
            { x: goal.x + 1, y: goal.y }
        ].filter(p => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height);


        // 4. Place Mechanics
        // Exclude Start, Goal, and Goal Neighbors (to prevent overwriting by Goal Security)
        const excludes = [start, goal, ...goalNeighbors];

        // --- KEY Mechanic ---
        if (options.enableKeys) {
            const keyPos = this.findEmptySpot(pastGrid, excludes);
            pastGrid[keyPos.y][keyPos.x] = 5; // Key
            excludes.push(keyPos);

            // Surround Key with Walls (and Gate if Levers enabled)
            const keyNeighbors = [
                { x: keyPos.x, y: keyPos.y - 1 },
                { x: keyPos.x, y: keyPos.y + 1 },
                { x: keyPos.x - 1, y: keyPos.y },
                { x: keyPos.x + 1, y: keyPos.y }
            ].filter(p => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height);

            const safeKeyNeighbors = keyNeighbors.filter(p =>
                !(p.x === start.x && p.y === start.y) && !(p.x === goal.x && p.y === goal.y)
            );

            // Only gate the key if Levers are enabled
            if (safeKeyNeighbors.length > 0 && options.enableLevers) {
                const gateIndex = Math.floor(Math.random() * safeKeyNeighbors.length);
                const gatePos = safeKeyNeighbors[gateIndex];
                safeKeyNeighbors.forEach(p => {
                    if (p !== gatePos) pastGrid[p.y][p.x] = 1;
                });
                pastGrid[gatePos.y][gatePos.x] = 9;
                futureGrid[gatePos.y][gatePos.x] = 1;
            }
        }

        // --- LEVER Mechanic ---
        if (options.enableLevers) {
            const leverPos = this.findEmptySpot(pastGrid, excludes);
            pastGrid[leverPos.y][leverPos.x] = 8;
            excludes.push(leverPos);
        }

        // --- CHEST Mechanic (Requires Key) ---
        if (options.enableKeys) {
            const chestPos = this.findEmptySpot(pastGrid, excludes);
            pastGrid[chestPos.y][chestPos.x] = 7;
            if (futureGrid[chestPos.y][chestPos.x] === 1) futureGrid[chestPos.y][chestPos.x] = 0;
            futureGrid[chestPos.y][chestPos.x] = 7;
        }


        // 5. Goal Security (Door OR Gate)
        const safeGoalNeighbors = goalNeighbors.filter(p => !(p.x === start.x && p.y === start.y));

        if (safeGoalNeighbors.length > 0) {
            // Priority: Door (Keys) > Gate (Levers)
            if (options.enableKeys) {
                const doorIndex = Math.floor(Math.random() * safeGoalNeighbors.length);
                const doorPos = safeGoalNeighbors[doorIndex];

                // Surround Goal with Future Walls
                goalNeighbors.forEach(p => {
                    if (!(p.x === start.x && p.y === start.y)) {
                        futureGrid[p.y][p.x] = 1;
                    }
                });

                futureGrid[doorPos.y][doorPos.x] = 6; // Door
            } else if (options.enableLevers) {
                // If Keys are OFF but Levers are ON, use a Gate to block the Goal
                const gateIndex = Math.floor(Math.random() * safeGoalNeighbors.length);
                const gatePos = safeGoalNeighbors[gateIndex];

                // Surround Goal with Past Walls to force Gate usage
                goalNeighbors.forEach(p => {
                    if (!(p.x === start.x && p.y === start.y)) {
                        pastGrid[p.y][p.x] = 1; // Past Wall
                    }
                });

                pastGrid[gatePos.y][gatePos.x] = 9; // Gate
                // Ensure Future is also blocked or synced
                // If we block Past, player needs Lever.
                // We should probably leave Future open (0) or block it (1/9)
                // If we block it with 1, future player is stuck.
                // Let's set Future to 0 (Open) - so Future player can enter, but Past player needs Lever.
                // Since win condition is BOTH, this works.
                if (futureGrid[gatePos.y][gatePos.x] === 1) futureGrid[gatePos.y][gatePos.x] = 0;
            }
        }

        // --- BOX Mechanic ---
        if (options.enableBoxes) {
            // Strategic Placement:
            // 1. Bottlenecks (1-tile wide gaps)
            // 2. Guards (Near Key, Lever, or Goal)

            const bottlenecks = this.findBottlenecks(pastGrid);
            const objectives = excludes.filter(p => [4, 5, 8].includes(pastGrid[p.y][p.x]));

            // NEW STRATEGY: Critical Path Placement
            // 1. Find Critical Tiles (tiles that obstruct the path if removed)
            const criticalTiles = this.findCriticalTiles(pastGrid, start, goal, excludes);

            // Prefer placing boxes on Critical Tiles (guarantees interaction)
            // or Geometric Bottlenecks (likely interaction)

            // Score candidates: Critical Tiles get high priority
            const candidates = [];

            criticalTiles.forEach(t => candidates.push({ x: t.x, y: t.y, score: 2.0 })); // High score for mandatory tiles
            bottlenecks.forEach(b => candidates.push({ x: b.x, y: b.y, score: b.score })); // Existing geometric score

            // Sort by score
            candidates.sort((a, b) => b.score - a.score);

            const numBoxes = Math.min(3, 1 + Math.floor(difficulty / 4)); // More boxes at higher difficulty
            let placedCount = 0;

            for (const cand of candidates) {
                if (placedCount >= numBoxes) break;
                if (cand.score < 0.1) continue;

                // Check if already occupied or excluded
                if (pastGrid[cand.y][cand.x] !== 0) continue;
                if (excludes.some(p => p.x === cand.x && p.y === cand.y)) continue;

                pastGrid[cand.y][cand.x] = 3;
                futureGrid[cand.y][cand.x] = 3;
                excludes.push(cand);
                placedCount++;
            }

            // If still need to place, try near objectives
            if (placedCount < numBoxes) {
                for (const obj of objectives) {
                    if (placedCount >= numBoxes) break;
                    const neighbors = [
                        { x: obj.x, y: obj.y - 1 }, { x: obj.x, y: obj.y + 1 },
                        { x: obj.x - 1, y: obj.y }, { x: obj.x + 1, y: obj.y }
                    ].filter(p =>
                        p.x >= 0 && p.x < width && p.y >= 0 && p.y < height &&
                        pastGrid[p.y][p.x] === 0 && !excludes.some(e => e.x === p.x && e.y === p.y)
                    );

                    if (neighbors.length > 0) {
                        const spot = neighbors[Math.floor(Math.random() * neighbors.length)];
                        pastGrid[spot.y][spot.x] = 3;
                        futureGrid[spot.y][spot.x] = 3;
                        excludes.push(spot);
                        placedCount++;
                    }
                }
            }

            // Final fallback: Random but distant from start
            while (placedCount < numBoxes) {
                const spot = this.findEmptySpot(pastGrid, excludes, start, (width + height) / 4);
                pastGrid[spot.y][spot.x] = 3;
                futureGrid[spot.y][spot.x] = 3;
                excludes.push(spot);
                placedCount++;
            }
        }

        return { past: pastGrid, future: futureGrid, start, goal };
    }

    pruneToSolution(pastGrid, futureGrid, start, goal, path) {
        const height = pastGrid.length;
        const width = pastGrid[0].length;

        const visitedPast = new Set();
        const visitedFuture = new Set();

        // Initial Position
        visitedPast.add(`${start.x},${start.y}`);
        visitedFuture.add(`${start.x},${start.y}`);

        // Add Goal (Always protected)
        visitedPast.add(`${goal.x},${goal.y}`);
        visitedFuture.add(`${goal.x},${goal.y}`);

        // State for Simulation
        let px = start.x, py = start.y;
        let fx = start.x, fy = start.y;
        let hasKey = false;
        let deposited = false;
        let futureHasKey = false;
        let leverOn = false;
        let boxes = this.getBoxPositions(pastGrid);

        // Protect initial box positions
        boxes.forEach(b => {
            visitedPast.add(`${b.x},${b.y}`);
            visitedFuture.add(`${b.x},${b.y}`);
        });

        // Trace Path
        for (const moveName of path) {
            let dx = 0, dy = 0;
            if (moveName === 'up') dy = -1;
            if (moveName === 'down') dy = 1;
            if (moveName === 'left') dx = -1;
            if (moveName === 'right') dx = 1;

            // --- Past Move Logic ---
            let npx = px + dx;
            let npy = py + dy;
            let pastBlocked = false;

            if (npx < 0 || npx >= width || npy < 0 || npy >= height) {
                npx = px; npy = py; pastBlocked = true;
            } else {
                const tile = pastGrid[npy][npx];
                if (tile === 1) pastBlocked = true; // Wall
                if (tile === 9 && !leverOn) pastBlocked = true; // Gate

                // Box Pushing in Pruning
                const hitBoxIndex = boxes.findIndex(b => b.x === npx && b.y === npy);
                if (hitBoxIndex !== -1) {
                    const bnx = npx + dx;
                    const bny = npy + dy;
                    // Check if path behind box is clear (we only allow pushing into Empty tiles 0)
                    // AND Check for Paradox: Cannot push box onto Future Player
                    let paradoxBlocked = false;
                    if (bnx === fx && bny === fy) paradoxBlocked = true;

                    if (bnx < 0 || bnx >= width || bny < 0 || bny >= height || pastGrid[bny][bnx] !== 0 || boxes.some(b => b.x === bnx && b.y === bny) || paradoxBlocked) {
                        pastBlocked = true;
                    } else {
                        // Push!
                        boxes[hitBoxIndex] = { x: bnx, y: bny };
                        visitedPast.add(`${bnx},${bny}`);
                        visitedFuture.add(`${bnx},${bny}`);
                        // Future player needs this space clear to NOT be blocked by paradox
                    }
                } else if (pastGrid[npy][npx] === 3) {
                    // PHANTOM BOX: The grid says '3' but the 'boxes' array says it's gone (moved).
                    // In this case, we treat it as empty floor (0).
                    // So pastBlocked remains false (unless occupied by another box or wall, which we checked above?)
                    // Logic above: `tile === 1` checks wall. `tile === 9` checks gate.
                    // If tile is 3 but hitBoxIndex is -1, it falls through => NOT blocked. Correct.
                }
            }

            if (!pastBlocked) {
                px = npx;
                py = npy;
                visitedPast.add(`${px},${py}`);

                // Interactions
                const tile = pastGrid[py][px];
                if (tile === 5) { hasKey = true; } // Key
                if (tile === 7 && hasKey) { hasKey = false; deposited = true; } // Chest
                if (tile === 8 && !leverOn) { leverOn = true; } // Lever
            }

            // --- Future Move Logic ---
            let nfx = fx + dx;
            let nfy = fy + dy;
            let futureBlocked = false;

            if (nfx < 0 || nfx >= width || nfy < 0 || nfy >= height) {
                nfx = fx; nfy = fy; futureBlocked = true;
            } else {
                const tile = futureGrid[nfy][nfx];
                if (tile === 1) futureBlocked = true;
                if (tile === 6 && !futureHasKey) futureBlocked = true; // Door
                if (tile === 9 && !leverOn) futureBlocked = true; // Gate
                if (boxes.some(b => b.x === nfx && b.y === nfy)) futureBlocked = true; // Box blocks future
            }

            if (!futureBlocked) {
                fx = nfx;
                fy = nfy;
                visitedFuture.add(`${fx},${fy}`);

                // Interactions
                const tile = futureGrid[fy][fx];
                if (tile === 7 && deposited && !futureHasKey) { futureHasKey = true; }
            }
        }

        // Protect critical objects
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pTile = pastGrid[y][x];
                if ([5, 6, 7, 8, 9].includes(pTile)) visitedPast.add(`${x},${y}`);

                const fTile = futureGrid[y][x];
                if ([5, 6, 7, 8, 9].includes(fTile)) visitedFuture.add(`${x},${y}`);
            }
        }

        // Apply Pruning
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!visitedPast.has(`${x},${y}`)) {
                    // Only prune if currently Empty (0)
                    if (pastGrid[y][x] === 0) pastGrid[y][x] = 1;
                }
                if (!visitedFuture.has(`${x},${y}`)) {
                    if (futureGrid[y][x] === 0) futureGrid[y][x] = 1;
                }
            }
        }
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
            leverOn: false,
            boxes: this.getBoxPositions(pastGrid),
            boxes: this.getBoxPositions(pastGrid),
            boxesPushed: 0,
            steps: 0,
            path: []
        });

        const visited = new Set();
        // State key optimization: Use single character for booleans and join with minimal chars
        const stateKey = (s) => `${s.px},${s.py},${s.fx},${s.fy},${s.hasKey ? 'K' : '0'}${s.deposited ? 'D' : '0'}${s.futureHasKey ? 'F' : '0'}${s.leverOn ? 'L' : '0'}|${s.boxes.map(b => `${b.x},${b.y}`).join('/')}`;
        visited.add(stateKey(queue[0]));

        let head = 0; // Pointer for queue instead of shift()
        const maxVisited = 100000;

        while (head < queue.length) {
            const current = queue[head++];

            if (visited.size > maxVisited) return null; // Hard break if too complex

            if (current.px === goal.x && current.py === goal.y &&
                current.fx === goal.x && current.fy === goal.y) {
                return { steps: current.steps, path: current.path, boxesPushed: current.boxesPushed };
            }

            const dirs = [
                { dx: 0, dy: -1, name: 'up' },
                { dx: 0, dy: 1, name: 'down' },
                { dx: -1, dy: 0, name: 'left' },
                { dx: 1, dy: 0, name: 'right' }
            ];

            for (const dir of dirs) {
                // PAST MOVE
                let npx = current.px + dir.dx;
                let npy = current.py + dir.dy;
                let nextHasKey = current.hasKey;
                let nextDeposited = current.deposited;
                let nextLeverOn = current.leverOn;
                let pushedABox = false;

                if (npx < 0 || npx >= width || npy < 0 || npy >= height) {
                    npx = current.px; npy = current.py;
                } else {
                    const tile = pastGrid[npy][npx];
                    let blocked = false;
                    if (tile === 1) blocked = true;
                    if (tile === 9 && !nextLeverOn) blocked = true; // Gate blocked if lever off
                    if (tile === 3) {
                        // Box Pushing Logic
                        const bnx = npx + dir.dx;
                        const bny = npy + dir.dy;
                        if (bnx < 0 || bnx >= width || bny < 0 || bny >= height) {
                            blocked = true;
                        } else {
                            // Check if blocked in Past OR Future by anything (Wall, Door, Gate, or OTHER box)
                            const isBoxAt = (x, y, boxes) => boxes.some(b => b.x === x && b.y === y);
                            const pBlocked = pastGrid[bny][bnx] !== 0 || isBoxAt(bnx, bny, current.boxes);
                            const fBlocked = futureGrid[bny][bnx] !== 0 || isBoxAt(bnx, bny, current.boxes);

                            // PARADOX CHECK: Cannot push onto Future Player
                            let paradoxBlocked = false;
                            if (bnx === current.fx && bny === current.fy) paradoxBlocked = true;

                            if (pBlocked || fBlocked || paradoxBlocked) {
                                blocked = true;
                            } else {
                                // Push successful!
                                // Mark pushed flag
                                pushedABox = true;
                            }
                        }
                    }

                    if (blocked) {
                        npx = current.px; npy = current.py;
                    } else {
                        // Interactions
                        if (tile === 5 && !nextHasKey && !nextDeposited) nextHasKey = true;
                        if (tile === 7 && nextHasKey) { nextHasKey = false; nextDeposited = true; }
                        if (tile === 8 && !nextLeverOn) nextLeverOn = true;
                    }
                }

                // BOXES STATE UPDATE
                let nextBoxes = current.boxes;
                // If past moved into a box, and wasn't blocked, it means it pushed it.
                if (npx !== current.px || npy !== current.py) {
                    const hitBoxIndex = current.boxes.findIndex(b => b.x === npx && b.y === npy);
                    if (hitBoxIndex !== -1) {
                        nextBoxes = [...current.boxes];
                        nextBoxes[hitBoxIndex] = { x: npx + dir.dx, y: npy + dir.dy };
                        // Sort boxes to ensure consistent state key
                        nextBoxes.sort((a, b) => (a.x - b.x) || (a.y - b.y));
                    }
                }

                // FUTURE MOVE
                let nfx = current.fx + dir.dx;
                let nfy = current.fy + dir.dy;
                let nextFutureHasKey = current.futureHasKey;

                if (nfx < 0 || nfx >= width || nfy < 0 || nfy >= height) {
                    nfx = current.fx; nfy = current.fy;
                } else {
                    let tile = futureGrid[nfy][nfx];
                    let isBlocked = false;
                    if (tile === 1) isBlocked = true;
                    if (tile === 6 && !nextFutureHasKey) isBlocked = true;
                    if (tile === 9 && !nextLeverOn) isBlocked = true; // Future gate?
                    if (nextBoxes.some(b => b.x === nfx && b.y === nfy)) isBlocked = true; // Box blocks future

                    if (isBlocked) {
                        nfx = current.fx; nfy = current.fy;
                    } else {
                        if (tile === 7 && nextDeposited && !nextFutureHasKey) {
                            nextFutureHasKey = true;
                        }
                    }
                }

                if (npx === current.px && npy === current.py && nfx === current.fx && nfy === current.fy &&
                    nextHasKey === current.hasKey && nextDeposited === current.deposited &&
                    nextFutureHasKey === current.futureHasKey && nextLeverOn === current.leverOn &&
                    JSON.stringify(nextBoxes) === JSON.stringify(current.boxes)) {
                    continue;
                }

                const nextState = {
                    px: npx, py: npy,
                    fx: nfx, fy: nfy,
                    hasKey: nextHasKey,
                    deposited: nextDeposited,
                    futureHasKey: nextFutureHasKey,
                    leverOn: nextLeverOn,
                    boxes: nextBoxes,
                    boxesPushed: current.boxesPushed + (pushedABox ? 1 : 0),
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

    findEmptySpot(grid, excludes = [], minDistFrom = null, minDist = 0) {
        let x, y;
        let attempts = 0;
        const maxAttempts = 200;
        const width = grid[0].length;
        const height = grid.length;

        do {
            x = Math.floor(Math.random() * width);
            y = Math.floor(Math.random() * height);
            attempts++;

            // Check overlaps
            let overlap = false;
            for (const p of excludes) {
                if (p.x === x && p.y === y) overlap = true;
            }
            if (overlap) continue;

            // Check distance
            if (minDistFrom && minDist > 0) {
                const dist = Math.abs(x - minDistFrom.x) + Math.abs(y - minDistFrom.y);
                if (dist < minDist) continue;
            }

            if (grid[y][x] === 0) return { x, y };

        } while (attempts < maxAttempts);

        // Final fallback if distance cannot be met
        if (minDist > 0) return this.findEmptySpot(grid, excludes, null, 0);
        return { x: 0, y: 0 };
    }

    getBoxPositions(grid) {
        const boxes = [];
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[0].length; x++) {
                if (grid[y][x] === 3) boxes.push({ x, y });
            }
        }
        return boxes;
    }

    findBottlenecks(grid) {
        const bottlenecks = [];
        const height = grid.length;
        const width = grid[0].length;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (grid[y][x] !== 0) continue;

                // Horizontal Bottleneck: Walls above and below, and air to the sides
                const wallAbove = grid[y - 1][x] === 1;
                const wallBelow = grid[y + 1][x] === 1;
                const airLeft = grid[y][x - 1] === 0;
                const airRight = grid[y][x + 1] === 0;

                if (wallAbove && wallBelow && airLeft && airRight) {
                    bottlenecks.push({ x, y, score: 0 }); // Score will be computed relative to path later
                }

                // Vertical Bottleneck: Walls left and right, and air above and below
                const wallLeft = grid[y][x - 1] === 1;
                const wallRight = grid[y][x + 1] === 1;
                const airAbove = grid[y - 1][x] === 0;
                const airBelow = grid[y + 1][x] === 0;

                if (wallLeft && wallRight && airAbove && airBelow) {
                    bottlenecks.push({ x, y, score: 0 });
                }
            }
        }
        return bottlenecks;
    }

    findCriticalTiles(grid, start, goal, excludes) {
        // Find a path from Start to Goal
        const path = this.findSimplePath(grid, start, goal, excludes);
        if (!path) return []; // No path means disconnected or bad init

        const critical = [];
        const width = grid[0].length;
        const height = grid.length;

        // For each tile on path (except start/goal), try to block it and see if path exists
        for (const pos of path) {
            if (pos.x === start.x && pos.y === start.y) continue;
            if (pos.x === goal.x && pos.y === goal.y) continue;

            // Safety: Don't block if it's already an object (like Key or Logic Gate spot)
            if (excludes.some(e => e.x === pos.x && e.y === pos.y)) continue;

            const tempGrid = grid.map(row => [...row]);
            tempGrid[pos.y][pos.x] = 1; // Temporary Wall

            // Check connectivity
            if (!this.checkConnectivity(tempGrid, start, goal)) {
                critical.push(pos);
            }
        }
        return critical;
    }

    findSimplePath(grid, start, goal, excludes) {
        // BFS for just getting ANY path
        const queue = [{ x: start.x, y: start.y, path: [] }];
        const visited = new Set();
        visited.add(`${start.x},${start.y}`);

        while (queue.length > 0) {
            const curr = queue.shift();
            if (curr.x === goal.x && curr.y === goal.y) return curr.path;

            const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
            for (const d of dirs) {
                const nx = curr.x + d.x;
                const ny = curr.y + d.y;

                if (nx >= 0 && nx < grid[0].length && ny >= 0 && ny < grid.length) {
                    if (!visited.has(`${nx},${ny}`) && grid[ny][nx] !== 1 && grid[ny][nx] !== 9) { // 1=Wall, 9=Gate (treat as blocker for simple path)
                        // Treat 'excludes' as non-blockers usually, but if we want to place boxes ON them, 
                        // we need to know if the path goes THROUGH them.
                        // BUT: we don't want to place boxes on TOP of Keys/Levers. 
                        // The `findCriticalTiles` filters those out later.
                        visited.add(`${nx},${ny}`);
                        queue.push({ x: nx, y: ny, path: [...curr.path, { x: nx, y: ny }] });
                    }
                }
            }
        }
        return null;
    }

    checkConnectivity(grid, start, goal) {
        return !!this.findSimplePath(grid, start, goal, []);
    }
}


