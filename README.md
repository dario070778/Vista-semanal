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
