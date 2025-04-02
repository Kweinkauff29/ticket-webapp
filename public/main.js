document.getElementById("ticketForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const description = document.getElementById("ticketDescription").value;
    const email = document.getElementById("ticketEmail").value;
    const phone = document.getElementById("ticketPhone").value;
  
    // Call the backend to create a new ticket
    const response = await fetch("/api/create-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, email, phone })
    });
    
    const ticket = await response.json();
    // Add the ticket to Kevin's list by default
    addTicketToUI(ticket, "Kevin");
    document.getElementById("ticketForm").reset();
  });
  
  function addTicketToUI(ticket, assignee) {
    // Create ticket element with drag and drop attributes
    const li = document.createElement("div");
    li.className = "ticket";
    li.id = "ticket-" + ticket.id;
    li.draggable = true;
    li.addEventListener("dragstart", drag);
    
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
  
    // Find the correct person's ticket list using the assignee
    const selector = `.person-box[data-person="${assignee}"] .ticket-list`;
    const container = document.querySelector(selector);
    if (container) {
      container.appendChild(li);
    }
  }
  
  function markCompleted(ticketId) {
    fetch(`/api/complete-ticket/${ticketId}`, { method: "POST" });
    const ticketEl = document.getElementById("ticket-" + ticketId);
    ticketEl.classList.add("completed");
    // Move to the completed list
    document.getElementById("completedTicketList").appendChild(ticketEl);
  }
  
  // Drag and drop handlers
  function drag(event) {
    event.dataTransfer.setData("text/plain", event.target.id);
  }
  
  function allowDrop(event) {
    event.preventDefault();
    // Optionally add visual feedback when dragging over a box:
    event.currentTarget.classList.add("drag-over");
  }
  
  function drop(event, assignee) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");
    const ticketId = event.dataTransfer.getData("text/plain");
    const ticketEl = document.getElementById(ticketId);
    // Here you could update the assignee info in your backend if needed
    event.currentTarget.appendChild(ticketEl);
  }
  
  // Toggle collapse/expand for person boxes
  function toggleBox(headerElem) {
    const ticketList = headerElem.nextElementSibling;
    if (ticketList.style.display === "none") {
      ticketList.style.display = "block";
    } else {
      ticketList.style.display = "none";
    }
  }
  