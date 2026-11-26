import { revalidatePath } from "next/cache";

/**
 * Invalida as páginas afetadas por uma alteração de perfil.
 * A rota pública fica no route group (public), então o caminho do arquivo precisa incluí-lo
 * (revalidatePath("/[username]", "page") geraria uma tag que não casa com nenhuma rota).
 */
export function revalidateProfilePages(username?: string | null): void {
  revalidatePath("/(public)/[username]", "page");
  if (username) revalidatePath(`/${username}`);
  revalidatePath("/customize");
}
