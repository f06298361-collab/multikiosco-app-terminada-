# ESTADO DEL PROYECTO — KIOSCO FRANCO MULTIKIOSCO

**Fecha de actualización:** 5 de agosto de 2026  
**Versión:** 1.5.0 (Soporte de Subdominios Wildcard, Resolucion PWA Aislada y Arquitectura Android TWA)  
**Estado del Build:** ✅ `npm run typecheck` y `npm run build` pasando correctamente (0 errores, 0 warnings).

---

## 1. RESUMEN DE CAMBIOS Y AUDITORÍA RECIENTE

### 1.1 Resolución de Subdominios Wildcard (`*.tudominio.com`)
- **Módulo `kiosk-resolver` Backend:** Creado e integrado en todas las rutas públicas y de configuración (`/api/settings`, `/api/settings/manifest.json`, `/api/settings/kiosk-icon`, `/api/products`, `/api/orders`).
- **Lógica de Prioridad para Resolver Kiosco:**
  1. Parámetro explícito de query o body (`?kiosk=slug` / `kioskId`).
  2. Subdominio extraído del header `Host` o `X-Forwarded-Host` (ej. `franco.tudominio.com` -> slug `franco`).
  3. Kiosco por defecto (`kiosk-franco`).
- **Aislamiento en Frontend:** Detección automática en el cliente del subdominio de la ventana actual (`window.location.hostname`) para cargar el kiosco correspondiente y vaciar el carrito al cambiar de tienda evitando mezclas de pedidos.

### 1.2 PWA Independiente por Origen / Subdominio
- **Manifiesto por Subdominio:** Cada subdominio (`franco.tudominio.com`) entrega su propio `manifest.json` con su `name`, `short_name`, `start_url` (`/?kiosk=franco`), `id`, `description` e icono personalizado en `/api/settings/kiosk-icon`.
- **Aislamiento de Service Worker:** Las claves de caché están asociadas al origen/subdominio, permitiendo instalar "Kiosco Franco" y "Kiosco Mendoza" como dos aplicaciones PWA independientes en el dispositivo sin colisionar en scope ni en datos.

### 1.3 Arquitectura Android (Trusted Web Activity - TWA)
- **Estrategia Elegida:** Plantilla TWA (Trusted Web Activity) ligera usando Gradle y Android Support Custom Tabs.
- **Identidad Nactiva:** Cada APK abre directamente `https://[slug].tudominio.com/` sin barra del navegador, proporcionando icono de inicio, pantalla splash y comportamiento nativo.

### 1.4 Auditoría de Seguridad y Aislamiento Multikiosco
- **Verificación de Permisos:** Admins restringidos estrictamente a su `kioskId`. Intento de acceso cross-kiosk devuelve error HTTP 403.
- **Validación Backend en Checkout:** `POST /api/orders` rechaza automáticamente intentos de pedir productos pausados (`available: false`) o pertenecientes a un kiosco inactivo.

---

## 2. ARQUITECTURA GENERAL

```
├── artifacts/
│   ├── api-server/         # Backend Express.js + Drizzle ORM + Resolver de Subdominios
│   │   ├── src/lib/kiosk-resolver.ts  # Detección dinámica por subdominio o query
│   │   └── src/routes/     # Settings, Products, Orders, Admin, Superadmin
│   └── kiosco-franco/      # Frontend cliente & panel de administración (React + Vite)
├── lib/
│   ├── db/                 # Esquemas Drizzle, migraciones automáticas y conexión PostgreSQL
│   ├── api-client-react/   # Hooks/clientes API
│   ├── api-spec/           # Especificaciones OpenAPI/Zod
│   └── api-zod/            # Validadores Zod
├── package.json            # Scripts del monorepo
└── PROJECT_STATE.md        # Documento de estado actual
```

---

## 3. VERIFICACIÓN Y COMPILACIÓN FINAL

- **Typecheck:** ✅ `npm run typecheck` pasa limpiamente (0 errores).
- **Build:** ✅ `npm run build` compila con éxito los paquetes del cliente y servidor.
- **Variables de Entorno Recomendadas para Producción:**
  - `DATABASE_URL`: URL de conexión PostgreSQL (obligatoria).
  - `AUTH_SECRET`: Clave secreta para la firma de tokens JWT (obligatoria en producción).
  - `SUPERADMIN_PASSWORD`: Contraseña inicial de emergencia para el SuperAdmin.


