const puzzleData = {
    keys: {
        green: 0,
        red: 0,
        cyan: 0,
        black: 0,
        pink: 0,
        gold: 0 // Master key
    },
    doors: [
        { color: 'green', type: 'normal', copies: 99, lock: { type: 'normal', cost: 5 } },
        { color: 'red', type: 'frozen', copies: 1, lock: { type: 'aura', cost: 1 } },
        { color: 'pink', type: 'normal', copies: 99, lock: { type: 'normal', cost: 3 } },
        { color: 'cyan', type: 'normal', copies: 99, lock: { type: 'normal', cost: 7 } },
        { color: 'black', type: 'normal', copies: 99, lock: { type: 'normal', cost: 9 } },
    ],
    keysToCollect: [
        { color: 'green', amount: 5, position: "start" },
        { color: 'red', amount: 1, position: "mid" },
        { color: 'cyan', amount: 7, position: "upper_left" },
    ],
    goal: { reached: false, position: "green_check" }
};

let logDiv = document.getElementById("log");

function logMessage(message) {
    logDiv.textContent += message + "\n";
}

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

async function solvePuzzle() {
    logMessage("Starting puzzle solver...");
    const solutions = [];

    await explorePaths(puzzleData, solutions);

    if (solutions.length > 0) {
        logMessage(`Found ${solutions.length} solution(s). Displaying the best solution...`);
        displaySolution(solutions[0]);
    } else {
        logMessage("No solution found.");
    }
}

function openAvailableDoors(data, path) {
    let doorOpened = false;
    for (const door of data.doors) {
        if (door.copies > 0) {
            if (door.type === 'frozen' && data.keys.red >= 1) {
                data.keys.red -= 1;
                path.push(`Defrosted ${door.color} frozen door.`);
                doorOpened = true;
                continue;
            }

            if (door.lock.type === 'normal' && data.keys[door.color] >= door.lock.cost) {
                data.keys[door.color] -= door.lock.cost;
                door.copies -= 1;
                path.push(`Opened ${door.color} door.`);
                doorOpened = true;
                continue;
            }
        }
    }
    return doorOpened;
}

function collectNecessaryKeys(data, path) {
    for (let key of data.keysToCollect) {
        const requiredKeys = getRequiredKeys(data, key.color);
        if (data.keys[key.color] < requiredKeys) {
            data.keys[key.color] += key.amount;
            path.push(`Collected ${key.amount} ${key.color} key(s).`);
        }
    }
}

function getRequiredKeys(data, color) {
    let totalCost = 0;
    for (const door of data.doors) {
        if (door.color === color && door.copies > 0) {
            totalCost += door.lock.cost * door.copies;
        }
    }
    return totalCost;
}

function checkGoal(data) {
    const allDoorsOpen = data.doors.every(door => door.copies <= 0);
    if (allDoorsOpen && !data.goal.reached) {
        data.goal.reached = true;
    }
}

async function explorePaths(data, solutions) {
    let stepCount = 0;
    const states = [{ state: cloneData(data), path: [] }];

    while (states.length > 0 && !data.goal.reached) {
        const { state, path } = states.pop();
        data = state;
        stepCount++;

        // Log the exploration step
        logMessage(`Exploring step ${stepCount}, Path: ${path.join(" -> ")}`);

        collectNecessaryKeys(data, path);
        const doorOpened = openAvailableDoors(data, path);
        checkGoal(data);

        if (doorOpened || !data.goal.reached) {
            states.push({ state: cloneData(data), path: [...path] });
        }

        if (stepCount % 1000 === 0) {
            logMessage(`Checked ${stepCount} paths... Latest path: ${path.slice(-10).join(" -> ")}`);
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (stepCount > 100000) break;
    }

    if (data.goal.reached) {
        solutions.push({ steps: stepCount, path });
    }
}

function displaySolution(solution) {
    logMessage(`Best solution found in ${solution.steps} steps. Path: ${solution.path.join(" -> ")}`);
}
