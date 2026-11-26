# 05. Guía de Uso, Convenciones Náuticas y Controles

## 1. Convenciones Náuticas y Sistema de Ejes

Para garantizar consistencia con los planos navales y la práctica marina a bordo, los ejes cartesianos del entorno 3D representan:

| Eje Cartesiano | Magnitud Naval | Sentido Positivo (+) | Sentido Negativo (-) |
| :---: | :--- | :--- | :--- |
| **Eje X** | **Eslora** (Longitudinal) | Hacia **Proa** (Frente del buque) | Hacia **Popa** (Atrás) |
| **Eje Y** | **Puntal** (Vertical) | Hacia **Arriba** (Cubierta / Techo) | Hacia **Abajo** (Fondo del pozo / Quilla) |
| **Eje Z** | **Manga** (Transversal) | Hacia **Babor** (Izquierda) | Hacia **Estribor** (Derecha) |

---

## Pantallas y Dispositivos

La interfaz se adapta al tamaño de la pantalla:

| Pantalla | Disposición |
| :--- | :--- |
| **Escritorio** (1280 px o más) | Paleta de figuras, visor e inspector en tres columnas. Con menos de 1536 px los paneles son más angostos y algunos botones muestran solo el ícono. |
| **Tablet y teléfono horizontal** (768 a 1279 px) | El visor ocupa todo el ancho. Una barra inferior abre los paneles como cajones laterales. |
| **Teléfono vertical** (menos de 768 px) | Barra superior en dos filas (buque/pozo y volumen/captura). Los paneles suben desde abajo y dejan ver parte del visor. |

En tablet y teléfono, la barra inferior tiene: **Figuras** (agregar), **Piezas** (lista del pozo; al tocar una se abre su edición), **Editar** (la pieza seleccionada), **Deshacer**, **Rehacer** y **Más** (modo de visualización, cotas, imán, respaldos, instalación y versión). El selector Edición / Vista previa queda sobre el visor, arriba a la izquierda.

### Uso táctil
- **Un dedo:** orbitar. **Dos dedos:** zoom y desplazamiento.
- **Tocar una pieza:** seleccionarla. Arrastrar para orbitar no cambia la selección.
- Con pantalla táctil, el gizmo de mover/rotar y los botones son más grandes.

---

## 2. Vistas de Cámara Preconfiguradas

En la barra inferior flotante del visor 3D se dispone de 4 accesos rápidos que posicionan la cámara:

1. **Centrar:** Vista isométrica elevada situada en la esquina superior **Babor-Proa** `(16, 11, -14)`, ideal para inspección general.
2. **Frente:** Se sitúa en la proa mirando hacia popa `(20, 1.5, 0)`, visualizando perpendicularmente la pared transversal del pozo (de Estribor a Babor).
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
- **Tecla `W` (o `G`):** Activar modo **Mover / Traslación** (flechas roja para X, verde para Y, azul para Z).
- **Tecla `R` (o `E`):** Activar modo **Rotar** (anillos de rotación con pasos magnéticos de 15°).
- **Espacio:** Alternar entre mover y rotar.

### Edición
- **`Ctrl+Z`:** Deshacer. **`Ctrl+Y`** o **`Ctrl+Shift+Z`:** Rehacer (`Cmd` en Mac). Todo se puede deshacer: medidas, posiciones, giros, nombres, agregar o borrar piezas. Las ediciones continuas (escribir una medida, arrastrar) cuentan como un solo paso.
- **`Supr`:** Eliminar la pieza seleccionada (pide confirmación).
- Mientras se escribe en un campo, los atajos no actúan y `Ctrl+Z` deshace dentro del campo.
- Las medidas de la pieza seleccionada también se editan desde la ventana **"Cotas del bloque seleccionado"**, sobre el visor (`Enter` o `Esc` para salir del campo).
- Los decimales se escriben con **coma** (también se acepta el punto). El punto del teclado numérico escribe la coma. Las flechas arriba y abajo suman o restan un paso.
- Un valor vacío, no numérico o por debajo del mínimo marca el campo en rojo y no se aplica; al salir del campo vuelve el último valor válido.

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
- **Modo Vista previa:** Muestra el sólido único resultante de unir y cortar todas las piezas, con sus aristas técnicas. Se calcula en segundo plano.
- **Ocultar piezas:** en "Componentes del Pozo", el ícono del ojo oculta o muestra cada pieza, y los botones "Mostrar todo" y "Ocultar todo" actúan sobre todas. Es solo visual: las piezas ocultas **siguen contando en el volumen**, no se aplica al modo Vista previa y se restablece al recargar la app.
- **Sólido / Rayos X / Alambre:** 
  - *Sólido:* Superficie opaca con sombras.
  - *Rayos X:* Malla translúcida para visualizar cavidades y rampas internas ocultas.
  - *Alambre:* Esqueleto de aristas para inspección topológica.

---

## Buques y Pozos

En la barra superior, junto a cada desplegable:

| Botón | Acción |
| :--- | :--- |
| ✎ | Editar el buque o pozo seleccionado. Desde ahí también se **elimina**. |
| + | Crear un buque o un pozo. Un buque nuevo incluye su "Pozo N° 1"; un pozo nuevo, una caja base. |
| ↺ | Reiniciar el pozo, dejándolo con una caja base (se puede deshacer). |

- **Factor de captura (t/m³):** se carga en cada buque y vale para todos sus pozos. También se abre haciendo clic en "Factor" debajo de la capacidad de captura.
- **Capacidad de captura estimada** = volumen del pozo × factor del buque.
- **Eliminar** pide confirmación, indica cuántos pozos y piezas se borran y guarda antes una copia automática (se restaura desde el menú de respaldos). El borrado no se deshace con `Ctrl+Z`.

---

## 6. Volumen Informado

La barra superior muestra el volumen del sólido que resulta de unir y cortar las piezas según su ubicación: lo que se superpone cuenta una sola vez y de cada corte se descuenta solo la parte que está dentro del pozo.

- **Sin etiqueta:** estado normal.
- **Calculando…:** el cálculo está en curso.
- **⚠ Aproximado:** el cálculo 3D falló (la causa se ve al pasar el mouse). El valor sale de sumar y restar las fórmulas de las piezas, sin considerar su ubicación: hay que revisar las piezas antes de usarlo.

---

## 7. Respaldos y Persistencia

- **Auto-guardado continuo:** Cada modificación se guarda automáticamente en un archivo SQLite dentro del navegador (OPFS), también al cerrar u ocultar la pestaña. En navegadores sin OPFS se usa un modo compatible sobre IndexedDB; el menú de respaldos indica cuál está en uso.
- **Botón "Respaldar DB":** Descarga el archivo `.sqlite` con todos los buques, pozos y piezas, para transferir la información entre computadoras o conservarla como resguardo de la marea. Se pone en ámbar si pasaron 7 días sin exportar.
- **Menú de respaldos (🕘):**
  - **Exportar / Importar .sqlite.** Al importar se valida el archivo y la base actual se guarda como copia antes de reemplazarla.
  - **Copias automáticas** guardadas en el navegador (una por día y antes de cada importación o restauración), con opción de restaurarlas.
  - Aviso si el navegador no garantiza conservar los datos.
- **Una pestaña a la vez:** si la app ya está abierta en otra pestaña, se ofrece pasar a usarla en la actual; la otra deja de guardar para no pisar los datos.

> Las copias automáticas viven en el mismo navegador. El respaldo que sobrevive a la pérdida del equipo es el archivo `.sqlite` exportado.

---

## 8. Instalación y Uso sin Conexión

- Cuando el navegador lo permite (Chrome, Edge, Android), aparece el botón **"Instalar app"** en la barra superior. Instalada, la app se abre como una aplicación más y funciona sin conexión.
- Una vez cargada, la app queda guardada en el navegador: funciona offline aunque no esté instalada.
- Instalarla también ayuda a que el navegador conserve los datos de forma persistente.

### Actualizaciones automáticas
- La app busca una versión nueva al abrirse, al volver a primer plano, al recuperar la conexión y cada 30 minutos.
- Cuando la encuentra, la aplica sola: espera a que no haya un formulario o diálogo abierto ni un campo en edición, guarda lo pendiente, muestra "Actualizando a la nueva versión…" y recarga. Si la app está en segundo plano, se actualiza en ese momento.
- La versión y la fecha de compilación se ven en el menú de respaldos (escritorio) o en "Más" (tablet y teléfono).
