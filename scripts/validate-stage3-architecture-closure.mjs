import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(projectRoot, 'src')
const closureRoots = Object.freeze([
  'demo',
  'production',
  'artifacts',
  'runtime',
  'runtimeData',
])

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath)
      }
      return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : []
    }),
  )
  return files.flat()
}

function toProjectPath(filePath) {
  return relative(projectRoot, filePath).replaceAll('\\', '/')
}

async function resolveImport(importer, specifier) {
  if (!specifier.startsWith('.')) {
    return undefined
  }

  const base = resolve(dirname(importer), specifier)
  const candidates = extname(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        resolve(base, 'index.ts'),
        resolve(base, 'index.tsx'),
      ]

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) {
        return candidate
      }
    } catch {
      // Continue until a supported TypeScript module is found.
    }
  }
  return undefined
}

function extractImportSpecifiers(sourceText) {
  const specifiers = []
  const pattern =
    /(?:import|export)\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
  for (const match of sourceText.matchAll(pattern)) {
    if (match[1] === undefined) {
      specifiers.push(match[2])
    }
  }
  return specifiers
}

function assertNoCycles(graph) {
  const visited = new Set()
  const active = new Set()
  const stack = []

  function visit(modulePath) {
    if (active.has(modulePath)) {
      const cycleStart = stack.indexOf(modulePath)
      const cycle = [...stack.slice(cycleStart), modulePath]
      assert.fail(
        `Circular dependency: ${cycle.map(toProjectPath).join(' -> ')}`,
      )
    }
    if (visited.has(modulePath)) {
      return
    }

    active.add(modulePath)
    stack.push(modulePath)
    for (const dependency of graph.get(modulePath) ?? []) {
      visit(dependency)
    }
    stack.pop()
    active.delete(modulePath)
    visited.add(modulePath)
  }

  for (const modulePath of graph.keys()) {
    visit(modulePath)
  }
}

function assertForbiddenImportsAbsent(imports) {
  const rules = Object.freeze([
    {
      owner: /^src\/demo\/customerExperience\//,
      forbidden:
        /^src\/(?:production|artifacts|runtime|runtimeData|providers)\//,
    },
    {
      owner:
        /^src\/demo\/(?:productionRuntimeDemo|productionIntelligence|commercialDemo|commercialExecution|commercialIntelligence)\//,
      forbidden:
        /^src\/(?:production|artifacts|runtime|runtimeData|providers)\//,
    },
    {
      owner: /^src\/demo\/monetization\//,
      forbidden:
        /^src\/(?:production|artifacts|runtime|runtimeData|providers)\//,
    },
    {
      owner: /^src\/demo\/productionAdapter\//,
      forbidden:
        /^src\/(?:production|artifacts|runtime|runtimeData|providers)\//,
    },
    {
      owner: /^src\/production\//,
      forbidden: /^src\/(?:demo|runtime|runtimeData)\//,
    },
    {
      owner: /^src\/artifacts\//,
      forbidden: /^src\/(?:demo|runtime|runtimeData)\//,
    },
    {
      owner: /^src\/(?:runtime|runtimeData)\//,
      forbidden: /^src\/(?:demo|production|providers)\//,
    },
  ])

  for (const dependency of imports) {
    for (const rule of rules) {
      if (
        rule.owner.test(dependency.importer) &&
        rule.forbidden.test(dependency.imported)
      ) {
        assert.fail(
          `Forbidden import: ${dependency.importer} -> ${dependency.imported}`,
        )
      }
    }
  }
}

function countDeclarations(sourceText, pattern) {
  return [...sourceText.matchAll(pattern)].length
}

const sourceFiles = (
  await Promise.all(
    closureRoots.map((root) => collectSourceFiles(resolve(sourceRoot, root))),
  )
).flat()
const sourceFileSet = new Set(sourceFiles)
const sourceEntries = await Promise.all(
  sourceFiles.map(async (filePath) => ({
    filePath,
    sourceText: await readFile(filePath, 'utf8'),
  })),
)
const graph = new Map(sourceFiles.map((filePath) => [filePath, []]))
const imports = []

for (const entry of sourceEntries) {
  for (const specifier of extractImportSpecifiers(entry.sourceText)) {
    const importedFile = await resolveImport(entry.filePath, specifier)
    if (importedFile === undefined || !sourceFileSet.has(importedFile)) {
      continue
    }
    graph.get(entry.filePath).push(importedFile)
    imports.push(
      Object.freeze({
        importer: toProjectPath(entry.filePath),
        imported: toProjectPath(importedFile),
      }),
    )
  }
}

assertNoCycles(graph)
assertForbiddenImportsAbsent(imports)

const sourceByPath = new Map(
  sourceEntries.map((entry) => [toProjectPath(entry.filePath), entry.sourceText]),
)
const customerExperienceService =
  sourceByPath.get(
    'src/demo/customerExperience/service/createCustomerDemoExperienceService.ts',
  ) ?? ''
assert.match(customerExperienceService, /commercialIntelligence/)
assert.match(customerExperienceService, /monetization/)

const productionAdapterSources = sourceEntries
  .filter((entry) =>
    toProjectPath(entry.filePath).startsWith('src/demo/productionAdapter/'),
  )
  .map((entry) => entry.sourceText)
  .join('\n')
for (const forbiddenSymbol of [
  'ArtifactEnvelope',
  'ArtifactRuntimeReference',
  'RuntimeDataV2',
  'RuntimeContext',
  'VideoProvider',
]) {
  assert.equal(
    productionAdapterSources.includes(forbiddenSymbol),
    false,
    `Production Adapter must remain isolated from ${forbiddenSymbol}`,
  )
}

const demoSources = sourceEntries
  .filter((entry) => toProjectPath(entry.filePath).startsWith('src/demo/'))
  .map((entry) => entry.sourceText)
  .join('\n')
const canonicalOwners = Object.freeze([
  ['Template Registry', /\bconst\s+demoTemplateRegistry\b/g],
  ['Scenario Registry', /\bconst\s+demoScenarioRegistry\b/g],
  ['Workflow Registry', /\bconst\s+productionWorkflowRegistry\b/g],
  ['Simulation Registry', /\bconst\s+demoExecutionRegistry\b/g],
])
for (const [label, pattern] of canonicalOwners) {
  assert.equal(
    countDeclarations(demoSources, pattern),
    1,
    `${label} must have exactly one canonical owner`,
  )
}
assert.equal(
  countDeclarations(
    demoSources,
    /\bfunction\s+createScenarioFromTemplate\b/g,
  ),
  1,
  'Scenario Builder must have exactly one canonical implementation',
)
assert.equal(
  countDeclarations(
    demoSources,
    /\bfunction\s+createCommercialDemoExecutionSimulator\b/g,
  ),
  1,
  'Execution Simulator must have exactly one canonical implementation',
)
assert.equal(
  countDeclarations(demoSources, /\b(?:class|function)\s+\w*SimulationEngine\b/g),
  0,
  'A second Simulation Engine is forbidden',
)

console.log('Stage3 Architecture Closure Validation')
console.log('1. Layer Direction: PASS')
console.log('2. No Circular Dependency: PASS')
console.log('3. No Forbidden Imports: PASS')
console.log('4. Runtime Isolation: PASS')
console.log('5. Single Registry Ownership: PASS')
console.log('6. No Duplicate Simulation Engine: PASS')
