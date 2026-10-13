<p align="center">
  <img src="public/logo-day.png" alt="Control Tensión Arterial" width="160" height="160" />
</p>

# Control Tensión Arterial — Cliente Android y PWA

![Android](https://img.shields.io/badge/Android-APK-3DDC84?style=flat-square&logo=android&logoColor=white)
![PWA](https://img.shields.io/badge/Web-PWA-0284c7?style=flat-square&logo=pwa&logoColor=white)
![Servidor](https://img.shields.io/badge/Conexión-Servidor%20autoalojado-2496ED?style=flat-square&logo=docker&logoColor=white)
![Idiomas](https://img.shields.io/badge/Idiomas-ES%20%7C%20EN-6366f1?style=flat-square)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue?style=flat-square)

Cliente Android y PWA para utilizar desde un teléfono o una tableta una instalación de [Control Tensión Arterial autoalojada](https://github.com/el-rocho/cta-elrocho-selfhosted).

Permite configurar la dirección del servidor y ofrece la experiencia completa de registro, análisis, copias e informes. Esta edición no almacena una base de datos independiente: trabaja con la cuenta y los datos del servidor.

> [!NOTE]
> Necesitas una instalación operativa de `cta-elrocho-selfhosted`. Si buscas una aplicación sin servidor, utiliza la edición individual offline.

---

## Ecosistema: elige la edición adecuada

| Edición | Cuándo elegirla | Repositorio |
| :--- | :--- | :--- |
| **Individual offline** | Una persona, un dispositivo y funcionamiento sin servidor ni conexión. | [cta-elrocho](https://github.com/el-rocho/cta-elrocho) |
| **Servidor autoalojado** | Varios usuarios, datos centralizados y administración familiar en un servidor o NAS. | [cta-elrocho-selfhosted](https://github.com/el-rocho/cta-elrocho-selfhosted) |
| **Cliente para servidor** *(esta edición)* | Acceso desde Android o PWA a una instalación autoalojada existente. | [cta-elrocho-client-app](https://github.com/el-rocho/cta-elrocho-client-app) |

---

## Funciones principales

- Configuración y comprobación de la URL del servidor.
- Inicio de sesión multiusuario y autenticación 2FA TOTP.
- Sesión persistente mediante la cabecera `X-Session-Token`.
- Registro de presión sistólica, presión diastólica, pulso, brazo y notas.
- Referencias configurables: `ESC 2024`, `AHA/ACC 2025` e `ISH 2020`.
- Objetivos terapéuticos orientativos y editables según la indicación profesional.
- Historial, estadísticas y gráficas de evolución de hasta un año.
- Filtro opcional de acomodación para agrupar tomas consecutivas y obtener un resultado efectivo por sesión.
- Informes PDF y CSV, copias completas e importación de datos de MyTherapy.
- Guardado y uso compartido nativo de archivos en Android.
- Interfaz en español e inglés, con temas claro y oscuro.
- Panel de estado y diagnóstico para administradores.

Las reglas clínicas y el funcionamiento del filtro se describen en la [matriz clínica](docs/reglas-clinicas-v1.6.0.md).

> [!IMPORTANT]
> Las clasificaciones y objetivos son informativos. La aplicación no sustituye el diagnóstico ni las indicaciones de un profesional sanitario.

---

## Instalación y actualizaciones

Las compilaciones oficiales se generan mediante GitHub Actions.

### Obtainium — recomendado en Android

Añade en [Obtainium](https://github.com/ImranR98/Obtainium) la dirección del repositorio:

```text
https://github.com/el-rocho/cta-elrocho-client-app
```

<p align="center">
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://github.com/el-rocho/cta-elrocho-client-app" alt="Código QR de cta-elrocho-client-app para Obtainium" width="160" height="160" />
</p>

### APK

1. Abre [GitHub Releases](https://github.com/el-rocho/cta-elrocho-client-app/releases).
2. Descarga `control-tension-client-app.apk`.
3. Instala el archivo en el dispositivo Android.

Antes de actualizar, consulta [UPGRADING.md](UPGRADING.md) y las notas de la versión. Mantén cliente y servidor en versiones compatibles.

### PWA

La PWA puede instalarse desde el navegador y conectarse a servidores publicados mediante HTTPS con un certificado válido.

> [!WARNING]
> La PWA oficial se sirve mediante HTTPS. Los navegadores bloquean su conexión a servidores locales `http://` por contenido mixto. Para un servidor HTTP de la red local, utiliza el APK Android.

---

## Conexión con el servidor

1. Inicia `cta-elrocho-selfhosted`.
2. Abre **Control Tensión Arterial — Cliente**.
3. Introduce la URL completa, por ejemplo `http://192.168.1.50:3000`.
4. Pulsa **Probar y conectar** e inicia sesión.

El APK y la PWA oficial ya están admitidos por el servidor. Si publicas una copia del cliente en otro dominio o puerto, añade su origen —sin barra final— a `CORS_ORIGINS` y reinicia el servidor:

```yaml
environment:
  - CORS_ORIGINS=https://mi-pwa.midominio.com
```

---

## Datos y copias

Las mediciones, preferencias y copias pertenecen a la cuenta del servidor. Desde el cliente puedes:

- generar informes PDF y CSV;
- crear y restaurar copias completas;
- importar archivos compatibles y datos de MyTherapy;
- compartir archivos mediante las funciones nativas de Android.

Para una copia integral de toda la instalación, respalda también el directorio `data` del servidor con el servicio detenido.

---

## Desarrollo local

```bash
npm install
npm run dev
npm run build
npx cap sync android
npx cap open android
```

---

## Licencia

Distribuido bajo la Licencia MIT.