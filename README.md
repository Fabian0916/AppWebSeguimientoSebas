# Seguimiento de L

App web para celular: tomas (fórmula y materna), pañales, peso, talla, perímetro cefálico, saturación y oxígeno, reflujo y estridor, sueño, temperatura, medicamentos y suplementos, con fotos en cada registro, gráficas por rango de fechas, reporte imprimible y un enlace de solo lectura para la doctora.

Sitio estático (HTML, CSS y JavaScript). No necesita compilar nada. Los datos y las fotos se guardan en Supabase (gratis).

## Probar sin configurar nada (modo demo)

Abre `index.html` con cualquier servidor local, por ejemplo `python3 -m http.server 8000` y entra a `http://localhost:8000`. Con `config.js` vacío, la app guarda en ese navegador y muestra la etiqueta "Modo demo".

## Puesta en marcha (unos 20 minutos)

### 1. Supabase (donde viven los datos)
1. Crea una cuenta en https://supabase.com y un proyecto nuevo (elige la región más cercana).
2. Menú **SQL Editor** > **New query**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**.
3. Menú **Authentication** > **Users** > **Add user** > crea dos usuarios con correo y contraseña (tú y tu esposa), marcando "Auto confirm user".
4. Menú **Authentication** > **Sign In / Providers** > Email: desactiva **Allow new users to sign up**. Así nadie más puede crear cuenta.
5. Menú **Project Settings** > **API Keys**: copia el **Project URL** y la clave pública. Puede llamarse **Publishable key** (`sb_publishable_…`) o **anon public** (empieza por `eyJ`). Cualquiera de las dos sirve. **Nunca** uses la `secret` ni la `service_role`.

### 2. Configurar la app
Abre `config.js` y pega los dos valores:

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",
```

La clave `anon` es pública por diseño. La protección está en las reglas del esquema: sin iniciar sesión nadie puede leer ni escribir.

### 3. GitHub
1. Crea un repositorio nuevo en GitHub. Mejor **privado**.
2. Sube todos los archivos de esta carpeta.

### 4. Vercel
1. En https://vercel.com entra con GitHub y elige **Add New > Project** con ese repositorio.
2. No cambies nada: **Framework Preset: Other**, sin comando de build. Pulsa **Deploy**.
3. Vercel te da una dirección como `https://seguimiento-l.vercel.app`. Ábrela en el celular y usa **Agregar a pantalla de inicio**.

## Lista de verificación después de publicar
1. Abre la dirección de Vercel: debe pedir correo y contraseña, y **no** debe decir "Modo demo".
2. Entra, pulsa **+**, registra una toma con una foto y guarda. Debe aparecer en la línea del día.
3. Abre la app en el celular de tu esposa con su usuario: debe ver el mismo registro.
4. En **Reporte**, crea un enlace para la doctora, ábrelo en una ventana privada: debe verse todo sin pedir contraseña y sin botón **+**.
5. Desactiva ese enlace y recarga la ventana privada: debe decir que no hay registros.
6. Pulsa **Descargar copia (CSV)** y comprueba que abre en Excel.

## Si algo falla
- **"Correo o contraseña incorrectos"**: revisa que el usuario esté creado en Authentication y marcado como confirmado.
- **Dice "Modo demo"**: `config.js` está vacío o no se subió a GitHub con los valores.
- **"No se pudo guardar"**: ejecuta de nuevo `supabase/schema.sql` completo y recarga la página.
- **La foto no sube**: revisa en Supabase > Storage que exista el depósito `fotos`.
- **Proyecto pausado por inactividad**: entra al panel de Supabase y pulsa **Restore**.

## Uso diario
- **Día**: botón **+** para registrar. Cada registro tiene hora, observaciones y botón **Tomar foto**. Toca un registro para editarlo o eliminarlo.
- **Gráficas** y **Reporte**: filtros 7, 14, 30 días, todo o fechas a elección. El botón **PDF** abre la impresión del celular: elige "Guardar como PDF".
- **Enlace para la doctora** (al final del Reporte): escribe un nombre y pulsa **Crear**. Copia el enlace y envíaselo. Ella no necesita cuenta, ve todo en solo lectura y elige las fechas. Puedes **Desactivar** o **Borrar** el enlace cuando quieras.

## Privacidad
- Los datos solo se leen con sesión iniciada o con un enlace de doctora activo, que contiene una clave larga imposible de adivinar.
- Las fotos se guardan en un depósito público con nombres aleatorios, para que la doctora pueda verlas. Solo las ve quien tenga la dirección exacta de la foto. Si prefieres que no se compartan fotos, no las agregues a los registros.
- La página lleva `noindex`, así que los buscadores no la listan.
- Mantén el repositorio de GitHub privado y no compartas las contraseñas.

## Estructura
- `index.html`, `style.css`, `app.js`: la interfaz.
- `db.js`: conexión con Supabase (o modo demo).
- `config.js`: tus datos de Supabase y el nombre del bebé.
- `supabase/schema.sql`: tablas, seguridad y almacenamiento de fotos.
- `vendor/`: librerías incluidas (Chart.js y supabase-js), para que funcione sin depender de internet externo.
