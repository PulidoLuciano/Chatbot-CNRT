# Chatbot CNRT - Asistente Virtual Inteligente con RAG

Este proyecto implementa un sistema de atención automatizada para la **Comisión Nacional de Regulación del Transporte (CNRT)**. Utiliza Inteligencia Artificial Generativa bajo una arquitectura **RAG (Retrieval-Augmented Generation)** para responder consultas ciudadanas sobre normativas, derechos, pasajes para personas con discapacidad y fiscalización.

El sistema es omnicanal (Web y Telegram) y cuenta con un panel de administración para la derivación de casos complejos a operadores humanos ("Human-in-the-loop").

## 🛠 Tecnologías Utilizadas

El proyecto orquesta diversos microservicios mediante **Docker**, integrando las siguientes tecnologías:

* **Orquestación y Backend:** [n8n](https://n8n.io/) (Workflow Automation).
* **Inteligencia Artificial:** Google Gemini (vía Google AI Studio) como LLM principal.
* **Base de Datos Vectorial:** [Qdrant](https://qdrant.tech/) para el almacenamiento semántico de normativas.
* **Gestión de Memoria:** Redis para el manejo de sesiones y colas de mensajes.
* **Almacenamiento de Documentos:** Google Drive API.
* **Frontend:** HTML5, CSS3 y JavaScript Vanilla (Componente Web y Dashboard).
* **Infraestructura:** Docker & Docker Compose.

---

## 🚀 Guía de Instalación y Configuración Paso a Paso

Sigue estas instrucciones detalladas para desplegar el entorno de desarrollo y producción.

### 1. Preparación del Entorno

1.  **Clonar el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd Chatbot-CNRT
    ```

2.  **Variables de Entorno:**
    * Localiza el archivo `.env.example` en la raíz del proyecto.
    * Renómbralo a `.env`.
    * Configura las variables necesarias (puertos, claves secretas, etc.).
    * **Nota sobre el túnel:** Si dispones de un servidor propio con IP pública o dominio real, elimina el servicio de `ngrok` del archivo `docker-compose.yml` y define tu `WEBHOOK_URL` en el `.env`. Si estás trabajando en local, mantén el servicio de ngrok para exponer los webhooks a Telegram.

### 2. Despliegue de Contenedores

Ejecuta el siguiente comando para descargar las imágenes e iniciar todos los servicios (n8n, Qdrant, Redis, Ngrok):

```bash
docker compose up -d
```
*Espera unos instantes hasta que todos los contenedores estén en estado "healthy".*

### 3. Configuración Inicial de n8n

1.  Accede a `http://localhost:5678` en tu navegador.
2.  Configura la cuenta de administrador inicial (usuario y contraseña).
3.  **Instalar Nodos de Comunidad:**
    * Ve a **Settings** > **Community Nodes**.
    * Haz clic en Install y busca el paquete: `n8n-nodes-qdrant`.
    * Acepta e instala.
4.  **Importar Workflows:**
    * Crea 3 flujos de trabajo nuevos en blanco.
    * Importa en cada uno los archivos `.json` ubicados en la carpeta `/workflows` del repositorio:
        * `Chatbot_Main.json` (Lógica principal).
        * `Respuesta_Modular.json` (Manejador de respuestas omnicanal).
        * `Derivacion_Humana.json` (Lógica de traspaso a operador).

### 4. Configuración de Servicios y Credenciales

Debes configurar las credenciales dentro de n8n para conectar los servicios externos e internos.

#### A. Google Drive (Fuente de Documentos)
1.  Genera credenciales OAuth 2.0 desde la [Google Cloud Console](https://console.cloud.google.com/).
2.  Crea una carpeta específica en tu Google Drive (ej: `CNRT_Normativas`) donde alojarás los PDFs.
3.  En n8n, crea una credencial de "Google Drive OAuth2 API" y vincula tu cuenta.

#### B. Qdrant (Base de Datos Vectorial)
1.  Accede al dashboard de Qdrant en `http://localhost:6333/dashboard`.
2.  Crea una nueva colección llamada: **`Normativas_CNRT`**.
3.  **IMPORTANTE:** Configura las dimensiones en **768** (esto es crítico para la compatibilidad con el modelo de embeddings de Gemini).
4.  En n8n, configura las credenciales de Qdrant usando el host interno de Docker:
    * URL: `http://qdrant-cnrt:6333` (No usar localhost aquí).

#### C. Redis (Memoria de Sesión)
1.  En n8n, configura las credenciales de Redis.
2.  Host: `redis-cnrt`
3.  Puerto: `6379`
4.  SSL: Off.

#### D. Google Gemini (Inteligencia Artificial)
1.  Obtén tu API Token gratuito desde [Google AI Studio](https://aistudio.google.com/).
2.  Configura las credenciales en los nodos llamados "Google Gemini Chat" dentro de los workflows.

#### E. Telegram (Canal de Chat)
1.  Crea un nuevo bot hablando con **@BotFather** en Telegram.
2.  Copia el **Access Token**.
3.  Configura las credenciales de Telegram API en n8n.

### 5. Vinculación Lógica de Workflows (CRÍTICO)

Al importar los workflows, los IDs internos cambian y rompen las referencias entre ellos. Debes corregirlo manualmente antes de activar:

1.  **En el Workflow "Chatbot Principal":**
    * Abre los nodos de tipo "Execute Workflow" (generalmente llamados *"Llamar a Derivación humana"* y *"Responder mensaje"*).
    * Aunque parezcan seleccionados, **vuelve a seleccionar** el workflow correspondiente de la lista desplegable. Esto actualiza el ID interno.
2.  **En el Workflow "Derivación Humana":**
    * Repite el proceso para el nodo *"Responder mensaje"* (debe apuntar al sub-workflow de respuesta modular).

### 6. Publicación e Ingesta de Datos

1.  **Activar Workflows:**
    Haz clic en el switch **Activate** (arriba a la derecha) en el siguiente orden estricto:
    1.  Workflow de Respuesta Modular.
    2.  Workflow de Derivación Humana.
    3.  Workflow Chatbot Principal.

2.  **Carga de Conocimiento (RAG):**
    * Sube los archivos PDF con las normativas a la carpeta de Google Drive `CNRT_Normativas`.
    * ⚠️ **ADVERTENCIA:** Sube los archivos **uno por uno**, esperando aproximadamente **1 minuto** entre cada carga. Esto permite que el sistema procese el archivo, genere los embeddings y los indexe en Qdrant sin saturar la memoria ni los límites de la API.

### 7. Configuración del Frontend (Dashboard y Web Widget)

Para que la interfaz web se comunique con tu backend, debes actualizar las URLs de los Webhooks (producción) generados por n8n.

#### Archivo `dashboard/dashboard.html`
Busca la constante `BASE_URL` en el script y actualízala con la URL del webhook del workflow de **Derivación Humana**:

```javascript
// Ejemplo usando Ngrok
const BASE_URL = "https://tu-dominio.ngrok-free.app/webhook/derivacion...";
```

#### Archivo `web-component/index.html`
En la etiqueta del componente HTML, actualiza los atributos con las URLs de producción:

```html
<cnrt-chat 
    sync-url="https://tu-dominio.ngrok-free.app/webhook/derivacion..." 
    send-url="https://tu-dominio.ngrok-free.app/webhook/chatbot...">
</cnrt-chat>
```
* `sync-url`: Apunta al webhook de lectura de historial (Derivación Humana o Endpoint dedicado).
* `send-url`: Apunta al webhook de entrada del Chatbot Principal.

---
*Desarrollado como Proyecto de Investigación GIITNI - UTN FRT - Tucumán, Argentina.*
