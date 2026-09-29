# Herramientas

Scripts de mantenimiento de los datos de YourLift. No los usa el sitio: se corren a
mano cuando hay que regenerar o corregir un archivo de datos.

**Se corren siempre desde la raíz del repositorio**, porque leen y escriben los
archivos de datos que están ahí:

```
python3 herramientas/build_nacimientos.py
```

| Script | Qué hace |
|---|---|
| `build_nacimientos.py` | Arma `nacimientos.js` (año de nacimiento por nombre, para la división por edad del ranking). |
| `build_records_suda.py` | Arma `records_suda.json` desde la planilla oficial de FESUPO. |
| `build_records_mundiales.py` | Arma `records_mundiales.json` desde los PDF de récords de goodlift.info. |
| `comparar_records_suda.py` | Compara la tabla de récords sudamericanos con una publicación nueva. |
| `leer_nomina_fesupo.py`, `leer_goodlift_pdf.py` | Leen las nóminas oficiales del Sudamericano. |
| `aplicar_nomina_oficial.py`, `aplicar_correcciones_suda.py`, `build_suda_dias.py`, `revisar_nomina_pais.py`, `verificar_goodlift.py` | Arman y revisan `nomina_sudamericano.json`. |
| `agregar_competencias_openipf.py`, `reconstruir_desde_acta.py`, `corregir_gl_data.py`, `alinear_con_storage.py` | Mantención de `data.json` (historial de atletas). |
| `exportar_powerbi.py` | Exporta CSV para Power BI (a `powerbi/`, que no va al repo). |
| `fix_regional_centro_sur.js`, `limpiar_regional_centro_sur.js` | Arreglos puntuales ya aplicados; quedan como referencia. |

`fuentes/` guarda los archivos originales de los que salen algunos datos (nómina
oficial en Excel, PDF de goodlift.info).
