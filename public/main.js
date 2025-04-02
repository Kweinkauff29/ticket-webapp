document.getElementById("ticketForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const description = document.getElementById("ticketDescription").value;
    const email = document.getElementById("ticketEmail").value;
    const phone = document.getElementById("ticketPhone").value;
  
    // Call the backend to create a new ticket, including email and phone if provided
    const response = await fetch("/api/create-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, email, phone })
    });
    
    const ticket = await response.json();
    addTicketToUI(ticket);
    document.getElementById("ticketForm").reset();
  });
  
  function addTicketToUI(ticket) {
    const li = document.createElement("li");
    li.className = "ticket";
    li.id = "ticket-" + ticket.id;
    li.innerHTML = `
      <div class="details">
        <strong>${ticket.ticketNumber}:</strong> ${ticket.summary}<br>
        ${ticket.email ? `<small>Email: ${ticket.email}</small>` : ""}
        ${ticket.phone ? `<small>Phone: ${ticket.phone}</small>` : ""}
        <small>(Due: ${new Date(ticket.reminderTime).toLocaleString()})</small>
      </div>
      <div>
        <input type="checkbox" onchange="markCompleted(${ticket.id})">
      </div>
    `;
    document.getElementById("ticketList").appendChild(li);
  }
  
  async function markCompleted(ticketId) {
    await fetch(`/api/complete-ticket/${ticketId}`, { method: "POST" });
    const ticketEl = document.getElementById("ticket-" + ticketId);
    ticketEl.classList.add("completed");
    // Move to the completed list
    document.getElementById("completedTicketList").appendChild(ticketEl);
  }