import { hashForObject } from "../router.js";
import { escapeHtml } from "../components.js";

export async function renderQuickCreate(context) {
  context.root.innerHTML = `
    <section class="page-head">
      <div>
        <h2>Creation rapide</h2>
        <p>Optimisee pour la saisie terrain. Une note rapide, puis les champs utiles seulement.</p>
      </div>
    </section>

    <section class="grid grid--two">
      <article class="panel">
        <form id="quick-create-form" class="form-grid">
          <div class="field">
            <label for="note-rapide">Note rapide</label>
            <textarea
              id="note-rapide"
              name="noteRapide"
              placeholder="lot de 3, sans telecommande, non teste"
              required
              autofocus
            ></textarea>
            <span class="field-hint">
              Champ libre, court et naturel. Il sera stocke tel quel.
            </span>
          </div>

          <div class="form-grid form-grid--two">
            <div class="field">
              <label for="etat">Etat</label>
              <input id="etat" name="etat" type="text" placeholder="Tres bon etat" />
            </div>

            <div class="field">
              <label for="type-objet">Type objet</label>
              <input id="type-objet" name="typeObjet" type="text" placeholder="Console, BD, vase..." />
            </div>

            <div class="field">
              <label for="source">Source</label>
              <input id="source" name="source" type="text" placeholder="depot-local" />
            </div>

            <div class="field">
              <label for="location-code">Emplacement</label>
              <input id="location-code" name="locationCode" type="text" placeholder="A1-B2" />
            </div>
          </div>

          <div class="inline-actions">
            <button type="submit" class="button button--primary">Creer la fiche</button>
          </div>
        </form>
      </article>

      <aside class="panel">
        <h3>Saisie standard</h3>
        <ul class="bullet-list">
          <li>La note rapide est obligatoire.</li>
          <li>Etat et type restent optionnels.</li>
          <li>Le formulaire garde la source et l'emplacement apres creation pour aller vite en serie.</li>
        </ul>

        <div id="quick-create-result" class="empty-state">
          <strong>Pas encore de creation</strong>
          <p>Une fois la fiche creee, son identifiant apparaitra ici.</p>
        </div>
      </aside>
    </section>
  `;

  const form = context.root.querySelector("#quick-create-form");
  const resultBox = context.root.querySelector("#quick-create-result");
  const noteField = context.root.querySelector("#note-rapide");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector("button[type='submit']");
    const formData = new FormData(form);
    submitButton?.setAttribute("disabled", "disabled");

    try {
      const object = await context.api.quickCreateObject({
        noteRapide: String(formData.get("noteRapide") ?? "").trim(),
        etat: String(formData.get("etat") ?? "").trim() || null,
        typeObjet: String(formData.get("typeObjet") ?? "").trim() || null,
        source: String(formData.get("source") ?? "").trim() || null,
        locationCode: String(formData.get("locationCode") ?? "").trim() || null
      });

      resultBox.innerHTML = `
        <strong>Fiche creee</strong>
        <p class="mono">${escapeHtml(object.objectId)}</p>
        <div class="inline-actions">
          <a class="button button--secondary" href="${hashForObject(object.objectId)}">Ouvrir la fiche</a>
        </div>
      `;
      context.setStatus(`Objet ${object.objectId} cree.`, "success");
      form.querySelector("[name='noteRapide']").value = "";
      form.querySelector("[name='etat']").value = "";
      form.querySelector("[name='typeObjet']").value = "";
      noteField?.focus();
    } catch (error) {
      context.setStatus(error.message, "error");
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });
}
