const socket = io();
let isCreator = false;
let currentRoomID = null;
let currentJoinButton = null;
let teamGenerated = false;
let revealedNames = new Set();
let roomChatUnread = 0;
let teamChatUnread = 0;
let currentChatTab = 'roomChat';

/* Toggle element visibility */
function toggleElementVisibility(elementId, shouldShow) {
    const element = document.getElementById(elementId);
    element.classList.toggle('hidden', !shouldShow);
}

/* Show or hide element by ID */
function showElement(elementId) {
    document.getElementById(elementId).classList.remove('hidden');
}

function hideElement(elementId) {
    document.getElementById(elementId).classList.add('hidden');
}

/* Event Listeners for various interactions */
document.getElementById("joinRoom").addEventListener("click", joinRoomHandler);
document.getElementById("submitName").addEventListener("click", submitNameHandler);
document.getElementById("generateTeams").addEventListener("click", generateTeamsHandler);
document.getElementById("roomChatSend").addEventListener("click", () => sendMessage('roomChat'));
document.getElementById("teamChatSend").addEventListener("click", () => sendMessage('teamChat'));
document.getElementById('roomChatTab').addEventListener('click', () => switchChatTab('roomChat'));
document.getElementById('teamChatTab').addEventListener('click', () => switchChatTab('teamChat'));

/* Join Room */
function joinRoomHandler() {
    const roomIDInput = document.getElementById("roomID");
    const roomID = roomIDInput.value.trim();
    if (roomID.length >= 3 && roomID.length <= 6) {
        joinRoom(roomID);
    } else {
        alert("Please enter a Room ID between 3 and 6 characters.");
    }
}

/* Emit room join request and update UI */
function joinRoom(roomID, isPublic = document.getElementById('isPublic').checked, teamSize = parseInt(document.getElementById('teamSizeSelect').value, 10)) {
    if (currentJoinButton) currentJoinButton.disabled = false;
    currentRoomID = roomID;
    socket.emit('joinRoom', { roomID, isPublic, teamSize });
    document.getElementById("memberInfoTitle").textContent = `${roomID} Room Information`;
    toggleElementVisibility("submitNameSection", true);
    toggleElementVisibility("memberInfoSection", true);
    toggleElementVisibility("teamGenerationSection", true);
    toggleElementVisibility("chatSection", true);
    console.log(`Joined room: ${roomID}`);
}

/* Submit Name */
function submitNameHandler() {
    const nameInput = document.getElementById("nameInput");
    const name = nameInput.value.trim();
    const afkq = document.getElementById("afkqTool").checked;
    if (name && currentRoomID) {
        socket.emit('submitName', { roomID: currentRoomID, name, afkq });
        nameInput.value = '';
        console.log(`Submitted name: ${name}, AFKQ: ${afkq}`);
    } else {
        alert("Please enter your name.");
    }
}

/* Generate Teams */
function generateTeamsHandler() {
    if (isCreator && currentRoomID) {
        socket.emit('generateTeams', { roomID: currentRoomID });
        console.log("Requested team generation.");
    } else {
        alert("Only the room creator can generate teams.");
    }
}

/* Chat Tab Switching */
function switchChatTab(tab) {
    currentChatTab = tab;
    document.querySelectorAll('.chat-tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');
    document.querySelectorAll('.chat-window').forEach(div => hideElement(div.id));
    showElement(tab);
    resetChatBadge(tab);
}

/* Send Message */
function sendMessage(chatType) {
    const input = document.getElementById(chatType + 'Input');
    const message = input.value.trim();
    if (message) {
        socket.emit(chatType + 'Message', { roomID: currentRoomID, message });
        input.value = '';
    }
}
