#!/usr/bin/env node
// Copy the Vite build into demo/ so the static gallery can serve it without a
// server. dist/ stays git-ignored; demo/ is the published artifact.
import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("demo", { recursive: true, force: true });
mkdirSync("demo", { recursive: true });
cpSync("dist", "demo", { recursive: true });
console.log("copied dist/ -> demo/");
