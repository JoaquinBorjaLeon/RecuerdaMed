import PatientListScreenBase from "../../src/components/patientListScreenBase";

export default function FamilyPatientsScreen() {
  return (
    <PatientListScreenBase
      title="Mis familiares"
      subtitle="Accede a la medicación y tomas de tus familiares."
      emptyText="No tienes familiares asignados."
      patientRoute="/family/patient/[id]"
    />
  );
}
