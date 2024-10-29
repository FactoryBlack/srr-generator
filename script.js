const socket = io();
let isCreator = false;
let currentRoomID = null;

window.addEventListener('DOMContentLoaded', () => {
    // Sections are already hidden via the 'hidden' class in HTML
});

socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
    document.getElementById("generateTeams").classList.toggle("hidden", !isCreator);
});

function joinRoom(roomID, isPublic = null, teamSize = null) {
    currentRoomID = roomID;
    if (isPublic === null) {
        isPublic = document.getElementById('isPublic').checked;
    }
    if (teamSize === null) {
        teamSize = parseInt(document.getElementById('teamSizeSelect').value, 10);
    }
    socket.emit('joinRoom', { roomID, isPublic, teamSize });

    // Show relevant sections
    document.getElementById("submitNameSection").classList.remove("hidden");
    document.getElementById("memberInfoSection").classList.remove("hidden");
    document.getElementById("teamGenerationSection").classList.remove("hidden");

    // Update event listeners
    socket.off('updateNames').on('updateNames', updateNameList);
    socket.off('displayTeams').on('displayTeams', displayTeams);
}

function updateNameList(users) {
    const nameListDiv = document.getElementById("nameList");
    nameListDiv.innerHTML = '';
    users.forEach(user => {
        const userElement = document.createElement('p');
        userElement.textContent = `${user.name} ${user.afkq ? "(AFKQ Tool)" : ""}`;

        if (isCreator) {
            const kickButton = document.createElement('button');
            kickButton.textContent = 'Kick';
            kickButton.classList.add('kick-button');
            kickButton.addEventListener('click', () => {
                kickUser(user.id);
            });
            userElement.appendChild(kickButton);
        }
        nameListDiv.appendChild(userElement);
    });
}

function displayTeams(teams) {
    const teamListDiv = document.getElementById("teamList");
    teamListDiv.innerHTML = teams.map((team, i) =>
        `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`
    ).join('');
}

function kickUser(userID) {
    if (isCreator && currentRoomID) {
        socket.emit('kickUser', { roomID: currentRoomID, userID });
    }
}

// Handle events when a user is kicked, room is closed, or join is denied
socket.on('kicked', (message) => {
    alert(message);
    resetUI();
});

socket.on('roomClosed', () => {
    alert("The room has been closed by the creator.");
    resetUI();
});

socket.on('joinDenied', (message) => {
    alert(message);
});

function resetUI() {
    document.getElementById("submitNameSection").classList.add("hidden");
    document.getElementById("memberInfoSection").classList.add("hidden");
    document.getElementById("teamGenerationSection").classList.add("hidden");
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
    document.getElementById("memberCount").textContent = "Total Members: 0, Named: 0, Unnamed: 0";
}

socket.on('activeRooms', (publicRooms) => {
    const roomsList = document.getElementById("roomsList");
    roomsList.innerHTML = publicRooms.map(room =>
        `<li>${room.roomID} - Team Size: ${room.teamSize}
        <button onclick="joinRoom('${room.roomID}', true, ${room.teamSize})">Join Room</button></li>`
    ).join('');
});

socket.on('memberCount', ({ total, named, unnamed }) => {
    document.getElementById("memberCount").textContent =
        `Total Members: ${total}, Named: ${named}, Unnamed: ${unnamed}`;
});

document.getElementById("joinRoom").addEventListener("click", () => {
    const roomIDInput = document.getElementById("roomID");
    const roomID = roomIDInput.value.trim();
    if (roomID) {
        joinRoom(roomID);
    } else {
        alert("Please enter a Room ID.");
    }
});

document.getElementById("submitName").addEventListener("click", () => {
    const nameInput = document.getElementById("nameInput");
    const name = nameInput.value.trim();
    const afkq = document.getElementById("afkqTool").checked;
    if (name && currentRoomID) {
        socket.emit('submitName', { roomID: currentRoomID, name, afkq });
        nameInput.value = ''; // Clear the input field
    } else {
        alert("Please enter your name.");
    }
});

document.getElementById("generateTeams").addEventListener("click", () => {
    if (isCreator && currentRoomID) {
        socket.emit('generateTeams', { roomID: currentRoomID });
    } else {
        alert("Only the room creator can generate teams.");
    }
});

// Listener to display teams after generation
socket.on('displayTeams', displayTeams);
