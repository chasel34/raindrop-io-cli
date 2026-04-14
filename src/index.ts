#!/usr/bin/env node

import { createCli } from "./cli.js";

const program = createCli();

await program.parseAsync(process.argv);
