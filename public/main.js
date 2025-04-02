// Handle ticket form submission with AI integration
document.getElementById("ticketForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const description = document.getElementById("ticketDescription").value;
    const email = document.getElementById("ticketEmail").value;
    const phone = document.getElementById("ticketPhone").value;
  
    // Call your backend endpoint that uses OpenAI (e.g., /api/ai-process)
    // Expected to return JSON with: { condensed, inProgressSubject, inProgressText }
    const aiResponse = await fetch("/api/ai-process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, email, phone })
    });
    
    const aiData = await aiResponse.json();
    
    // Show the AI-generated popup to the user
    showAIPopup(aiData, { description, email, phone });
  });
  
  function showAIPopup(aiData, ticketData) {
    const modal = document.getElementById("aiPopup");
    document.getElementById("aiCondensed").innerText = "Condensed: " + aiData.condensed;
    document.getElementById("aiInProgress").innerText = "In-Progress Text: " + aiData.inProgressText + "\nSubject: " + aiData.inProgressSubject;
    
    modal.style.display = "block";
  
    // Confirm button: Create the ticket and optionally trigger email sending
    document.getElementById("aiConfirmBtn").onclick = async function() {
      modal.style.display = "none";
      // Create the ticket via your backend
      const response = await fetch("/api/create-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketData)
      });
      const ticket = await response.json();
      // Add the new ticket to Kevin's box by default (or set as desired)
      addTicketToUI(ticket, "Kevin");
      document.getElementById("ticketForm").reset();
  
      // Optionally, call another endpoint to send the in-progress email using:
      // aiData.inProgressSubject and aiData.inProgressText
      // e.g., await fetch("/api/send-email", { ... });
    };
  
    // Cancel button: close the popup without creating a ticket
    document.getElementById("aiCancelBtn").onclick = function() {
      modal.style.display = "none";
    };
  }
  
  // Adds a ticket element to the specified assignee box; also stores the assignee in a data attribute
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
        <input type="checkbox" onchange="toggleCompleted(event, ${ticket.id})">
      </div>
    `;
  
    // Append to the box for the given assignee
    const selector = `.person-box[data-person="${assignee}"] .ticket-list`;
    const container = document.querySelector(selector);
    if (container) {
      container.appendChild(ticketElem);
    }
  }
  
  // Toggle completion state:
  // If checkbox is checked, mark ticket as complete and move it to the Completed list.
  // If unchecked, remove completed styling and move it back to its stored (last) assignee's box.
  async function toggleCompleted(event, ticketId) {
    const checkbox = event.target;
    const ticketElem = document.getElementById("ticket-" + ticketId);
    if (checkbox.checked) {
      // Mark as completed
      await fetch(`/api/complete-ticket/${ticketId}`, { method: "POST" });
      ticketElem.classList.add("completed");
      document.getElementById("completedTicketList").appendChild(ticketElem);
    } else {
      // Unchecked: mark as active again and return to last stored assignee box
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
  