# CellMarket Public Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le catalogue public sûr à consommer par CellWork, avec permissions exactes, médias inertes et CI reproductible sur Windows/Linux.

**Architecture:** Le validateur CLI reste la frontière commune. Les tests Node exécutent le vrai CLI sur des catalogues temporaires; les schémas bloquent les URL non HTTPS et le validateur contrôle le contenu SVG ainsi que les capacités demandées par les instructions.

**Tech Stack:** Node.js 20+, `node:test`, AJV, GitHub Actions.

**Spec:** Rapport Codex Security `f4c55244-3201-4468-b21d-ddbc9e337eff`.

## Global Constraints

- Aucun secret ni permission accordée implicitement.
- Une permission demandée dans une instruction doit être annoncée dans le manifeste.
- Les mêmes commandes doivent réussir sous Windows et Linux.
- Aucun runtime payant ou service distant requis.

---

### Task 1: Validation portable et tests CLI

**Files:** `tests/validate.test.js`, `scripts/validate.js`, `package.json`

- [x] Écrire un test CLI avec catalogue temporaire valide et observer l'échec Windows.
- [x] Normaliser les chemins relatifs à la frontière du validateur.
- [x] Vérifier le passage du contrôle légitime.

### Task 2: Frontières média, URL et capacités

**Files:** `tests/validate.test.js`, `scripts/validate.js`, `schemas/*.schema.json`, manifests concernés

- [x] Écrire et observer les tests rouges pour SVG actif, URL non HTTPS et commande d'installation non déclarée.
- [x] Bloquer les SVG actifs/références externes et les URI hors HTTPS.
- [x] Ajouter les capacités fermées nécessaires aux manifests qui demandent npm/npx.
- [x] Vérifier les cas malveillants et légitimes.

### Task 3: Index reproductible et CI

**Files:** `tests/index.test.js`, `scripts/build-index.js`, `scripts/verify-index.js`, `.github/workflows/ci.yml`

- [x] Écrire un test rouge de génération identique deux fois.
- [x] Stabiliser `generatedAt` lorsque les entrées ne changent pas et normaliser les chemins/checksums.
- [x] Exécuter les régressions sous Windows et Linux dans la CI.

### Task 4: Publication et portes finales

**Files:** `LICENSE`, `CONTRIBUTING.md`, documentation de ce plan

- [x] Ajouter la licence MIT racine et les règles de contribution sécurisée.
- [x] Exécuter tests, validation, génération, vérification et audit npm.
- [x] Inspecter le diff, commit et push de `codex/security-hardening`.
