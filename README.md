# RecuerdaMed

Aplicación móvil multiplataforma para mejorar la adherencia terapéutica en personas mayores y polimedicadas, con notificación a cuidadores y familiares autorizados.

Trabajo Fin de Grado — Grado en Ingeniería Informática (Ingeniería del Software), ETSII, Universidad de Sevilla.

## Stack tecnológico

- **Frontend**: React Native 0.81.5 + Expo ~54.0.33 + TypeScript ~5.9.2
- **Backend**: Firebase 12.4.0 (Auth, Firestore, Storage)
- **Notificaciones**: expo-notifications (locales) + Expo Push Service (remotas)
- **Despliegue**: Expo Go (móvil) + Vercel (web)

## Requisitos previos

- Node.js 20+
- npm
- Expo Go (para pruebas en dispositivo móvil)

## Instalación

1. Clonar el repositorio e instalar dependencias:

   ```bash
   git clone https://github.com/JoaquinBorjaLeon/app-RecuerdaMed.git
   cd app-RecuerdaMed
   npm install
   ```

2. Iniciar la aplicación:

   ```bash
   npx expo start
   ```

3. Escanear el código QR con Expo Go (móvil) o pulsar `w` para abrir en navegador.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npx expo start` | Inicia el servidor de desarrollo |
| `npm run lint` | Ejecuta ESLint |
| `npm run typecheck` | Verificación de tipos TypeScript |
| `npm run test` | Ejecuta los 18 tests unitarios (Jest) |

## Estructura del proyecto

```
├── app/                # Pantallas (Expo Router, enrutamiento por ficheros)
│   ├── care/           # Flujos del cuidador
│   ├── family/         # Flujos del familiar
│   └── meds/           # CRUD medicaciones y planificaciones
├── src/
│   ├── api/            # Capa de negocio (un módulo por entidad)
│   ├── components/     # Componentes reutilizables
│   ├── lib/            # Configuración Firebase y utilidades
│   ├── theme/          # Paleta de colores (light/dark)
│   ├── types.ts        # Interfaces TypeScript compartidas
│   └── utils/          # Funciones puras + tests unitarios
├── firestore.rules     # Reglas de seguridad de Firestore
├── storage.rules       # Reglas de seguridad de Storage
└── firestore.indexes.json  # 11 índices compuestos
```

## Características principales

- **Tres roles diferenciados**: Paciente, Cuidador y Familiar con permisos específicos
- **Planificación flexible**: patrones diario, días de la semana y cada X horas
- **Ventanas de tolerancia**: confirmación dentro de un margen configurable
- **Notificaciones automáticas**: locales (recordatorio, aviso, expiración) y push remotas a vinculados
- **Vinculación con consentimiento**: invitaciones revocables entre paciente y cuidadores/familiares
- **Historial de adherencia**: trazabilidad completa de tomas confirmadas y expiradas

## Autor

Joaquín Borja León
