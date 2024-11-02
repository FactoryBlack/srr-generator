// Puzzle data setup for this specific level
const puzzleData = {
    keys: {
        white: 0, orange: 0, purple: 0, cyan: 0, pink: 0, black: 0,
        red: 0, green: 0, blue: 0, brown: 0, master: 0, glitch: 0
    },
    doors: [
        { color: 'green', type: 'normal', lock: { type: 'normal', cost: 5 }, copies: 99, position: "midway" },
        { color: 'red', type: 'frozen', lock: { type: 'aura', cost: 1 }, copies: 99, position: "upper_left" },
        // Add other doors with specifics here
    ],
    keysToCollect: [
        { color: 'green', amount: 5, position: "start" },
        // Define all collectible keys in the level based on layout
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

// Asynchronous solver function to keep the page responsive
async function solvePuzzle() {
    logMessage("Starting puzzle solver...");
    const solutions = [];

    await bruteForceSolve(puzzleData, solutions);

    if (solutions.length > 0) {
        logMessage(`Found ${solutions.length} solution(s). Displaying the best solution...`);
        displaySolution(solutions[0]);
    } else {
        logMessage("No solution found.");
    }
}

// Function to collect keys in the puzzle (only if needed)
function collectKey(key, data) {
    if (data.keys[key.color] < getRequiredKeys(data, key.color)) {
        data.keys[key.color] += key.amount;
        logMessage(`Collected ${key.amount} ${key.color} key(s). New count: ${data.keys[key.color]}`);
    }
}

// Helper function to determine the required number of keys to open all doors
function getRequiredKeys(data, color) {
    let totalCost = 0;
    for (const door of data.doors) {
        if (door.color === color && door.copies > 0) {
            totalCost += door.lock.cost * door.copies;
        }
    }
    return totalCost;
}

// Function to open a door based on the key requirements and type
function openDoor(door, data) {
    if (door.copies <= 0) return false; // Skip fully opened doors

    // Check aura requirements for frozen, eroded, painted doors
    if (door.type === 'frozen' && data.keys.red >= 1) {
        data.keys.red -= 1; // Use red aura key to defrost
    }

    // For normal locks, check if we have enough keys
    if (door.lock.type === 'normal' && data.keys[door.color] >= door.lock.cost) {
        data.keys[door.color] -= door.lock.cost;
        door.copies -= 1;
        logMessage(`Opened ${door.color} door with lock cost ${door.lock.cost}. Remaining copies: ${door.copies}`);
        return door.copies <= 0; // True if the door is fully opened
    }

    return false;
}

// Function to check if the goal (reaching green check) has been met
function checkGoal(data) {
    // Assuming reaching the green check mark requires unlocking all relevant doors
    const allDoorsOpen = data.doors.every(door => door.copies <= 0);
    if (allDoorsOpen) {
        data.goal.reached = true;
        logMessage("Goal reached! Reached the green check mark.");
    }
}

// Brute-force solving function to explore paths
async function bruteForceSolve(data, solutions) {
    let stepCount = 0;

    while (!data.goal.reached) {
        stepCount++;

        // Only collect keys if necessary for opening remaining doors
        for (let key of data.keysToCollect) {
            collectKey(key, data);
        }

        // Attempt to open each door
        for (let door of data.doors) {
            const doorOpened = openDoor(door, data);
            if (doorOpened) {
                checkGoal(data); // Check if goal reached after opening
            }
        }

        // Log progress and allow yield every 1000 steps
        if (stepCount % 1000 === 0) {
            logMessage(`Checked ${stepCount} paths...`);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Stop if the goal is reached or if the maximum steps are reached
        if (data.goal.reached || stepCount > 100000) break;
    }
}

// Display the best solution found
function displaySolution(solution) {
    logMessage(`Best solution found in ${solution.steps} steps.`);
}
