// script.js

const socket = io();
let isCreator = false;
let currentRoomID = null;
let currentJoinButton = null;
let teamGenerated = false;

let userVoted = false;
let voteDuration = 60; // 60 seconds
let voteInterval = null;
let revealedNames = new Set();

let totalMembers = 0;

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
        showElement("generateTeamsContainer"); // Updated to show the container
        showElement("creatorNameSection");
    } else {
        hideElement("generateTeamsContainer"); // Hide the container for participants
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
    // If already in a room, leave it first
    if (currentRoomID) {
        leaveRoom(currentRoomID, currentJoinButton);
    }

    // Reset UI before joining a new room
    resetUI();

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
    showElement("chatSection");

    // Check for cached name and pre-fill the input
    const cachedName = localStorage.getItem('cachedName');
    if (cachedName) {
        document.getElementById('nameInput').value = cachedName;
    }

    // Update event listeners
    socket.off('updateNames').on('updateNames', ({ users, creatorId }) => {
        updateNameList(users, creatorId);
    });
    socket.off('displayTeams').on('displayTeams', displayTeams);
    socket.off('revealName').on('revealName', ({ memberId, memberName }) => {
        handleRevealName(memberId, memberName);
    });
    socket.off('revealAllNames').on('revealAllNames', (teams) => {
        handleRevealAllNames(teams);
    });
    socket.off('voteUpdate').on('voteUpdate', ({ votedUsernames }) => {
        updateVotedMembers(votedUsernames);
    });
    socket.off('enableConfirmReroll').on('enableConfirmReroll', () => {
        showConfirmRerollButton();
    });
    socket.off('teamsRerolled').on('teamsRerolled', (teams) => {
        handleTeamsRerolled(teams);
    });

    if (joinButton) {
        joinButton.textContent = 'Leave Room';
        joinButton.onclick = function () {
            leaveRoom(roomID, joinButton);
        };
        currentJoinButton = joinButton;
    }

    console.log(`Joined room: ${roomID}`);
}

/* Leave Room Function */
function leaveRoom(roomID, joinButton) {
    socket.emit('leaveRoom', { roomID });
    resetUI();
    if (joinButton) {
        joinButton.textContent = 'Join Room';
        joinButton.onclick = function () {
            joinRoom(roomID, true, null, joinButton);
        };
    }
}

/* Update Name List Function */
function updateNameList(users, creatorId) {
    totalMembers = users.length;
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

        // Add 'Host' badge if the user is the creator
        if (user.id === creatorId) {
            const hostBadge = document.createElement('span');
            hostBadge.classList.add('host-badge');
            hostBadge.textContent = 'Host';
            nameContainer.appendChild(hostBadge);
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

/* Display Teams Function */
function displayTeams(teams) {
    const teamListDiv = document.getElementById("teamList");
    teamListDiv.innerHTML = '';
    revealedNames.clear();
    teamGenerated = true;

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

    // Show the Vote to Reroll button to participants only
    if (!isCreator) {
        showVoteToRerollButton();
    } else {
        // For creator, show the vote counter and confirm button container
        showVoteCounter();
    }

    console.log("Displayed teams.");
}

/* Show Vote to Reroll Button for Participants */
function showVoteToRerollButton() {
    const teamListDiv = document.getElementById("teamList");

    const voteButton = document.createElement('button');
    voteButton.textContent = 'Vote to Reroll';
    voteButton.classList.add('button-primary', 'vote-reroll-button');
    voteButton.addEventListener('click', () => {
        if (!userVoted) {
            socket.emit('voteReroll', { roomID: currentRoomID });
            userVoted = true;
            voteButton.disabled = true;
        }
    });

    teamListDiv.appendChild(voteButton);

    // Start the countdown timer
    startVoteTimer(voteButton);
}

/* Start Vote Timer */
function startVoteTimer(voteButton) {
    let timeLeft = voteDuration;

    voteInterval = setInterval(() => {
        timeLeft--;
        const percentage = (timeLeft / voteDuration) * 100;
        voteButton.style.background = `linear-gradient(to right, #FA2A55 ${percentage}%, #FFFFFF ${percentage}%)`;

        if (timeLeft <= 0) {
            clearInterval(voteInterval);
            if (voteButton) {
                voteButton.remove();
            }
            userVoted = false;
        }
    }, 1000);
}

/* Show Vote Counter and Confirm Button for Creator */
function showVoteCounter() {
    const container = document.getElementById('generateTeamsContainer');

    // Create vote counter label
    const voteCounter = document.createElement('span');
    voteCounter.id = 'voteCounter';
    voteCounter.textContent = '0 / 0 members voted reroll';
    voteCounter.style.marginLeft = '10px';

    // Create Confirm Reroll button (initially hidden)
    const confirmButton = document.createElement('button');
    confirmButton.id = 'confirmRerollButton';
    confirmButton.textContent = 'Confirm Reroll';
    confirmButton.classList.add('button-primary');
    confirmButton.style.display = 'none';
    confirmButton.style.marginLeft = '10px';
    confirmButton.addEventListener('click', () => {
        socket.emit('confirmReroll', { roomID: currentRoomID });
    });

    container.appendChild(voteCounter);
    container.appendChild(confirmButton);
}

/* Update Voted Members */
function updateVotedMembers(votedUsernames) {
    // Update vote counter if creator
    if (isCreator) {
        const voteCounter = document.getElementById('voteCounter');
        if (voteCounter) {
            voteCounter.textContent = `${votedUsernames.length} / ${totalMembers} members voted reroll`;
        }

        // Check if votes reach 80% or more
        if (votedUsernames.length / totalMembers >= 0.8) {
            const confirmButton = document.getElementById('confirmRerollButton');
            if (confirmButton) {
                confirmButton.style.display = 'inline-block';
            }
        }
    }

    // For participants, highlight voted members
    if (!isCreator) {
        // Clear previous votes
        const nameElements = document.querySelectorAll('.user-name');
        nameElements.forEach(element => {
            element.classList.remove('voted-member');
        });

        // Highlight users who have voted
        votedUsernames.forEach(username => {
            nameElements.forEach(element => {
                if (element.textContent === username) {
                    element.classList.add('voted-member');
                }
            });
        });
    }
}

/* Handle Teams Rerolled */
function handleTeamsRerolled(teams) {
    // Reset userVoted and clear any existing votes
    userVoted = false;
    clearInterval(voteInterval);

    // Remove the Vote to Reroll button if it exists
    const voteButton = document.querySelector('.vote-reroll-button');
    if (voteButton) {
        voteButton.remove();
    }

    // Remove vote counter and confirm button if creator
    if (isCreator) {
        const voteCounter = document.getElementById('voteCounter');
        const confirmButton = document.getElementById('confirmRerollButton');
        if (voteCounter) voteCounter.remove();
        if (confirmButton) confirmButton.remove();
    }

    // Clear accent color from names
    const votedMembers = document.querySelectorAll('.voted-member');
    votedMembers.forEach(member => {
        member.classList.remove('voted-member');
    });

    // Display the new teams
    displayTeams(teams);
}

/* Handle Reveal Name Event */
function handleRevealName(memberId, memberName) {
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
}

socket.on('revealName', ({ memberId, memberName }) => {
    handleRevealName(memberId, memberName);
});

/* Handle Reveal All Names Event */
function handleRevealAllNames(teams) {
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
}

socket.on('revealAllNames', (teams) => {
    handleRevealAllNames(teams);
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
    hideElement("creatorNameSection"); // Hide the creatorNameSection
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
        currentJoinButton.onclick = function () {
            const roomID = currentJoinButton.getAttribute('data-room-id');
            joinRoom(roomID, true, null, currentJoinButton);
        };
        currentJoinButton = null;
    }

    // Reset chat variables
    resetChat();

    // Reset variables
    currentRoomID = null;
    isCreator = false;
    teamGenerated = false;
    revealedNames = new Set();
    totalMembers = 0;

    // Remove any event listeners
    socket.off('updateNames');
    socket.off('displayTeams');
    socket.off('revealName');
    socket.off('revealAllNames');
    socket.off('voteUpdate');
    socket.off('enableConfirmReroll');
    socket.off('teamsRerolled');

    // Reset vote variables
    userVoted = false;
    clearInterval(voteInterval);

    // Remove any vote-related elements
    const voteButton = document.querySelector('.vote-reroll-button');
    if (voteButton) {
        voteButton.remove();
    }

    // Remove vote counter and confirm button if creator
    const voteCounter = document.getElementById('voteCounter');
    const confirmButton = document.getElementById('confirmRerollButton');
    if (voteCounter) voteCounter.remove();
    if (confirmButton) confirmButton.remove();

    // Clear accent color from names
    const votedMembers = document.querySelectorAll('.voted-member');
    votedMembers.forEach(member => {
        member.classList.remove('voted-member');
    });

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
            joinButton.setAttribute('data-room-id', room.roomID);
            joinButton.textContent = 'Join Room';
            joinButton.addEventListener('click', function () {
                joinRoom(room.roomID, true, room.teamSize, this);
            });

            // If the user is already in this room
            if (currentRoomID === room.roomID) {
                joinButton.textContent = 'Leave Room';
                joinButton.onclick = function () {
                    leaveRoom(room.roomID, joinButton);
                };
                currentJoinButton = joinButton;
            }

            roomItem.appendChild(joinButton);
            roomsList.appendChild(roomItem);
        });
    }

    console.log("Updated active public rooms.");
}

/* Update Member Count */
socket.on('memberCount', ({ total, named, unnamed }) => {
    document.getElementById("totalMembers").textContent = total;
    document.getElementById("namedMembers").textContent = named;
    document.getElementById("unnamedMembers").textContent = unnamed;
    totalMembers = total; // Update total members for voting
    console.log(`Member count updated: Total - ${total}, Named - ${named}, Unnamed - ${unnamed}`);
});

/* Join Room Button Event Listener */
document.getElementById("joinRoom").addEventListener("click", () => {
    const roomIDInput = document.getElementById("roomID");
    const roomID = roomIDInput.value.trim();
    if (roomID.length >= 3 && roomID.length <= 6) {
        joinRoom(roomID);
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

        // Save the name to localStorage
        localStorage.setItem('cachedName', name);
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

/* Chat Functionality */
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

/* Event Listeners for Enter Key Press */
// Join or Create Room
document.getElementById('roomID').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        document.getElementById('joinRoom').click();
    }
});

// Submit Name
document.getElementById('nameInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        document.getElementById('submitName').click();
    }
});

// Add Name (Creator)
document.getElementById('creatorNameInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        document.getElementById('addName').click();
    }
});

// Room Chat Send
document.getElementById('roomChatInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        document.getElementById('roomChatSend').click();
    }
});

// Team Chat Send
document.getElementById('teamChatInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        document.getElementById('teamChatSend').click();
    }
});
