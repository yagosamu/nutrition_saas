import { PatientCreateForm } from "../patient-create-form";

export default function NewPatientPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        Novo paciente
      </h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">
        O paciente recebe uma senha provisória e troca no primeiro acesso.
      </p>
      <PatientCreateForm />
    </div>
  );
}
