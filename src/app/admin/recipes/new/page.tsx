import { RecipeForm } from "../recipe-form";

export default function NewRecipePage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-900">
        Nova receita
      </h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">
        Receitas da equipe entram aprovadas no banco geral.
      </p>
      <RecipeForm id={null} />
    </div>
  );
}
