# 03. Catálogo Geométrico Naval (10 Figuras)

El módulo `src/services/geometryCatalog.js` define las 10 figuras canónicas de la ficha técnica naval pesquera. Para cada figura se implementa:
1. **Fórmula Analítica:** Para cálculo paramétrico nominal.
2. **Generador de Malla 3D:** Creación procedural de `BufferGeometry` con normales exteriores y topología cerrada (*manifold/watertight*).
3. **Desglose Explicativo:** Generación del texto matemático paso a paso visible en la interfaz.
4. **Diagrama SVG Vectorial:** Gráfico esquemático con las cotas ($L, W, H, A, B, D$).

---

## 1. Tabla Resumen de Figuras Navales

| N° | Identificador | Nombre en Catálogo | Categoría | Fórmula Analítica |
| :---: | :--- | :--- | :--- | :--- |
| **1** | `caja` | Caja (Prisma Rectangular) | Básicos | $V = H \times L \times W$ |
| **2** | `cuna_irregular` | Cuña Irregular (Forma Pozo) | Pozos y Rampas | $V = \frac{H \times L \times (A + 2B)}{6}$ |
| **3** | `cuna_regular` | Cuña Regular (Rampa) | Básicos | $V = \frac{1}{2} \times H \times L \times W$ |
| **4** | `trapezoide` | Trapezoide (Prisma Trapezoidal) | Pozos y Rampas | $V = \frac{A + B}{2} \times H \times L$ |
| **5** | `trapezoide_conico_1` | Trapezoide Cónico (1) | Pozos y Rampas | $V = \frac{1}{4} \times (A + B + C + D) \times H \times L$ |
| **6** | `trapezoide_conico_2` | Trapezoide Cónico (2) | Pozos y Rampas | $V = \frac{1}{4} \times (A + B + C) \times H \times L$ |
| **7** | `cilindro` | Cilindro (Columna / Tubería) | Conductos y Columnas | $V = \pi \times \left(\frac{D}{2}\right)^2 \times H$ |
| **8** | `tronco_cono` | Tronco de Cono | Conductos y Columnas | $V = \frac{\pi \times H}{12} \times (D^2 + D \cdot d + d^2)$ |
| **9** | `elipsoide` | Cilindro Elíptico (Bolsa de Red) | Especiales | $V = \frac{\pi}{4} \times W \times H \times L$ |
| **10** | `piramidal` | Piramidal | Básicos | $V = \frac{1}{6} \times H \times L \times W$ |

---

### Revisión contra la ficha técnica
Las fórmulas se validaron contra la ficha técnica original y su versión redibujada (*Cálculo del volumen de captura: bolsa de la red y pozo*). Las diez son exactas para las figuras que dibuja la ficha.

- **Trapezoide cónico (1):** es un pozo de sección trapezoidal de altura $H$ que cambia linealmente de un extremo al otro (A arriba y B abajo en el extremo 1; C arriba y D abajo en el extremo 2). Como el área de la sección varía en forma lineal, el promedio de las secciones extremas es exacto: $V = L \cdot \frac{H(A+B)/2 + H(C+D)/2}{2}$.
- **Trapezoide cónico (2):** es el caso $D = 0$: el piso converge en un punto en el extremo 2.
- **"Elipsoide" (bolsa de red):** la ficha original lo dibuja como un **cilindro de sección elíptica** (largo $L$, sección $W \times H$), y su fórmula $0.78545 \cdot WHL = \frac{\pi}{4} WHL$ es exacta para esa forma. En la aplicación se llama *Cilindro Elíptico* para no confundirlo con un elipsoide real ($\frac{\pi}{6} LWH$, un 33 % menos); el id `elipsoide` se conserva por compatibilidad con las bases guardadas.
- **H es la altura vertical**, perpendicular a A y B, como indica la ficha original. Medida sobre una cara inclinada, el volumen quedaría sobrestimado.
- La ficha toma $\pi \approx 3{,}1418$ (el valor correcto es 3,14159); de ahí sale 0,78545 en lugar de 0,785398. La diferencia es de 0,007 % y la aplicación usa $\pi$ exacto.
- El ejemplo de la cuña irregular (A = 23,50; B = 13,50; L = 45,00; H = 13,00 → 4.923,75 m³) es correcto.

### Convenciones de las mallas
- El **largo** corre sobre el eje X (eslora).
- La **cuña regular** se agrega girada 180° en planta, con el borde fino hacia proa (+X).
- La base apoya en $y = 0$: `pos_y` es la cota del piso de la pieza.
- Cilindros, troncos de cono y el cilindro elíptico usan 32 segmentos, con los radios ajustados para que el polígono conserve el área del círculo o de la elipse, y por lo tanto el volumen.

`npm test` compara cada fórmula con el volumen de su malla.

---

> **Vértice de la piramidal:** puede desplazarse en paralelo a la base (`desvio_largo`, `desvio_ancho`) sin cambiar la fórmula, porque su distancia a la base no varía (principio de Cavalieri).

## 2. Requisitos de Construcción de Mallas para CSG

Para que un motor booleano funcione de manera sólida y no genere agujeros ni inversiones de fase, cada malla debe cumplir estrictamente dos condiciones topológicas:

### A. Orientación de Normales (*Winding Order* Exterior)
Los vértices de cada triángulo deben listarse en sentido antihorario (*counter-clockwise*) visto desde el exterior del sólido. Si las normales apuntan hacia adentro, el motor CSG interpreta el interior como exterior, restando cuando debería sumar o destripando la figura.

Durante el desarrollo se detectó que figuras como `cuna_regular`, `cuna_irregular` y `piramidal` tenían triángulos con normales invertidas (dando volúmenes negativos por el teorema de Gauss). Se reordenaron los índices para asegurar que todos los vectores normales apunten hacia afuera.

### B. Mallas Cerradas (*Watertight / Manifold 2-Manifold*)
Cada arista de la geometría debe estar compartida por exactamente dos triángulos vecinos. No pueden existir bordes abiertos ni caras desconectadas. Para figuras como cuñas y piramidales se generan manualmente todas las caras perimetrales (base inferior, cara vertical posterior, laterales y rampa inclinada).
