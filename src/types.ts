export type Medication = {
  id: string;
  patientId: string;
  name: string;
  form?: string;
  strength?: string;
  notes?: string;
  imageUrl?: string;
  createdAt: any;
  createdBy?: string;
};

export type SchedulePattern = "DAILY" | "DOW" | "EVERY_X_HOURS";

export type Schedule = {
  id: string;
  medId: string;
  patientId: string;
  pattern: SchedulePattern;
  times?: string[];         // ["08:00","20:00"] (HH:mm) — para DAILY y DOW
  dow?: number[];            // 1..7 (1=Lun, 7=Dom) — solo para DOW
  everyXHours?: number;      // solo para EVERY_X_HOURS
  startDate: string;         // "YYYY-MM-DD"
  endDate?: string | null;
  toleranceMinutes: number;
  createdAt: any;
};

export type TomaStatus = "PLANNED" | "DUE" | "CONFIRMED" | "EXPIRED";

export type Toma = {
  id: string;
  patientId: string;
  medId: string;
  scheduleId: string;

  // Snapshot de la medicación para mantener historial si se edita el medicamento
  medName?: string;
  medStrength?: string;
  medForm?: string;

  plannedAt: string;      // ISO 8601
  windowStart: string;    // ISO 8601
  windowEnd: string;      // ISO 8601

  status: TomaStatus;

  notificationId?: string | null;

  // Timestamps de notificaciones enviadas (evita reenvíos)
  warningNotifiedAt?: string | null;
  expiredNotifiedAt?: string | null;
  confirmedNotifiedAt?: string | null;

  // Clave única para evitar tomas duplicadas (scheduleId + plannedAt)
  dedupeKey: string;

  createdAt?: any;
  confirmedAt?: string;
};
