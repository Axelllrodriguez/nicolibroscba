# Nico Libros

Tienda online de libros nuevos en Córdoba Capital, con catálogo, pedidos por WhatsApp y panel de administración.

## Configuración

La tienda usa PostgreSQL. Configurá estas variables como secretos del entorno donde la ejecutes:

- `DATABASE_URL`: cadena de conexión a PostgreSQL.
- `ADMIN_EMAIL`: correo del administrador.
- `ADMIN_PASSWORD_HASH`: hash bcrypt de la contraseña inicial (no cargues la contraseña en texto plano).
- `SESSION_SECRET`: secreto aleatorio de al menos 32 caracteres para firmar la sesión.

Generá un secreto con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Para generar un hash bcrypt localmente: `node -e "require('bcryptjs').hash(process.argv[1], 12).then(console.log)" "TU_CONTRASEÑA"`. Elegí una contraseña nueva, fuerte y exclusiva para producción; no compartas ni subas los valores generados.

El sitio inicia con catálogo de demostración. Los registros demo están marcados en el panel y se pueden archivar al reemplazarlos por los datos reales.

## Panel administrativo

Ingresá en `/admin`. El acceso está limitado al único correo configurado en `ADMIN_EMAIL`, junto con su contraseña bcrypt y `SESSION_SECRET`; no hay registro público de administradores.

Antes de iniciar la API con el esquema actualizado, aplicá los cambios de base de datos con `pnpm --filter @workspace/db push` usando `DATABASE_URL`. Esto agrega la sinopsis, las compras de inventario y los gastos operativos.

Para probar el panel localmente, iniciá la API en el puerto `3000` con `DATABASE_URL`, `PORT=3000`, `HOST=127.0.0.1`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` y `SESSION_SECRET`; después iniciá la tienda con `pnpm --filter @workspace/nico-libros dev`. Ambos servidores quedan limitados al equipo local. Vite reenvía `/api` a `http://127.0.0.1:3000`; podés cambiar el destino con `API_PROXY_TARGET`.

Desde **Libros** se puede editar el stock manualmente, pegar enlaces de portada/video o subirlos desde el celular o la computadora. Se aceptan imágenes JPG, PNG, WebP y GIF (hasta 10 MB) y videos MP4, WebM y MOV (hasta 50 MB). En desarrollo local los archivos se guardan en `artifacts/api-server/uploads`. En Vercel, el navegador los sube directamente a Vercel Blob; el servidor solo genera el permiso temporal después de comprobar la sesión de administrador.

## Despliegue en Vercel

El proyecto incluye una función Node para la API en `api/[...path].ts`. Vercel usa el `buildCommand`, el directorio de salida y las rutas de `/admin` configuradas en `vercel.json`; importá el repositorio con la raíz del proyecto como **Root Directory**.

Antes del primer despliegue:

1. Provisioná una base PostgreSQL alojada y configurá `DATABASE_URL` en los entornos de Vercel que vayas a usar.
2. Aplicá el esquema contra esa base con `pnpm --filter @workspace/db push`. La API crea los datos iniciales de forma segura al recibir la primera solicitud.
3. Configurá `ADMIN_EMAIL`, un nuevo `ADMIN_PASSWORD_HASH` y un `SESSION_SECRET` aleatorio de al menos 32 caracteres. No uses contraseñas compartidas anteriormente.
4. Creá un almacén **público** de Vercel Blob, conectalo al proyecto y agregá `BLOB_READ_WRITE_TOKEN` como variable de entorno. Este token solo se usa en el servidor; nunca lo incluyas en el frontend ni en Git.
5. Volvé a desplegar después de guardar las variables.

Los archivos `.env` y sus variantes están excluidos de Git. No subas secretos, bases locales ni archivos dentro de `uploads`.

Para que las compras y sus costos queden en las finanzas, usá **Registrar compra**: suma las unidades al stock y guarda el costo unitario, proveedor y fecha. Al confirmar un pedido se descuenta el stock; al cancelar un pedido confirmado se reintegra. El libro queda automáticamente sin stock cuando llega a cero.

La sección **Compras y finanzas** permite consultar ventas por día, semana, mes, año o fechas personalizadas, comparar ingresos con egresos en gráficos, ver el rendimiento de libros y categorías, registrar gastos operativos y revisar compras a proveedores. El margen bruto descuenta el costo de los libros vendidos; el flujo de caja estimado descuenta de los ingresos las compras de inventario y los gastos operativos registrados. Ninguna métrica incluye impuestos, comisiones ni gastos que no se carguen en el panel. Las portadas y videos se pueden ingresar mediante URL o subir desde un dispositivo.
