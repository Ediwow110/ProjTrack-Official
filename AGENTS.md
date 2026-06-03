# Project OpenCode Tool Policy

This project uses OpenCode with Superpowers, Context7, Playwright MCP, and Ralph Loop.

## Required Behavior

The agent must automatically route tasks to the correct tools without requiring the user to manually name a plugin.

## Project Routing

Use Superpowers for:

- implementation planning
- code review
- refactoring
- debugging
- test-first development
- risky changes
- multi-step tasks

Use Context7 for:

- framework documentation
- package APIs
- dependency configuration
- installation questions
- current library behavior

Use Playwright MCP for:

- frontend verification
- browser bugs
- login/navigation/dashboard/form testing
- visual or interaction checks

Use Ralph Loop only when:

- the task has clear acceptance criteria
- tests or verification can prove progress
- the task benefits from iterative autonomous execution
- safety limits are clear

## Project Definition of Done

A code task is not done unless:

- relevant documentation was checked when external APIs were involved
- tests or validation commands were run when code changed
- browser verification was performed when UI behavior changed
- changed files are listed
- risks and unverified assumptions are stated
