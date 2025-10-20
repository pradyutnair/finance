#!/usr/bin/env ts-node

/**
 * Script to convert institution_id_mapping.json to TypeScript format
 * Usage: npx ts-node scripts/convert-bank-mapping.ts
 */

const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

function convertJsonToTs() {
  try {
    // Read the JSON file
    const jsonPath = join(__dirname, '../lib/institution_id_mapping.json')
    let jsonContent = readFileSync(jsonPath, 'utf-8')

    // Fix the invalid NaN value in the JSON
    jsonContent = jsonContent.replace(/"NaN": NaN/g, '"NaN": null')

    const parsedJson = JSON.parse(jsonContent)

    // Convert to TypeScript format
    let tsContent = `// Auto-generated institution mappings
// Generated on: ${new Date().toISOString()}

export const institutionIdMapping: Record<string, string> = {
`

    // Sort the entries for better readability
    const sortedEntries = Object.entries(parsedJson)
      .filter(([key, value]) => typeof value === 'string') // Only keep string values
      .sort(([a], [b]) => a.localeCompare(b))

    // Add each mapping
    for (const [key, value] of sortedEntries) {
      // Escape quotes in both key and value
      const escapedKey = key.replace(/"/g, '\\"')
      const escapedValue = (value as string).replace(/"/g, '\\"')
      tsContent += `  "${escapedKey}": "${escapedValue}",\n`
    }

    tsContent += `}

export default institutionIdMapping
`

    // Write the TypeScript file
    const tsPath = join(__dirname, '../lib/institution-id-mapping.ts')
    writeFileSync(tsPath, tsContent, 'utf-8')

    console.log(`✅ Successfully converted ${sortedEntries.length} mappings`)
    console.log(`📄 TypeScript file saved to: ${tsPath}`)
    console.log('\nTo use the full mapping, update lib/bank-name-mapping.ts to:')
    console.log('import { institutionIdMapping } from "./institution-id-mapping"')

  } catch (error) {
    console.error('❌ Error converting mapping:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  convertJsonToTs()
}