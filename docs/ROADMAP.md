# BugLord 2.0 Roadmap

> **Status:** In active redevelopment
> **Target platforms:** Android + iOS
> **Goal:** Transform the original BugLord FYP prototype into a polished, testable, commercially viable application ready to progress toward public release.

---

## 1. Vision

BugLord is a gamified insect-collecting application that combines real-world insect discovery with collection, progression, exploration, and turn-based gameplay.

BugLord 2.0 will move the project beyond its Final Year Project prototype by rebuilding areas that were limited by academic scope, licensing restrictions, infrastructure costs, and time constraints.

The primary goals of BugLord 2.0 are to:

* Own and control the machine-learning classification pipeline.
* Improve scanning accuracy and reliability.
* Stabilise the existing core application.
* Expand BugLord's gameplay loop.
* Introduce a cohesive game-focused visual identity.
* Support Android and iOS.
* Build infrastructure suitable for eventual commercial deployment.
* Introduce sustainable, non-predatory monetisation.
* Establish automated testing and development workflows.
* Produce a polished build suitable for extensive user testing and progression toward release.

BugLord 2.0 is **not simply a UI overhaul**. Core architecture and functionality should be stabilised before significant visual redesign work begins.

---

# 2. Development Principles

Development of BugLord 2.0 should follow several principles.

### Stability before expansion

Existing systems should work reliably before large new systems are added.

### Functionality before visual redesign

Core APIs, data structures, ML integration, and gameplay flows should be stabilised before redesigning their UI.

### Commercial ownership

New dependencies, datasets, models, APIs, assets, and services should be checked for licensing restrictions before becoming core parts of the commercial application.

### Cross-platform development

Unless a platform limitation makes this impossible, features should be designed for both Android and iOS rather than treating one platform as an afterthought.

### Testable development

Major systems should include automated tests and clear acceptance criteria.

### Incremental delivery

Large features should be split into independently testable milestones rather than implemented as one large change.

---

# 3. BugLord 2.0 Development Phases

---

## Phase 0 — Project Foundation

**Objective:** Establish a stable technical baseline before continuing major development.

### Repository and architecture

* [ ] Confirm the current BugLord 2.0 architecture.
* [ ] Document the React Native / Expo application structure.
* [ ] Document Firebase responsibilities.
* [ ] Document backend responsibilities.
* [ ] Document the ML inference pipeline.
* [ ] Remove obsolete prototype code where safe.
* [ ] Remove unused dependencies.
* [ ] Identify temporary FYP-era implementations.
* [ ] Identify systems requiring migration or replacement.
* [ ] Ensure secrets and credentials are excluded from source control.
* [ ] Confirm environment configuration strategy.
* [ ] Create `.env.example` where appropriate.
* [ ] Ensure production secrets cannot accidentally be committed.

### Development workflow

* [ ] Establish `main` as the stable branch.
* [ ] Use feature branches for major development.
* [ ] Require automated checks before significant merges where practical.
* [ ] Establish consistent formatting and linting.
* [ ] Establish TypeScript checking.
* [ ] Establish automated test execution.
* [ ] Document local development setup.
* [ ] Document backend development setup.
* [ ] Document ML training setup.

### ML specification

* [ ] Finalise `docs/ml/BUGLORD_ML_V2_SPEC.md`.
* [ ] Finalise the commercial dataset manifest format.
* [ ] Add `training/schemas/commercial_dataset_manifest.schema.json`.
* [ ] Add manifest validation.
* [ ] Add tests for valid and invalid dataset manifests.
* [ ] Document dataset licensing requirements.
* [ ] Document model licensing requirements.

### Phase 0 completion criteria

Phase 0 is complete when:

* The repository builds from a clean checkout.
* Development environments are documented.
* Automated linting, type checking, and testing succeed.
* ML input/output contracts are documented.
* Dataset licensing requirements are explicit.
* No critical secrets are stored in the repository.

---

# Phase 1 — Commercial ML Dataset

**Objective:** Build a legally usable insect dataset capable of supporting BugLord's new classification model.

### Dataset research

* [ ] Identify suitable insect image datasets.
* [ ] Verify licences for every dataset considered.
* [ ] Reject datasets incompatible with commercial use.
* [ ] Record dataset source and licensing information.
* [ ] Determine target taxonomic coverage.
* [ ] Determine minimum acceptable samples per class.
* [ ] Identify underrepresented classes.

### Dataset pipeline

* [ ] Define the canonical dataset structure.
* [ ] Implement dataset manifest generation.
* [ ] Implement manifest validation.
* [ ] Detect invalid or corrupted images.
* [ ] Detect duplicate images.
* [ ] Detect duplicate train/validation/test samples.
* [ ] Validate class labels.
* [ ] Validate taxonomic metadata.
* [ ] Generate dataset statistics.
* [ ] Generate class-distribution reports.

### Dataset preparation

* [ ] Build initial training dataset.
* [ ] Create training split.
* [ ] Create validation split.
* [ ] Create held-out test split.
* [ ] Prevent near-duplicate images leaking between splits.
* [ ] Record dataset version.
* [ ] Record licence provenance for each dataset source.
* [ ] Store reproducible dataset configuration.

### Phase 1 completion criteria

Phase 1 is complete when:

* A reproducible commercial-safe dataset exists.
* Every image source has traceable licensing information.
* Dataset validation passes.
* Training, validation, and test sets are isolated.
* Dataset statistics are documented.
* The dataset can be regenerated or updated predictably.

---

# Phase 2 — BugLord Classification Model

**Objective:** Train an independently usable insect classification model to replace the FYP-era licensed model.

Initial training will take place locally using the development PC before production infrastructure is introduced.

### Training pipeline

* [ ] Create reproducible training scripts.
* [ ] Support configurable model architectures.
* [ ] Support configurable batch size.
* [ ] Support configurable learning rate.
* [ ] Support configurable image resolution.
* [ ] Support checkpoint saving.
* [ ] Support training resume.
* [ ] Record training metrics.
* [ ] Record experiment configuration.
* [ ] Record dataset version used for each experiment.
* [ ] Record model version.

### Model experimentation

* [ ] Establish baseline model.
* [ ] Measure top-1 accuracy.
* [ ] Measure top-k accuracy.
* [ ] Generate confusion matrix.
* [ ] Identify commonly confused species/classes.
* [ ] Investigate class imbalance.
* [ ] Experiment with augmentation.
* [ ] Experiment with transfer learning.
* [ ] Experiment with candidate architectures where useful.
* [ ] Measure inference latency.
* [ ] Measure VRAM/RAM requirements.

### Confidence and unknown insects

* [ ] Implement confidence scoring.
* [ ] Establish an initial confidence threshold.
* [ ] Prevent low-confidence predictions from being presented as certain.
* [ ] Define behaviour for unknown/unsupported insects.
* [ ] Provide an appropriate fallback response.
* [ ] Record confidence alongside scan results.

### Model validation

* [ ] Evaluate model against held-out test data.
* [ ] Test real-world smartphone photographs.
* [ ] Test poor lighting.
* [ ] Test partially obscured insects.
* [ ] Test distant insects.
* [ ] Test multiple insects where applicable.
* [ ] Test non-insect images.
* [ ] Compare performance against the original FYP scanning experience.

### Phase 2 completion criteria

Phase 2 is complete when:

* The model reaches an acceptable accuracy baseline.
* Real-world testing demonstrates useful classification performance.
* Low-confidence predictions are handled safely.
* Training is reproducible.
* The model can legally be used as part of BugLord.

---

# Phase 3 — Production-Style Inference Pipeline

**Objective:** Replace the old inference system with the BugLord-owned model and establish the API contract that future production infrastructure will use.

### Backend

* [ ] Integrate the new model with FastAPI.
* [ ] Define versioned inference endpoints.
* [ ] Validate uploaded files.
* [ ] Reject unsupported file formats.
* [ ] Enforce upload-size limits.
* [ ] Add inference timeout handling.
* [ ] Add structured error responses.
* [ ] Add request logging without unnecessarily storing user images.
* [ ] Add model version to inference responses.
* [ ] Add confidence values to responses.
* [ ] Add server health endpoint.
* [ ] Add automated backend tests.

### Local development hosting

Initially, the inference service may be hosted from the development PC for controlled testing.

* [ ] Establish local inference server configuration.
* [ ] Secure remote access where required.
* [ ] Prevent unnecessary exposure of the development machine.
* [ ] Benchmark concurrent requests.
* [ ] Measure inference time.
* [ ] Measure GPU memory usage.
* [ ] Document local hosting limitations.

### Future infrastructure abstraction

* [ ] Avoid hard-coding local server addresses.
* [ ] Support environment-based API URLs.
* [ ] Prepare backend containerisation.
* [ ] Create Docker configuration where appropriate.
* [ ] Document deployment requirements.
* [ ] Ensure the model can later migrate to cloud/VPS/GPU infrastructure without modifying the mobile scanning architecture.

### Phase 3 completion criteria

Phase 3 is complete when:

* BugLord can scan insects using the new model.
* The mobile app no longer relies on the old licensed classifier.
* API failures are handled gracefully.
* The model/API contract is stable.
* Moving inference from the development PC to production infrastructure does not require redesigning the application.

---

# Phase 4 — Scanning Experience

**Objective:** Make insect scanning one of BugLord's most polished and reliable features.

### Camera and image workflow

* [ ] Review camera capture flow.
* [ ] Review gallery upload flow.
* [ ] Add image validation.
* [ ] Add sensible image compression.
* [ ] Improve upload feedback.
* [ ] Add scanning/loading state.
* [ ] Prevent duplicate scan submissions.
* [ ] Handle network interruption.
* [ ] Allow safe retry after failure.
* [ ] Handle server downtime gracefully.

### Scan results

* [ ] Display prediction confidence appropriately.
* [ ] Improve insect information presentation.
* [ ] Prevent unsupported predictions being treated as confirmed discoveries.
* [ ] Clearly distinguish new discoveries from previously collected insects.
* [ ] Prevent duplicate collection exploits.
* [ ] Save scan metadata consistently.
* [ ] Record model version used for scans where useful.
* [ ] Ensure collection rewards are applied exactly once.

### Metadata

* [ ] Review insect metadata sources.
* [ ] Verify commercial/API usage terms.
* [ ] Standardise taxonomic fields.
* [ ] Handle missing metadata.
* [ ] Cache appropriate metadata.
* [ ] Reduce unnecessary external API requests.

### Phase 4 completion criteria

A successful scan should reliably follow:

**Capture → Upload → Classification → Validation → Metadata → Collection → Reward → BugDex**

without inconsistent states or duplicated rewards.

---

# Phase 5 — Core Application Reliability

**Objective:** Resolve important technical debt from the FYP prototype before expanding the game.

---

## 5.1 Authentication

* [ ] Review registration.
* [ ] Review login.
* [ ] Review logout.
* [ ] Review password recovery.
* [ ] Review session persistence.
* [ ] Handle expired authentication sessions.
* [ ] Handle deleted/invalid accounts.
* [ ] Test authentication across Android and iOS.

---

## 5.2 Firestore

* [ ] Review Firestore schema.
* [ ] Document collections and documents.
* [ ] Review security rules.
* [ ] Prevent unauthorised writes.
* [ ] Validate sensitive server-controlled values.
* [ ] Review synchronisation behaviour.
* [ ] Handle offline writes.
* [ ] Resolve conflicting updates.
* [ ] Avoid duplicated rewards/items.
* [ ] Review transaction usage.

---

## 5.3 Trading

* [ ] Review current trading architecture.
* [ ] Fix trade cancellation behaviour.
* [ ] Prevent cancelled trades from completing.
* [ ] Prevent duplicate trades.
* [ ] Prevent users trading insects/items they no longer own.
* [ ] Validate trade state before completion.
* [ ] Make trade operations atomic where possible.
* [ ] Add trading tests.
* [ ] Test simultaneous actions from both users.
* [ ] Test network interruption during a trade.

### Trading invariant

A trade should either:

**complete fully**

or

**not modify either user's inventory at all.**

---

# Phase 6 — Walk Mode 2.0

**Objective:** Fix the largest known limitation of the original Walk Mode and turn it into a reliable progression system.

### Step tracking

* [ ] Research reliable Android background step tracking.
* [ ] Research reliable iOS background step tracking.
* [ ] Implement platform-appropriate step APIs.
* [ ] Track steps while BugLord is backgrounded.
* [ ] Track eligible steps after the app is closed where supported.
* [ ] Synchronise stored steps when the app opens.
* [ ] Prevent duplicate step rewards.
* [ ] Handle device reboot.
* [ ] Handle permission revocation.
* [ ] Handle unavailable sensor data.

### Walk Mode progression

* [ ] Review XP rewards.
* [ ] Review item rewards.
* [ ] Introduce sensible daily progression.
* [ ] Prevent trivial farming exploits.
* [ ] Add milestones.
* [ ] Improve reward feedback.
* [ ] Integrate Walk Mode with broader BugLord progression.

### Permissions/privacy

* [ ] Clearly explain why activity permissions are required.
* [ ] Request only necessary permissions.
* [ ] Avoid collecting unnecessary location/activity data.
* [ ] Document platform-specific privacy requirements.

### Phase 6 completion criteria

Walk Mode should no longer require users to keep BugLord actively open for their normal eligible walking activity to contribute to progression, within Android/iOS platform restrictions.

---

# Phase 7 — UI/UX Redesign

**Objective:** Give BugLord a coherent identity after the core systems and navigation structure have stabilised.

The major visual redesign begins **after core architecture and gameplay flows are stable** to avoid repeatedly redesigning unfinished screens.

### Design system

* [ ] Establish BugLord visual direction.
* [ ] Define pixel/game-inspired aesthetic.
* [ ] Define typography.
* [ ] Define spacing.
* [ ] Define button styles.
* [ ] Define cards/panels.
* [ ] Define iconography.
* [ ] Define animations.
* [ ] Define rarity presentation.
* [ ] Define loading/error/empty states.
* [ ] Build reusable UI components.

### Screen redesign

* [ ] Authentication.
* [ ] Home.
* [ ] Camera/scanner.
* [ ] Scan results.
* [ ] BugDex.
* [ ] Bug details.
* [ ] Walk Mode.
* [ ] Hive Mode.
* [ ] Inventory.
* [ ] Trading.
* [ ] Social.
* [ ] Profile.
* [ ] Settings.

### UX

* [ ] Reduce unnecessary taps.
* [ ] Improve navigation clarity.
* [ ] Improve first-time user onboarding.
* [ ] Explain major gameplay systems.
* [ ] Improve accessibility.
* [ ] Test different screen sizes.
* [ ] Test Android.
* [ ] Test iOS.

---

# Phase 8 — BugDex & Collection Expansion

**Objective:** Make collecting insects rewarding independently of other game systems.

* [ ] Redesign BugDex.
* [ ] Display discovered species.
* [ ] Display undiscovered entries appropriately.
* [ ] Add collection completion statistics.
* [ ] Add rarity.
* [ ] Add discovery dates.
* [ ] Add first-discovery information.
* [ ] Add useful insect facts.
* [ ] Add collection milestones.
* [ ] Add achievements where appropriate.
* [ ] Add filtering.
* [ ] Add sorting.
* [ ] Add search.
* [ ] Improve insect detail pages.
* [ ] Consider geographic/seasonal discovery information where technically and legally appropriate.

---

# Phase 9 — Hive Mode 2.0

**Objective:** Expand Hive Mode from the FYP battle prototype into a meaningful roguelike progression system.

## Core run structure

A Hive run should consist of a sequence of encounters in which players must manage their team of bugs, equipment, health, resources, and upgrades.

* [ ] Formalise Hive run structure.
* [ ] Establish encounter progression.
* [ ] Establish approximately 10 major battle stages as the initial design target.
* [ ] Add branching encounter choices where useful.
* [ ] Add random events.
* [ ] Add shops.
* [ ] Add reward encounters.
* [ ] Add elite encounters.
* [ ] Add boss encounters.
* [ ] Add run completion rewards.

---

## Combat

* [ ] Review turn system.
* [ ] Add clearer turn order.
* [ ] Expand moves.
* [ ] Add move categories.
* [ ] Add physical attacks.
* [ ] Add ranged/special attacks.
* [ ] Add status effects.
* [ ] Add buffs/debuffs.
* [ ] Add resistances.
* [ ] Add weaknesses.
* [ ] Add better enemy AI.
* [ ] Improve battle feedback.
* [ ] Add combat animations.

---

## Equipment

Examples may include:

* Swords
* Scrolls
* Armour
* Charms
* Relics
* Other insect-scale fantasy equipment

Tasks:

* [ ] Define equipment slots.
* [ ] Define equipment rarity.
* [ ] Define equipment stats.
* [ ] Define item types.
* [ ] Define move-granting items.
* [ ] Define resistance/weakness interactions.
* [ ] Add temporary Hive Mode equipment inventory.
* [ ] Add item drops.
* [ ] Add shop purchases.
* [ ] Add item comparison UI.

---

## Roguelike progression

Hive Mode should contain meaningful risk without unnecessarily destroying long-term BugLord progress.

Current intended direction:

* Bug collection persists.

* Permanent account progression persists.

* Hive run-specific items are lost when the run ends.

* Hive run-specific upgrades reset.

* Core bug ownership should not reset.

* [ ] Finalise persistent vs run-specific progression.

* [ ] Define defeat behaviour.

* [ ] Define victory behaviour.

* [ ] Define run rewards.

* [ ] Balance run economy.

* [ ] Balance difficulty curve.

* [ ] Implement run save/resume.

* [ ] Prevent corrupted runs from damaging permanent inventories.

---

# Phase 10 — Economy & Progression

**Objective:** Create an economy that rewards playing BugLord rather than paying to skip BugLord.

### Currency

* [ ] Define currency sources.
* [ ] Define currency sinks.
* [ ] Balance Walk Mode rewards.
* [ ] Balance scanning rewards.
* [ ] Balance Hive Mode rewards.
* [ ] Balance achievements/milestones.
* [ ] Prevent easy duplication exploits.

### Progression

* [ ] Define player progression.
* [ ] Define bug progression.
* [ ] Define level scaling.
* [ ] Review bug stat growth.
* [ ] Review item progression.
* [ ] Avoid excessive grind.
* [ ] Avoid runaway power inflation.

---

# Phase 11 — Monetisation

**Objective:** Introduce optional monetisation without making BugLord pay-to-win.

Monetisation should support development and infrastructure costs while preserving the core experience for free users.

## Rewarded advertisements

Possible rewarded-ad uses:

* Optional bonus coins.
* Additional reward selection.
* Limited reroll.
* Small Hive Mode bonus.
* Optional reward multiplier.
* Other convenience rewards.

Rules:

* [ ] Ads should be optional.
* [ ] Core gameplay must not require watching advertisements.
* [ ] Avoid disruptive forced advertisements.
* [ ] Establish daily reward limits where required.
* [ ] Prevent automated ad-reward exploits.
* [ ] Ensure ad rewards do not destroy game balance.
* [ ] Review ad-network privacy requirements.
* [ ] Review age-rating implications.

---

## Optional purchases

Potential purchases may include:

* Cosmetics.

* UI themes.

* Bug cosmetics.

* Profile customisation.

* Cosmetic Hive effects.

* Supporter bundles.

* Other non-essential content.

* [ ] Avoid directly selling dominant competitive power.

* [ ] Avoid loot-box-style mechanics unless there is a compelling and legally reviewed reason.

* [ ] Define purchase restoration.

* [ ] Validate purchases server-side where necessary.

* [ ] Support Apple purchase requirements.

* [ ] Support Google Play purchase requirements.

* [ ] Test refunds/restoration.

* [ ] Document purchased entitlement state.

---

# Phase 12 — Testing & Quality Assurance

**Objective:** Treat BugLord 2.0 as a production application rather than an academic prototype.

### Automated testing

* [ ] Unit tests.
* [ ] Component tests.
* [ ] Backend API tests.
* [ ] ML pipeline tests.
* [ ] Dataset validation tests.
* [ ] Firestore logic tests.
* [ ] Trading tests.
* [ ] Economy tests.
* [ ] Scan workflow tests.

### Integration testing

* [ ] Authentication → profile.
* [ ] Scan → classification → collection.
* [ ] Walk → rewards.
* [ ] Hive → rewards.
* [ ] Trade → inventory update.
* [ ] Purchase → entitlement.
* [ ] Ad → reward.

### Device testing

Test on:

* [ ] Low-end Android device.
* [ ] Mid-range Android device.
* [ ] High-end Android device.
* [ ] Supported iPhone.
* [ ] Different screen sizes.
* [ ] Different OS versions where practical.

### Failure testing

* [ ] No internet.
* [ ] Slow internet.
* [ ] Backend offline.
* [ ] ML inference failure.
* [ ] Firebase failure.
* [ ] App terminated mid-operation.
* [ ] Duplicate requests.
* [ ] Invalid server response.
* [ ] Low device storage.
* [ ] Permission denied.

---

# Phase 13 — UAT & Beta Readiness

**Objective:** Validate BugLord with real users before treating it as commercially ready.

### Internal testing

* [ ] Complete internal regression pass.
* [ ] Resolve critical bugs.
* [ ] Resolve major gameplay blockers.
* [ ] Verify Android feature parity.
* [ ] Verify iOS feature parity.

### User Acceptance Testing

* [ ] Create new UAT questionnaire.
* [ ] Recruit testers unfamiliar with the project.
* [ ] Recruit returning FYP testers where useful.
* [ ] Observe first-time onboarding.
* [ ] Test scanning outdoors.
* [ ] Test Walk Mode naturally.
* [ ] Test Hive Mode progression.
* [ ] Test collection motivation.
* [ ] Test monetisation perception.
* [ ] Collect usability feedback.
* [ ] Collect bug reports.
* [ ] Prioritise findings.
* [ ] Complete follow-up UAT after major changes.

### Core UAT questions

Determine whether users:

* Understand BugLord quickly.
* Enjoy discovering insects.
* Want to expand their BugDex.
* Understand how bugs become useful in gameplay.
* Find Walk Mode rewarding.
* Want to replay Hive Mode.
* Understand equipment and combat.
* Find monetisation reasonable.
* Encounter confusing or frustrating flows.
* Want to continue playing after the test.

---

# Phase 14 — Security, Privacy & Production Hardening

**Objective:** Prepare BugLord for use outside controlled testing environments.

### Security

* [ ] Review Firebase security rules.
* [ ] Review API authentication requirements.
* [ ] Add rate limiting where appropriate.
* [ ] Validate server-side reward operations.
* [ ] Protect economy-sensitive endpoints.
* [ ] Protect trading operations.
* [ ] Protect purchase verification.
* [ ] Review account enumeration.
* [ ] Review sensitive logging.
* [ ] Review dependency vulnerabilities.

### Privacy

* [ ] Determine exactly what user data is collected.
* [ ] Minimise unnecessary collection.
* [ ] Establish data retention rules.
* [ ] Create privacy policy.
* [ ] Create account deletion workflow.
* [ ] Create user data deletion workflow.
* [ ] Review GDPR obligations.
* [ ] Review image-handling policy.
* [ ] Review analytics configuration.
* [ ] Review ad-network data collection.

---

# Phase 15 — Infrastructure & Deployment

**Objective:** Move from development infrastructure toward infrastructure capable of supporting external users.

### Backend deployment

* [ ] Determine expected inference requirements.
* [ ] Benchmark GPU requirements.
* [ ] Evaluate suitable hosting providers.
* [ ] Estimate cost per scan.
* [ ] Estimate cost per active user.
* [ ] Containerise inference server.
* [ ] Establish production configuration.
* [ ] Establish HTTPS.
* [ ] Establish domain/API endpoint.
* [ ] Establish monitoring.
* [ ] Establish error reporting.
* [ ] Establish backup/recovery procedures.

### Cost controls

Because ML inference creates a real cost per user:

* [ ] Track inference usage.
* [ ] Add reasonable abuse protection.
* [ ] Add rate limits if necessary.
* [ ] Investigate inference batching.
* [ ] Investigate model optimisation.
* [ ] Investigate quantisation where accuracy permits.
* [ ] Evaluate GPU utilisation.
* [ ] Calculate sustainable free-user scanning limits if limits become necessary.

---

# Phase 16 — Release Candidate

**Objective:** Produce the first BugLord build that could reasonably become the public commercial application.

### Required

* [ ] Commercial-safe ML model.
* [ ] Reliable scanning.
* [ ] Stable BugDex.
* [ ] Background-capable Walk Mode.
* [ ] Stable Hive Mode 2.0.
* [ ] Stable inventory.
* [ ] Stable trading.
* [ ] Android/iOS parity for core features.
* [ ] Production-ready authentication.
* [ ] Production-ready backend.
* [ ] New UI implemented.
* [ ] No known critical security issues.
* [ ] No known critical data-loss issues.
* [ ] UAT completed.
* [ ] Major UAT findings addressed.
* [ ] Analytics/error monitoring available.
* [ ] Privacy requirements addressed.
* [ ] Monetisation tested without compromising gameplay.

### Release Candidate Definition of Done

BugLord 2.0 reaches **Release Candidate** status when:

1. A new user can install the app and understand its core gameplay without developer assistance.
2. A user can scan a real insect and reliably receive a useful result.
3. A successful discovery enters the BugDex correctly.
4. Walk Mode progression functions under normal mobile usage.
5. Hive Mode provides a complete repeatable gameplay loop.
6. Inventory and trading preserve data integrity.
7. The app works reliably on supported Android and iOS devices.
8. Backend failures do not corrupt player data.
9. Monetisation remains optional.
10. Critical and high-severity defects have been resolved.
11. User testing indicates the product is enjoyable and understandable.
12. The application can be migrated onto production infrastructure.

---

# 4. Post-BugLord 2.0

The following features are deliberately excluded from the initial BugLord 2.0 scope unless development priorities change.

## Multiplayer Battles

Real-time or asynchronous player-vs-player battles are planned for a later milestone.

Potential future work:

* Matchmaking.
* Friends battles.
* Ranked battles.
* Casual battles.
* Competitive seasons.
* Leaderboards.
* Server-authoritative combat.
* Anti-cheat systems.
* PvP balancing.

Multiplayer should only be introduced after the core combat system has proven enjoyable and stable in Hive Mode.

---

## Other Future Possibilities

Potential future expansions include:

* Seasonal insects.
* Seasonal Hive Mode content.
* Limited events.
* Community challenges.
* Collector achievements.
* Regional collections.
* Advanced social profiles.
* Clubs/guilds.
* Friend activity feeds.
* Cooperative challenges.
* Rare encounter events.
* Trading marketplace improvements.
* Expanded cosmetics.
* New equipment sets.
* New Hive biomes.
* Boss insects.
* Field research challenges.

These ideas should not delay BugLord 2.0.

---

# 5. Current Development Priority

The current order of work should be:

**1. Repository/Foundation**

↓

**2. Commercial Dataset**

↓

**3. BugLord ML Model**

↓

**4. Inference Backend**

↓

**5. Scanning Integration**

↓

**6. Core Reliability**

↓

**7. Walk Mode**

↓

**8. UI Redesign**

↓

**9. BugDex Expansion**

↓

**10. Hive Mode 2.0**

↓

**11. Economy**

↓

**12. Monetisation**

↓

**13. Testing/UAT**

↓

**14. Security & Production Infrastructure**

↓

**15. Release Candidate**

This ordering is intentional. Visual redesign and major gameplay expansion should not interrupt the work required to replace the ML system and stabilise BugLord's underlying architecture.

---

# 6. Immediate Next Milestone

The immediate focus is the **BugLord commercial classification pipeline**.

### Next tasks

* [x] Restore/create `docs/ml/BUGLORD_ML_V2_SPEC.md`.
* [x] Restore/create `training/schemas/commercial_dataset_manifest.schema.json`.
* [x] Implement dataset manifest validation.
* [x] Add manifest validator tests.
* [x] Identify commercially compatible insect datasets.
* [x] Establish the first dataset version.
* [x] Establish the baseline training experiment.
* [x] [REVIEW] Finalise BugDex taxonomy v0.1.
* [ ] [REVIEW] Complete BIOSCAN-5M commercial rights review.
* [ ] Train and evaluate the first BugLord-owned classifier.

Development should remain focused on this milestone before beginning unrelated BugLord 2.0 feature work.

---

# 7. Roadmap Maintenance

This roadmap is a living document.

When work is completed:

* Mark the corresponding task as complete.
* Add newly discovered required work to the appropriate phase.
* Avoid adding speculative features to the active development path.
* Move non-essential ideas into the post-2.0 section.
* Update completion criteria when architecture decisions materially change.
* Prefer GitHub issues for detailed implementation discussions.
* Keep this roadmap focused on project-level progress and dependencies.

The roadmap should answer one question at any point during development:

> **What is the most important thing BugLord needs next to move closer to release?**
