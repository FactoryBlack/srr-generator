const socket = io();
let isCreator = false;
let currentRoomID = null;

// Set initial visibility for sections
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById("submitNameSection").style.display = "none";
    document.getElementById("memberInfoSection").style.display = "none";
    document.getElementById("teamGenerationSection").style.visibility = "hidden";
});

socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
    console.log("Creator status:", isCreator);

    // Show the Generate Teams button only for the creator
    const generateButton = document.getElementById("generateTeams");
    if (generateButton) {
        generateButton.style.visibility = isCreator ? "visible" : "hidden";
    }
});

function joinRoom(roomID) {
    currentRoomID = roomID;
    socket.emit('joinRoom', { roomID, isPublic: true, teamSize: 2 });

    // Show sections upon joining
    document.getElementById("submitNameSection").style.display = "block";
    document.getElementById("memberInfoSection").style.display = "block";
    document.getElementById("teamGenerationSection").style.visibility = "visible";

    // Clear previous listeners to prevent duplication
    socket.off('updateNames');
    socket.off('displayTeams');

    // Listen for `updateNames` and populate `nameList`
    socket.on('updateNames', (users) => {
        console.log("updateNames event received with users:", users);
        const nameListDiv = document.getElementById("nameList");
        if (nameListDiv) {
            // Update the innerHTML of nameListDiv
            nameListDiv.innerHTML = users.map(user => {
                const kickButton = isCreator ? `<button class="kick-button" onclick="kickUser('${user.id}')">Kick</button>` : '';
                return `<p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""} ${kickButton}</p>`;
            }).join('');
            console.log("nameListDiv updated with:", nameListDiv.innerHTML); // Log the final HTML
        }
    });

    // Listen for `displayTeams` and populate `teamList`
    socket.on('displayTeams', (teams) => {
        console.log("displayTeams event received with teams:", teams);
        const teamListDiv = document.getElementById("teamList");
        if (teamListDiv) {
            // Update the innerHTML of teamListDiv
            teamListDiv.innerHTML = teams.map((team, i) =>
                `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`
            ).join('');
            console.log("teamListDiv updated with:", teamListDiv.innerHTML); // Log the final HTML
        }
    })
}

function kickUser(userID) {
    console.log("Kick button clicked for user:", userID);
    if (currentRoomID && isCreator) {
        socket.emit('kickUser', { roomID: currentRoomID, userID });
    }
}

socket.on('kicked', (message) => {
    alert(message);
    document.getElementById("submitNameSection").style.display = "none";
    document.getElementById("memberInfoSection").style.display = "none";
    document.getElementById("teamGenerationSection").style.visibility = "hidden";
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
});

socket.on('memberCount', ({ total, named, unnamed }) => {
    document.getElementById("memberCount").textContent =
        `Total Members: ${total}, Named: ${named}, Unnamed: ${unnamed}`;
});

document.getElementById("joinRoom").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();
    currentRoomID = roomID;
    const isPublic = document.getElementById("isPublic").checked;
    const teamSize = parseInt(document.getElementById("teamSizeSelect").value) || 2;

    socket.emit('joinRoom', { roomID, isPublic, teamSize });

    document.getElementById("submitNameSection").style.display = "block";
    document.getElementById("memberInfoSection").style.display = "block";
    document.getElementById("teamGenerationSection").style.visibility = "visible";
});

document.getElementById("submitName").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    const afkq = document.getElementById("afkqTool").checked;

    if (name && currentRoomID) {
        socket.emit('submitName', { roomID: currentRoomID, name, afkq });
        document.getElementById("nameInput").value = "";
    }
});

document.getElementById("generateTeams").addEventListener("click", () => {
    if (currentRoomID && isCreator) {
        socket.emit('generateTeams', { roomID: currentRoomID });
    } else {
        alert("Only the room creator can generate teams.");
    }
});

socket.on('roomClosed', () => {
    alert("The room has been closed by the creator.");
    document.getElementById("submitNameSection").style.display = "none";
    document.getElementById("memberInfoSection").style.display = "none";
    document.getElementById("teamGenerationSection").style.visibility = "hidden";
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
});

socket.on('joinDenied', (message) => {
    alert(message);
});

document.getElementById("nameList").innerHTML = "<p>Test User</p>";
document.getElementById("teamList").innerHTML = "<p><strong>Team 1:</strong> Test User, Another User</p>";

window.kickUser = kickUser;
