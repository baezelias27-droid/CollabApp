# COLLAB — Workspace Colaborativo

App web privada para 2 usuarios: Ideas con tablero + Editor de proyectos con ejecución de código.

---

## Estructura de archivos

```
collab-app/
├── index.html          ← Toda la UI (auth + app)
├── styles.css          ← Estilos completos
├── app.js              ← Lógica frontend (Firebase SDK)
├── firebase-config.js  ← ⚠️ TUS credenciales Firebase
├── firestore.rules     ← Reglas de seguridad (pegar en consola)
├── server.js           ← Backend Express (opcional)
├── package.json        ← Dependencias Node
└── routes/
    └── api.js          ← Rutas API backend
```

---

## ⚙️ Configuración paso a paso

### Paso 1 — Crear proyecto Firebase

1. Ve a https://console.firebase.google.com
2. Click "Agregar proyecto" → pon un nombre → crear
3. En el panel principal, haz click en **</>** (Web)
4. Registra la app, copia el objeto `firebaseConfig`

### Paso 2 — Activar Authentication

1. Firebase Console → **Authentication** → Comenzar
2. Pestaña "Sign-in method" → habilita **Email/contraseña**

### Paso 3 — Activar Firestore

1. Firebase Console → **Firestore Database** → Crear base de datos
2. Elige "Comenzar en modo producción" (o prueba para desarrollo)
3. Elige una región

### Paso 4 — Configurar reglas de seguridad

1. Firestore → pestaña **Reglas**
2. Pega el contenido de `firestore.rules`
3. Publicar

### Paso 5 — Agregar tus credenciales

Abre `firebase-config.js` y reemplaza los valores:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy-TU-API-KEY-AQUI",
  authDomain:        "tu-proyecto.firebaseapp.com",
  projectId:         "tu-proyecto",
  storageBucket:     "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

---

## 🚀 Cómo ejecutar

### Opción A — Solo frontend (más simple)

Como usa ES Modules (`import`), necesitas un servidor HTTP básico:

```bash
# Con Python (incluido en macOS/Linux)
python3 -m http.server 8080

# Con Node (instalar globalmente)
npm install -g live-server
live-server

# Con VS Code
# Instala la extensión "Live Server" y click en "Go Live"
```

Abre http://localhost:8080 en el navegador.

### Opción B — Con backend Express

```bash
# Instalar dependencias
npm install

# Desarrollo (auto-recarga)
npm run dev

# Producción
npm start
```

Coloca los archivos frontend (index.html, styles.css, app.js, firebase-config.js)
dentro de una carpeta `/public` para que Express los sirva.

---

## 🔐 Seguridad

- Solo usuarios autenticados pueden acceder a la app
- Las reglas de Firestore refuerzan esto a nivel de base de datos
- El código JavaScript se ejecuta en sandbox (new Function) sin acceso al DOM externo
- Para mayor seguridad, puedes agregar una whitelist de emails en Firestore

---

## 📱 Funcionalidades

### Ideas + Tablero
- Crear, editar y eliminar ideas
- Tablero por idea con 3 columnas: Ventajas / Desventajas / Problemas
- Agregar, editar y eliminar ítems en cada columna
- Sincronización en tiempo real (onSnapshot de Firestore)

### Proyectos / Editor de código
- Crear proyectos con nombre y descripción
- Editor de JavaScript en el navegador
- Ejecutar código con `Ctrl+Enter` (captura console.log, errors, warns)
- Historial de los últimos 10 guardados con opción de restaurar
- Tab inserta 2 espacios

### Auth
- Registro con nombre, email y contraseña
- Login persistente (Firebase mantiene la sesión)
- Logout con botón en sidebar

---

## 🧩 Arquitectura

```
Frontend (Vanilla JS)
      │
      ├─── Firebase Auth     → Login / sesión
      └─── Firestore         → Ideas, tableros, proyectos
                                (tiempo real con onSnapshot)

Backend Express (opcional)
      └─── Sirve archivos estáticos
           Rutas API futuras (/api/*)
```

El frontend se comunica **directamente** con Firebase usando el SDK de cliente.
El backend Express es un servidor de archivos estáticos y punto de extensión futuro.

---

## Colecciones de Firestore

```
users/{uid}
  name, email, createdAt

ideas/{ideaId}
  title, description, createdBy, createdAt
  └── ventajas/{itemId}   → text, createdBy, createdAt
  └── desventajas/{itemId}
  └── problemas/{itemId}

projects/{projectId}
  name, description, code, history[], createdBy, createdAt, updatedAt
```
