const socket = io();
let isCreator = false;

socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
});

// Load active rooms on page load
socket.on('activeRooms', (publicRooms) => {
    const roomsList = document.getElementById("roomsList");
    roomsList.innerHTML = publicRooms.map(room =>
        `<li>${room.roomID} - Team Size: ${room.teamSize}</li>`
    ).join('');
});

// Update member count display
socket.on('memberCount', ({ total, named, unnamed }) => {
    document.getElementById("memberCount").textContent =
        `Total Members: ${total}, Named: ${named}, Unnamed: ${unnamed}`;
});

document.getElementById("joinRoom").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();
    const isPublic = document.getElementById("isPublic").checked;
    const teamSize = parseInt(document.getElementById("teamSizeSelect").value) || 2;
    socket.emit('joinRoom', { roomID, isPublic, teamSize, isCreator: true });

    // Make the "Submit name" section visible once the user joins a room
    document.getElementById("submitNameSection").classList.remove("hidden");

    socket.on('updateNames', (users) => {
        const nameListDiv = document.getElementById("nameList");
        nameListDiv.innerHTML = users.map(user =>
            `<p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""}</p>`
        ).join('');
    });

    socket.on('displayTeams', (teams) => {
        const teamListDiv = document.getElementById("teamList");
        teamListDiv.innerHTML = teams.map((team, i) =>
            `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`
        ).join('');
    });
});

document.getElementById("submitName").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    const afkq = document.getElementById("afkqTool").checked;
    const roomID = document.getElementById("roomID").value.trim();

    if (name) {
        socket.emit('submitName', { roomID, name, afkq });
        document.getElementById("nameInput").value = ""; // Clear the input field
    }
});

document.getElementById("generateTeams").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();
    if (isCreator) {
        socket.emit('generateTeams', { roomID });
    } else {
        alert("Only the room creator can generate teams.");
    }
});
