/**
 * The consultation timer (`startedAt`/`endedAt`/`durationSeconds`) exists for
 * clinic-side reporting (revenue vs. time spent) — it must never reach the
 * patient app. `AppointmentsService`/`PatientsService` return the full
 * `Appointment` entity regardless of caller, so every controller response
 * that can be read by a patient must pass through this before going out.
 */
const DOCTOR_ONLY_FIELDS = ['startedAt', 'endedAt', 'durationSeconds'] as const;

export function sanitizeAppointmentForViewer(appointment: any, userType: string): any {
  if (!appointment || userType !== 'patient') return appointment;

  const sanitized = { ...appointment };
  for (const field of DOCTOR_ONLY_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

export function sanitizeAppointmentsForViewer(appointments: any[], userType: string): any[] {
  if (userType !== 'patient') return appointments;
  return appointments.map((a) => sanitizeAppointmentForViewer(a, userType));
}
