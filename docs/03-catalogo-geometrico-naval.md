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
| **3** | `cuna_regular` | Cuña Regular (Rampa) | Pozos y Rampas | $V = \frac{1}{2} \times H \times L \times W$ |
| **4** | `trapezoide` | Trapezoide (Prisma Trapezoidal) | Pozos y Rampas | $V = \frac{A + B}{2} \times H \times L$ |
| **5** | `trapezoide_conico_1` | Trapezoide Cónico (1) | Pozos y Rampas | $V = \frac{L \times H \times (A + B)}{4}$ |
| **6** | `trapezoide_conico_2` | Trapezoide Cónico (2) | Pozos y Rampas | $V = \frac{L \times H \times (A + B)}{4}$ |
| **7** | `cilindro` | Cilindro (Columna / Tubería) | Conductos y Columnas | $V = \pi \times \left(\frac{D}{2}\right)^2 \times H$ |
| **8** | `cilindro_conico` | Tronco de Cono | Conductos y Columnas | $V = \frac{\pi \times H}{12} \times (D^2 + D \cdot d + d^2)$ |
| **9** | `elipsoide` | Elipsoide (Bolsa de Red) | Especiales | $V = \frac{4}{3} \times \pi \times \frac{L}{2} \times \frac{W}{2} \times \frac{H}{2}$ |
| **10** | `piramidal` | Piramidal / Cuña Esquinera | Especiales | $V = \frac{1}{6} \times H \times L \times W$ |

---

## 2. Requisitos de Construcción de Mallas para CSG

Para que un motor booleano funcione de manera sólida y no genere agujeros ni inversiones de fase, cada malla debe cumplir estrictamente dos condiciones topológicas:

### A. Orientación de Normales (*Winding Order* Exterior)
Los vértices de cada triángulo deben listarse en sentido antihorario (*counter-clockwise*) visto desde el exterior del sólido. Si las normales apuntan hacia adentro, el motor CSG interpreta el interior como exterior, restando cuando debería sumar o destripando la figura.

Durante el desarrollo se detectó que figuras como `cuna_regular`, `cuna_irregular` y `piramidal` tenían triángulos con normales invertidas (dando volúmenes negativos por el teorema de Gauss). Se reordenaron los índices para asegurar que todos los vectores normales apunten hacia afuera.

### B. Mallas Cerradas (*Watertight / Manifold 2-Manifold*)
Cada arista de la geometría debe estar compartida por exactamente dos triángulos vecinos. No pueden existir bordes abiertos ni caras desconectadas. Para figuras como cuñas y piramidales se generan manualmente todas las caras perimetrales (base inferior, cara vertical posterior, laterales y rampa inclinada).
