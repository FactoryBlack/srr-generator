const socket = io();
let isCreator = false;
let currentRoomID = null;

// Hide the submit name section initially
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById("submitNameSection").style.display = "none";
});

socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
    console.log("Creator status:", isCreator); // Debug log to check creator status
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
    socket.emit('joinRoom', { roomID, isPublic: true, teamSize: 2 });
    document.getElementById("submitNameSection").style.display = "block";

    // Clear any previous listener for updateNames and displayTeams to prevent duplicates
    socket.off('updateNames');
    socket.off('displayTeams');

    socket.on('updateNames', (users) => {
        console.log("Is creator inside updateNames?", isCreator);
        const nameListDiv = document.getElementById("nameList");
        nameListDiv.innerHTML = users.map(user => {
            const kickButton = isCreator ? `<button class="kick-button" onclick="kickUser('${user.id}')">Kick</button>` : '';
            console.log(`Generated HTML for user ${user.name}: <p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""} ${kickButton}</p>`); // Log the generated HTML
            return `<p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""} ${kickButton}</p>`;
        }).join('');
    });

    socket.on('displayTeams', (teams) => {
        const teamListDiv = document.getElementById("teamList");
        teamListDiv.innerHTML = teams.map((team, i) =>
            `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`
        ).join('');
    });
}

// Function to handle kicking a user
function kickUser(userID) {
    if (currentRoomID && isCreator) {
        console.log("Attempting to kick user:", userID); // Debugging log
        socket.emit('kickUser', { roomID: currentRoomID, userID });
    }
}

// Listen for the kicked event to remove the kicked user from the UI
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

// Join or create a room when the Join/Create button is clicked
document.getElementById("joinRoom").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();
    currentRoomID = roomID;
    const isPublic = document.getElementById("isPublic").checked;
    const teamSize = parseInt(document.getElementById("teamSizeSelect").value) || 2;

    // Emit joinRoom without specifying isCreator, as the server will determine creator status
    socket.emit('joinRoom', { roomID, isPublic, teamSize });

    document.getElementById("submitNameSection").style.display = "block";
});

// Submit name to the room, using current room ID
document.getElementById("submitName").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    const afkq = document.getElementById("afkqTool").checked;

    if (name && currentRoomID) {
        socket.emit('submitName', { roomID: currentRoomID, name, afkq });
        document.getElementById("nameInput").value = ""; // Clear the input field
    }
});

// Generate teams if the user is the creator
document.getElementById("generateTeams").addEventListener("click", () => {
    if (currentRoomID && isCreator) {
        socket.emit('generateTeams', { roomID: currentRoomID });
    } else {
        alert("Only the room creator can generate teams.");
    }
});

// Handle room closure by the creator
socket.on('roomClosed', () => {
    alert("The room has been closed by the creator.");
    document.getElementById("submitNameSection").style.display = "none";
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
});
