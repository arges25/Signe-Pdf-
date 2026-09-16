import type { DocTemplateId } from "./doc-types";

export const TEMPLATE_LABELS: Record<DocTemplateId, string> = {
  blank: "Document vierge",
  letter: "Lettre",
  attestation: "Attestation",
  hebergement: "Attestation d’hébergement",
};

export const TEMPLATE_DESCRIPTIONS: Record<DocTemplateId, string> = {
  blank: "Une feuille blanche, pour tout écrire vous-même.",
  letter: "Coordonnées, destinataire, objet et formule de politesse déjà en place.",
  attestation: "Un modèle administratif simple, entièrement modifiable.",
  hebergement: "Le modèle classique d’attestation d’hébergement.",
};

// Every template is plain, fully editable HTML — bracketed placeholders
// are ordinary text the user overtypes, never a locked field. Keeping
// this uniform (no special widgets) is what makes "never blocks the
// user" trivially true: it's the same contentEditable either way.
export function templateInitialHtml(id: DocTemplateId): string {
  switch (id) {
    case "letter":
      return [
        `<p>Nom Prénom<br>Adresse<br>Téléphone<br>E-mail</p>`,
        `<p><br></p>`,
        `<p>Destinataire<br>Adresse du destinataire</p>`,
        `<p><br></p>`,
        `<p style="text-align:right">Fait à [Ville], le [date]</p>`,
        `<p><br></p>`,
        `<p><strong>Objet : </strong>[objet de la lettre]</p>`,
        `<p><br></p>`,
        `<p>Madame, Monsieur,</p>`,
        `<p><br></p>`,
        `<p>[Corps de la lettre]</p>`,
        `<p><br></p>`,
        `<p>Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.</p>`,
        `<p><br></p>`,
        `<p style="text-align:right">Signature</p>`,
      ].join("");
    case "attestation":
      return [
        `<h2 style="text-align:center">ATTESTATION</h2>`,
        `<p><br></p>`,
        `<p>Je soussigné(e), [Nom Prénom], né(e) le [date de naissance] à [lieu de naissance], demeurant [adresse],</p>`,
        `<p><br></p>`,
        `<p>atteste que [objet de l’attestation].</p>`,
        `<p><br></p>`,
        `<p>Fait pour servir et valoir ce que de droit.</p>`,
        `<p><br></p>`,
        `<p style="text-align:right">Fait à [Ville], le [date]<br>Signature</p>`,
      ].join("");
    case "hebergement":
      return [
        `<h2 style="text-align:center">ATTESTATION D’HÉBERGEMENT</h2>`,
        `<p><br></p>`,
        `<p>Je soussigné(e), [Nom Prénom de l’hébergeant], demeurant [adresse complète],</p>`,
        `<p><br></p>`,
        `<p>atteste sur l’honneur héberger à mon domicile, à titre gratuit :</p>`,
        `<p><br></p>`,
        `<p>[Nom Prénom de la personne hébergée], né(e) le [date de naissance],</p>`,
        `<p><br></p>`,
        `<p>depuis le [date de début d’hébergement].</p>`,
        `<p><br></p>`,
        `<p>Cette attestation est établie pour servir et valoir ce que de droit.</p>`,
        `<p><br></p>`,
        `<p style="text-align:right">Fait à [Ville], le [date]<br>Signature</p>`,
      ].join("");
    case "blank":
    default:
      return `<p><br></p>`;
  }
}
