// Puzzle data and solver setup

const puzzleData = {
    keys: {
        white: 0, orange: 0, purple: 0, cyan: 0, pink: 0, black: 0,
        red: 0, green: 0, blue: 0, brown: 0, master: 0, glitch: 0
    },
    doors: [
        { color: 'green', type: 'normal', lock: { type: 'normal', cost: 5 }, copies: 99 },
        { color: 'red', type: 'frozen', lock: { type: 'aura', cost: 1 }, copies: 99 },
        // More doors here based on level specifics
    ],
    goal: { reached: false } // Define the condition for reaching the goal
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

// Attempt to open a door based on current keys
function openDoor(door, keys) {
    if (door.type === 'frozen' && keys.red >= 1) {
        keys.red -= 1; // Use red aura key to defrost the door
    }
    if (door.lock.type === 'normal' && keys[door.color] >= door.lock.cost) {
        keys[door.color] -= door.lock.cost;
        door.copies -= 1;
        return door.copies <= 0; // Return true if door is fully opened
    }
    return false;
}

// Simulate collecting a key
function collectKey(keyType, amount, keys) {
    keys[keyType] += amount;
}

// Brute-force solving with non-blocking iteration
async function bruteForceSolve(data, solutions) {
    let stepCount = 0;

    while (!data.goal.reached) {
        stepCount++;

        // Example interactions
        for (let door of data.doors) {
            const doorOpened = openDoor(door, data.keys);
            if (doorOpened) {
                logMessage(`Opened ${door.color} door with lock cost ${door.lock.cost}.`);
                checkGoal(data);
            }
        }

        // Simulate picking up a key as part of the path
        collectKey('green', 5, data.keys);  // Example: Collecting a green key

        // Log progress and allow yield
        if (stepCount % 1000 === 0) {
            logMessage(`Checked ${stepCount} paths...`);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Stop if goal is reached or no more actions available
        if (data.goal.reached || stepCount > 100000) break;
    }
}

// Define what reaching the goal means
function checkGoal(data) {
    // If the green tick is reached, update the goal state
    if (data.keys.green >= 7) { // Placeholder for goal condition
        data.goal.reached = true;
    }
}

// Display a solution
function displaySolution(solution) {
    logMessage(`Best solution found in ${solution.steps} steps.`);
}
