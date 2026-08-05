# Guía de actualización

Esta guía describe el procedimiento general para actualizar el cliente Android o PWA del servidor autoalojado. Las migraciones de datos se realizan en el servidor, no en este cliente.

## Qué guarda el cliente

Las cuentas, mediciones, ajustes clínicos y notas se almacenan en la base SQLite del servidor. El cliente conserva localmente:

- Dirección del servidor.
- Token de sesión.
- Caché temporal de mediciones y configuración.

Desinstalar el cliente no borra SQLite, pero elimina esos datos locales y puede obligar a configurar de nuevo la dirección e iniciar sesión.

## Antes de actualizar

1. Consulta la guía de actualización de la versión correspondiente del servidor.
2. Haz una copia de su directorio persistente `data`.
3. Lee las notas de la versión del cliente:
   - [Actualización a 1.6.1-beta.1](docs/actualizaciones/v1.6.1-beta.1.md)
   - [Actualización a 1.6.0](docs/actualizaciones/v1.6.0.md)
   - [Versiones publicadas en GitHub](https://github.com/el-rocho/cta-elrocho-client-app/releases)

## Orden recomendado

1. Actualiza el servidor autoalojado.
2. Comprueba desde el navegador que inicia correctamente y muestra el historial.
3. Instala el nuevo APK cliente encima del anterior mediante Obtainium o GitHub Releases.
4. Comprueba la dirección del servidor, la sesión y las mediciones.

El servidor y el cliente deben mantenerse en versiones compatibles. No utilices de forma permanente un cliente nuevo con un servidor antiguo: las nuevas rutas, campos o validaciones pueden no estar disponibles.

## PWA

La PWA guarda la dirección, sesión y caché en el navegador. No borres los datos del sitio durante una actualización. Las mediciones seguirán protegidas en el servidor aunque sea necesario configurar de nuevo el cliente.

## Volver a una versión anterior

Android normalmente impide instalar un APK con un código de versión inferior sobre uno más reciente. Desinstalar el cliente permite instalarlo de nuevo, pero elimina su configuración y sesión locales.

Un cambio de versión del cliente no revierte la base SQLite. Si el problema afecta al servidor o a una migración, sigue el procedimiento de recuperación del repositorio `cta-elrocho-selfhosted`.
