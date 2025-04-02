document.getElementById("ticketForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const description = document.getElementById("ticketDescription").value;
  
    // Call the backend to create a new ticket.
    const response = await fetch("/api/create-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description })
    });
    
    const ticket = await response.json();
    addTicketToUI(ticket);
    document.getElementById("ticketDescription").value = "";
  });
  
  function addTicketToUI(ticket) {
    const li = document.createElement("li");
    li.className = "ticket";
    li.id = "ticket-" + ticket.id;
    li.innerHTML = `<input type="checkbox" onchange="markCompleted(${ticket.id})">
                    <strong>${ticket.ticketNumber}:</strong> ${ticket.summary} 
                    <em>(Due: ${new Date(ticket.reminderTime).toLocaleString()})</em>`;
    document.getElementById("ticketList").appendChild(li);
  }
  
  async function markCompleted(ticketId) {
    await fetch(`/api/complete-ticket/${ticketId}`, { method: "POST" });
    const ticketEl = document.getElementById("ticket-" + ticketId);
    ticketEl.classList.add("completed");
    // Move to the completed list
    document.getElementById("completedTicketList").appendChild(ticketEl);
  }
  