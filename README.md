# Back-office revente multi-canaux

Socle backend prive en `Node.js + TypeScript + Fastify + SQLite`.

Le projet est construit par phases.

- Phase 1 : objets centraux, publications canal, historique, IDs metier
- Phase 2 : gestion locale des images par objet
- Phase 3 : note rapide et creation rapide d'objet
- Phase 5 : generation IA structuree
- Phase 6 : frontend minimal utile
- Phase 7 : publications multi-canaux
- Phase 8 : recherche, historique et fiabilite

## Arborescence

```text
.
|-- .env.example
|-- .gitignore
|-- README.md
|-- package.json
|-- package-lock.json
|-- public/
|   |-- index.html
|   |-- styles.css
|   `-- app/
|       |-- api.js
|       |-- components.js
|       |-- main.js
|       |-- router.js
|       `-- views/
|           |-- object-detail.js
|           |-- pipeline.js
|           |-- quick-create.js
|           `-- search.js
|-- tsconfig.json
|-- data/
|   `-- .gitkeep
|-- storage/
|   `-- objects/
|       `-- .gitkeep
`-- src/
    |-- app.ts
    |-- server.ts
    |-- common/
    |   |-- errors/
    |   |   `-- app-error.ts
    |   `-- services/
    |       `-- id.service.ts
    |-- config/
    |   `-- env.ts
    |-- db/
    |   |-- client.ts
    |   `-- sql/
    |       |-- schema.sql
    |       `-- seeds.sql
    |-- modules/
    |   |-- channels/
    |   |   |-- channel.routes.ts
    |   |   |-- channel.model.ts
    |   |   `-- channel.repository.ts
    |   |-- history/
    |   |   |-- history.model.ts
    |   |   |-- history.repository.ts
    |   |   |-- history.routes.ts
    |   |   `-- history.service.ts
    |   |-- ai/
    |   |   |-- ai.errors.ts
    |   |   |-- ai.model.ts
    |   |   |-- ai.provider.ts
    |   |   |-- ai.repository.ts
    |   |   |-- ai.routes.ts
    |   |   |-- ai.schemas.ts
    |   |   `-- ai.service.ts
    |   |-- objects/
    |   |   |-- object.model.ts
    |   |   |-- object.repository.ts
    |   |   |-- object.routes.ts
    |   |   |-- object.schemas.ts
    |   |   `-- object.service.ts
    |   |-- photos/
    |   |   |-- photo.model.ts
    |   |   |-- photo.repository.ts
    |   |   |-- photo.routes.ts
    |   |   |-- photo.schemas.ts
    |   |   |-- photo.service.ts
    |   |   `-- photo.storage.ts
    |   `-- publications/
    |       |-- publication.model.ts
    |       |-- publication.repository.ts
    |       |-- publication.routes.ts
    |       |-- publication.schemas.ts
    |       `-- publication.service.ts
    `-- ui/
        `-- ui.routes.ts
```

## Schema DB

Tables principales :

- `objects` : fiche centrale de l'objet reel
- `object_photos` : photos rattachees a un objet, avec ordre et chemins de stockage
- `publications` : diffusion canal d'un objet
- `channels` : registre extensible des canaux
- `history_events` : historique append-only des actions objet/publication
- `id_counters` : sequences metier pour les IDs
- `object_ai_generations` : versions IA stockees separement des validations finales

Notes de phase 2 :

- la table `object_photos` existante est conservee
- `main_photo_id` reste sur `objects`
- les infos techniques image restent flexibles dans `object_photos.metadata`
- un index a ete ajoute sur `object_photos.object_id`

Notes de phase 3 :

- `objects.note_rapide` reste le champ libre de saisie terrain
- `objects.type_objet` est ajoute comme champ optionnel explicite
- la recherche simple reste en SQL SQLite avec `LIKE`

Notes de phase 5 :

- les suggestions IA sont stockees dans `object_ai_generations`
- les champs finaux objet ne sont pas ecrases par l'IA
- seuls `prixIA` et `confiance` de l'objet sont mis a jour avec la derniere generation reussie
- chaque tentative garde son statut `PENDING`, `COMPLETED` ou `FAILED`

## Routes API

### Objets

- `POST /objects`
- `POST /objects/quick`
- `GET /objects`
- `GET /objects?q=&noteRapide=&titreInterne=&categorieInterne=&typeObjet=`
- `GET /objects?channelId=&channelStatus=`
- `GET /objects?auditPreset=PROBLEM|READY_UNPUBLISHED|SOLD_UNPAID`
- `GET /objects/search/quick`
- `GET /objects/:objectId`
- `GET /objects/:objectId/history?scope=FULL|OBJECT_ONLY`
- `PATCH /objects/:objectId`
- `PATCH /objects/:objectId/quick-note`
- `PATCH /objects/:objectId/status`
- `POST /objects/:objectId/history/:historyEventId/rollback`

### IA

- `GET /objects/:objectId/ai-generations`
- `POST /objects/:objectId/ai-generations`
- `POST /objects/:objectId/ai-generations/retry`

### Publications

- `POST /objects/:objectId/publications`
- `GET /objects/:objectId/publications`
- `GET /objects/:objectId/publications?channelId=vinted`
- `GET /objects/:objectId/publications?channelStatus=DRAFT`
- `GET /publications`
- `GET /publications?channelId=vinted`
- `GET /publications?channelStatus=PUBLISHED`
- `GET /publications/:publicationId`
- `GET /publications/:publicationId/history`
- `PATCH /publications/:publicationId`
- `DELETE /publications/:publicationId`

### Photos

- `POST /objects/:objectId/photos`
- `GET /objects/:objectId/photos`
- `GET /objects/:objectId/photos/:photoId/file?variant=original|thumbnail`
- `PATCH /objects/:objectId/photos/main`
- `PATCH /objects/:objectId/photos/reorder`
- `DELETE /objects/:objectId/photos/:photoId`

### Canaux

- `GET /channels`

### Interface privee

- `GET /`
- `GET /styles.css`
- `GET /app/*`

## Conventions d'identifiants

- objet : `LGAA-000001`
- publication Vinted : `LGAA-V-000001`
- publication Site : `LGAA-S-000001`
- publication eBay : `LGAA-E-000001`
- photo : `LGAA-PH-000001`

Choix important pour les photos :

- le dossier de stockage est porte par `objectId`
- les fichiers disque sont nommes sequentiellement a l'ajout : `01.jpg`, `02.png`, `03.webp`
- `photoId` reste l'identifiant metier stable en base et dans l'API
- l'ordre d'affichage reste gere en base via `position`
- on ne renomme pas physiquement les fichiers lors d'un reorder

Ce choix garde un stockage lisible sur disque, tout en evitant des operations de renommage inutiles lors des changements d'ordre.

## Objet vs publication

Separation retenue :

- l'objet central represente le stock reel interne
- une publication represente une diffusion sur un canal donne
- un objet peut avoir zero, une ou plusieurs publications
- chaque publication garde son propre `publicationId`
- chaque publication garde son propre `channelListingId`
- chaque publication garde son propre `channelStatus`
- les champs publies peuvent differer de la fiche interne

Exemple :

- objet central : `LGAA-000001`
- publication Vinted : `LGAA-V-000001`
- publication Site : `LGAA-S-000001`
- publication eBay : `LGAA-E-000001`

## Stockage local image

La racine de stockage est configurable via `STORAGE_ROOT`.

Exemple par defaut :

```text
storage/
`-- objects/
    `-- LGAA-000001/
        |-- originals/
        |   |-- 01.jpg
        |   `-- 02.png
        `-- thumbnails/
            |-- 01.jpg
            `-- 02.png
```

Exemple NAS :

```env
STORAGE_ROOT=Z:\\resale-media
```

Dans ce cas les fichiers sont ranges pareil, mais sous `Z:\\resale-media`.

## Regles image

- un objet peut avoir plusieurs photos
- une seule photo principale
- si un objet n'a pas encore de photo principale, la premiere photo uploadee devient la principale
- l'ordre est garde dans `object_photos.position`
- quand une photo est supprimee, les positions sont recompactees
- si la photo principale est supprimee, la premiere photo restante devient la nouvelle principale

## Note rapide

Objectif :

- saisir une fiche standard en moins de 10 secondes
- accepter une formulation libre et imparfaite
- conserver une base exploitable plus tard pour l'IA

Regles :

- `noteRapide` est courte, libre, naturelle
- elle est stockee telle quelle
- elle est retournee dans les lectures objet
- elle est recherchable
- elle est historisee

Champs terrain rapides :

- `noteRapide` : obligatoire en creation rapide
- `etat` : optionnel
- `typeObjet` : optionnel

Exemples acceptes :

- `lot de 3`
- `sans telecommande`
- `edition 1974`
- `vendu en l etat`
- `teste OK`
- `non teste`
- `fele dessous`

## Recherche simple note rapide

Deux niveaux simples :

- `GET /objects?q=` : recherche large sur `objectId`, `noteRapide`, `titreInterne`, `typeObjet`
- `GET /objects/search/quick?q=` : recherche rapide orientee terrain, limitee a la note rapide, avec une reponse legere

Filtres utiles :

- `GET /objects?noteRapide=non%20teste`
- `GET /objects?typeObjet=console`
- `GET /objects?noteRapide=telecommande&typeObjet=lecteur`

## Historisation note rapide

Strategie simple :

- creation rapide : evenement `OBJECT_QUICK_CREATED`
- mise a jour rapide : evenement `OBJECT_QUICK_NOTE_UPDATED`
- mise a jour standard contenant `noteRapide`, `etat` ou `typeObjet` : evenement `OBJECT_UPDATED`

Chaque evenement garde au minimum :

- l'objet cible
- la date
- une synthese lisible
- les valeurs avant/apres pour les champs rapides quand c'est pertinent

## Generation IA

Entrees utilisees :

- photos de l'objet
- note rapide
- etat eventuel
- type objet eventuel

Sortie structuree :

- `titreSuggere`
- `descriptionSuggeree`
- `categorieSuggeree`
- `etatSuggere`
- `prixSuggere`
- `hashtagsSuggeres`
- `confiance`
- `elementsIncertains`

Regles :

- aucune invention
- si une information n'est pas confirmable, le champ vaut `null`
- tout doute doit apparaitre dans `elementsIncertains`
- la suggestion IA reste separee de la validation finale systeme

Mecanisme de confiance :

- le modele renvoie une confiance initiale
- le service applique ensuite une penalite simple si le contexte est faible
- penalites actuelles : peu ou pas de photos, absence de note rapide, nombre d'elements incertains
- la confiance finale est celle stockee et retournee par l'API

## Validation des fichiers

Formats acceptes :

- `image/jpeg`
- `image/png`
- `image/webp`

Strategie :

- validation MIME annonce
- verification de signature binaire du fichier
- lecture des dimensions avec `sharp`
- limite de taille par fichier
- limite de nombre de fichiers par upload

Variables associees :

```env
PHOTO_MAX_FILE_SIZE_BYTES=15728640
PHOTO_MAX_FILES_PER_UPLOAD=12
PHOTO_THUMBNAIL_MAX_SIZE=600
ENABLE_PHOTO_THUMBNAILS=true
```

Variables IA :

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5-mini
OPENAI_TIMEOUT_MS=45000
AI_MAX_INPUT_PHOTOS=6
```

## Exemples API

### Creer un objet

```json
{
  "source": "depot-local",
  "noteRapide": "lot de 3, sans telecommande",
  "titreInterne": "Lecteur cassette Sony",
  "descriptionInterne": "A nettoyer, non teste",
  "categorieInterne": "Audio",
  "etat": "Bon etat",
  "prixReference": 3500,
  "locationCode": "A1-B2",
  "metadata": {
    "batch": "arrivage-2026-04-02"
  }
}
```

### Creation rapide d'objet

```json
{
  "noteRapide": "lot de 3 sans telecommande teste OK",
  "etat": "Bon etat",
  "typeObjet": "Lecteur cassette"
}
```

### Reponse objet

```json
{
  "data": {
    "objectId": "LGAA-000001",
    "createdAt": "2026-04-02T12:00:00.000Z",
    "updatedAt": "2026-04-02T12:00:00.000Z",
    "stockStatus": "IN_STOCK",
    "workflowStatus": "BROUILLON",
    "source": "depot-local",
    "noteRapide": "lot de 3, sans telecommande",
    "typeObjet": null,
    "titreInterne": "Lecteur cassette Sony",
    "descriptionInterne": "A nettoyer, non teste",
    "categorieInterne": "Audio",
    "etat": "Bon etat",
    "prixIA": null,
    "prixReference": 3500,
    "prixFinal": null,
    "confiance": null,
    "mainPhotoId": null,
    "locationCode": "A1-B2",
    "metadata": {
      "batch": "arrivage-2026-04-02"
    },
    "photos": []
  }
}
```

### Creer une publication

```json
{
  "channelId": "vinted",
  "channelStatus": "DRAFT",
  "titrePublie": "Lecteur cassette Sony vintage",
  "descriptionPubliee": "Bon etat visuel, vendu en l'etat",
  "categorieCanal": "electronique/audio",
  "prixPublie": 3900,
  "hashtagsPublies": ["sony", "vintage", "audio"],
  "metadata": {
    "listingTemplate": "standard"
  }
}
```

### Mise a jour rapide de note

```json
{
  "noteRapide": "lot de 3 sans telecommande non teste",
  "etat": "Etat moyen",
  "typeObjet": "Lecteur cassette"
}
```

### Lancer une generation IA

`POST /objects/:objectId/ai-generations`

Exemple de reponse :

```json
{
  "data": {
    "generationId": 1,
    "objectId": "LGAA-000001",
    "triggerType": "MANUAL",
    "generationStatus": "COMPLETED",
    "attemptNumber": 1,
    "provider": "openai",
    "model": "gpt-5-mini",
    "promptVersion": "object-ai-v1",
    "inputSnapshot": {
      "objectId": "LGAA-000001",
      "noteRapide": "lot de 3 sans telecommande",
      "etat": "Bon etat",
      "typeObjet": "Lecteur cassette",
      "mainPhotoId": "LGAA-PH-000001",
      "totalPhotoCount": 4,
      "selectedPhotoCount": 4,
      "photos": [
        {
          "photoId": "LGAA-PH-000001",
          "position": 1,
          "mimeType": "image/jpeg",
          "relativePath": "objects/LGAA-000001/originals/LGAA-PH-000001.jpg",
          "isMain": true
        }
      ]
    },
    "output": {
      "titreSuggere": "Lecteur cassette Sony vintage",
      "descriptionSuggeree": "Lecteur cassette vintage vendu en l etat, sans telecommande.",
      "categorieSuggeree": "Audio",
      "etatSuggere": "Bon etat",
      "prixSuggere": 3900,
      "hashtagsSuggeres": ["sony", "vintage", "audio"],
      "confiance": 0.58,
      "elementsIncertains": [
        {
          "champ": "PRIX",
          "raison": "Absence de reference de marche fiable dans le contexte fourni"
        }
      ]
    },
    "confidence": 0.58,
    "errorCode": null,
    "errorMessage": null,
    "providerResponseId": "resp_123",
    "createdAt": "2026-04-02T15:00:00.000Z",
    "updatedAt": "2026-04-02T15:00:01.000Z",
    "completedAt": "2026-04-02T15:00:01.000Z"
  }
}
```

### Relancer une generation IA

`POST /objects/:objectId/ai-generations/retry`

Le systeme cree une nouvelle tentative en base avec `triggerType = RETRY`.

### Uploader plusieurs photos

`POST /objects/:objectId/photos`

Type de requete :

- `multipart/form-data`
- champ fichier : `files`
- plusieurs occurrences du meme champ `files`

Exemple `curl` :

```bash
curl -X POST http://localhost:3000/objects/LGAA-000001/photos \
  -F "files=@C:/photos/photo-1.jpg" \
  -F "files=@C:/photos/photo-2.png"
```

Exemple de reponse :

```json
{
  "data": [
    {
      "photoId": "LGAA-PH-000001",
      "objectId": "LGAA-000001",
      "position": 1,
      "originalFilename": "photo-1.jpg",
      "storedFilename": "01.jpg",
      "relativePath": "objects/LGAA-000001/originals/01.jpg",
      "mimeType": "image/jpeg",
      "metadata": {
        "extension": "jpg",
        "sizeBytes": 245612,
        "checksumSha256": "f58e4f...",
        "width": 1600,
        "height": 1200,
        "thumbnailRelativePath": "objects/LGAA-000001/thumbnails/01.jpg"
      },
      "createdAt": "2026-04-02T12:10:00.000Z",
      "isMain": true
    },
    {
      "photoId": "LGAA-PH-000002",
      "objectId": "LGAA-000001",
      "position": 2,
      "originalFilename": "photo-2.png",
      "storedFilename": "02.png",
      "relativePath": "objects/LGAA-000001/originals/02.png",
      "mimeType": "image/png",
      "metadata": {
        "extension": "png",
        "sizeBytes": 312004,
        "checksumSha256": "2c4d11...",
        "width": 1280,
        "height": 1280,
        "thumbnailRelativePath": "objects/LGAA-000001/thumbnails/02.png"
      },
      "createdAt": "2026-04-02T12:10:00.000Z",
      "isMain": false
    }
  ]
}
```

### Definir la photo principale

```json
{
  "photoId": "LGAA-PH-000002"
}
```

### Reordonner les photos

```json
{
  "photoIds": [
    "LGAA-PH-000003",
    "LGAA-PH-000001",
    "LGAA-PH-000002"
  ]
}
```

## Choix structurants

- `objet`, `publication` et `photo` restent separes en base et en code
- les canaux restent dynamiques via `channels`
- `history_events` garde la trace des uploads, reorders, changements de photo principale et suppressions
- `history_events` garde aussi les evenements de creation rapide et mise a jour rapide
- `history_events` garde aussi les demandes, succes et echecs de generation IA
- `metadata` absorbe les details techniques image sans rigidifier trop tot le schema
- le stockage local est simple : un dossier par objet, sous-dossiers `originals` et `thumbnails`
- le disque reste lisible avec un nommage sequentiel `01`, `02`, `03`, tandis que `photoId` reste stable en base
- la creation rapide ajoute un endpoint minimal pour mobile sans dupliquer le modele objet central
- la recherche rapide reste volontairement simple en `LIKE` SQLite, sans FTS ni moteur externe
- la generation IA est versionnee dans une table dediee pour separer suggestion et decision finale
- la sortie IA est strictement validee avant stockage
- le frontend reste volontairement leger : HTML, CSS et JS modules servis par Fastify
- le routage UI est en hash pour eviter une stack frontend lourde et garder un deploiement simple
- la fiche objet rend visible la separation metier entre objet central, photos, IA et publications
- les recherches d'audit restent en SQL simple avec indexes dedies, sans moteur externe
- l'historique distingue explicitement `MANUAL`, `AI` et `SYSTEM`
- le rollback est volontairement borne au dernier changement manuel rollbackable de l'objet central

## Frontend minimal

Vues disponibles :

- `#/pipeline` : colonnes workflow avec changement de statut rapide
- `#/quick-create` : creation terrain orientee note rapide
- `#/search` : recherche et filtres
- `#/objects/:objectId` : fiche objet complete

Composants principaux :

- cartes objet reutilisables
- formulaire rapide de changement de statut
- fiche objet centrale editable
- panneau photos avec upload, photo principale, suppression et reorder
- panneau IA avec historique des generations
- panneau publications separe de l'objet central
- panneau publications filtre par canal et statut directement dans la fiche objet

Connexion API :

- meme origine que le backend
- `fetch` natif
- pas de dependance frontend lourde
- canaux charges dynamiquement via `GET /channels`

## Publications multi-canaux

Regles structurelles :

- les canaux de base seeds sont `vinted`, `site`, `ebay`
- l'ID metier publication depend du code canal stocke en base
- l'ajout d'un nouveau canal ne demande pas de refonte de la logique publication
- les filtres publication reposent sur `channelId` et `channelStatus`

Exemples de filtres :

- `GET /publications?channelId=vinted`
- `GET /publications?channelId=site&channelStatus=READY`
- `GET /objects/LGAA-000001/publications?channelId=ebay`

## Recherche et audit

Recherche disponible :

- par ID via `GET /objects?q=LGAA-000001`
- par note rapide via `GET /objects?noteRapide=sans%20telecommande`
- par titre via `GET /objects?titreInterne=Sony`
- par categorie via `GET /objects?categorieInterne=Audio`
- par statut workflow via `GET /objects?workflowStatus=A_VERIFIER`
- par canal via `GET /objects?channelId=vinted`
- par statut canal via `GET /objects?channelStatus=PUBLISHED`

Vues d'audit disponibles :

- `PROBLEM` : objets avec `workflowStatus = PROBLEME`
- `READY_UNPUBLISHED` : objets `PRET` sans publication detectee comme publiee
- `SOLD_UNPAID` : objets `VENDU`, donc vendus mais non encore passes en `PAYE`

Les raccourcis d'audit sont visibles dans la vue `#/search`.

## Historique et rollback

Chaque evenement d'historique garde :

- l'entite concernee (`OBJECT` ou `PUBLICATION`)
- l'objet racine pour reconstituer le journal complet
- la source du changement (`MANUAL`, `AI`, `SYSTEM`)
- un `summary` lisible rapidement
- le payload detaille
- les donnees de rollback quand le changement peut etre annule

Regles de rollback actuelles :

- rollback uniquement sur l'objet central
- rollback uniquement sur un evenement manuel
- rollback uniquement si des donnees de retour arriere ont ete stockees
- rollback uniquement sur le dernier evenement manuel rollbackable

Objectif :

- garder un mecanisme simple
- eviter les annulations en cascade difficiles a auditer
- rendre les modifications manuelles, IA et systeme clairement distinguables

Dans la fiche objet, le panneau `Historique complet` affiche le journal unifie objet + publications avec badge de source et action de rollback quand elle est autorisee.

## Lancement

```bash
npm install
npm run dev
```

## Verification locale

Verifie pendant le developpement :

- `npm run build`
- smoke test REST en memoire pour objets/publications
- smoke test REST photo hors sandbox pour upload, liste, photo principale, reorder et suppression
- smoke test IA en memoire avec provider simule pour valider stockage, confiance et audit
