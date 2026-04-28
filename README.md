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


