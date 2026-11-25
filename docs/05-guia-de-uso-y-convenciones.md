# 05. Guía de Uso, Convenciones Náuticas y Controles

## 1. Convenciones Náuticas y Sistema de Ejes

Para garantizar consistencia con los planos navales y la práctica marina a bordo, los ejes cartesianos del entorno 3D representan:

| Eje Cartesiano | Magnitud Naval | Sentido Positivo (+) | Sentido Negativo (-) |
| :---: | :--- | :--- | :--- |
| **Eje X** | **Eslora** (Longitudinal) | Hacia **Proa** (Frente del buque) | Hacia **Popa** (Atrás) |
| **Eje Y** | **Puntal** (Vertical) | Hacia **Arriba** (Cubierta / Techo) | Hacia **Abajo** (Fondo del pozo / Quilla) |
| **Eje Z** | **Manga** (Transversal) | Hacia **Babor** (Izquierda) | Hacia **Estribor** (Derecha) |

---

## 2. Vistas de Cámara Preconfiguradas

En la barra inferior flotante del visor 3D se dispone de 4 accesos rápidos que posicionan la cámara:

1. **Centrar:** Vista isométrica elevada situada en la esquina superior **Babor-Proa** `(16, 11, -14)`, ideal para inspección general.
2. **Frente:** Se sitúa en la proa mirando hacia popa `(18, 1.5, 0)`, visualizando perpendicularmente la pared transversal del pozo (de Estribor a Babor).
3. **Planta:** Vista cenital ortogonal desde arriba `(0, 22, 0)`, visualizando la distribución en el plano horizontal (Eslora vs. Manga).
4. **Lateral:** Perfil de eslora mirando desde Babor `(0, 1.5, -20)`.

---

## 3. Controles de Ratón y Teclado

### Navegación 3D
- **Click Izquierdo + Arrastrar:** Orbitar la cámara alrededor del pozo.
- **Click Derecho + Arrastrar:** Paneo (desplazar la vista en el plano de la pantalla).
- **Rueda del Ratón:** Zoom acercar / alejar.
- **Click Izquierdo sobre una pieza:** Seleccionar el bloque para inspección y edición.

### Gizmos de Manipulación
- **Tecla `W`:** Activar modo **Mover / Traslación** (flechas roja para X, verde para Y, azul para Z).
- **Tecla `R`:** Activar modo **Rotar** (anillos de rotación con pasos magnéticos de 15°).

---

## 4. Snap Magnético vs. Ajuste Fino Manual

El sistema ofrece dos modalidades complementarias de posicionamiento:

1. **Arrastre Visual en Pantalla (Snap Activo):**
   - Cuando se arrastra una pieza con el gizmo 3D, el movimiento se cuantiza automáticamente a pasos de `0.25 m`.
   - Al soltar la pieza cerca de otra existente, se activa el **snap magnético entre caras**, pegando automáticamente las paredes de ambos bloques para evitar huecos no deseados.
2. **Ajuste Fino Manual por Teclado:**
   - En la sección **Ubicación en Bodega** del panel lateral derecho, los campos **Eje X (Eslora)**, **Eje Y (Puntal)** y **Eje Z (Manga)** aceptan valores numéricos directos con precisión centimétrica (`0.01 m`).
   - El gizmo no intercepta ni redondea los valores escritos a mano, permitiendo calibrar desplazamientos exactos según plano.

---

## 5. Modos de Visualización

En la barra de herramientas superior se puede conmutar entre:

- **Modo Edición:** Permite ver y manipular cada bloque paramétrico de forma independiente, identificando uniones (azules) y sustracciones (rojas translúcidas).
- **Modo Pozo Booleano:** Computa en tiempo real la unión y corte total de la bodega, mostrando el sólido único resultante con sus aristas técnicas.
- **Sólido / Rayos X / Alambre:** 
  - *Sólido:* Superficie opaca con sombras.
  - *Rayos X:* Malla translúcida para visualizar cavidades y rampas internas ocultas.
  - *Alambre:* Esqueleto de aristas para inspección topológica.

---

## 6. Respaldos y Persistencia

- **Auto-guardado continuo:** Cada modificación se sincroniza automáticamente en SQLite sobre IndexedDB.
- **Botón "Respaldar DB":** Descarga en un click el archivo físico `.sqlite` generado en el momento, el cual contiene todos los buques, pozos, bloques y transformaciones, permitiendo transferir la información entre computadoras o conservarla como resguardo legal de la marea.
