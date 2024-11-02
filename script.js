<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>I Wanna Lockpick Puzzle Solver</title>
    <style>
        .console-output {
            width: 100%;
            height: 300px;
            overflow-y: auto;
            background-color: #333;
            color: #eee;
            font-family: monospace;
            padding: 10px;
            border: 1px solid #222;
            white-space: pre-line;
        }
        #startButton {
            margin-bottom: 10px;
        }
    </style>
</head>
<body>

<h1>I Wanna Lockpick Puzzle Solver</h1>
<label for="levelSelect">Select Level:</label>
<select id="levelSelect">
    <option value="new_level.json">New Level</option>
</select>
<button id="loadLevelButton">Load Level</button>
<button id="startButton">Start Solver</button>
<div id="log" class="console-output"></div>

<script>
// Load level data
let puzzleData = {};
document.getElementById("loadLevelButton").addEventListener("click", async () => {
    const level = document.getElementById("levelSelect").value;
    try {
        const response = await fetch(level);
        puzzleData = await response.json();
        logMessage(`Loaded ${level}`);
    } catch (error) {
        logMessage(`Error loading level data: ${error.message}`);
    }
});

let logDiv = document.getElementById("log");
function logMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.textContent = message;
    logDiv.appendChild(messageElement);
    logDiv.scrollTop = logDiv.scrollHeight;
}

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

// Collect keys function
function collectKey(data, color, amount) {
    if (!data.keys[color]) {
        logMessage(`Error: Key color '${color}' is not defined in data.keys.`);
        return;
    }
    data.keys[color].real += amount.real;
    data.keys[color].imag += amount.imag;
    logMessage(`Collected ${amount.real !== 0 ? amount.real : ''}${amount.imag !== 0 ? (amount.real !== 0 ? ' + ' : '') + amount.imag + 'i' : ''} ${color} key(s). Total: ${data.keys[color].real} + ${data.keys[color].imag}i`);
}

// Check auras with detailed logging
function checkAuras(data) {
    let greenAuraActive = data.keys.green.real >= 5;
    let redAuraActive = data.keys.red.real >= 1;
    let blueAuraActive = data.keys.blue.real >= 3;
    let brownAuraActive = data.keys.brown.real < 0;

    if (redAuraActive) logMessage("Red aura activated! Frozen doors can be defrosted.");
    if (greenAuraActive) logMessage("Green aura activated! Eroded doors can be healed.");
    if (blueAuraActive) logMessage("Blue aura activated! Painted doors can be cleaned.");
    if (brownAuraActive) logMessage("Negative brown aura activated! Curses can now be removed from nearby doors.");

    return { greenAuraActive, redAuraActive, blueAuraActive, brownAuraActive };
}

// Open doors with aura checks and logging
function openDoor(data, door, auras) {
    logMessage(`Attempting to open ${door.color} door. Type: ${door.type}, Corrupted: ${door.corrupted ?? 'N/A'}`);

    if (door.type === 'frozen' && door.corrupted) {
        if (auras.redAuraActive) {
            logMessage(`Defrosted frozen ${door.color} door with red aura.`);
            door.corrupted = false;
        } else {
            logMessage(`Cannot defrost frozen ${door.color} door. Red aura not active.`);
            return false;
        }
    }

    if (door.type === 'eroded' && door.corrupted) {
        if (auras.greenAuraActive) {
            logMessage(`Healed eroded ${door.color} door with green aura.`);
            door.corrupted = false;
        } else {
            logMessage(`Cannot heal eroded ${door.color} door. Green aura not active.`);
            return false;
        }
    }

    if (door.type === 'painted' && door.corrupted) {
        if (auras.blueAuraActive) {
            logMessage(`Cleaned painted ${door.color} door with blue aura.`);
            door.corrupted = false;
        } else {
            logMessage(`Cannot clean painted ${door.color} door. Blue aura not active.`);
            return false;
        }
    }

    if (door.type === 'cursed') {
        if (auras.brownAuraActive) {
            logMessage(`Opened cursed ${door.color} door using negative brown aura.`);
            door.copies -= 1;
            logMessage(`Remaining copies: ${door.copies}`);
            return true;
        } else {
            logMessage(`Cannot open cursed ${door.color} door without negative brown aura.`);
            return false;
        }
    }

    for (const lock of door.locks) {
        const { color, cost } = lock;
        if (!data.keys[color]) {
            logMessage(`Error: Key color '${color}' is not defined in data.keys.`);
            return false;
        }
        data.keys[color].real -= cost.real;
        data.keys[color].imag -= cost.imag;
        logMessage(`Used ${cost.real !== 0 ? cost.real : ''}${cost.imag !== 0 ? (cost.real !== 0 ? ' + ' : '') + cost.imag + 'i' : ''} ${color} key(s) to open part of ${door.color} door.`);
    }

    door.copies -= 1;
    logMessage(`Opened ${door.color} door. Remaining copies: ${door.copies}`);
    return true;
}

// Goal check with detailed logging
function checkGoal(data) {
    if (!data.goal || !Array.isArray(data.goal.required_doors)) {
        logMessage("Error: required_doors is not defined in goal or is not an array.");
        return;
    }

    const remainingDoors = data.goal.required_doors.filter(color => {
        const door = data.doors.find(d => d.color === color);
        return door && (door.copies > 0 || door.corrupted);
    });

    if (remainingDoors.length === 0) {
        data.goal.reached = true;
        logMessage("Goal reached! All necessary doors are open.");
    } else {
        logMessage("Goal not yet reached. Remaining doors to be opened or uncorrupted: " + remainingDoors.join(", "));
    }
}

// Solver function
async function cursedDoorTest() {
    logMessage("Starting solver...");

    const testData = cloneData(puzzleData);
    for (const key of testData.keysToCollect) {
        collectKey(testData, key.color, key.amount);
    }

    const auras = checkAuras(testData);

    for (const door of testData.doors) {
        openDoor(testData, door, auras);
    }

    checkGoal(testData);
}

document.getElementById("startButton").addEventListener("click", cursedDoorTest);
</script>
</body>
</html>
