const socket = io();
let isCreator = false;
let currentRoomID = null;
let currentJoinButton = null;

/* Functions to Show and Hide Elements with Fade Transitions */
function showElement(elementId) {
    const element = document.getElementById(elementId);
    element.classList.remove('hidden');
    element.classList.add('visible');
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    element.classList.remove('visible');
    element.classList.add('hidden');
}

/* Handle Creator Status */
socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
    if (isCreator) {
        showElement("generateTeams");
    } else {
        hideElement("generateTeams");
    }
});

/* Join or Create Room Function */
function joinRoom(roomID, isPublic = null, teamSize = null, joinButton = null) {
    // Reset previous join button
    if (currentJoinButton && currentJoinButton !== joinButton) {
        currentJoinButton.disabled = false;
        currentJoinButton.textContent = 'Join Room';
    }

    currentRoomID = roomID;
    if (isPublic === null) {
        isPublic = document.getElementById('isPublic').checked;
    }
    if (teamSize === null) {
        teamSize = parseInt(document.getElementById('teamSizeSelect').value, 10);
    }
    socket.emit('joinRoom', { roomID, isPublic, teamSize });

    // Update the member info title with the room ID
    document.getElementById("memberInfoTitle").textContent = `${roomID} Room Information`;

    // Show relevant sections with fade transitions
    showElement("submitNameSection");
    showElement("memberInfoSection");
    showElement("teamGenerationSection");

    // Update event listeners
    socket.off('updateNames').on('updateNames', updateNameList);
    socket.off('displayTeams').on('displayTeams', displayTeams);

    // Disable the join button if provided
    if (joinButton) {
        joinButton.disabled = true;
        joinButton.textContent = 'Joined';
        currentJoinButton = joinButton;
    } else {
        // Check if the room exists in the public rooms list and update the button there
        const publicJoinButton = document.getElementById(`joinRoomButton-${roomID}`);
        if (publicJoinButton) {
            publicJoinButton.disabled = true;
            publicJoinButton.textContent = 'Joined';
            currentJoinButton = publicJoinButton;
        }
    }
}

/* Update Name List Function */
function updateNameList(users) {
    const nameListDiv = document.getElementById("nameList");
    nameListDiv.innerHTML = '';
    users.forEach(user => {
        const userElement = document.createElement('p');

        // Create a container for the name and icon
        const nameContainer = document.createElement('div');
        nameContainer.classList.add('user-name-container');

        if (user.afkq) {
            const iconSpan = document.createElement('span');
            iconSpan.classList.add('icon-placeholder');
            nameContainer.appendChild(iconSpan);
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = user.name;
        nameContainer.appendChild(nameSpan);

        userElement.appendChild(nameContainer);

        if (isCreator && user.id !== socket.id) {
            const kickButton = document.createElement('button');
            kickButton.textContent = 'Kick';
            kickButton.classList.add('kick-button');
            kickButton.addEventListener('click', () => {
                kickUser(user.id);
            });
            userElement.appendChild(kickButton);
        } else {
            // Add a placeholder to keep the height consistent
            const placeholder = document.createElement('div');
            placeholder.style.width = '50px'; // Adjust width as needed
            userElement.appendChild(placeholder);
        }
        nameListDiv.appendChild(userElement);
    });
}

/* Display Teams Function */
function displayTeams(teams) {
    const teamListDiv = document.getElementById("teamList");
    teamListDiv.innerHTML = teams.map((team, i) =>
        `<p><strong>Team ${i + 1}:</strong> ${team.join(', ')}</p>`
    ).join('');
}

/* Kick User Function */
function kickUser(userID) {
    if (isCreator && currentRoomID) {
        socket.emit('kickUser', { roomID: currentRoomID, userID });
    }
}

/* Handle Events When a User is Kicked, Room is Closed, or Join is Denied */
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

/* Reset UI Function */
function resetUI() {
    hideElement("submitNameSection");
    hideElement("memberInfoSection");
    hideElement("teamGenerationSection");
    document.getElementById("nameList").innerHTML = "";
    document.getElementById("teamList").innerHTML = "";
    document.getElementById("memberCount").innerHTML =
        `<span class="member-stat">Total Members: <span id="totalMembers">0</span></span><br>
         <span class="member-stat">Named: <span id="namedMembers">0</span></span><br>
         <span class="member-stat">Unnamed: <span id="unnamedMembers">0</span></span>`;
    document.getElementById("memberInfoTitle").textContent = "Member Count";

    // Reset the join button if applicable
    if (currentJoinButton) {
        currentJoinButton.disabled = false;
        currentJoinButton.textContent = 'Join Room';
        currentJoinButton = null;
    }
}

/* Handle Active Rooms */
socket.on('activeRooms', (publicRooms) => {
    const roomsList = document.getElementById("roomsList");
    const noRoomsMessage = document.getElementById("noRoomsMessage");

    if (publicRooms.length === 0) {
        roomsList.innerHTML = '';
        showElement("noRoomsMessage");
    } else {
        roomsList.innerHTML = '';
        hideElement("noRoomsMessage");
        publicRooms.forEach(room => {
            const roomItem = document.createElement('li');
            roomItem.textContent = `${room.roomID} - Team Size: ${room.teamSize}`;

            const joinButton = document.createElement('button');
            joinButton.id = `joinRoomButton-${room.roomID}`;
            joinButton.textContent = 'Join Room';
            joinButton.addEventListener('click', function () {
                joinRoom(room.roomID, true, room.teamSize, this);
            });

            // If the user is already in this room, disable the button
            if (currentRoomID === room.roomID) {
                joinButton.disabled = true;
                joinButton.textContent = 'Joined';
                currentJoinButton = joinButton;
            }

            roomItem.appendChild(joinButton);
            roomsList.appendChild(roomItem);
        });
    }
});

/* Update Member Count */
socket.on('memberCount', ({ total, named, unnamed }) => {
    document.getElementById("totalMembers").textContent = total;
    document.getElementById("namedMembers").textContent = named;
    document.getElementById("unnamedMembers").textContent = unnamed;
});

/* Join Room Button Event Listener */
document.getElementById("joinRoom").addEventListener("click", () => {
    const roomIDInput = document.getElementById("roomID");
    const roomID = roomIDInput.value.trim();
    if (roomID.length >= 3 && roomID.length <= 6) {
        joinRoom(roomID);
        // The main 'Join or Create Room' button remains enabled
    } else {
        alert("Please enter a Room ID between 3 and 6 characters.");
    }
});

/* Submit Name Button Event Listener */
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

/* Generate Teams Button Event Listener */
document.getElementById("generateTeams").addEventListener("click", () => {
    if (isCreator && currentRoomID) {
        socket.emit('generateTeams', { roomID: currentRoomID });
    } else {
        alert("Only the room creator can generate teams.");
    }
});

/* Display Teams After Generation */
socket.on('displayTeams', displayTeams);
