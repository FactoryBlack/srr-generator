const socket = io();
let isCreator = false;
let currentRoomID = null;

// Hide the submit name section initially
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById("submitNameSection").style.display = "none";
});

socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
});

// Load active rooms and display Join Room buttons
socket.on('activeRooms', (publicRooms) => {
    const roomsList = document.getElementById("roomsList");
    roomsList.innerHTML = publicRooms.map(room =>
        `<li>${room.roomID} - Team Size: ${room.teamSize}
        <button onclick="joinRoom('${room.roomID}')">Join Room</button></li>`
    ).join('');
});

function joinRoom(roomID) {
    currentRoomID = roomID;
    socket.emit('joinRoom', { roomID, isPublic: true, teamSize: 2, isCreator: false });
    document.getElementById("submitNameSection").style.display = "block";

    socket.on('updateNames', (users) => {
        const nameListDiv = document.getElementById("nameList");
        nameListDiv.innerHTML = users.map(user => {
            const kickButton = isCreator ? `<button onclick="kickUser('${user.id}')">Kick</button>` : '';
            return `<p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""} ${kickButton}</p>`;
        }).join('');
    });

    // Add the missing displayTeams event listener here
    socket.on('displayTeams', (teams) => {
        const teamListDiv = document.getElementById("teamList");
        teamListDiv.innerHTML = teams.map((team, i) =>
            `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`
        ).join('');
    });
}

function kickUser(userID) {
    if (currentRoomID && isCreator) {
        socket.emit('kickUser', { roomID: currentRoomID, userID });
    }
}

socket.on('kicked', (message) => {
    alert(message);
    document.getElementById("submitNameSection").style.display = "none";
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
});

// Update member count display
socket.on('memberCount', ({ total, named, unnamed }) => {
    document.getElementById("memberCount").textContent =
        `Total Members: ${total}, Named: ${named}, Unnamed: ${unnamed}`;
});

document.getElementById("joinRoom").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();
    currentRoomID = roomID; // Track the room ID for submissions
    const isPublic = document.getElementById("isPublic").checked;
    const teamSize = parseInt(document.getElementById("teamSizeSelect").value) || 2;

    // The creator flag should only be true here, when creating a new room
    socket.emit('joinRoom', { roomID, isPublic, teamSize, isCreator: true });

    // Show the "Submit name" section once the user joins a room
    document.getElementById("submitNameSection").style.display = "block";

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

// Name submission function that uses the current room ID
document.getElementById("submitName").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    const afkq = document.getElementById("afkqTool").checked;

    if (name && currentRoomID) { // Ensure room ID and name are set
        socket.emit('submitName', { roomID: currentRoomID, name, afkq });
        document.getElementById("nameInput").value = ""; // Clear the input field
    }
});

document.getElementById("generateTeams").addEventListener("click", () => {
    if (currentRoomID && isCreator) {
        socket.emit('generateTeams', { roomID: currentRoomID });
    } else {
        alert("Only the room creator can generate teams.");
    }
});

// Listen for roomClosed event
socket.on('roomClosed', () => {
    // Display an alert notifying users
    alert("The room has been closed by the creator.");

    // Hide the submit name section
    document.getElementById("submitNameSection").style.display = "none";

    // Clear room-specific data (e.g., name list)
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
});
