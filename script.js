const socket = io();
let isCreator = false;
let currentRoomID = null;

// Hide the submit name, member info, and team generation sections initially
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById("submitNameSection").style.display = "none";
    document.getElementById("memberInfoSection").style.display = "none";
    document.getElementById("teamGenerationSection").style.display = "none"; // Hide team generation section initially
});

socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
    console.log("Creator status:", isCreator); // Confirm creator status on the client side

    // Show the team generation button only if the user is the creator
    if (isCreator) {
        document.getElementById("generateTeams").style.display = "block";
    } else {
        document.getElementById("generateTeams").style.display = "none";
    }
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

    // Show the sections upon joining the room
    document.getElementById("submitNameSection").style.display = "block";
    document.getElementById("memberInfoSection").style.display = "block";
    document.getElementById("teamGenerationSection").style.display = "block"; // Show team generation section on join

    // Clear any previous listeners to prevent duplicates
    socket.off('updateNames');
    socket.off('displayTeams');

    // Update names with Kick button functionality for the creator
    socket.on('updateNames', (users) => {
        console.log("Is creator inside updateNames?", isCreator); // Should show true for the creator
        const nameListDiv = document.getElementById("nameList");
        nameListDiv.innerHTML = users.map(user => {
            const kickButton = isCreator ? `<button class="kick-button" onclick="kickUser('${user.id}')">Kick</button>` : '';
            console.log(`Generated HTML for user ${user.name}: <p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""} ${kickButton}</p>`); // Log for each user
            return `<p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""} ${kickButton}</p>`;
        }).join('');
    });

    // Display teams generated by the creator
    socket.on('displayTeams', (teams) => {
        const teamListDiv = document.getElementById("teamList");
        teamListDiv.innerHTML = teams.map((team, i) =>
            `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`
        ).join('');
    });
}

function kickUser(userID) {
    console.log("Kick button clicked for user:", userID); // Debugging log to confirm function call

    if (currentRoomID && isCreator) {
        socket.emit('kickUser', { roomID: currentRoomID, userID });
        console.log("kickUser event emitted for user:", userID); // Confirm the event is emitted
    } else {
        console.log("Kick failed: Not the creator or room ID missing.");
    }
}

// Listen for the kicked event to reset the UI for the kicked user
socket.on('kicked', (message) => {
    alert(message);
    console.log("Kicked event received:", message);

    // Clear all room-related data on the page
    document.getElementById("submitNameSection").style.display = "none";
    document.getElementById("memberInfoSection").style.display = "none";
    document.getElementById("teamGenerationSection").style.display = "none"; // Hide team generation if kicked
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
    document.getElementById("roomsList").innerHTML = "";
    document.getElementById("memberCount").textContent = "Total Members: 0, Named: 0, Unnamed: 0";
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

    socket.emit('joinRoom', { roomID, isPublic, teamSize });

    document.getElementById("submitNameSection").style.display = "block";
    document.getElementById("memberInfoSection").style.display = "block";
    document.getElementById("teamGenerationSection").style.display = "block"; // Show team generation upon joining

    socket.on('updateNames', (users) => {
        const nameListDiv = document.getElementById("nameList");
        nameListDiv.innerHTML = users.map(user => {
            const kickButton = isCreator ? `<button onclick="kickUser('${user.id}')" class="kick-button" style="display: inline; color: red;">Kick</button>` : '';
            return `<p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""} ${kickButton}</p>`;
        }).join('');
    });

    socket.on('displayTeams', (teams) => {
        const teamListDiv = document.getElementById("teamList");
        teamListDiv.innerHTML = teams.map((team, i) =>
            `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`
        ).join('');
    });
});

// Submit name to the room
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
    document.getElementById("memberInfoSection").style.display = "none";
    document.getElementById("teamGenerationSection").style.display = "none"; // Hide team generation upon room closure
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
});

socket.on('joinDenied', (message) => {
    alert(message);
    console.log("Join denied message received:", message); // For debugging
});

window.kickUser = kickUser;
