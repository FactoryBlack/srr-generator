const socket = io();
let isCreator = false;
let currentRoomID = null;
let currentJoinButton = null;
let teamGenerated = false;

/* Functions to Show and Hide Elements */
function showElement(elementId) {
    const element = document.getElementById(elementId);
    element.classList.remove('hidden');
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    element.classList.add('hidden');
}

/* Handle Creator Status */
socket.on('creatorStatus', (data) => {
    isCreator = data.isCreator;
    if (isCreator) {
        showElement("generateTeams");
        showElement("creatorNameSection");
    } else {
        hideElement("generateTeams");
        hideElement("creatorNameSection");
    }
});

/* Event Listener for the Add Name Button */
document.getElementById("addName").addEventListener("click", () => {
    const nameInput = document.getElementById("creatorNameInput");
    const name = nameInput.value.trim();
    if (name && currentRoomID) {
        // Check for duplicate names
        if (isNameDuplicate(name)) {
            alert("This name already exists in the room. Please enter a different name.");
            console.log(`Attempted to add duplicate name: ${name}`);
            return;
        }
        socket.emit('addName', { roomID: currentRoomID, name });
        nameInput.value = ''; // Clear the input field
    } else {
        alert("Please enter a name to add.");
    }
});

/* Function to Check for Duplicate Names */
function isNameDuplicate(name) {
    const nameListDiv = document.getElementById("nameList");
    const existingNames = Array.from(nameListDiv.querySelectorAll('.user-name'))
        .map(span => span.textContent.trim().toLowerCase());
    return existingNames.includes(name.toLowerCase());
}

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

    // Show relevant sections
    showElement("submitNameSection");
    showElement("memberInfoSection");
    showElement("teamGenerationSection");
    showElement("chatSection"); // Show chat section

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

    console.log(`Joined room: ${roomID}`);
}

/* Update Name List Function */
function updateNameList(users) {
    const nameListDiv = document.getElementById("nameList");
    nameListDiv.innerHTML = '';
    users.forEach(user => {
        const userElement = document.createElement('p');
        userElement.classList.add('user-entry');

        // Create a container for the name and badge
        const nameContainer = document.createElement('div');
        nameContainer.classList.add('user-name-container');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = user.name;
        nameSpan.classList.add('user-name');
        nameContainer.appendChild(nameSpan);

        // Add AFKQ badge if applicable
        if (user.afkq) {
            const badgeSpan = document.createElement('span');
            badgeSpan.classList.add('afkq-badge');
            badgeSpan.textContent = 'AFKQ';
            nameContainer.appendChild(badgeSpan);
        }

        userElement.appendChild(nameContainer);

        // Add 'Kick' button for creator
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
    console.log("Updated name list.");
}

/* Variables to Track Revealed Names */
let revealedNames = new Set();

/* Display Teams Function */
function displayTeams(teams) {
    const teamListDiv = document.getElementById("teamList");
    teamListDiv.innerHTML = '';
    revealedNames.clear(); // Reset revealed names
    teamGenerated = true; // Mark that teams have been generated

    // Enable Team Chat Tab
    document.getElementById('teamChatTab').disabled = false;

    teams.forEach((team, i) => {
        const teamElement = document.createElement('div');
        teamElement.classList.add('team');

        const teamHeader = document.createElement('h3');
        teamHeader.textContent = `Team ${i + 1}`;
        teamElement.appendChild(teamHeader);

        const memberList = document.createElement('ul');
        team.forEach((memberName, index) => {
            const memberItem = document.createElement('li');
            const memberId = `team${i}-member${index}`;
            memberItem.id = memberId;

            // Initially mask the names
            memberItem.textContent = '???';

            // If creator, add a "Reveal" button
            if (isCreator) {
                const revealButton = document.createElement('button');
                revealButton.textContent = 'Reveal';
                revealButton.classList.add('reveal-button');
                revealButton.addEventListener('click', () => {
                    socket.emit('revealName', { roomID: currentRoomID, memberId, memberName });
                });
                memberItem.appendChild(revealButton);
            }

            memberList.appendChild(memberItem);
        });
        teamElement.appendChild(memberList);
        teamListDiv.appendChild(teamElement);
    });

    // If creator, add a "Reveal All" button
    if (isCreator) {
        const revealAllButton = document.createElement('button');
        revealAllButton.textContent = 'Reveal All';
        revealAllButton.classList.add('button-primary');
        revealAllButton.addEventListener('click', () => {
            socket.emit('revealAllNames', { roomID: currentRoomID });
        });
        teamListDiv.appendChild(revealAllButton);
    }

    console.log("Displayed teams.");
}

/* Handle Reveal Name Event */
socket.on('revealName', ({ memberId, memberName }) => {
    const memberItem = document.getElementById(memberId);
    if (memberItem && !revealedNames.has(memberId)) {
        // Remove existing content
        memberItem.textContent = memberName;
        revealedNames.add(memberId);
        console.log(`Revealed name: ${memberName}`);

        // Remove the 'Reveal' button if present
        const revealButton = memberItem.querySelector('.reveal-button');
        if (revealButton) {
            revealButton.remove();
        }
    }
});

/* Handle Reveal All Names Event */
socket.on('revealAllNames', (teams) => {
    teams.forEach((team, i) => {
        team.forEach((memberName, index) => {
            const memberId = `team${i}-member${index}`;
            const memberItem = document.getElementById(memberId);
            if (memberItem && !revealedNames.has(memberId)) {
                memberItem.textContent = memberName;
                revealedNames.add(memberId);

                // Remove the 'Reveal' button if present
                const revealButton = memberItem.querySelector('.reveal-button');
                if (revealButton) {
                    revealButton.remove();
                }
            }
        });
    });
    console.log("Revealed all names.");
});

/* Kick User Function */
function kickUser(userID) {
    if (isCreator && currentRoomID) {
        socket.emit('kickUser', { roomID: currentRoomID, userID });
        console.log(`Kicked user: ${userID}`);
    }
}

/* Handle Events When a User is Kicked, Room is Closed, or Join is Denied */
socket.on('kicked', (message) => {
    alert(message);
    resetUI();
    console.log("You have been kicked from the room.");
});

socket.on('roomClosed', () => {
    alert("The room has been closed by the creator.");
    resetUI();
    console.log("Room has been closed by the creator.");
});

socket.on('joinDenied', (message) => {
    alert(message);
    console.log("Join denied: " + message);
});

/* Reset UI Function */
function resetUI() {
    hideElement("submitNameSection");
    hideElement("memberInfoSection");
    hideElement("teamGenerationSection");
    hideElement("chatSection");
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

    // Reset chat variables
    resetChat();

    console.log("UI has been reset.");
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

    console.log("Updated active public rooms.");
});

/* Update Member Count */
socket.on('memberCount', ({ total, named, unnamed }) => {
    document.getElementById("totalMembers").textContent = total;
    document.getElementById("namedMembers").textContent = named;
    document.getElementById("unnamedMembers").textContent = unnamed;
    console.log(`Member count updated: Total - ${total}, Named - ${named}, Unnamed - ${unnamed}`);
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
        console.log(`Submitted name: ${name}, AFKQ: ${afkq}`);
    } else {
        alert("Please enter your name.");
    }
});

/* Generate Teams Button Event Listener */
document.getElementById("generateTeams").addEventListener("click", () => {
    if (isCreator && currentRoomID) {
        socket.emit('generateTeams', { roomID: currentRoomID });
        console.log("Requested team generation.");
    } else {
        alert("Only the room creator can generate teams.");
    }
});

/* Display Teams After Generation */
socket.on('displayTeams', displayTeams);

/* Chat Functionality */
/* Variables for Chat */
let currentChatTab = 'roomChat';
let roomChatUnread = 0;
let teamChatUnread = 0;

/* Switch Chat Tabs */
document.getElementById('roomChatTab').addEventListener('click', () => {
    switchChatTab('roomChat');
});

document.getElementById('teamChatTab').addEventListener('click', () => {
    if (!teamGenerated) {
        alert('Team Chat will be available after teams are generated.');
        return;
    }
    switchChatTab('teamChat');
});

function switchChatTab(tab) {
    currentChatTab = tab;
    document.querySelectorAll('.chat-tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');

    document.querySelectorAll('.chat-window').forEach(div => hideElement(div.id));
    showElement(tab);

    // Reset unread count
    if (tab === 'roomChat') {
        roomChatUnread = 0;
        updateChatBadge('roomChatBadge', roomChatUnread);
    } else if (tab === 'teamChat') {
        teamChatUnread = 0;
        updateChatBadge('teamChatBadge', teamChatUnread);
    }
}

/* Send Message */
document.getElementById('roomChatSend').addEventListener('click', () => {
    const message = document.getElementById('roomChatInput').value.trim();
    if (message) {
        socket.emit('roomChatMessage', { roomID: currentRoomID, message });
        document.getElementById('roomChatInput').value = '';
    }
});

document.getElementById('teamChatSend').addEventListener('click', () => {
    const message = document.getElementById('teamChatInput').value.trim();
    if (message) {
        socket.emit('teamChatMessage', { roomID: currentRoomID, message });
        document.getElementById('teamChatInput').value = '';
    }
});

/* Receive Messages */
socket.on('roomChatMessage', ({ sender, message }) => {
    displayChatMessage('roomChatMessages', sender, message);
    if (currentChatTab !== 'roomChat') {
        roomChatUnread++;
        updateChatBadge('roomChatBadge', roomChatUnread);
    }
});

socket.on('teamChatMessage', ({ sender, message }) => {
    displayChatMessage('teamChatMessages', sender, message);
    if (currentChatTab !== 'teamChat') {
        teamChatUnread++;
        updateChatBadge('teamChatBadge', teamChatUnread);
    }
});

/* Display Chat Message */
function displayChatMessage(chatMessagesId, sender, message) {
    const chatMessagesDiv = document.getElementById(chatMessagesId);
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender');
    senderSpan.textContent = sender + ': ';

    const messageSpan = document.createElement('span');
    messageSpan.classList.add('message-text');
    messageSpan.textContent = message;

    messageElement.appendChild(senderSpan);
    messageElement.appendChild(messageSpan);
    chatMessagesDiv.appendChild(messageElement);

    // Scroll to the bottom
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

/* Update Chat Badge */
function updateChatBadge(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.textContent = '0';
        badge.classList.add('hidden');
    }
}

/* Reset Chat Variables */
function resetChat() {
    currentChatTab = 'roomChat';
    roomChatUnread = 0;
    teamChatUnread = 0;
    teamGenerated = false;

    document.getElementById('roomChatMessages').innerHTML = '';
    document.getElementById('teamChatMessages').innerHTML = '';
    updateChatBadge('roomChatBadge', 0);
    updateChatBadge('teamChatBadge', 0);

    document.getElementById('teamChatTab').disabled = true;
    hideElement('teamChat');
    switchChatTab('roomChat');
}
