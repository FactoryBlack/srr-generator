const socket = io();
let isCreator = false;
let currentRoomID = null;

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById("submitNameSection").classList.add("hidden");
    document.getElementById("memberInfoSection").classList.add("hidden");
    document.getElementById("teamGenerationSection").classList.add("hidden");
});

socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
    document.getElementById("generateTeams").classList.toggle("hidden", !isCreator);
});

function joinRoom(roomID) {
    currentRoomID = roomID;
    socket.emit('joinRoom', { roomID, isPublic: true, teamSize: 2 });

    document.getElementById("submitNameSection").classList.remove("hidden");
    document.getElementById("memberInfoSection").classList.remove("hidden");
    document.getElementById("teamGenerationSection").classList.remove("hidden");

    socket.off('updateNames').on('updateNames', updateNameList);
    socket.off('displayTeams').on('displayTeams', displayTeams);
}

function updateNameList(users) {
    const nameListDiv = document.getElementById("nameList");
    nameListDiv.innerHTML = users.map(user => {
        const kickButton = isCreator ? `<button class="kick-button" onclick="kickUser('${user.id}')">Kick</button>` : '';
        return `<p>${user.name} ${user.afkq ? "(AFKQ Tool)" : ""} ${kickButton}</p>`;
    }).join('');
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

// Listen for the kicked event to reset the UI for the kicked user
socket.on('kicked', (message) => {
    alert(message);
    document.getElementById("submitNameSection").classList.add("hidden");
    document.getElementById("memberInfoSection").classList.add("hidden");
    document.getElementById("teamGenerationSection").classList.add("hidden");
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
    document.getElementById("memberCount").textContent = "Total Members: 0, Named: 0, Unnamed: 0";
});

// Handle roomClosed event to clear UI for users when the room is closed by creator
socket.on('roomClosed', () => {
    alert("The room has been closed by the creator.");
    document.getElementById("submitNameSection").classList.add("hidden");
    document.getElementById("memberInfoSection").classList.add("hidden");
    document.getElementById("teamGenerationSection").classList.add("hidden");
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
});

// Handle joinDenied event to inform users when they are banned from a room
socket.on('joinDenied', (message) => {
    alert(message);
});

socket.on('memberCount', ({ total, named, unnamed }) => {
    document.getElementById("memberCount").textContent =
        `Total Members: ${total}, Named: ${named}, Unnamed: ${unnamed}`;
});

document.getElementById("joinRoom").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();
    joinRoom(roomID);
});

document.getElementById("submitName").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value.trim();
    const afkq = document.getElementById("afkqTool").checked;
    if (name && currentRoomID) {
        socket.emit('submitName', { roomID: currentRoomID, name, afkq });
    }
});

document.getElementById("generateTeams").addEventListener("click", () => {
    if (isCreator && currentRoomID) {
        socket.emit('generateTeams', { roomID: currentRoomID });
    }
});

window.kickUser = kickUser; // Expose kickUser for global access
