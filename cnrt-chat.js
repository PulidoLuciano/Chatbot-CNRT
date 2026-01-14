class CNRTChat extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }); // Encapsulamiento
      this.isOpen = false;
      this.sessionId = this.getSessionId(); // Recupera o crea ID
      this.webhookUrl = this.getAttribute('webhook-url'); // URL de n8n
    }
  
    // 1. Estilos y Estructura HTML
    connectedCallback() {
      this.render();
      this.addEventListeners();
    }
  
    // Genera un ID único para Redis y lo guarda en el navegador
    getSessionId() {
      let id = localStorage.getItem('cnrt_session_id');
      if (!id) {
        id = 'web_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('cnrt_session_id', id);
      }
      return id;
    }
  
    render() {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            font-family: 'Segoe UI', sans-serif;
          }
          /* Botón Flotante (Launcher) */
          .launcher {
            width: 60px;
            height: 60px;
            background-color: #0072bb; /* Azul Institucional */
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s;
          }
          .launcher:hover { transform: scale(1.1); }
          .launcher svg { width: 30px; height: 30px; fill: white; }
          
          /* Ventana del Chat */
          .chat-window {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
            display: none; /* Oculto por defecto */
            flex-direction: column;
            overflow: hidden;
            border: 1px solid #e0e0e0;
          }
          .chat-window.open { display: flex; }
          
          /* Header */
          .header {
            background: #0072bb;
            color: white;
            padding: 15px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          /* Lista de Mensajes */
          .messages {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            background: #f9f9f9;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .msg {
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 10px;
            font-size: 14px;
            line-height: 1.4;
          }
          .msg.user {
            align-self: flex-end;
            background: #0072bb;
            color: white;
            border-bottom-right-radius: 2px;
          }
          .msg.bot {
            align-self: flex-start;
            background: #e0e0e0;
            color: #333;
            border-bottom-left-radius: 2px;
          }
          
          /* Input Area */
          .input-area {
            padding: 10px;
            border-top: 1px solid #eee;
            display: flex;
            background: white;
          }
          input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 20px;
            outline: none;
          }
          button.send {
            background: none;
            border: none;
            color: #0072bb;
            cursor: pointer;
            font-weight: bold;
            padding: 0 10px;
          }
          
          /* Typing Indicator */
          .typing { font-size: 12px; color: #888; margin-left: 15px; display: none; }
        </style>
  
        <div class="chat-window" id="window">
          <div class="header">
            <span>Asistente Virtual CNRT</span>
            <span style="cursor:pointer" id="close-btn">✖</span>
          </div>
          <div class="messages" id="msg-list">
            <div class="msg bot">¡Hola! Soy el asistente virtual de la CNRT. ¿En qué puedo ayudarte hoy?</div>
          </div>
          <div class="typing" id="typing">Escribiendo...</div>
          <div class="input-area">
            <input type="text" id="input" placeholder="Escribe tu consulta..." />
            <button class="send" id="send-btn">Enviar</button>
          </div>
        </div>
  
        <div class="launcher" id="launcher">
          <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        </div>
      `;
    }
  
    addEventListeners() {
      const launcher = this.shadowRoot.getElementById('launcher');
      const window = this.shadowRoot.getElementById('window');
      const closeBtn = this.shadowRoot.getElementById('close-btn');
      const sendBtn = this.shadowRoot.getElementById('send-btn');
      const input = this.shadowRoot.getElementById('input');
  
      // Toggle Abrir/Cerrar
      const toggle = () => {
        this.isOpen = !this.isOpen;
        window.classList.toggle('open', this.isOpen);
        if (this.isOpen) input.focus();
      };
  
      launcher.addEventListener('click', toggle);
      closeBtn.addEventListener('click', toggle);
  
      // Enviar Mensaje
      const send = async () => {
        const text = input.value.trim();
        if (!text) return;
  
        // 1. Mostrar mensaje del usuario
        this.addMessage(text, 'user');
        input.value = '';
        this.showTyping(true);
  
        try {
          // 2. Enviar a n8n
          const response = await fetch(this.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatInput: text,
              sessionId: this.sessionId, // Importante para Redis
              metadata: { source: 'web' } // Para que n8n sepa que es web
            })
          });
  
          const data = await response.json();
          
          // 3. Mostrar respuesta del bot
          this.showTyping(false);
          // Asumiendo que n8n devuelve { "output": "Texto de respuesta" }
          this.addMessage(data.output || "Lo siento, hubo un error de conexión.", 'bot');
  
        } catch (error) {
          this.showTyping(false);
          this.addMessage("Error al conectar con el servidor.", 'bot');
          console.error(error);
        }
      };
  
      sendBtn.addEventListener('click', send);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') send();
      });
    }
  
    addMessage(text, sender) {
      const list = this.shadowRoot.getElementById('msg-list');
      const div = document.createElement('div');
      div.classList.add('msg', sender);
      // Convertir saltos de línea a <br> (básico)
      div.innerHTML = text.replace(/\n/g, '<br>'); 
      list.appendChild(div);
      list.scrollTop = list.scrollHeight; // Auto-scroll al fondo
    }
  
    showTyping(show) {
      const el = this.shadowRoot.getElementById('typing');
      el.style.display = show ? 'block' : 'none';
    }
  }
  
  // Registrar el componente
  customElements.define('cnrt-chat', CNRTChat);