# Vista semanal 4.1

- Los registros manuales de varias horas repiten ahora el texto en cada celda horaria ocupada.
- Mantiene los rellenos parciales de 15/30/45 minutos y el resto del comportamiento de la 4.0.


## Versión 4.2
- La parte ya transcurrida de un evento en la hora actual se oculta en tiempo real; al llegar a su hora de fin desaparece completamente.
- Se mantiene la sincronización con Supabase.

## Versión 4.3
- Los eventos planificados no se eliminan automáticamente al terminar una ocurrencia.
- Las ocurrencias pasadas simplemente dejan de mostrarse.
- La sincronización con Supabase evita que una copia antigua sobrescriba una edición más reciente.
- Se mantiene el consumo visual en cuartos de hora de la versión 4.2.

## Versión 4.4
- Las ediciones y eliminaciones de eventos planificados se confirman inmediatamente en Supabase antes de cerrar el editor.
- Se evita que una lectura remota anterior revierta un cambio recién guardado.
- Se mantienen el consumo visual continuo y las correcciones de recurrencia de la 4.3.

## Versión 4.5
- Al cambiar la fecha de inicio de un evento recurrente, la edición pasa automáticamente a "Toda la serie".
- Si cambia la estructura de la recurrencia (fecha, días, final u horario), se eliminan excepciones antiguas que podían ocultar lunes o martes futuros.
- Se mantienen Supabase, la persistencia de eventos y el consumo visual continuo.

## Versión 4.6
- Los eventos recurrentes se evalúan por la fecha real de cada columna fija L-M-X-J-V-S-D.
- Corrige la proyección en la semana especial donde, por ejemplo, L17 y M18 aparecen visualmente antes que X12 y J13.
- Se mantienen Supabase, la edición confirmada en nube y el consumo visual continuo.
