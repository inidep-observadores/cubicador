# Documentación del Proyecto: Cubicación 3D Naval

Sistema Web Progresivo (PWA) Offline-First para el modelado tridimensional interactivo, cálculo de volumen cúbico ($m^3$) y estimación de capacidad de captura (toneladas) en pozos y bodegas de buques pesqueros.

---

## 📑 Índice de Documentación

1. [01. Planteo Inicial y Objetivos](./01-planteo-y-objetivos.md)
   - Contexto operativo de observadores a bordo y técnicos navales.
   - Limitaciones del método analítico tradicional en papel.
   - Objetivos funcionales y requerimientos operativos.
2. [02. Arquitectura y Stack Tecnológico](./02-arquitectura-y-stack.md)
   - Enfoque 100% *Offline-First* sin dependencia de servidores.
   - Stack: Vue 3, Three.js, Pinia, SQLite (WASM) + IndexedDB, Tailwind CSS, Vite PWA.
   - Esquema de la base, versionado y migraciones.
   - Protección de los datos y cálculo 3D en segundo plano (Web Worker).
   - Estructura del proyecto y publicación en un subdirectorio.
3. [03. Catálogo Geométrico Naval (10 Figuras)](./03-catalogo-geometrico-naval.md)
   - Especificación matemática de las 10 figuras paramétricas oficiales.
   - Fórmulas analíticas, diagramas SVG de cotas y parámetros requeridos.
   - Construcción de mallas cerradas (*watertight / manifold*) y orientación de normales exteriores.
4. [04. Motor Booleano CSG y Cálculo Espacial](./04-motor-booleano-csg.md)
   - Diagnóstico del motor booleano inicial (`three-bvh-csg`) y fallos de coplanaridad.
   - Replanteo con partición binaria del espacio (BSP clásico determinista con `three-csg-ts`).
   - Algoritmo de cálculo de volumen por divergencia (suma de tetraedros orientados).
   - Resolución de intersecciones espaciales 3D reales vs. suma algebraica ciega.
5. [05. Guía de Uso, Convenciones Náuticas y Controles](./05-guia-de-uso-y-convenciones.md)
   - Sistema de coordenadas y ejes navales (Eslora, Manga, Puntal, Proa, Popa, Babor, Estribor).
   - Vistas de cámara preconfiguradas y controles orbitales.
   - Modos de edición vs. Vista previa.
   - Snap magnético automático y ajuste fino manual al centímetro.
   - Atajos de teclado, deshacer y validación de campos.
   - Volumen informado (estados Calculando y Aproximado).
   - Respaldos, copias automáticas, importación e instalación de la app.

---

## 🚀 Inicio Rápido para Desarrolladores

### Requisitos
- Node.js (v18+)
- npm o pnpm

### Instalación y Ejecución Local
```bash
# Clonar el repositorio
git clone https://github.com/inidep-observadores/cubicador.git
cd cubicador

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo local
npm run dev

# Correr las pruebas (fórmulas, mallas, motor booleano y migraciones)
npm test

# Generar compilación de producción para PWA
npm run build

# Regenerar los íconos de la PWA
npm run icons
```

Para publicar en un subdirectorio, ver [02. Arquitectura · Publicación](./02-arquitectura-y-stack.md#8-publicación).
