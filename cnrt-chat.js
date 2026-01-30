class CNRTChat extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.isOpen = false;
    this.sessionId = this.getSessionId();
    // URL Base para POST (enviar) y GET (sincronizar)
    // Asumimos que tu webhook base es .../webhook/chat-web
    this.syncUrl = this.getAttribute("sync-url");
    this.sendUrl = this.getAttribute("send-url");
    this.syncInterval = null;
    this.messageCount = 0; // Para saber si llegaron nuevos
  }

  getSessionId() {
    let id = localStorage.getItem("cnrt_session_id");
    if (!id) {
      id = "web_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("cnrt_session_id", id);
    }
    return id;
  }

  connectedCallback() {
    this.render();
    this.addEventListeners();
    // Iniciar sincronización automática
    this.startPolling();
  }

  disconnectedCallback() {
    this.stopPolling();
  }

  // --- LÓGICA DE SINCRONIZACIÓN (POLLING) ---
  startPolling() {
    // Preguntar cada 4 segundos si hay mensajes nuevos
    this.syncInterval = setInterval(() => this.syncMessages(), 4000);
  }

  stopPolling() {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }

  async syncMessages() {
    if (!this.isOpen) return; // Solo sincronizar si el chat está abierto

    try {
      const syncUrl =
        this.syncUrl + "/agent/history?sessionId=" + this.sessionId;

      const response = await fetch(syncUrl, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) return;

      const history = await response.json();

      // Si hay más mensajes en el servidor que en mi pantalla, actualizo
      if (Array.isArray(history) && history.length > this.messageCount) {
        this.renderHistory(history);
      }
    } catch (e) {
      console.error("Error sync:", e);
    }
  }

  renderHistory(history) {
    const list = this.shadowRoot.getElementById("msg-list");
    list.innerHTML = "";

    history.forEach((msg) => {
      const sender = msg.type === "user" ? "user" : "bot";
      const text = msg.content || msg.data?.content || msg.text || "";

      this.addMessageDOM(text, sender);
    });

    this.messageCount = history.length;
    list.scrollTop = list.scrollHeight;
  }
  // -------------------------------------------

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        /* ... (MISMOS ESTILOS DE ANTES) ... */
        :host { position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: sans-serif; }
        .launcher { width: 60px; height: 60px; background: #0072bb; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
        .chat-window { position: absolute; bottom: 80px; right: 0; width: 350px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; border: 1px solid #ddd; }
        .chat-window.open { display: flex; }
        .header { background: #0072bb; color: white; padding: 15px; font-weight: bold; display:flex; justify-content:space-between; }
        .messages { flex: 1; padding: 15px; overflow-y: auto; background: #f9f9f9; display: flex; flex-direction: column; gap: 10px; }
        .msg { max-width: 80%; padding: 8px 12px; border-radius: 10px; font-size: 14px; word-wrap: break-word; }
        .msg.user { align-self: flex-end; background: #0072bb; color: white; border-bottom-right-radius: 2px; }
        .msg.bot { align-self: flex-start; background: #e0e0e0; color: #333; border-bottom-left-radius: 2px; }
        .msg.agent { align-self: flex-start; background: #e0e0e0; color: #333; border-bottom-left-radius: 2px; }
        .input-area { padding: 10px; border-top: 1px solid #eee; display: flex; background: white; }
        input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 20px; outline: none; }
      </style>

      <div class="chat-window" id="window">
        <div class="header">
          <span>CNRT Ayuda</span>
          <span id="close-btn" style="cursor:pointer">✖</span>
        </div>
        <div class="messages" id="msg-list"></div>
        <div class="input-area">
          <input type="text" id="input" placeholder="Escribe..." />
        </div>
      </div>
      <div class="launcher" id="launcher">💬</div>
    `;
  }

  addEventListeners() {
    const launcher = this.shadowRoot.getElementById("launcher");
    const closeBtn = this.shadowRoot.getElementById("close-btn");
    const input = this.shadowRoot.getElementById("input");

    const toggle = () => {
      this.isOpen = !this.isOpen;
      this.shadowRoot
        .getElementById("window")
        .classList.toggle("open", this.isOpen);
      if (this.isOpen) {
        input.focus();
        this.syncMessages(); // Sincronizar al abrir
      }
    };

    launcher.addEventListener("click", toggle);
    closeBtn.addEventListener("click", toggle);

    input.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        const text = input.value.trim();
        if (!text) return;

        // Optimismo: Mostrar mensaje inmediatamente
        this.addMessageDOM(text, "user");
        input.value = "";

        try {
          // Enviar mensaje (POST)
          await fetch(this.sendUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify({
              chatInput: text,
              sessionId: this.sessionId,
            }),
          });
          // No esperamos respuesta directa del fetch POST.
          // Dejamos que el próximo "syncMessages" traiga la respuesta (sea IA o Humano)
          setTimeout(() => this.syncMessages(), 1000);
        } catch (err) {
          console.error(err);
        }
      }
    });
  }

  addMessageDOM(text, sender) {
    const list = this.shadowRoot.getElementById("msg-list");
    const div = document.createElement("div");
    div.classList.add("msg", sender);
    div.innerHTML = text.replace(/\n/g, "<br>");
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }
}

customElements.define("cnrt-chat", CNRTChat);
