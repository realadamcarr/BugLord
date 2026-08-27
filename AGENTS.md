# BugLord Agent Rules

## Repository

BugLord is a React Native / Expo application with backend and
machine-learning components.

## Development Rules

- Never modify main directly.
- Work only on the current agent branch.
- Inspect existing code before implementing.
- Do not invent missing source-of-truth specifications.
- Prefer existing architecture and conventions.
- Add tests for meaningful functionality.
- Run relevant tests before declaring work complete.
- Run lint/typecheck where applicable.
- Never delete tests simply to make a build pass.
- Never expose secrets or credentials.

## Autonomous Decisions

The agent may independently decide:

- implementation details
- variable/function names
- file organisation within existing architecture
- refactors that preserve behaviour
- tests
- bug fixes
- minor dependency-compatible changes

## Requires User Approval

Stop and request user input before:

- changing product behaviour
- changing major architecture
- changing BugDex taxonomy
- deleting significant functionality
- changing database schemas incompatibly
- deploying production systems
- changing Firebase production configuration
- spending money
- purchasing cloud resources
- deleting datasets
- changing ML model objectives
- merging into main
- handling ambiguous product requirements

## Definition of Done

A task is complete when:

1. implementation is complete
2. appropriate tests pass
3. lint/typecheck passes where relevant
4. git diff has been reviewed
5. documentation is updated if necessary