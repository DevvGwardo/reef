#!/usr/bin/env node
// Alias so `npx reefsh@<v> <args>` works without the -p flag. npx without -p
// looks for an executable matching the package name (reefsh), not the bin
// name (reef), so users who type the natural form hit "could not determine
// executable to run". This shim resolves that — `npx reefsh new ...` and
// `npx -p reefsh reef new ...` both end up at the same CLI entry.
import { main, runMain } from "../src/cli.js"
runMain(main)
