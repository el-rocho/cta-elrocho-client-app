<p align="center">
  <img src="public/logo-day.png" alt="Logo Control Tensión Arterial Client App" width="160" height="160" />
</p>

# Control Tensión Arterial (Cliente Móvil Android & PWA) 🩺📱

![Built with Vibe Coding](https://img.shields.io/badge/Built%20with-Vibe%20Coding%20%26%20AI-7c3aed?style=for-the-badge&logo=sparkles)
![Android APK](https://img.shields.io/badge/Android-APK%20Nativa%20v1.6.0--beta.1-3DDC84?style=for-the-badge&logo=android)
![PWA Ready](https://img.shields.io/badge/Web-PWA%20Instalable-0284c7?style=for-the-badge&logo=pwa)
![Obtainium Compatible](https://img.shields.io/badge/Obtainium-Releases%20v1.6.0--beta.1-2563eb?style=for-the-badge&logo=github)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue?style=for-the-badge)

Aplicación móvil nativa Android (APK) y PWA web diseñada como cliente dedicado para conectar con el servidor autoalojado [**Control Tensión Arterial (cta-elrocho-selfhosted)**](https://github.com/el-rocho/cta-elrocho-selfhosted).

Proporciona la misma experiencia cuidada, bilingüe y completa del panel web autoalojado directamente desde tu teléfono móvil o tablet, con selector dinámico de IP y soporte nativo para exportar e imprimir informes PDF/CSV en Android.

> ✨ **Metodología de Desarrollo**: Este proyecto ha sido conceptualizado, diseñado y guiado mediante **Vibe Coding**, utilizando asistencia avanzada de Inteligencia Artificial para la generación de código y arquitectura.

---

## 💡 Ecosistema de Aplicaciones: ¿Qué versión elegir?

El proyecto **Control Tensión Arterial** dispone de tres aplicaciones complementarias adaptadas a cada necesidad:

| Aplicación | Repositorio GitHub | Descripción y Uso |
| :--- | :--- | :--- |
| 📱 **Versión Individual Móvil (Offline)** | [**cta-elrocho**](https://github.com/el-rocho/cta-elrocho) | Ideal para uso personal en un único teléfono. Funciona **100% offline**, sin cuentas, sin servidor y guardando todos los datos en el almacenamiento interno privado del dispositivo. |
| 🐳 **Servidor Autoalojado (Docker)** | [**cta-elrocho-selfhosted**](https://github.com/el-rocho/cta-elrocho-selfhosted) | Ideal si deseas desplegar la app en tu servidor privado o NAS para gestionar **varios perfiles familiares (~10 usuarios)** con base de datos SQLite y **2FA TOTP**. |
| 🚀 **Cliente Servidor (Android & PWA)** | **[cta-elrocho-client-app](https://github.com/el-rocho/cta-elrocho-client-app)** *(Este repo)* | App cliente para conectar al servidor autoalojado introduciendo la IP (`http://192.168.1.x:3000`), con interfaz nativa Android y exportación PDF/CSV. |

---

## ⚡ Características Principales

- **Conexión Dinámica a Servidor**: Configura y prueba fácilmente la dirección IP o URL de tu servidor autoalojado (ej. `http://192.168.1.50:3000` o `https://salud.mi-casa.local`).
- **Autenticación Completa & 2FA TOTP**: Inicio de sesión multiusuario, creación de cuenta de administrador y validación de 2 factores (Google Authenticator, Aegis, Authy, etc.).
- **Persistencia de Sesión Segura**: Envío automático de cabecera `X-Session-Token` para evitar cierres de sesión involuntarios en dispositivos móviles.
- **Exportación e Informes Nativa Android**: Genera informes PDF con gráficos vectoriales y copias CSV guardándolos directamente en los documentos del teléfono mediante `@capacitor/filesystem` y compartiéndolos con `@capacitor/share`.
- **Filtro de Síndrome de Bata Blanca**: Algoritmo inteligente que descarta tomas iniciales elevadas provocadas por la ansiedad del manguito.
- **Gráficos de Tendencias**: Evolución temporal de tensión sistólica, diastólica y pulso.
- **Soporte Bilingüe y Modo Oscuro**: Interfaz en 🇪🇸 Español y 🇬🇧 Inglés, adaptable a modo oscuro y claro.

---

## 📲 Instalación y Actualizaciones (Obtainium, APK y PWA)

Las compilaciones oficiales del APK y el despliegue de la PWA se generan automáticamente mediante **GitHub Actions**.

### 1. 📱 Instalación con Obtainium (recomendada en Android)

La app es 100% compatible con **[Obtainium](https://github.com/ImranR98/Obtainium)**. Escanea este código QR desde Obtainium en tu teléfono Android o añade manualmente la URL del repositorio (`https://github.com/el-rocho/cta-elrocho-client-app`):

<p align="center">
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://github.com/el-rocho/cta-elrocho-client-app" alt="Código QR para Obtainium - cta-elrocho-client-app" width="160" height="160" />
  <br />
  <sub><b>Escanea desde Obtainium para instalar y recibir actualizaciones</b></sub>
</p>

### 2. 📥 Descarga manual del APK (GitHub Releases)

1. Accede a **[Releases del Repositorio](https://github.com/el-rocho/cta-elrocho-client-app/releases)**.
2. Descarga el archivo `control-tension-client-app.apk`.
3. Instala el APK en tu dispositivo Android.

### 3. 🌐 Uso como PWA (navegador web / pantalla de inicio)

- También puedes acceder a la versión PWA a través de GitHub Pages e instalarla en la pantalla de inicio de tu navegador iOS/Android.

> [!IMPORTANT]
> **Limitación al conectar con servidores HTTP locales:** la PWA alojada en GitHub Pages utiliza HTTPS. Por seguridad, los navegadores bloquean las conexiones desde una página HTTPS hacia un servidor local HTTP por considerarlas contenido mixto.
>
> Para conectarte a un servidor HTTP de tu red local, utiliza la aplicación Android (APK). La PWA podrá conectarse solamente si el servidor está disponible mediante HTTPS con un certificado válido. Abrir o autorizar manualmente la dirección HTTP en otra pestaña del navegador no elimina esta restricción.

---

## 🚀 Conexión con el Servidor Autoalojado

1. Asegúrate de tener en ejecución el servidor [**cta-elrocho-selfhosted**](https://github.com/el-rocho/cta-elrocho-selfhosted) en tu red local o servidor (ej. puerto 3000).
2. Abre la aplicación **Control Tensión Server**.
3. En la pantalla inicial de configuración, introduce la dirección de tu servidor (ejemplo: `http://192.168.1.100:3000`).
4. Pulsa **Probar y Conectar**. La dirección se guardará de forma permanente y la app se conectará al instante.

> Si utilizas una dirección `http://` local, realiza la conexión desde el APK Android. Para usar la PWA de GitHub Pages, configura el servidor con HTTPS y un certificado válido.

---

## 🛠️ Desarrollo Local y Compilación

```bash
# 1. Clonar el repositorio e instalar dependencias
git clone https://github.com/el-rocho/cta-elrocho-client-app.git
cd cta-elrocho-client-app
npm install

# 2. Iniciar servidor de desarrollo web
npm run dev

# 3. Compilar proyecto web y sincronizar con Android nativo (Capacitor)
npm run build
npx cap sync android

# 4. Abrir en Android Studio para compilar APK manualmente
npx cap open android
```

---

## 📜 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más información.
