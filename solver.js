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
        // Add additional doors if present in the level
    ],
    keysToCollect: [
        { color: 'green', amount: 5, position: "start" },
        { color: 'red', amount: 1, position: "mid" },
        { color: 'cyan', amount: 7, position: "upper_left" },
        // Define other key positions based on the layout of the level
    ],
    goal: { reached: false, position: "green_check" }
};

let logDiv = document.getElementById("log");

// Utility to log messages to the page
function logMessage(message) {
    const logEntry = document.createElement("div");
    logEntry.textContent = message;
    logDiv.appendChild(logEntry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// Main solver function
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

// Helper function to attempt opening each type of door based on conditions
function openAvailableDoors(data) {
    let doorOpened = false;
    for (const door of data.doors) {
        if (door.copies > 0) {
            // Special handling for frozen doors
            if (door.type === 'frozen' && data.keys.red >= 1) {
                data.keys.red -= 1; // Use red key to defrost
                logMessage(`Defrosted red frozen door.`);
                doorOpened = true;
                continue;
            }

            // Check if we have enough keys to open the door
            if (door.lock.type === 'normal' && data.keys[door.color] >= door.lock.cost) {
                data.keys[door.color] -= door.lock.cost;
                door.copies -= 1;
                logMessage(`Opened ${door.color} door with lock cost ${door.lock.cost}. Remaining copies: ${door.copies}`);
                doorOpened = true;
                continue;
            }
        }
    }
    return doorOpened;
}

// Helper function to collect necessary keys based on door requirements
function collectNecessaryKeys(data) {
    for (let key of data.keysToCollect) {
        const requiredKeys = getRequiredKeys(data, key.color);
        if (data.keys[key.color] < requiredKeys) {
            data.keys[key.color] += key.amount;
            logMessage(`Collected ${key.amount} ${key.color} key(s). New count: ${data.keys[key.color]}`);
        }
    }
}

// Calculates the total keys required to open all doors of a specific color
function getRequiredKeys(data, color) {
    let totalCost = 0;
    for (const door of data.doors) {
        if (door.color === color && door.copies > 0) {
            totalCost += door.lock.cost * door.copies;
        }
    }
    return totalCost;
}

// Check if the goal (reaching green check mark) has been met
function checkGoal(data) {
    const allDoorsOpen = data.doors.every(door => door.copies <= 0);
    if (allDoorsOpen && !data.goal.reached) {
        data.goal.reached = true;
        logMessage("Goal reached! The path to the green check mark is now clear.");
    }
}

// Exploration function for trying out paths
async function explorePaths(data, solutions) {
    let stepCount = 0;

    while (!data.goal.reached) {
        stepCount++;

        // Prioritize collecting only necessary keys
        collectNecessaryKeys(data);

        // Try to open any available doors
        const doorOpened = openAvailableDoors(data);

        // Check if the goal has been reached
        checkGoal(data);

        // If no doors were opened and no more keys are needed, stop to prevent infinite loop
        if (!doorOpened && data.keysToCollect.every(key => data.keys[key.color] >= getRequiredKeys(data, key.color))) {
            logMessage("No more doors to open or keys to collect.");
            break;
        }

        // Log and yield every 1000 steps
        if (stepCount % 1000 === 0) {
            logMessage(`Checked ${stepCount} paths...`);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Stop if max steps reached
        if (stepCount > 100000) break;
    }
}

// Display the best solution found
function displaySolution(solution) {
    logMessage(`Best solution found in ${solution.steps} steps.`);
}
