import { IngredientForm } from "../ingredient-form";

export default function NewIngredientPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        Novo ingrediente
      </h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">
        Cadastro manual — entra no banco com fonte &ldquo;Próprio&rdquo;.
      </p>
      <IngredientForm id={null} />
    </div>
  );
}
