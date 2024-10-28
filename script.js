const socket = io();

document.getElementById("joinRoom").addEventListener("click", () => {
    const roomID = document.getElementById("roomID").value.trim();
    socket.emit('joinRoom', roomID);

    document.getElementById("submitName").addEventListener("click", () => {
        const name = document.getElementById("nameInput").value.trim();
        if (name) {
            socket.emit('submitName', { roomID, name });
            document.getElementById("nameInput").value = ""; // Clear the input field
        }
    });

    // Display names as they update
    socket.on('updateNames', (names) => {
        const nameListDiv = document.getElementById("nameList");
        nameListDiv.innerHTML = names.map(name => `<p>${name}</p>`).join('');
    });
});
