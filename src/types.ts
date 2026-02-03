export type Patient = {
  id: string;                 // uid del usuario
  fullName?: string | null;
  timezone: string;
  locale: string;
  createdAt: any;
};

export type Medication = {
  id: string;
  patientId: string;          // uid
  name: string;
  form?: string;              // comprimido, jarabe...
  strength?: string;          // 500 mg...
  notes?: string;
  createdAt: any;
  createdBy?: string;          
};

export type SchedulePattern = 'DAILY' | 'DOW' | 'EVERY_X_HOURS';

export type Schedule = {
  id: string;
  medId: string;                 // referencia a medications/{medId}
  patientId: string;             // uid del usuario (para filtros/futuro)
  pattern: SchedulePattern;      // DAILY | DOW | EVERY_X_HOURS
  times?: string[];              // ["08:00","20:00"] (HH:mm) si DAILY o DOW
  dow?: number[];                // 1..7 (1=Lun ... 7=Dom) si DOW
  everyXHours?: number;          // si EVERY_X_HOURS (ej. 8)
  startDate: string;             // "YYYY-MM-DD"
  endDate?: string | null;       // opcional
  toleranceMinutes: number;      // p.ej. 30
  createdAt: any;
};

export type TomaStatus = "PLANNED" | "DUE" | "CONFIRMED" | "SKIPPED" | "EXPIRED";

export type Toma = {
  id: string;
  patientId: string;
  medId: string;
  scheduleId: string;

  // snapshot de medicación para historial
  medName?: string;
  medStrength?: string;
  medForm?: string;

  plannedAt: string;      // ISO
  windowStart: string;    // ISO
  windowEnd: string;      // ISO

  status: TomaStatus;

  notificationId?: string | null;

  // notificaciones auxiliares
  warningNotifiedAt?: string | null;
  expiredNotifiedAt?: string | null;
  confirmedNotifiedAt?: string | null;

  // ✅ clave anti-duplicados (muy importante)
  dedupeKey: string;

  createdAt?: any;
  confirmedAt?: string;
};

