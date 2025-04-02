// Removed AI integration code

// Handle ticket form submission (bypassing AI integration)
document.getElementById("ticketForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const description = document.getElementById("ticketDescription").value;
    const email = document.getElementById("ticketEmail").value;
    const phone = document.getElementById("ticketPhone").value;
    // Directly create the ticket (default assignee is set server-side to "Kevin")
    const response = await fetch("/api/create-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, email, phone })
    });
    const ticket = await response.json();
    // Add the new ticket to the UI under its assigned person
    addTicketToUI(ticket, ticket.assignee || "Kevin");
    document.getElementById("ticketForm").reset();
  });
  
  // Load existing tickets on page load
  document.addEventListener("DOMContentLoaded", async function () {
    try {
      const response = await fetch("/api/tickets");
      const tickets = await response.json();
      tickets.forEach(ticket => {
        if (ticket.completed == 1) {
          addTicketToUI(ticket, "completed");
        } else {
          addTicketToUI(ticket, ticket.assignee || "Kevin");
        }
      });
    } catch (error) {
      console.error("Error loading tickets:", error);
    }
  });
  
  // Adds a ticket element to the specified assignee box or completed list
  function addTicketToUI(ticket, assignee) {
    const ticketElem = document.createElement("div");
    ticketElem.className = "ticket";
    ticketElem.id = "ticket-" + ticket.id;
    ticketElem.draggable = true;
    ticketElem.dataset.assignee = assignee;
    ticketElem.addEventListener("dragstart", drag);
  
    ticketElem.innerHTML = `
      <div class="details">
        <strong>${ticket.ticketNumber}:</strong> ${ticket.summary}<br>
        ${ticket.email ? `<small>Email: ${ticket.email}</small>` : ""}
        ${ticket.phone ? `<small>Phone: ${ticket.phone}</small>` : ""}
        <small>(Due: ${new Date(ticket.reminderTime).toLocaleString()})</small>
      </div>
      <div>
        <input type="checkbox" onchange="toggleCompleted(event, ${ticket.id})" ${ticket.completed == 1 ? "checked" : ""}>
      </div>
    `;
  
    if (assignee === "completed") {
      document.getElementById("completedTicketList").appendChild(ticketElem);
    } else {
      const selector = `.person-box[data-person="${assignee}"] .ticket-list`;
      const container = document.querySelector(selector);
      if (container) {
        container.appendChild(ticketElem);
      }
    }
  }
  
  // Toggle ticket completion state
  async function toggleCompleted(event, ticketId) {
    const checkbox = event.target;
    const ticketElem = document.getElementById("ticket-" + ticketId);
    if (checkbox.checked) {
      // Mark as completed
      await fetch(`/api/complete-ticket/${ticketId}`, { method: "POST" });
      ticketElem.classList.add("completed");
      document.getElementById("completedTicketList").appendChild(ticketElem);
    } else {
      // Unmark as completed and return to its stored assignee box
      ticketElem.classList.remove("completed");
      const lastAssignee = ticketElem.dataset.assignee || "Kevin";
      const selector = `.person-box[data-person="${lastAssignee}"] .ticket-list`;
      const container = document.querySelector(selector);
      if (container) {
        container.appendChild(ticketElem);
      }
    }
  }
  
  // HTML5 Drag and Drop handlers
  function drag(event) {
    event.dataTransfer.setData("text/plain", event.target.id);
  }
  
  function allowDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.add("drag-over");
  }
  
  function drop(event, assignee) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");
    const ticketId = event.dataTransfer.getData("text/plain");
    const ticketElem = document.getElementById(ticketId);
    // Update the stored assignee so that if the ticket is unchecked later, it returns here
    ticketElem.dataset.assignee = assignee;
    event.currentTarget.appendChild(ticketElem);
  }
  
  // Toggle collapse/expand for each person box
  function toggleBox(headerElem) {
    const ticketList = headerElem.nextElementSibling;
    ticketList.style.display = (ticketList.style.display === "none") ? "block" : "none";
  }
  
  // Optional: close the modal if the user clicks outside of the modal content
  window.onclick = function(event) {
    const modal = document.getElementById("aiPopup");
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
  