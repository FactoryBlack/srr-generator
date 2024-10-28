const socket = io();

// Track if the user is the creator
let isCreator = false;

// Load active rooms on page load
socket.on('activeRooms', (publicRooms) => {
    const roomsList = document.getElementById("roomsList");
    roomsList.innerHTML = publicRooms.map(room =>
        `<li>${room.roomID} - Team Size: ${room.teamSize}</li>`
    ).join('');
});

// Join or create a room with visibility and team size settings
document.getElementById("joinRoom").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();
    const isPublic = document.getElementById("isPublic").checked;
    const teamSize = parseInt(document.getElementById("teamSizeSelect").value) || 2;

    // Set this user as the room creator if they are creating the room
    isCreator = true;

    socket.emit('joinRoom', { roomID, isPublic, teamSize, isCreator });

    // Listen for updates to the name list
    socket.on('updateNames', (names) => {
        const nameListDiv = document.getElementById("nameList");
        nameListDiv.innerHTML = names.map(name => `<p>${name}</p>`).join('');
    });

    // Listen for teams and display them
    socket.on('displayTeams', (teams) => {
        const teamListDiv = document.getElementById("teamList");
        teamListDiv.innerHTML = teams.map((team, i) =>
            `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`).join('');
    });
});

document.getElementById("submitName").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    const roomID = document.getElementById("roomID").value.trim();

    if (name) {
        socket.emit('submitName', { roomID, name });
        document.getElementById("nameInput").value = ""; // Clear the input field
    }
});

// Generate teams with specified team size (only if the user is the creator)
document.getElementById("generateTeams").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();

    if (isCreator) {
        socket.emit('generateTeams', { roomID });
    } else {
        alert("Only the room creator can generate teams.");
    }
});
