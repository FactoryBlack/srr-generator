// Basic puzzle data for a minimal test scenario
const puzzleData = {
    keys: { green: 0, red: 0 },
    doors: [
        { color: 'green', type: 'normal', copies: 1, lock: { type: 'normal', cost: 5 } }
    ],
    keysToCollect: [
        { color: 'green', amount: 5 }
    ],
    goal: { reached: false }
};

let logDiv = document.getElementById("log");

function logMessage(message) {
    logDiv.textContent += message + "\n";
}

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

// Function to test basic key collection
function collectKey(data, color, amount) {
    // Check if the color key exists in data.keys
    if (!data.keys[color]) {
        logMessage(`Error: Key color '${color}' is not defined in data.keys.`);
        return;
    }

    // Proceed with key collection if the color exists
    data.keys[color].real += amount.real;
    data.keys[color].imag += amount.imag;
    logMessage(`Collected ${amount.real !== 0 ? amount.real : ''}${amount.imag !== 0 ? ' + ' + amount.imag + 'i' : ''} ${color} key(s). Total: ${data.keys[color].real} + ${data.keys[color].imag}i`);
}


// Function to open a door if requirements are met
function openDoor(data, door) {
    if (data.keys[door.color] >= door.lock.cost) {
        data.keys[door.color] -= door.lock.cost;
        door.copies -= 1;
        logMessage(`Opened ${door.color} door. Remaining copies: ${door.copies}`);
        return true;
    } else {
        logMessage(`Not enough ${door.color} keys to open the door.`);
        return false;
    }
}

// Function to check if goal is reached (all doors opened)
function checkGoal(data) {
    const allDoorsOpen = data.doors.every(door => door.copies <= 0);
    if (allDoorsOpen) {
        data.goal.reached = true;
        logMessage("Goal reached! All doors are open.");
    } else {
        logMessage("Goal not yet reached.");
    }
}

// Testing function to simulate a simple puzzle-solving scenario
async function simpleTest() {
    logMessage("Starting simplified test...");

    const testData = cloneData(puzzleData);
    const steps = [];

    // Step 1: Collect a key
    collectKey(testData, 'green', 5);

    // Step 2: Attempt to open the door
    if (openDoor(testData, testData.doors[0])) {
        steps.push("Opened green door.");
    }

    // Step 3: Check if goal is reached
    checkGoal(testData);

    if (testData.goal.reached) {
        logMessage("Test succeeded. Path: " + steps.join(" -> "));
    } else {
        logMessage("Test failed. Goal was not reached.");
    }
}

// Run the simplified test
simpleTest();
