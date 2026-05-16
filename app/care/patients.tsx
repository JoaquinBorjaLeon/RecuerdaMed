import PatientListScreenBase from "../../src/components/patientListScreenBase";

export default function CaregiverPatientsScreen() {
  return (
    <PatientListScreenBase
      title="Mis pacientes"
      subtitle="Accede rápidamente a la medicación y tomas."
      emptyText="No tienes pacientes asignados."
      patientRoute="/care/patient/[id]"
    />
  );
}
