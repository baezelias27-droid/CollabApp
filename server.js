// ══════════════════════════════════════════════════════
//  server.js  —  Backend Node.js + Express (OPCIONAL)
//
//  Para esta app, el frontend se comunica DIRECTAMENTE
//  con Firebase (Auth + Firestore), así que este servidor
//  solo es necesario si:
//    - Quieres lógica backend propia (APIs, webhooks)
//    - Quieres servir el frontend de forma local/segura
//    - Futura expansión (ej: notificaciones, integraciones)
//
//  Para correr la app sin backend: abre index.html
//  directamente en el navegador o usa un servidor estático.
// ══════════════════════════════════════════════════════

const express = require("express");
const path    = require("path");
const cors    = require("cors");
require("dotenv").config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares
app.use(cors());
app.use(express.json());

// ── Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, "public")));

// ── Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ══════════════════════════════ RUTAS API (ejemplo)
// Si en el futuro necesitas validación server-side con
// Firebase Admin SDK, aquí van tus rutas.

const apiRouter = require("./routes/api");
app.use("/api", apiRouter);

// ── 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// ── Iniciar servidor
app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
